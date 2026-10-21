#!/usr/bin/env node
/**
 * workspace-hierarchy 纯函数单测。
 *
 * 运行方式：node scripts/test-hierarchy.mjs（Node ≥ 24 内置 type stripping，
 * 直接 import .ts 源文件，不需要 typescript / tsdown / 任何依赖）。
 *
 * 覆盖（对齐 docs/session-tree-rc2-design.md 的路径测试要求）：
 * Windows 盘符 / UNC 规范化与大小写敏感、POSIX 不解释反斜杠、路径段边界、
 * 最近严格祖先（不虚构未登记目录）、重复路径无环、隐藏父提升与深层祖先、
 * 折叠剪枝不漏根、当前祖先链、同级锚点与跨级拒绝。
 */
import assert from 'node:assert/strict'
import {
  ancestorKeys,
  buildWorkspaceHierarchy,
  canonicalFolderPath,
  owningAncestorKey,
  promotePastHidden,
  siblingReorderAnchor,
  visibleTreeNodes,
} from '../src/client/workspace-hierarchy.ts'

let passed = 0
const failures = []
/** 单个用例：失败记录并继续，最后统一汇报。 */
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

// ---- canonicalFolderPath：仅做分隔符归一与去尾斜杠，大小写保留 --------------

test('canonicalFolderPath: Windows 盘符反斜杠归一 + 去尾斜杠', () => {
  assert.equal(canonicalFolderPath('C:\\a\\b\\'), 'C:/a/b')
  assert.equal(canonicalFolderPath('C:/a/b'), 'C:/a/b')
})
test('canonicalFolderPath: UNC 反斜杠归一', () => {
  assert.equal(canonicalFolderPath('\\\\srv\\share\\x\\'), '//srv/share/x')
})
test('canonicalFolderPath: POSIX 只去尾分隔符，不解释反斜杠', () => {
  assert.equal(canonicalFolderPath('/a/b/'), '/a/b')
  assert.equal(canonicalFolderPath('/a\\b'), '/a\\b')
})

// ---- owningAncestorKey：最近严格祖先，大小写敏感，段边界 --------------------

test('owningAncestorKey: 最近祖先优先于更浅祖先（与登记顺序无关）', () => {
  assert.equal(owningAncestorKey('/a/b/c', ['/a/b', '/a']), '/a/b')
  assert.equal(owningAncestorKey('/a/b/c', ['/a', '/a/b']), '/a/b')
})
test('owningAncestorKey: 路径段边界不混淆（/a/b 不是 /a/bar 的祖先）', () => {
  assert.equal(owningAncestorKey('/a/bar', ['/a/b']), undefined)
  assert.equal(owningAncestorKey('/a/bar', ['/a/b', '/a']), '/a')
})
test('owningAncestorKey: 严格祖先排除自身', () => {
  assert.equal(owningAncestorKey('/a', ['/a']), undefined)
  assert.equal(owningAncestorKey('/a', ['/a', '/a']), undefined)
})
test('owningAncestorKey: 大小写敏感（对齐 rc.2 Workspace 身份语义）', () => {
  assert.equal(owningAncestorKey('C:/A/B', ['c:/a']), undefined)
  assert.equal(owningAncestorKey('/A/B', ['/a']), undefined)
  assert.equal(owningAncestorKey('C:/a/B', ['C:/a']), 'C:/a')
})
test('owningAncestorKey: UNC 前缀匹配', () => {
  assert.equal(owningAncestorKey('//srv/share/x', ['//srv/share']), '//srv/share')
  assert.equal(owningAncestorKey('//srv/sharex', ['//srv/share']), undefined)
})

// ---- buildWorkspaceHierarchy：构树、重复路径、无环 --------------------------

const w = (workspaceId, path) => (path === undefined ? { workspaceId } : { workspaceId, path })

