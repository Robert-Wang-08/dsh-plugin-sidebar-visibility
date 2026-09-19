/**
 * 可见性偏好本地持久化（浏览器侧，per-account）。
 *
 * 与官方惯例一致：ui-workspace 的展开状态、手动排序本就是
 * 浏览器持久化记录（dsh-client-ui-workspace README「Reordering and view
 * options」），本插件沿用 localStorage；跨设备同步留作 Host 升级项。
 *
 * TODO(verify): 官方记录的 account key 派生方式见
 * dsh-client-ui-workspace/lib/types/client/stores.d.ts 的 retainAccountKeys。
 * v0 用单一 key，多账号共存的串扰风险在 README 风险节标注。
 */

const STORAGE_KEY = 'dsh.sidebar-visibility.v1'

/** 会话列表分组模式：按工作区分段，或合并为一个列表（官方 "In one list"）。 */
export type SessionGroupBy = 'workspace' | 'flat'

/** 会话排序：沿用 Host 顺序，或按最近更新时间降序（官方 view options 的两个档位）。 */
export type SessionOrderBy = 'manual' | 'updated'

export interface VisibilityPrefs {
  /** 可视化隐藏的工作区（可恢复，与归档无关）。 */
  hiddenWorkspaceIds: string[]
  /** 折叠的工作区：仅收起组内会话行，标题行保留原位（与隐藏 / 归档无关）。 */
  collapsedWorkspaceIds: string[]
  /** 收藏的高价值会话，按收藏时间升序。 */
  favoriteSessionIds: string[]
  /** Provider 挂起暂存：settingsNs → 被 unset 的用户层子树 / 覆盖前快照。 */
  providerStash: Record<string, ProviderStashEntry>
  /** 会话列表分组模式；默认与官方一致。 */
  groupBy: SessionGroupBy
  /** 会话排序档位；默认与官方一致。 */
  orderBy: SessionOrderBy
}

export interface ProviderStashEntry {
  /** unset：用户层子树已暂存并移除；models-empty：写了 models:[] 覆盖。 */
  mode: 'unset' | 'models-empty'
  /** mode=unset 时为用户层被移除的配置子树；mode=models-empty 时为覆盖前的 models 值。 */
  stashedValue: unknown
  /** 挂起时被剔除的 subagent allowedModels 快照（恢复时还原）。 */
  allowedModelsSnapshot?: string[]
  suspendedAt: string
}

/**
 * 默认偏好。`groupBy` / `orderBy` 的取值与官方
 * `dsh-client-ui-workspace` 的 viewing store 初始值一致（workspace + updated），
 * 使本插件遮蔽官方占用者后，默认观感与官方浏览器保持一致。
 */
const DEFAULTS: VisibilityPrefs = {
  hiddenWorkspaceIds: [],
  collapsedWorkspaceIds: [],
  favoriteSessionIds: [],
  providerStash: {},
  groupBy: 'workspace',
  orderBy: 'updated',
}

function read(): VisibilityPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* 损坏时回落默认 */ }
  return { ...DEFAULTS }
}

function write(next: VisibilityPrefs) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next))
  // 通知同一页内所有听众（React 侧用 useSyncExternalStore 订阅）。
  listeners.forEach((fn) => fn())
}

const listeners = new Set<() => void>()

export function subscribeVisibility(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getVisibility(): VisibilityPrefs {
  return read()
}

export function setGroupBy(mode: SessionGroupBy) {
  const prefs = read()
  prefs.groupBy = mode
  write(prefs)
}

export function setOrderBy(mode: SessionOrderBy) {
  const prefs = read()
  prefs.orderBy = mode
  write(prefs)
}

export function toggleHiddenWorkspace(workspaceId: string) {
  const prefs = read()
  const i = prefs.hiddenWorkspaceIds.indexOf(workspaceId)
  if (i >= 0) prefs.hiddenWorkspaceIds.splice(i, 1)
  else prefs.hiddenWorkspaceIds.push(workspaceId)
  write(prefs)
}

/**
 * 折叠 / 展开某个工作区。
 *
 * 折叠是纯展示态：只收起该组的会话行，标题行留在原位，会话数据、归档状态与
 * 隐藏状态都不受影响。与 `toggleHiddenWorkspace` 的区别是隐藏会把整组挪到树底
 * 的「已隐藏的工作区」折叠区，折叠则保留分组位置。
 */
export function toggleCollapsedWorkspace(workspaceId: string) {
  const prefs = read()
  const i = prefs.collapsedWorkspaceIds.indexOf(workspaceId)
  if (i >= 0) prefs.collapsedWorkspaceIds.splice(i, 1)
  else prefs.collapsedWorkspaceIds.push(workspaceId)
  write(prefs)
}

/**
 * 覆盖式设置折叠集合。
 *
 * 全折叠 / 全展开走整个列表一次写入，避免逐组 toggle 触发多次 localStorage
 * 写入与多次订阅回调。
 */
export function setCollapsedWorkspaces(workspaceIds: string[]) {
  const prefs = read()
  prefs.collapsedWorkspaceIds = [...workspaceIds]
  write(prefs)
}

export function toggleFavoriteSession(sessionId: string) {
  const prefs = read()
  const i = prefs.favoriteSessionIds.indexOf(sessionId)
  if (i >= 0) prefs.favoriteSessionIds.splice(i, 1)
  else prefs.favoriteSessionIds.push(sessionId)
  write(prefs)
}

export function stashProvider(settingsNs: string, entry: ProviderStashEntry) {
  const prefs = read()
  prefs.providerStash[settingsNs] = entry
  write(prefs)
}

export function popProviderStash(settingsNs: string): ProviderStashEntry | undefined {
  const prefs = read()
  const entry = prefs.providerStash[settingsNs]
  delete prefs.providerStash[settingsNs]
  write(prefs)
  return entry
}
