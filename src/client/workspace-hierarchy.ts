/**
 * 工作区目录层级纯函数（浏览器侧，无依赖，可被 Node 内置 type stripping 直接单测）。
 *
 * 语义对齐官方 dsh-client-ui-workspace rc.2 的 parents 派生
 * （lib/client.js:615-638 folderPath / owningParentFolder）：只在「已登记工作区」
 * 之间按规范化目录的最近严格祖先建父子关系，不虚构未登记目录，不改变 Host 的
 * 扁平顺序与会话归属。
 *
 * 大小写语义与 rc.2 官方一致：路径比较大小写敏感（同 Workspace 身份）。
 * 规范化只做两件事——对 Windows 盘符（^[A-Za-z]:[/\\]）与 UNC（\\ 前缀）路径把
 * 反斜杠归一为正斜杠；再去掉尾部分隔符。POSIX 路径不解释反斜杠、不改大小写。
 * 边界按完整路径段比较（`root/` 前缀），`/a/b` 不是 `/a/bc` 的祖先；
 * 同一规范化路径重复登记时取首个为规范代表，严格排除自身；层级推导全程带环
 * 检测，重复 / 环输入不会死循环，也不会自父子。
 */

/** 构树所需的工作区投影（WorkspaceView 的子集）。 */
export interface WorkspaceLike {
  workspaceId: string
  path?: string
}

/**
 * 规范化目录路径：Windows 盘符 / UNC 的反斜杠统一成正斜杠并去掉尾部分隔符；
 * POSIX 路径只去尾分隔符。大小写保留、POSIX 反斜杠按普通字符原样保留。
 */
export function canonicalFolderPath(path: string): string {
  const unified = /^[A-Za-z]:[/\\]/.test(path) || path.startsWith('\\\\') ? path.replaceAll('\\', '/') : path
  return unified.replace(/\/+$/, '')
}

/**
 * 最近严格祖先（规范化路径域）。要求输入都是 canonicalFolderPath 的输出。
 * 按「最长 `root/` 前缀」取最近祖先；自身除外；同长并列取先登记者；
 * 比较大小写敏感。
 */
export function owningAncestorKey(canonicalChild: string, canonicalKeys: readonly string[]): string | undefined {
  let owner: string | undefined
  let length = -1
  for (const key of canonicalKeys) {
    if (key.length > length && canonicalChild !== key && canonicalChild.startsWith(`${key}/`)) {
      owner = key
      length = key.length
    }
  }
  return owner
}

/** 层级快照：parents 只含「有路径且有已登记严格祖先」的工作区，其余视为根。 */
export interface WorkspaceHierarchy {
  /** 全体工作区，保持 Host 顺序（根排序与同级锚点都依赖这个顺序）。 */
  order: readonly WorkspaceLike[]
  /** workspaceId → 直接父 workspaceId（规范化路径最近严格祖先）。 */
  parents: ReadonlyMap<string, string>
  /** workspaceId → 深度，根为 0（防御环时环上节点按根计）。 */
  depthById: ReadonlyMap<string, number>
}

/**
 * 按已登记规范化路径构建层级。多对一：同一规范化路径重复登记时，子区只挂到
 * 首个代表上；路径缺失或为空的工作区一律是根。全程环安全。
 */
export function buildWorkspaceHierarchy(workspaces: readonly WorkspaceLike[]): WorkspaceHierarchy {
  const idByCanonical = new Map<string, string>()
  const canonicalById = new Map<string, string>()
  for (const w of workspaces) {
    if (typeof w.path !== 'string' || w.path === '') continue
    const canonical = canonicalFolderPath(w.path)
    if (canonical === '') continue
    canonicalById.set(w.workspaceId, canonical)
    if (!idByCanonical.has(canonical)) idByCanonical.set(canonical, w.workspaceId)
  }
  const canonicalKeys = [...idByCanonical.keys()]

  const parents = new Map<string, string>()
  for (const w of workspaces) {
    const canonical = canonicalById.get(w.workspaceId)
    if (canonical === undefined) continue
    const ownerKey = owningAncestorKey(canonical, canonicalKeys)
    if (ownerKey === undefined) continue
    const ownerId = idByCanonical.get(ownerKey)
    // 严格祖先：规范化后同路径（重复登记）不构成父子，杜绝自父子成环。
    if (ownerId !== undefined && ownerId !== w.workspaceId) parents.set(w.workspaceId, ownerId)
  }

  // 防御环：路径祖先链理论无环，这里仍带 seen 检测；环上节点按根处理。
  const safeParents = new Map(parents)
  const depthById = new Map<string, number>()
  for (const w of workspaces) {
    const seen = new Set<string>([w.workspaceId])
    let depth = 0
    let cursor: string | undefined = parents.get(w.workspaceId)
    let cyclic = false
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        cyclic = true
        break
      }
      seen.add(cursor)
      depth += 1
      cursor = parents.get(cursor)
    }
    if (cyclic) {
      safeParents.delete(w.workspaceId)
      depthById.set(w.workspaceId, 0)
    } else {
      depthById.set(w.workspaceId, depth)
    }
  }

  return { order: [...workspaces], parents: safeParents, depthById }
}

/**
 * 隐藏提升：把每个工作区的渲染父级换成「最近可见祖先」——直接父被隐藏时继续
 * 向上走，直到可见工作区或根。带 seen 检测，环输入安全。
 */