test('buildWorkspaceHierarchy: 最近严格祖先成链 + 深度', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/work'), w('b', 'D:/work/proj-a'), w('c', 'D:/work/proj-a/sub')])
  assert.deepEqual([...h.parents.entries()], [['b', 'a'], ['c', 'b']])
  assert.deepEqual([...h.depthById.entries()], [['a', 0], ['b', 1], ['c', 2]])
})
test('buildWorkspaceHierarchy: 不虚构未登记中间目录', () => {
  const h = buildWorkspaceHierarchy([w('root', 'D:/x/y'), w('deep', 'D:/x/y/a/b')])
  assert.equal(h.parents.get('deep'), 'root')
  assert.equal(h.depthById.get('deep'), 1)
})
test('buildWorkspaceHierarchy: 孤立嵌套（无任何祖先登记）为根', () => {
  const h = buildWorkspaceHierarchy([w('only', 'D:/x/y/z')])
  assert.equal(h.parents.size, 0)
  assert.equal(h.depthById.get('only'), 0)
})
test('buildWorkspaceHierarchy: 重复路径取首个代表，不自父子、不成环', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/dup'), w('b', 'D:/dup'), w('c', 'D:/dup/child')])
  assert.equal(h.parents.has('a'), false)
  assert.equal(h.parents.has('b'), false)
  assert.equal(h.parents.get('c'), 'a')
  assert.equal(h.depthById.get('c'), 1)
  assert.ok([...h.depthById.values()].every((d) => Number.isFinite(d)))
})
test('buildWorkspaceHierarchy: 大小写不同的 Windows 路径不合并（大小写敏感）', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/dup'), w('b', 'd:/dup/child')])
  assert.equal(h.parents.get('b'), undefined)
})
test('buildWorkspaceHierarchy: 无路径 / 空路径为根，不参与父级解析', () => {
  const h = buildWorkspaceHierarchy([w('nopath'), w('empty', ''), w('child', 'D:/p/sub'), w('p', 'D:/p')])
  assert.equal(h.parents.get('child'), 'p')
  assert.equal(h.parents.has('nopath'), false)
  assert.equal(h.parents.has('empty'), false)
})

// ---- promotePastHidden：隐藏父提升最近可见祖先 ------------------------------

test('promotePastHidden: 隐藏中间层时提升到最近可见祖先', () => {
  const parents = new Map([['b', 'a'], ['c', 'b']])
  const promoted = promotePastHidden(parents, new Set(['b']))
  assert.equal(promoted.get('c'), 'a')
  assert.equal(promoted.get('b'), 'a')
})
test('promotePastHidden: 全链隐藏时升到根', () => {
  const parents = new Map([['b', 'a'], ['c', 'b']])
  const promoted = promotePastHidden(parents, new Set(['a', 'b']))
  assert.equal(promoted.get('c'), undefined)
  assert.equal(promoted.get('b'), undefined)
})
test('promotePastHidden: 环输入安全且不产生自父', () => {
  const cyclic = new Map([['a', 'b'], ['b', 'a']])
  const promoted = promotePastHidden(cyclic, new Set(['b']))
  assert.equal(promoted.get('a'), undefined)
})

// ---- visibleTreeNodes：可见树、折叠剪枝、提升后的顺序 -----------------------

test('visibleTreeNodes: 基本嵌套与 Host 顺序', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/w'), w('b', 'D:/w/b'), w('c', 'D:/w/c'), w('d', 'D:/w/b/d')])
  const nodes = visibleTreeNodes(h, promotePastHidden(h.parents, new Set()), new Set(), new Set())
  assert.equal(nodes.length, 1)
  const [a] = nodes
  assert.equal(a.workspace.workspaceId, 'a')
  assert.deepEqual(a.children.map((n) => n.workspace.workspaceId), ['b', 'c'])
  assert.deepEqual(a.children[0].children.map((n) => n.workspace.workspaceId), ['d'])
  assert.deepEqual([a.depth, a.children[0].depth, a.children[0].children[0].depth], [0, 1, 2])
})
test('visibleTreeNodes: 隐藏父时可见子区提升到最近可见祖先（深层）', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/w'), w('b', 'D:/w/b'), w('c', 'D:/w/b/c'), w('d', 'D:/w/b/c/d')])
  // 只隐藏 b：c、d 的最近可见祖先不同——c 上提到 a，d 仍留在可见的 c 之下。
  const partial = visibleTreeNodes(h, promotePastHidden(h.parents, new Set(['b'])), new Set(['b']), new Set())
  const [pa] = partial
  // b 被隐藏不渲染；c 上提到 a，d 仍留在可见的 c 之下。
  assert.deepEqual(pa.children.map((n) => [n.workspace.workspaceId, n.depth]), [['c', 1]])
  assert.deepEqual(pa.children[0].children.map((n) => [n.workspace.workspaceId, n.depth]), [['d', 2]])
  // 隐藏 b、c：d 跨过两级隐藏，直接上提到 a。
  const deep = visibleTreeNodes(h, promotePastHidden(h.parents, new Set(['b', 'c'])), new Set(['b', 'c']), new Set())
  const [da] = deep
  assert.deepEqual(da.children.map((n) => [n.workspace.workspaceId, n.depth]), [['d', 1]])
})
test('visibleTreeNodes: 隐藏根时子区升为根', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/w'), w('b', 'D:/w/b'), w('d', 'D:/w/b/d'), w('c', 'D:/w/c')])
  const nodes = visibleTreeNodes(h, promotePastHidden(h.parents, new Set(['a'])), new Set(['a']), new Set())
  assert.deepEqual(nodes.map((n) => [n.workspace.workspaceId, n.depth]), [['b', 0], ['c', 0]])
  assert.deepEqual(nodes[0].children.map((n) => n.workspace.workspaceId), ['d'])
})
test('visibleTreeNodes: 折叠保留自身、剪掉整棵子树（子树不漏成根）', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/w'), w('b', 'D:/w/b'), w('d', 'D:/w/b/d'), w('c', 'D:/w/c')])
  const nodes = visibleTreeNodes(h, promotePastHidden(h.parents, new Set()), new Set(), new Set(['b']))
  assert.equal(nodes.length, 1)
  const [a] = nodes
  // b 折叠保留自身；c 是 a 的另一个子级，照常出现。
  assert.deepEqual(a.children.map((n) => n.workspace.workspaceId), ['b', 'c'])
  assert.deepEqual(a.children[0].children, [])
  // d 既不是根也不在任何 children 里：整棵子树随折叠消失。
  const ids = []
  const walk = (n) => { ids.push(n.workspace.workspaceId); n.children.forEach(walk) }
  nodes.forEach(walk)
  assert.ok(!ids.includes('d'))
})

