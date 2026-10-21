/**
 * 构建产物冒烟测试（不启动浏览器）。
 *
 * 直接以 classic-script 语义执行 `lib/client.js`，用最小桩验证：
 * - 单次 `__ModuleLoader__.load` 注册、id 与 package.json 一致；
 * - `apply(ctx)` 能完成 slot 注入与席位注册（含 sidebar.workspaces / footer /
 *   provider card 两种命名空间），不抛错；
 * - 导出的 inject 服务清单仍包含本插件依赖。
 *
 * 渲染细节（DOM 结构、CSS）由 scripts/test-runtime.mjs 与人工视觉验收覆盖；
 * 本脚本只保证「产物能装载、apply 能跑通」这条线上契约。
 *
 * 运行：node scripts/test-bundle.mjs（需先 pnpm run bundle）
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const libPath = fileURLToPath(new URL('../lib/client.js', import.meta.url))
if (!existsSync(libPath)) {
  console.error('lib/client.js 不存在：先跑 pnpm run bundle')
  process.exit(1)
}

const source = readFileSync(libPath, 'utf8')
const captured = []
const fakeWindow = { __ModuleLoader__: { load: (registration) => captured.push(registration) } }

const reactStub = {
  createElement: () => null,
  Fragment: 'Fragment',
  useSyncExternalStore: () => null,
  useMemo: (fn) => fn(),
  useEffect: () => {},
  useCallback: (fn) => fn,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (value) => ({ current: value ?? null }),
  useReducer: (reducer, initial) => [initial, () => {}],
}
const fakeRequire = (spec) => {
  if (spec === 'react') return reactStub
  throw new Error('unexpected require from client bundle: ' + spec)
}

new Function('window', 'require', source)(fakeWindow, fakeRequire)

assert.equal(captured.length, 1, 'client.js 应只注册一次模块')
assert.equal(captured[0].id, '@local/dsh-plugin-sidebar-visibility')

const mod = captured[0].factory(fakeRequire)
assert.equal(typeof mod.apply, 'function', '缺少 apply')
assert.ok(Array.isArray(mod.inject), '缺少 inject 清单')
for (const service of ['slots', 'uiWorkspace', 'sessions', 'workspaces']) {
  assert.ok(mod.inject.includes(service), 'inject 缺少 ' + service)
}

const registrations = []
const disposers = []
const fakeCtx = {
  slots: {
    inject: (seat, factory) => {
      const dispose = factory()
      disposers.push(dispose)
      return dispose
    },
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
  get: () => undefined,
  on: () => () => {},
  effect: () => () => {},
}

mod.apply(fakeCtx)

const seats = registrations.map((r) => r.options.name)
assert.ok(seats.includes('sidebar.workspaces'), '未注册 sidebar.workspaces')
assert.ok(seats.includes('sidebar.footer.action'), '未注册 sidebar.footer.action')
assert.ok(
  registrations.some((r) => String(r.options.name).startsWith('settings.models.provider-card')),
  '未注册 provider card 席位',
)
assert.ok(
  typeof registrations[0].component === 'function' || typeof registrations[0].component === 'object',
  '席位组件应为 React 组件',
)

// 卸载路径：所有 disposer 都应可调用且不抛错。
for (const dispose of disposers) if (typeof dispose === 'function') dispose()

console.log('PASS: bundle smoke (' + registrations.length + ' seats: ' + seats.join(', ') + ')')
