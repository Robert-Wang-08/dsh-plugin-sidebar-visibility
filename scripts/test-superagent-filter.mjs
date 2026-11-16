#!/usr/bin/env node
/**
 * superagent-filter 纯函数单测。
 *
 * 运行方式：node scripts/test-superagent-filter.mjs（Node ≥ 24 内置 type stripping，
 * 直接 import .ts 源文件，不需要 typescript / tsdown / 任何依赖）。
 *
 * 覆盖：Windows 反斜杠与大小写、POSIX 路径、work 目录边界（workspace 不误判）、
 * worker 会话 id 前缀、会话 / 路径两路判定。
 */
import assert from 'node:assert/strict'
import {
  filterPickerWorkspaces,
  isSuperagentTaskSession,
  isSuperagentWorkPath,
  isWorkerSessionId,
} from '../src/client/superagent-filter.ts'

let passed = 0
const failures = []
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log('ok  -', name)
  } catch (error) {
    failures.push(name)
    console.error('FAIL -', name)
    console.error('      ', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

// ---- isSuperagentWorkPath --------------------------------------------------

test('work 路径：Windows 反斜杠 + 盘符 + 用户名', () => {
  assert.equal(isSuperagentWorkPath('C:\\Users\\wwm_1\\.dsh\\state\\superagent\\work\\ticket-a'), true)
})
test('work 路径：POSIX 正斜杠', () => {
  assert.equal(isSuperagentWorkPath('/home/u/.dsh/state/superagent/work/ticket-a'), true)
})
test('work 路径：大小写不敏感', () => {
  assert.equal(isSuperagentWorkPath('C:\\Users\\u\\.DSH\\State\\SuperAgent\\Work\\x'), true)
})
test('work 路径：恰好落在 work 目录本身也算', () => {
  assert.equal(isSuperagentWorkPath('C:\\Users\\u\\.dsh\\state\\superagent\\work'), true)
  assert.equal(isSuperagentWorkPath('/u/.dsh/state/superagent/work/'), true)
})
test('work 路径：目录段边界，不误判 workspace', () => {
  assert.equal(isSuperagentWorkPath('/u/.dsh/state/superagent/workspace/ticket-a'), false)
  assert.equal(isSuperagentWorkPath('/u/.dsh/state/superagent/worklogs/x'), false)
})
test('work 路径：普通项目目录 / 其他 superagent 路径不算', () => {
  assert.equal(isSuperagentWorkPath('D:\\src\\dsh'), false)
  assert.equal(isSuperagentWorkPath('/u/.dsh/state/superagent/receipts/x'), false)
})
test('work 路径：空值不算', () => {
  assert.equal(isSuperagentWorkPath(undefined), false)
  assert.equal(isSuperagentWorkPath(''), false)
})

// ---- isWorkerSessionId -----------------------------------------------------

test('worker 会话 id：worker- 前缀', () => {
  assert.equal(isWorkerSessionId('worker-7947db19d965'), true)
})
test('worker 会话 id：大小写不敏感', () => {
  assert.equal(isWorkerSessionId('Worker-Abc'), true)
})
test('worker 会话 id：普通会话不算', () => {
  assert.equal(isWorkerSessionId('session-abc'), false)
  assert.equal(isWorkerSessionId('worker'), false)
  assert.equal(isWorkerSessionId('my-worker-abc'), false)
})

// ---- isSuperagentTaskSession ----------------------------------------------

test('任务会话：worker 前缀命中', () => {
  assert.equal(isSuperagentTaskSession({ id: 'worker-t1', cwd: 'D:\\src\\dsh' }), true)
})
test('任务会话：cwd 落在 work 目录命中', () => {
  assert.equal(
    isSuperagentTaskSession({ id: 'session-x', cwd: 'C:\\Users\\u\\.dsh\\state\\superagent\\work\\t1' }),
    true,
  )
})
test('任务会话：普通会话不命中', () => {
  assert.equal(isSuperagentTaskSession({ id: 'session-x', cwd: 'D:\\src\\dsh' }), false)
  assert.equal(isSuperagentTaskSession({ id: 'session-x' }), false)
})

// ---- filterPickerWorkspaces ------------------------------------------------

const pickerItems = [
  { workspaceId: 'w-dsh', title: 'dsh', path: 'D:\\src\\dsh' },
  { workspaceId: 'w-task', title: 'resume-session-filter', path: 'C:\\Users\\u\\.dsh\\state\\superagent\\work\\t1' },
  { workspaceId: 'w-posix', title: 'posix', path: '/home/u/.dsh/state/superagent/work/t2' },
  { workspaceId: 'w-ncbs', title: 'ncbs', path: 'D:\\src\\ncbs' },
]

test('选择器过滤：hide=true 剔除 superagent 任务工作区，保留其余顺序', () => {
  const out = filterPickerWorkspaces(pickerItems, true)
  assert.deepEqual(out.map((x) => x.workspaceId), ['w-dsh', 'w-ncbs'])
})

test('选择器过滤：hide=false 原样返回（新数组，不共享引用）', () => {
  const out = filterPickerWorkspaces(pickerItems, false)
  assert.deepEqual(out.map((x) => x.workspaceId), pickerItems.map((x) => x.workspaceId))
  assert.notEqual(out, pickerItems)
})

test('选择器过滤：空列表与无 path 项安全', () => {
  assert.deepEqual(filterPickerWorkspaces([], true), [])
  const noPath = [{ workspaceId: 'w-x' }]
  assert.deepEqual(filterPickerWorkspaces(noPath, true), noPath)
})

console.log('\n' + passed + ' passed, ' + failures.length + ' failed')
if (failures.length > 0) {
  console.error('failures: ' + failures.join(', '))
}
