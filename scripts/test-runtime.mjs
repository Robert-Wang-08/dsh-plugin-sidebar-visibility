/**
 * 运行中标识与 badge 展示桥的契约测试（不启动浏览器，不依赖构建产物）。
 *
 * 纯模块用 Node 24 内置 type stripping 直接导入 .ts，测试不依赖 typescript 包
 * （本仓库 node_modules 可能是悬空 junction，跨设备也不该为跑测试先装依赖）。
 *
 * 覆盖：
 * - 运行区间观测纯函数（下限语义、停止重启、时钟回拨、幂等）；
 * - 分钟文案；
 * - 共享节拍末位释放；
 * - `readBridge` 的缺失/版本不符降级；
 * - 跨插件真实契约：直接执行 `dsh-plugin-provider-badge/client.js` 的 classic
 *   script，用官方 ModelDirectoryState 形状断言 `presentationOf` 的颜色、字色、
 *   徽标文字、模型名，以及用户自选色优先。
 *
 * 运行：node scripts/test-runtime.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import * as timer from '../src/client/runtime-timer.ts'
import * as bridge from '../src/client/runtime-bridge.ts'

let passed = 0
function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log('  ok  ' + name)
  } catch (error) {
    console.error('  FAIL ' + name)
    console.error(error instanceof Error ? error.stack : error)
    process.exitCode = 1
  }
}

// ---- 运行区间观测 ----------------------------------------------------------

check('挂载时已在运行 → 下限标记，文案 ≥Nm', () => {
  const observation = timer.initialObservation(1_000_000, true)
  assert.equal(observation.startedAt, 1_000_000)
  assert.equal(observation.lowerBound, true)
  assert.equal(timer.formatElapsed(timer.elapsedOf(observation, 1_000_000 + 5 * 60_000), true), '≥5m')
  assert.equal(timer.formatElapsed(timer.elapsedOf(observation, 1_000_000 + 20_000), true), '≥1m')
})

check('挂载时未运行 → 无起点、无文案', () => {
  const observation = timer.initialObservation(1_000_000, false)
  assert.equal(observation.startedAt, null)
  assert.equal(observation.lowerBound, false)
  assert.equal(timer.elapsedOf(observation, 1_000_000 + 90_000), null)
  assert.equal(timer.formatElapsed(null, false), '')
})

check('观察到的 false→true 记录精确起点', () => {
  const idle = timer.initialObservation(1_000_000, false)
  const started = timer.stepObservation(idle, true, 1_030_000)
  assert.equal(started.startedAt, 1_030_000)
  assert.equal(started.lowerBound, false)
  assert.equal(timer.formatElapsed(timer.elapsedOf(started, 1_030_000 + 59_999), false), '<1m')
  assert.equal(timer.formatElapsed(timer.elapsedOf(started, 1_030_000 + 60_000), false), '1m')
  assert.equal(timer.formatElapsed(timer.elapsedOf(started, 1_030_000 + 3_600_000), false), '60m')
})

check('停止清除起点，再次运行为新起点', () => {
  const started = timer.stepObservation(timer.initialObservation(0, false), true, 10_000)
  const stopped = timer.stepObservation(started, false, 70_000)
  assert.equal(stopped.startedAt, null)
  assert.equal(stopped.lowerBound, false)
  const restarted = timer.stepObservation(stopped, true, 100_000)
  assert.equal(restarted.startedAt, 100_000)
  assert.equal(restarted.lowerBound, false)
})

check('同一 running 状态不改写起点（幂等、返回同一对象）', () => {
  const started = timer.stepObservation(timer.initialObservation(0, false), true, 10_000)
  assert.equal(timer.stepObservation(started, true, 999_000), started)
  const idle = timer.initialObservation(0, false)
  assert.equal(timer.stepObservation(idle, false, 999_000), idle)
})

check('时钟回拨不产生负数运行时间', () => {
  const started = timer.stepObservation(timer.initialObservation(0, false), true, 10_000)
  assert.equal(timer.elapsedOf(started, 5_000), 0)
})

check('共享节拍末位订阅者释放后清除定时器', () => {
  const stopA = timer.subscribeRuntimeTick(() => {})
  const stopB = timer.subscribeRuntimeTick(() => {})
  assert.equal(timer.runtimeTickListenerCount(), 2)
  stopA()
  assert.equal(timer.runtimeTickListenerCount(), 1)
  stopB()
  assert.equal(timer.runtimeTickListenerCount(), 0)
})

// ---- badge 展示桥 ----------------------------------------------------------

check('无 window 时 readBridge 返回 null（badge 未装/未加载）', () => {
  delete globalThis.window
  assert.equal(bridge.readBridge(), null)
})

check('版本不符的桥被忽略', () => {
  globalThis.window = {
    addEventListener() {}, removeEventListener() {},
    __DSH_PROVIDER_BADGE__: { version: 2, presentationFor: () => ({}) },
  }
  assert.equal(bridge.readBridge(), null)
  delete globalThis.window
})

check('版本相符的桥被采用', () => {
  const handle = { getSnapshot: () => null, subscribe: () => () => {} }
  globalThis.window = {
    addEventListener() {}, removeEventListener() {},
    __DSH_PROVIDER_BADGE__: { version: 1, presentationFor: () => handle },
  }
  assert.equal(bridge.readBridge(), globalThis.window.__DSH_PROVIDER_BADGE__)
  delete globalThis.window
})

// ---- 与 badge 的真实跨插件契约 ---------------------------------------------

/** 以 classic-script 方式加载 badge 客户端半，拿到 factory 的导出面。 */
function loadBadge() {
  const source = readFileSync(new URL('../../dsh-plugin-provider-badge/client.js', import.meta.url), 'utf8')
  const captured = []
  globalThis.window = {
    __ModuleLoader__: { load: (registration) => captured.push(registration) },
  }
  // badge 的浏览器半只从平台种子表拿 react；Node 侧按需给最小桩（不渲染组件）。
  const reactStub = {
    createElement: () => null,
    Fragment: 'Fragment',
    useSyncExternalStore: () => null,
    useMemo: (fn) => fn(),
    useEffect: () => {},
    useCallback: (fn) => fn,
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: (value) => ({ current: value ?? null }),
  }
  const badgeRequire = (spec) => {
    if (spec === 'react') return reactStub
    throw new Error('unexpected require from badge client: ' + spec)
  }
  try {
    new Function('window', 'require', source)(globalThis.window, badgeRequire)
  } finally {
    delete globalThis.window
  }
  assert.equal(captured.length, 1, 'badge client 应只注册一次')
  assert.equal(captured[0].id, 'dsh-plugin-provider-badge')
  return captured[0].factory(badgeRequire)
}

