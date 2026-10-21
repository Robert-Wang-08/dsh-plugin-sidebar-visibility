/**
 * 运行中标识：转圈 + 本次运行已运行时间 + 当前模型配色。
 *
 * 计时口径、桥协议与降级语义分别在 `./runtime-timer.ts` 与
 * `./runtime-bridge.ts`（两者都是可单测的纯模块）；本文件只做 React 接线与渲染。
 *
 * 边界（与 rc.2 契约一致）：
 * - 列表只有 `running: boolean`，没有运行起点；挂载时已在运行的会话只给下限
 *   （≥ Xm），不用 updatedAt / 会话创建时间冒充起点。
 * - 颜色与模型名来自 badge 桥（同一份 ModelDirectoryState），侧栏不复制色表；
 *   badge 缺失/版本不符/目录未就绪 → 中性降级但照常计时。
 * - 颜色 = 会话所选 provider，不表示运行期 failover 后的实际执行模型。
 */
import React from 'react'
import {
  BRIDGE_EVENT,
  readBridge,
  type PresentationHandle,
  type PresentationSnapshot,
} from './runtime-bridge.ts'
import {
  elapsedOf,
  formatElapsed,
  initialObservation,
  runtimeTickSnapshot,
  stepObservation,
  subscribeRuntimeTick,
  type RuntimeObservation,
} from './runtime-timer.ts'

export * from './runtime-bridge.ts'
export * from './runtime-timer.ts'

/** 无模型信息时的中性主色（与官方 ongoing 转圈同色）。 */
const FALLBACK_COLOR = 'var(--dsw-alias-state-business-primary, #4c8dff)'

function usePresentation(sessionId: string): PresentationSnapshot | null {
  const [handle, setHandle] = React.useState<PresentationHandle | null>(
    () => readBridge()?.presentationFor?.(sessionId) ?? null,
  )

  React.useEffect(() => {
    const refresh = () => setHandle(readBridge()?.presentationFor?.(sessionId) ?? null)
    refresh()
    window.addEventListener(BRIDGE_EVENT, refresh)
    return () => window.removeEventListener(BRIDGE_EVENT, refresh)
  }, [sessionId])

  const subscribe = React.useCallback(
    (listener: () => void) => (handle === null ? () => {} : handle.subscribe(listener)),
    [handle],
  )
  const getSnapshot = React.useCallback(
    () => (handle === null ? null : handle.getSnapshot()),
    [handle],
  )

  React.useEffect(() => {
    if (handle === null) return
    try {
      handle.load?.()
    } catch {
      /* 目录加载失败只影响配色，计时照常 */
    }
  }, [handle])

  return React.useSyncExternalStore(subscribe, getSnapshot, () => null)
}

function useObservedRuntime(running: boolean): RuntimeObservation {
  const [observation, setObservation] = React.useState<RuntimeObservation>(() =>
    initialObservation(Date.now(), running),
  )
  React.useEffect(() => {
    setObservation((previous) => stepObservation(previous, running, Date.now()))
  }, [running])
  // 共享节拍驱动分钟文案重渲染；节拍值本身不参与展示。
  React.useSyncExternalStore(subscribeRuntimeTick, runtimeTickSnapshot, () => 0)
  return observation
}

function runtimeTitle(
  presentation: PresentationSnapshot | null,
  ms: number | null,
  lowerBound: boolean,
): string {
  const minutes = ms === null ? 0 : Math.floor(ms / 60000)
  const span =
    ms === null
      ? '正在运行'
      : lowerBound
        ? `已运行至少 ${Math.max(1, minutes)} 分钟（这一行开始显示时已在运行，真实起点不可知）`
        : minutes < 1
          ? '本次运行不足 1 分钟'
          : `本次运行约 ${minutes} 分钟`
  if (presentation === null) return `${span} · 模型信息不可用（provider-badge 未启用或目录未就绪）`
  return `${span} · ${presentation.providerName} · ${presentation.modelName}`
}

export interface RunningIndicatorProps {
  sessionId: string
  /** 会话是否正在运行；false 时返回 null（调用方也可自行条件渲染）。 */
  running: boolean
}

/**
 * 运行中标识：彩色转圈环 + 模型徽标 + 已运行时间。
 * 总宽在窄侧栏内约 96px，超出省略；完整说明放 title/aria-label。
 */
export function RunningIndicator(props: RunningIndicatorProps) {
  const { sessionId, running } = props
  const presentation = usePresentation(sessionId)
  const observation = useObservedRuntime(running)
  if (!running) return null

  const elapsed = elapsedOf(observation, Date.now())
  const title = runtimeTitle(presentation, elapsed, observation.lowerBound)
  const color = presentation?.color ?? FALLBACK_COLOR

  return React.createElement(
    'span',
    { className: 'dshsv-run', title, 'aria-label': title },
    React.createElement('span', {
      className: 'dshsv-spin',
      'aria-hidden': true,
      style: { borderTopColor: color, borderRightColor: color },
    }),
    presentation === null
      ? null
      : React.createElement(
          'span',
          {
            className: 'dshsv-runBadge',
            style: { background: presentation.color, color: presentation.ink },
          },
          presentation.text,
        ),
    React.createElement('span', { className: 'dshsv-runTime' }, formatElapsed(elapsed, observation.lowerBound)),
  )
}