// ---- ancestorKeys：当前会话祖先链 ------------------------------------------

test('ancestorKeys: 直接父与所有严格祖先，不含自身', () => {
  const h = buildWorkspaceHierarchy([w('a', 'D:/w'), w('b', 'D:/w/b'), w('d', 'D:/w/b/d')])
  assert.deepEqual([...ancestorKeys(h.parents, 'd')], ['b', 'a'])
  assert.deepEqual([...ancestorKeys(h.parents, 'b')], ['a'])
  assert.equal(ancestorKeys(h.parents, 'a').size, 0)
  assert.equal(ancestorKeys(h.parents, undefined).size, 0)
})

// ---- siblingReorderAnchor：同级重排、跨级拒绝 -------------------------------

const dragWorkspaces = [w('a', 'D:/w'), w('b', 'D:/w/b'), w('c', 'D:/w/c'), w('x', 'D:/other'), w('y', 'D:/other/sub')]
const dragParents = buildWorkspaceHierarchy(dragWorkspaces).parents

test('siblingReorderAnchor: 同级 before 锚点', () => {
  // 兄弟 [b, c]：拖 c 到 b 之前 = 真实移动。
  assert.deepEqual(siblingReorderAnchor(dragWorkspaces, dragParents, 'c', 'b', 'before'), { kind: 'move', anchor: 'b' })
})
test('siblingReorderAnchor: 根级互为同级（同为 undefined 父）', () => {
  assert.deepEqual(siblingReorderAnchor(dragWorkspaces, dragParents, 'x', 'a', 'before'), { kind: 'move', anchor: 'a' })
  // a 拖到 x 之后 = 移到根级末尾（anchor 省略）。
  assert.deepEqual(siblingReorderAnchor(dragWorkspaces, dragParents, 'a', 'x', 'after'), { kind: 'move', anchor: undefined })
})
test('siblingReorderAnchor: 无变化情形返回 noop', () => {
  // 锚点即自身
  assert.deepEqual(siblingReorderAnchor(dragWorkspaces, dragParents, 'b', 'b', 'before'), { kind: 'noop' })
  // 拖 b 到 c 之前 = 原位相邻
  assert.deepEqual(siblingReorderAnchor(dragWorkspaces, dragParents, 'b', 'c', 'before'), { kind: 'noop' })
  // 拖 b 到 c 之后 = b 移到同级末尾（真实移动，anchor 省略）
  assert.deepEqual(siblingReorderAnchor(dragWorkspaces, dragParents, 'b', 'c', 'after'), { kind: 'move', anchor: undefined })
  // 拖 c 到 b 之后 = c 本来就在 b 之后
  assert.deepEqual(siblingReorderAnchor(dragWorkspaces, dragParents, 'c', 'b', 'after'), { kind: 'noop' })
})
test('siblingReorderAnchor: 跨级（父子 / 异父 / 任意深后代）一律 reject', () => {
  // 拖 a 落到子级 b 上：不同父 → 拒绝（不改父子目录）
  const toChild = siblingReorderAnchor(dragWorkspaces, dragParents, 'a', 'b', 'before')
  assert.equal(toChild.kind, 'reject')
  // 拖 b 落到父级 a 上：同样拒绝
  assert.equal(siblingReorderAnchor(dragWorkspaces, dragParents, 'b', 'a', 'before').kind, 'reject')
  // 异父
  assert.equal(siblingReorderAnchor(dragWorkspaces, dragParents, 'b', 'y', 'before').kind, 'reject')
})

// ---- 汇总 -------------------------------------------------------------------

console.log('')
if (failures.length > 0) {
  console.error(`FAILED: ${failures.length}/${failures.length + passed} (${failures.join('; ')})`)
  process.exit(1)
}
console.log(`PASS: ${passed} tests`)