function fakeContext(state) {
  const store = { getSnapshot: () => state, subscribe: () => () => {} }
  const directory = { store, load: async () => state, select: async () => ({ ok: true, value: undefined }) }
  return {
    get: (name) => {
      if (name === 'sessions') return { subagentAddress: () => undefined }
      if (name === 'modelDirectories') return { directoryFor: () => directory }
      return undefined
    },
  }
}

const badge = loadBadge()

check('badge 导出只读展示桥，协议名与版本与侧栏一致', () => {
  assert.equal(typeof badge.__test.presentationOf, 'function')
  assert.equal(badge.__test.BRIDGE_GLOBAL, bridge.BRIDGE_GLOBAL)
  assert.equal(badge.__test.BRIDGE_VERSION, bridge.BRIDGE_VERSION)
  assert.equal(badge.__test.BRIDGE_EVENT, bridge.BRIDGE_EVENT)
})

check('桥输出与徽标同源：默认色、字色、文字、模型名', () => {
  const state = {
    current: { provider: 'codex-relay', model: 'gpt-6.1-sol' },
    groups: [{
      id: 'codex-relay',
      name: 'GPT Relay',
      models: [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }],
    }],
    status: 'ready',
  }
  const handle = badge.__test.presentationOf(fakeContext(state), 'session-a')
  assert.notEqual(handle, null)
  const snapshot = handle.getSnapshot()
  assert.equal(snapshot.color, '#2F6FEB')
  assert.equal(snapshot.text, 'a1gpt')
  assert.equal(snapshot.providerId, 'codex-relay')
  assert.equal(snapshot.providerName, 'GPT Relay')
  assert.equal(snapshot.modelId, 'gpt-6.1-sol')
  assert.equal(snapshot.modelName, 'GPT-6.1 Sol')
  assert.match(snapshot.ink, /^#[0-9A-Fa-f]{3,6}$/)
})

