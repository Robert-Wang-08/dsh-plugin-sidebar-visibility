/**
 * Provider 挂起/恢复开关 —— 注入 `settings.models.provider-card` 席位（keyed，
 * 本包在 ./index.ts 按 settingsNs 逐个注册）。
 *
 * 复核后确认的 API（全部有官方先例）：
 * - owner props：{ provider: ProviderDirectoryEntry, configured, keyConfigured }
 *   ProviderDirectoryEntry { provider: 路由 id, displayName, settingsNs,
 *   settingsPath: 该 Provider 在命名空间用户层内的路径, active, declared? }
 *   （dsh-client-ui-settings-models/lib/types/client/store.d.ts）
 * - settings remote（dsh-api-settings-controller/lib/types/index.d.ts）：
 *   describe() → 各命名空间视图 { value, base?, user?, revision }
 *   update(ns, patch, expectedRevision) / replace(ns, section, expectedRevision)
 *   mutate(ns, [{ op: 'set'|'unset', path: string[], value? }], expectedRevision)
 *   op 形状先例：dsh-client-ui-settings-models/lib/client.js 的 pathOps()。
 *
 * 挂起语义（保留配置、可选项消失、可恢复）：
 * - 分支 A（用户层有配置，如 llm-pi-ai 手配 Provider）：暂存 user 子树后
 *   按 pathOps 同款方式逐键 unset；恢复时 update 合并回暂存值。
 * - 分支 B（纯组合层 Provider，如 deepseek-official）：用户层写入
 *   [...settingsPath, 'models'] = [] 覆盖，目录构建处过滤空模型分组；
 *   恢复时 unset 同一路径，覆盖移除、组合层配置自动回归。
 *
 * v0 范围边界：subagent allowedModels 白名单快照剔除留到迭代 2（需要先
 * 确认路由 id 与 subagent-model-selection 的精确结构，避免误写白名单）。
 * 挂起后该 Provider 路由仍可能出现在已固定的 subagent 选择里。
 */
import React from 'react'
import {
  getVisibility,
  popProviderStash,
  stashProvider,
  subscribeVisibility,
} from './visibility-store.ts'

export interface ProviderSuspendToggleProps {
  provider: {
    provider: string
    displayName?: string
    settingsNs: string
    settingsPath: readonly string[]
    active?: boolean
    declared?: boolean
  }
  configured?: boolean
  keyConfigured?: boolean
  /** 注册时 inject face 注入（见 ./index.ts）。 */
  remote?: {
    settings?: {
      describe?: () => Promise<any>
      update?: (ns: string, patch: Record<string, unknown>, expectedRevision?: number) => Promise<any>
      mutate?: (ns: string, ops: Array<{ op: string; path: string[]; value?: unknown }>, expectedRevision?: number) => Promise<any>
    }
  }
  t?: (key: string) => string
}

/** 在 describe() 结果中定位一个命名空间视图（兼容数组与记录两种外形）。 */
function findNamespaceView(desc: any, ns: string): { user?: unknown; revision?: number } | null {
  const list: any[] = Array.isArray(desc?.namespaces) ? desc.namespaces : Object.values(desc?.namespaces ?? desc ?? {})
  for (const v of list) {
    if (v && (v.ns === ns || v.name === ns || v.namespace === ns)) return v
  }
  return null
}

export function ProviderSuspendToggle(props: ProviderSuspendToggleProps) {
  const { provider, remote } = props
  const ns = provider.settingsNs
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => subscribeVisibility(() => force()), [])
  const [busy, setBusy] = React.useState(false)

  const suspended = Boolean(getVisibility().providerStash[ns])
  const label = suspended ? '恢复 Provider' : '挂起 Provider'

  async function suspend() {
    const settings = remote?.settings
    if (!settings?.describe || !settings.mutate) {
      console.warn('[sidebar-visibility] remote.settings 不可用')
      return
    }
    const desc = await settings.describe()
    const view = findNamespaceView(desc, ns)
    const revision = typeof view?.revision === 'number' ? view.revision : undefined
    const user = view?.user

    if (user && typeof user === 'object' && !Array.isArray(user)) {
      // 分支 A：用户层整段暂存 + 逐键 unset（pathOps 同款路径寻址）。
      const section = user as Record<string, unknown>
      const ops = Object.keys(section).map((k) => ({ op: 'unset', path: [k] }))
      if (ops.length > 0) await settings.mutate(ns, ops, revision)
      stashProvider(ns, { mode: 'unset', stashedValue: section, suspendedAt: new Date().toISOString() })
    } else {
      // 分支 B：用户层为空 → 写入 models: [] 覆盖；settingsPath 寻址该 Provider 子树。
      const path = [...provider.settingsPath, 'models']
      await settings.mutate(ns, [{ op: 'set', path, value: [] }], revision)
      stashProvider(ns, { mode: 'models-empty', stashedValue: null, suspendedAt: new Date().toISOString() })
    }
  }

  async function resume() {
    const settings = remote?.settings
    if (!settings?.describe || !settings.mutate) return
    const entry = getVisibility().providerStash[ns]
    if (!entry) return
    const desc = await settings.describe()
    const view = findNamespaceView(desc, ns)
    const revision = typeof view?.revision === 'number' ? view.revision : undefined

    if (entry.mode === 'unset' && entry.stashedValue && typeof entry.stashedValue === 'object') {
      // 分支 A 恢复：暂存子树合并回用户层。
      await settings.update?.(ns, entry.stashedValue as Record<string, unknown>, revision)
    } else {
      // 分支 B 恢复：移除 models: [] 覆盖。
      const path = [...provider.settingsPath, 'models']
      await settings.mutate(ns, [{ op: 'unset', path }], revision)
    }
    popProviderStash(ns)
  }

  async function onToggle() {
    setBusy(true)
    try {
      if (suspended) await resume()
      else await suspend()
    } catch (error) {
      console.warn('[sidebar-visibility] provider 挂起/恢复失败', error)
    } finally {
      setBusy(false)
    }
  }

  return React.createElement(
    'button',
    {
      type: 'button',
      disabled: busy,
      onClick: onToggle,
      'data-visibility-provider': ns,
      title: suspended
        ? '恢复该 Provider：暂存的配置写回，模型立即可选'
        : '挂起该 Provider：配置保留在本插件暂存区，模型从可选项中消失，可随时恢复',
    },
    busy ? '…' : label,
  )
}