export function promotePastHidden(
  parents: ReadonlyMap<string, string>,
  hiddenIds: ReadonlySet<string>,
): ReadonlyMap<string, string | undefined> {
  const promoted = new Map<string, string | undefined>()
  for (const id of parents.keys()) {
    const seen = new Set<string>([id])
    let cursor: string | undefined = parents.get(id)
    while (cursor !== undefined && hiddenIds.has(cursor)) {
      if (seen.has(cursor)) {
        cursor = undefined
        break
      }
      seen.add(cursor)
      cursor = parents.get(cursor)
    }
    // 环防御：走回 seen 里的节点（含自身）说明环输入，按根处理。
    if (cursor !== undefined && seen.has(cursor)) cursor = undefined
    promoted.set(id, cursor)
  }
  return promoted
}

/** 可见树节点：工作区 + 深度 + 可见子节点（折叠处剪枝，子树不出现）。 */
export interface TreeNode {
  workspace: WorkspaceLike
  depth: number
  children: TreeNode[]
}

/**
 * 可见树：隐藏工作区整体不出现（其子区已由 promotedParents 提升到最近可见
 * 祖先）；折叠的工作区保留自身节点、不递归子树；同级按 Host 顺序。环防御：
 * 未被链接到任何父下的节点（含防御性孤儿）按根输出。
 */
export function visibleTreeNodes(
  hierarchy: WorkspaceHierarchy,
  promotedParents: ReadonlyMap<string, string | undefined>,
  hiddenIds: ReadonlySet<string>,
  collapsedIds: ReadonlySet<string>,
): TreeNode[] {
  // shells 按插入序即 Host 序，子节点因此天然保序。
  const shells = new Map<string, TreeNode>()
  for (const w of hierarchy.order) {
    if (hiddenIds.has(w.workspaceId)) continue
    shells.set(w.workspaceId, { workspace: w, depth: 0, children: [] })
  }

  const linked = new Set<string>()
  for (const node of shells.values()) {
    const id = node.workspace.workspaceId
    const parent = promotedParents.get(id) ?? undefined
    if (parent === undefined) continue
    const parentNode = shells.get(parent)
    // 防御：父不可见 / 自指 → 当根（正常应由 promotePastHidden 归根）。
    if (parentNode === undefined || parentNode === node) continue
    // 折叠处剪枝：折叠节点自身保留，整棵子树不进入输出。
    if (collapsedIds.has(parent)) continue
    parentNode.children.push(node)
    linked.add(id)
  }

  // 根 = 无提升父级，或提升父级不在可见集合 / 自指（防御）。注意：被折叠剪枝
  // 的节点其父仍在可见集合里，因此不会升格为根，整棵子树随折叠不出现。
  const roots = [...shells.values()].filter((node) => {
    const parent = promotedParents.get(node.workspace.workspaceId) ?? undefined
    return parent === undefined || !shells.has(parent) || shells.get(parent) === node
  })
  const assigned = new Set<string>()
  const walkDepth = (node: TreeNode, depth: number): void => {
    if (assigned.has(node.workspace.workspaceId)) return
    assigned.add(node.workspace.workspaceId)
    node.depth = depth
    for (const child of node.children) walkDepth(child, depth + 1)
  }
  for (const root of roots) walkDepth(root, 0)
  return roots
}

/**
 * 从某工作区向上到根的祖先键集合（不含自身；环安全）。
 * 用于「当前会话祖先高亮」：直接父与其所有严格祖先都会点亮。
 */
export function ancestorKeys(parents: ReadonlyMap<string, string>, startId: string | undefined): ReadonlySet<string> {
  const keys = new Set<string>()
  if (startId === undefined) return keys
  const seen = new Set<string>([startId])
  let cursor: string | undefined = parents.get(startId)
  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor)
    keys.add(cursor)
    cursor = parents.get(cursor)
  }
  return keys
}

/** 同级重排判定结果：move 携带插入锚点（anchor 省略表示移到同级末尾）。 */
export type ReorderOutcome = { kind: 'noop' } | { kind: 'reject'; reason: string } | { kind: 'move'; anchor?: string }

/**
 * 同级重排锚点（官方 commitWorkspaceDrag 的纯函数化，lib/client.js:2407-2423）。
 * 只在同一父级（含同为根）的工作区之间重排；跨级（父子 / 异父）一律 reject，
 * 绝不改父子目录。与官方一致的两种无变化情形返回 noop：
 * anchor 即自身、以及源与锚点相邻。
 */
export function siblingReorderAnchor(
  workspaces: readonly WorkspaceLike[],
  parents: ReadonlyMap<string, string>,
  dragId: string,
  overId: string,
  half: 'before' | 'after',
): ReorderOutcome {
  const siblings = workspaces.filter((w) => parents.get(w.workspaceId) === parents.get(dragId))
  const overIndex = siblings.findIndex((w) => w.workspaceId === overId)
  if (overIndex === -1) {
    return {
      kind: 'reject',
      reason: `drop target "${overId}" is not a sibling of "${dragId}"; cross-level reorder is not allowed`,
    }
  }
  const anchor = half === 'before' ? overId : siblings[overIndex + 1]?.workspaceId
  if (anchor === dragId) return { kind: 'noop' }
  const sourceIndex = siblings.findIndex((w) => w.workspaceId === dragId)
  if (sourceIndex === -1) return { kind: 'reject', reason: `dragged workspace "${dragId}" is not registered` }
  const anchorIndex = anchor === undefined ? siblings.length : siblings.findIndex((w) => w.workspaceId === anchor)
  if (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1) return { kind: 'noop' }
  return { kind: 'move', anchor }
}