check('用户自选色优先于默认色表', () => {
  const state = {
    current: { provider: 'codex-relay', model: 'gpt-6.1-sol' },
    groups: [{ id: 'codex-relay', name: 'GPT Relay', models: [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }] }],
    status: 'ready',
  }
  const values = new Map([['dsh-plugin-provider-badge:colors', JSON.stringify({ 'codex-relay': '#123456' })]])
  globalThis.localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
  }
  try {
    const snapshot = badge.__test.presentationOf(fakeContext(state), 'session-b').getSnapshot()
    assert.equal(snapshot.color, '#123456')
  } finally {
    delete globalThis.localStorage
  }
})

check('subagent 转址会话与无当前选择 → null（中性降级）', () => {
  const subagentCtx = {
    get: (name) => {
      if (name === 'sessions') return { subagentAddress: () => ({ sessionId: 'parent' }) }
      return undefined
    },
  }
  assert.equal(badge.__test.presentationOf(subagentCtx, 'session-c'), null)
  // 目录可用但尚无选择：句柄在、快照为 null（选择出现后无需重取桥）。
  const emptyState = { current: null, groups: [], status: 'ready' }
  const emptyHandle = badge.__test.presentationOf(fakeContext(emptyState), 'session-d')
  assert.notEqual(emptyHandle, null)
  assert.equal(emptyHandle.getSnapshot(), null)
})

check('snapshot 在状态未变时保持同一对象（uSES 安全）', () => {
  const state = {
    current: { provider: 'codex-relay', model: 'gpt-6.1-sol' },
    groups: [{ id: 'codex-relay', name: 'GPT Relay', models: [{ id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol' }] }],
    status: 'ready',
  }
  const handle = badge.__test.presentationOf(fakeContext(state), 'session-e')
  assert.equal(handle.getSnapshot(), handle.getSnapshot())
})

check('badge 纯色表：未驻留会话也能取到与徽标相同的颜色', () => {
  const shown = badge.__test.colorPresentationFor('codex-relay', [])
  assert.equal(shown.color, '#2F6FEB')
  assert.equal(shown.text, 'a1gpt')
  assert.match(shown.ink, /^#[0-9A-Fa-f]{3,6}$/)
})

check('badge 纯色表尊重用户自选色', () => {
  const values = new Map([['dsh-plugin-provider-badge:colors', JSON.stringify({ 'codex-relay': '#0A0B0C' })]])
  globalThis.localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
  }
  try {
    assert.equal(badge.__test.colorPresentationFor('codex-relay', []).color, '#0A0B0C')
  } finally {
    delete globalThis.localStorage
  }
})

check('badge 纯色表对未入表 provider 稳定（同一集合两次一致）', () => {
  const a = badge.__test.colorPresentationFor('some-provider', ['codex-relay', 'some-provider'])
  const b = badge.__test.colorPresentationFor('some-provider', ['codex-relay', 'some-provider'])
  assert.equal(a.color, b.color)
  assert.equal(a.text, b.text)
})

check('withSelection：目录缺失时用投影 provider + 纯色表补色', () => {
  const colorFor = (provider) => badge.__test.colorPresentationFor(provider, [])
  const composed = bridge.withSelection(null, { provider: 'codex-relay', model: 'gpt-6.1-sol' }, colorFor)
  assert.notEqual(composed, null)
  assert.equal(composed.color, '#2F6FEB')
  assert.equal(composed.text, 'a1gpt')
  assert.equal(composed.modelId, 'gpt-6.1-sol')
})

check('withSelection：有目录快照时优先目录结果，并补齐模型 id', () => {
  const base = { color: '#111111', ink: '#ffffff', text: 'abcd', providerId: 'codex-relay', providerName: 'GPT Relay', modelId: '', modelName: '' }
  const composed = bridge.withSelection(base, { provider: 'codex-relay', model: 'gpt-6.1-sol' }, undefined)
  assert.equal(composed.color, '#111111')
  assert.equal(composed.modelId, 'gpt-6.1-sol')
  assert.equal(composed.modelName, 'gpt-6.1-sol')
})

check('withSelection：既无目录又无纯色表 → null（中性降级）', () => {
  assert.equal(bridge.withSelection(null, { provider: 'codex-relay' }, undefined), null)
  assert.equal(bridge.withSelection(null, null, (provider) => badge.__test.colorPresentationFor(provider, [])), null)
})

console.log('\n' + passed + ' checks passed' + (process.exitCode === 1 ? ', some FAILED' : ''))
