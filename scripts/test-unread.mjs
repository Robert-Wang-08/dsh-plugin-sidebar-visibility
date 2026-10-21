/**
 * 已完成未读标记的契约测试（不启动浏览器）。
 *
 * 直接以 Node 内置 type stripping 导入 visibility-store.ts，用假 localStorage 验证：
 * 幂等加入 / 移除、批量已读、归档清理、损坏存储回落、非字符串 id 过滤。
 *
 * 运行：node scripts/test-unread.mjs
 */
import assert from 'node:assert/strict'

const KEY = 'dsh.sidebar-visibility.v1'
const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
}

const store = await import('../src/client/visibility-store.ts')

let passed = 0
function check(name, fn) {
  try { fn(); passed += 1; console.log('  ok  ' + name) }
  catch (error) { console.error('  FAIL ' + name); console.error(error?.stack ?? error); process.exitCode = 1 }
}

const reset = () => storage.clear()

check('默认没有未读', () => {
  reset()
  assert.deepEqual(store.getVisibility().unreadSessionIds, [])
})

check('标记未读：写入一次且幂等', () => {
  reset()
  store.markSessionUnread('s1')
  store.markSessionUnread('s1')
  assert.deepEqual(store.getVisibility().unreadSessionIds, ['s1'])
  assert.equal(store.isSessionUnread('s1'), true)
  assert.equal(store.isSessionUnread('s2'), false)
})

check('标记已读：移除且重复调用不报错', () => {
  reset()
  store.markSessionUnread('s1')
  store.markSessionUnread('s2')
  store.markSessionRead('s1')
  store.markSessionRead('s1')
  assert.deepEqual(store.getVisibility().unreadSessionIds, ['s2'])
})

check('批量已读：一次移除多个', () => {
  reset()
  for (const id of ['a', 'b', 'c']) store.markSessionUnread(id)
  store.markSessionsRead(['a', 'c'])
  assert.deepEqual(store.getVisibility().unreadSessionIds, ['b'])
})

check('清理不存在的会话 id（归档 / 删除后）', () => {
  reset()
  for (const id of ['kept', 'gone']) store.markSessionUnread(id)
  store.pruneUnreadSessions(['kept'])
  assert.deepEqual(store.getVisibility().unreadSessionIds, ['kept'])
})

check('持久化：写入同一 localStorage 键并可从原始 JSON 读回', () => {
  reset()
  store.markSessionUnread('persisted')
  const raw = JSON.parse(storage.get(KEY))
  assert.deepEqual(raw.unreadSessionIds, ['persisted'])
})

check('损坏存储回落默认，不抛错', () => {
  reset()
  storage.set(KEY, '{not json')
  assert.deepEqual(store.getVisibility().unreadSessionIds, [])
})

check('非字符串 / 空 id 被过滤', () => {
  reset()
  storage.set(KEY, JSON.stringify({ unreadSessionIds: ['ok', 42, '', null] }))
  assert.deepEqual(store.getVisibility().unreadSessionIds, ['ok'])
})

check('订阅者在写入时收到通知', () => {
  reset()
  let calls = 0
  const stop = store.subscribeVisibility(() => { calls += 1 })
  store.markSessionUnread('notify')
  store.markSessionRead('notify')
  stop()
  store.markSessionUnread('after-stop')
  assert.equal(calls, 2)
})

console.log('\n' + passed + ' checks passed' + (process.exitCode === 1 ? ', some FAILED' : ''))