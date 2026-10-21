/**
 * 运行区间计时（纯函数 + 共享节拍，不含 React、不依赖浏览器）。
 *
 * 数据边界：rc.2 的会话列表只有 `running: boolean`，没有运行起点。
 * `SessionSummary.updatedAt` 是最后变更时间，`sessionStats` 是整条日志的累计
 * 墙钟，都不能当成本次运行起点。因此这里只记录**浏览器实际观察到的连续运行
 * 区间**；挂载时已在运行的会话没有可信起点，只能给出下限（≥ Xm）。
 *
 * 放在独立模块是为了两条：挂钩可单测（Node 直接 type-stripping 载入），
 * 以及 WorkspaceTree 只依赖展示组件、不关心计时实现。
 */

export interface RuntimeObservation {
  /** 观察到的起点；null 表示当前未运行。 */
  startedAt: number | null
  /** 起点是「页面打开时已在运行」，只能给出下限。 */
  lowerBound: boolean
  /** 上一帧的 running 值。 */
  running: boolean
}

/** 初始观察：挂载时已 running 的会话没有可信起点，标为下限。 */
export function initialObservation(now: number, running: boolean): RuntimeObservation {
  return { startedAt: running ? now : null, lowerBound: running, running }
}

/** 观察步进：false→true 记起点；true→false 清空；同一状态保持（返回同一对象）。 */
export function stepObservation(previous: RuntimeObservation, running: boolean, now: number): RuntimeObservation {
  if (running === previous.running) return previous
  if (running) return { startedAt: now, lowerBound: false, running: true }
  return { startedAt: null, lowerBound: false, running: false }
}

/** 已运行毫秒；未运行时为 null；时钟回拨不产生负数。 */
export function elapsedOf(observation: RuntimeObservation, now: number): number | null {
  if (observation.startedAt === null) return null
  return Math.max(0, now - observation.startedAt)
}

/**
 * 分钟文案：`Nm`；不足一分钟 `<1m`；下限观察 `≥Nm`（不足一分钟按 ≥1m 表达，
 * 避免「≥<1m」这种无意义组合）。
 */
export function formatElapsed(ms: number | null, lowerBound: boolean): string {
  if (ms === null) return ''
  const minutes = Math.floor(ms / 60000)
  if (lowerBound) return `≥${Math.max(1, minutes)}m`
  return minutes < 1 ? '<1m' : `${minutes}m`
}

// ---- 共享节拍 --------------------------------------------------------------

let tickCount = 0
let tickTimer: ReturnType<typeof setInterval> | null = null
const tickListeners = new Set<() => void>()

function startTicker() {
  if (tickTimer !== null) return
  // 5s 节拍：分钟级文案最多晚 5 秒跳动；所有运行行共用一个定时器。
  tickTimer = setInterval(() => {
    tickCount += 1
    for (const listener of [...tickListeners]) listener()
  }, 5000)
}

/** 订阅共享节拍（末位订阅者释放后清除定时器，不留残余 interval）。 */
export function subscribeRuntimeTick(listener: () => void): () => void {
  tickListeners.add(listener)
  startTicker()
  return () => {
    tickListeners.delete(listener)
    if (tickListeners.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }
}

/** 节拍快照（uSES 要求同一状态返回同一值）。 */
export function runtimeTickSnapshot(): number {
  return tickCount
}

/** 当前订阅者数量（测试断言定时器已释放）。 */
export function runtimeTickListenerCount(): number {
  return tickListeners.size
}
