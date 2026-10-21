/**
 * provider-badge 只读展示桥的消费面（纯函数，不含 React）。
 *
 * badge 是模型与配色的事实源：颜色 = 用户自选色 > ROUTE_COLORS > 自动调色板，
 * 字色 = inkFor，模型名取自同一份 ModelDirectoryState。侧栏**不复制色表**，
 * 只消费 `window.__DSH_PROVIDER_BADGE__.presentationFor(sessionId)`。
 *
 * 版本不符、桥缺失、目录未就绪或读取抛错 → null，调用方中性降级（照常计时）。
 * 语义边界：颜色/模型代表会话**所选** provider 与模型，不反映运行期 failover
 * 后的实际执行模型（与输入框徽标同口径）。
 */

/** 桥接全局名（badge 侧同名字符串）。 */
export const BRIDGE_GLOBAL = '__DSH_PROVIDER_BADGE__'
/** badge 安装桥后广播的事件名：消费方可能在桥安装前已渲染。 */
export const BRIDGE_EVENT = 'dsh-provider-badge:bridge'
/** 桥协议版本；任一侧改动必须同步升版本。 */
export const BRIDGE_VERSION = 1

export interface PresentationSnapshot {
  /** 徽标底色（CSS 颜色串）。 */
  color: string
  /** 与底色对比的前景色。 */
  ink: string
  /** badge 徽标文字（四字母缩写或覆盖表文本）。 */
  text: string
  /** provider 路由 id（如 codex-relay）。 */
  providerId: string
  /** provider 显示名（未取到时与 providerId 相同）。 */
  providerName: string
  /** 当前所选模型 id。 */
  modelId: string
  /** 当前所选模型显示名（未取到时与 modelId 相同）。 */
  modelName: string
}

export interface PresentationHandle {
  getSnapshot: () => PresentationSnapshot | null
  subscribe: (listener: () => void) => () => void
  load?: () => void
}

export interface BridgeShape {
  version?: number
  presentationFor?: (sessionId: string) => PresentationHandle | null
}

/** 读取 badge 桥；未装 badge、版本不符或读取抛错时返回 null（中性降级）。 */
export function readBridge(): BridgeShape | null {
  const root = typeof window === 'undefined' ? undefined : (window as unknown as Record<string, unknown>)
  const bridge = root?.[BRIDGE_GLOBAL] as BridgeShape | undefined
  if (bridge === null || bridge === undefined || typeof bridge !== 'object') return null
  if (bridge.version !== BRIDGE_VERSION || typeof bridge.presentationFor !== 'function') return null
  return bridge
}
