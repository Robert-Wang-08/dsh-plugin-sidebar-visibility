import { getVisibility } from './visibility-store.ts'

/**
 * superagent 任务会话 / 工作区判定。
 *
 * 背景：superagent 每个 ticket 在自己的 work 目录（`<DSH_HOME>/state/superagent/work/<ticket>`）
 * 下登记一个工作区，并创建一个 id 形如 `worker-<ticketId>` 的**普通会话**
 * （header.origin 未设置，不是 subagent 子会话）。DSH 的会话列表只硬屏蔽
 * origin=subagent 的子会话，所以这些 worker 会话和 work 工作区会默认出现在
 * 侧栏里。日常使用时这些是编排器的内部工作区，需要能一键隐藏。
 *
 * 判定不依赖具体用户名/盘符：只认 DSH_HOME 相对路径 `/.dsh/state/superagent/work/`。
 * 工作区隐藏后会话数据与运行都不受影响，只是列表派生视图。
 */

/** 归一成分隔符统一的正斜杠路径；仅用于判定，不做大小写规范化。 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * 路径是否位于 `.dsh/state/superagent/work` 下（Windows 大小写不敏感，
 * 盘符/用户名/DSH_HOME 位置都不参与判定）。目录段按边界匹配，
 * `.dsh/state/superagent/workspace` 不会被误判。
 */
export function isSuperagentWorkPath(path: string | undefined): boolean {
  if (!path) return false
  return /\/\.dsh\/state\/superagent\/work(?:\/|$)/i.test(normalizePath(path))
}

/** worker 会话 id：superagent 的 `worker-<ticketId>`（大小写不敏感）。 */
export function isWorkerSessionId(id: string): boolean {
  return /^worker-/i.test(id)
}

/**
 * 是否属于 superagent 任务：worker 会话 id，或会话 cwd / 所属工作区路径落在
 * `.dsh/state/superagent/work` 下。两者任一命中即视为任务内部对象。
 */
export function isSuperagentTaskSession(session: { id: string; cwd?: string }): boolean {
  return isWorkerSessionId(session.id) || isSuperagentWorkPath(session.cwd)
}

/**
 * 工作区选择器（新建会话顶部）的可选项过滤：`hide` 打开时剔除 superagent
 * 任务工作区；其余顺序、标题、选择态都不变。纯函数，便于单测。
 */
export function filterPickerWorkspaces<T extends { path?: string }>(items: readonly T[], hide: boolean): T[] {
  return hide ? items.filter((item) => !isSuperagentWorkPath(item.path)) : [...items]
}

/** 当前「隐藏任务」开关值（读取插件持久化偏好）。 */
export function getHideSuperagentTasks(): boolean {
  return getVisibility().hideSuperagentTasks
}
