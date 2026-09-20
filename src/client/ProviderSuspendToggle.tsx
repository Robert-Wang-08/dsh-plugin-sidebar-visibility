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
 * 席位粒度（关键）：`settings.models.provider-card` 按 settingsNs 派发 —— 注册一次
 * 会收到该命名空间下的**每一张**卡片（已保存的、新增的、手写声明的都算），每张
 * 卡片的 owner props 带自己的 `settingsPath`。因此挂起/恢复必须按 `settingsPath`
 * 定位，不能动整个命名空间，否则挂起一个 Provider 会把同族其他 Provider 一起清掉。
 *
 * 挂起语义（保留配置、可选项消失、可恢复），按 settingsPath 分三种情况：
 * - 根级 Provider（settingsPath 为空，如 deepseek-official 之于 llm-deepseek）：
 *   它拥有整个命名空间，用户层整段暂存后逐键 unset；恢复时 update 合并回整段。
 * - 命名空间下的 Provider（settingsPath 非空）：只暂存并 unset 该子树；
 *   恢复时 mutate set 回原路径。
 * - 纯组合层 Provider（用户层没有它的配置）：写 [...settingsPath, 'models'] = []
 *   覆盖，目录构建处过滤空模型分组；恢复时 unset 同一路径。
 *
 * 暂存键按 Provider 区分（命名空间 + settingsPath），同族多张卡片不会互相覆盖。
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

/**
 * 暂存键。
 *
 * 同一个命名空间下可以挂多个 Provider（席位按 settingsNs 派发，注册一次收到该族
 * 全部卡片），暂存必须按 Provider 的 settingsPath 分开，否则挂起其中一个会覆盖
 * 另一个的暂存值。settingsPath 为空表示该 Provider 就是命名空间根，键退回命名空间
 * 本身，与旧版本写入的键一致。
 */
function stashKeyOf(ns: string, settingsPath: readonly string[]): string {
  return settingsPath.length === 0 ? ns : `${ns}#${settingsPath.join('/')}`
}

/** 按路径读取普通对象里的值；路径为空时返回对象本身。 */
function readPath(root: unknown, path: readonly string[]): unknown {
  let node: any = root
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined
    node = node[key]
  }
  return node
}

export function ProviderSuspendToggle(props: ProviderSuspendToggleProps) {
  const { provider, remote } = props
  const ns = provider.settingsNs
  const settingsPath = [...provider.settingsPath]
  const stashKey = stashKeyOf(ns, settingsPath)
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => subscribeVisibility(() => force()), [])
  const [busy, setBusy] = React.useState(false)

  /*
   * 旧版本的暂存键只用了命名空间，且存的是整个用户层。这里仍然读它，让被旧逻辑
   * 误清的命名空间还能靠一次「恢复」写回；写回后旧键即被清除。
   */
  const stashes = getVisibility().providerStash
  const entry = stashes[stashKey]
  const legacy = entry === undefined && stashKey !== ns ? stashes[ns] : undefined
  const suspended = entry !== undefined || legacy !== undefined
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
    const at = new Date().toISOString()

    // 根级 Provider：整个命名空间就是它，用户层整段暂存后逐键 unset。
    if (settingsPath.length === 0) {
      if (user && typeof user === 'object' && !Array.isArray(user) && Object.keys(user).length > 0) {
        const section = user as Record<string, unknown>
        await settings.mutate(ns, Object.keys(section).map((k) => ({ op: 'unset', path: [k] })), revision)
        stashProvider(stashKey, { mode: 'unset', stashedValue: section, suspendedAt: at })
        return
      }
      await settings.mutate(ns, [{ op: 'set', path: ['models'], value: [] }], revision)
      stashProvider(stashKey, { mode: 'models-empty', stashedValue: null, suspendedAt: at })
      return
    }

    // 命名空间下的 Provider：只动它自己的子树，同族其他 Provider 不受影响。
    const value = readPath(user, settingsPath)
    if (value !== undefined) {
      await settings.mutate(ns, [{ op: 'unset', path: settingsPath }], revision)
      stashProvider(stashKey, { mode: 'unset', stashedValue: value, suspendedAt: at })
      return
    }
    await settings.mutate(ns, [{ op: 'set', path: [...settingsPath, 'models'], value: [] }], revision)
    stashProvider(stashKey, { mode: 'models-empty', stashedValue: null, suspendedAt: at })
  }

  async function resume() {
    const settings = remote?.settings
    if (!settings?.describe || !settings.mutate) return
    const desc = await settings.describe()
    const view = findNamespaceView(desc, ns)
    const revision = typeof view?.revision === 'number' ? view.revision : undefined

    // 旧键：存的是整个用户层 section，按整段写回（挽回被旧逻辑误清的命名空间）。
    if (entry === undefined && legacy !== undefined) {
      if (legacy.mode === 'unset' && legacy.stashedValue && typeof legacy.stashedValue === 'object') {
        await settings.update?.(ns, legacy.stashedValue as Record<string, unknown>, revision)
      } else {
        await settings.mutate(ns, [{ op: 'unset', path: ['models'] }], revision)
      }
      popProviderStash(ns)
      return
    }

    if (entry === undefined) return

    if (entry.mode === 'unset') {
      if (settingsPath.length === 0) {
        // 根级 Provider：暂存的是整个用户层，按整段合并写回（空路径无法寻址命名空间根）。
        await settings.update?.(ns, entry.stashedValue as Record<string, unknown>, revision)
      } else {
        await settings.mutate(ns, [{ op: 'set', path: settingsPath, value: entry.stashedValue }], revision)
      }
    } else {
      await settings.mutate(ns, [{ op: 'unset', path: [...settingsPath, 'models'] }], revision)
    }
    popProviderStash(stashKey)
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
