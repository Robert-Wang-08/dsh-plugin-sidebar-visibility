/**
 * browser 半入口：注册两个席位占用者。
 *
 * 复核后确认的注册形状（先例：dsh-client-ui-workspace/lib/client.js apply()）：
 *   ctx.slots.inject('<seat>', () => ctx.slots.register(options, Component))
 *   options = { name, key?, priority?, children?, store?, inject?: () => face, locale? }
 *
 * 1. `sidebar.workspaces`（single，scope root）：遮蔽官方 WorkspaceBrowser。
 *    该席位已被 client-ui-workspace 以默认 priority 0 占用，single 席位在同一
 *    priority 上只允许一个占用者，因此必须换一个 priority 注册；渲染方按
 *    priority 升序取第一个，所以取 -1 才能压过官方。inject face 复用官方
 *    ctx.uiWorkspace 导航服务提供 open / startSession 等动作。
 * 2. `settings.models.provider-card`（keyed）：无通配注册，按 settingsNs
 *    逐个 key 注册（先例：dsh-cordis-client-runner 内嵌示例的 key 字段）。
 *    该席位当前无官方占用者（slot 元数据 occupants 为空、keyDomain 标注
 *    "none are taken yet"），故沿用默认 priority。目前覆盖两个内置家族；
 *    用户手配命名空间的扩展注册留 TODO。
 */
import type { Context } from '@deepseek-ai/cordis'
import { ProviderSuspendToggle } from './ProviderSuspendToggle.tsx'
import { WorkspaceTree } from './WorkspaceTree.tsx'

/**
 * cordis 服务注入清单（与官方 client 包的 inject 导出同款）。
 *
 * `sessions` 是官方查找能力的来源：官方 WorkspaceBrowser 的内容检索走
 * `ctx.get('sessions').search(query, signal)`（Host 可见消息内容索引），
 * 该服务也是官方 ui-workspace 的 inject 项之一。
 */
export const inject = ['slots', 'uiWorkspace', 'sessions', 'remote', 'remote.settings']

/** Provider 卡片席位按命名空间注册的 key 清单。 */
const PROVIDER_CARD_KEYS = ['llm-deepseek', 'llm-pi-ai']

/**
 * 遮蔽 `sidebar.workspaces` 官方占用者所需的 priority。
 *
 * 席位按 priority 升序排列、取第一个渲染；官方 client-ui-workspace 用默认 0，
 * 因此这里必须低于 0。single 席位只在 priority 相同时报重复占用。
 */
const SHADOW_OFFICIAL_PRIORITY = -1

/** 官方各 Controller 统一的返回包装（`RemoteResult<T>`）的两支。 */
type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }

/** `sessions` 服务上本插件用到的那一面（官方 ISessions 的子集）。 */
interface SessionsFace {
  search(
    query: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<{ items: { sessionId: string; snippet: string }[]; hasMore: boolean }>>
  /**
   * 会话绑定。只有已绑定的会话能拿到对外面；未绑定时官方同样直接报错
   * （`dsh-client-ui-workspace` 的 renameSession 走同一条路径）。
   */
  binding(sessionId: string):
    | { session: { rename(title: string): Promise<RemoteResult<{ title: string; seq: number }>> } }
    | undefined
}

interface VisibilityClientContext extends Context {
  slots: {
    inject: (seat: string, factory: () => unknown) => void
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
  uiWorkspace?: {
    openSession: (sessionId: string) => void
    startSession: (workspaceId?: string) => void
    forkSession: (sessionId: string) => Promise<void>
    archiveSession: (sessionId: string) => Promise<void>
  }
  get?: (name: string) => unknown
  remote?: unknown
}

export function apply(ctx: Context) {
  const client = ctx as VisibilityClientContext
  const sessions = client.get?.('sessions') as SessionsFace | undefined

  // 工作区树席位：遮蔽官方占用者，动作面走官方导航服务。
  client.slots.inject('sidebar.workspaces', () =>
    client.slots.register(
      {
        name: 'sidebar.workspaces',
        priority: SHADOW_OFFICIAL_PRIORITY,
        inject: () => ({
          open: (sessionId: string) => client.uiWorkspace?.openSession(sessionId),
          startSession: (workspaceId?: string) => client.uiWorkspace?.startSession(workspaceId),
          forkSession: (sessionId: string) => {
            client.uiWorkspace?.forkSession(sessionId).catch(() => {})
          },
          archiveSession: (sessionId: string) => client.uiWorkspace?.archiveSession(sessionId) ?? Promise.resolve(),
          /*
           * 重命名：与官方 WorkspaceBrowser 的 renameSession 同一路径 ——
           * sessions.binding(id).session.rename(title) 返回 RemoteResult，
           * 失败时抛出错误消息供调用方就地展示。
           */
          renameSession: async (sessionId: string, title: string) => {
            const session = sessions?.binding(sessionId)?.session
            if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
            const result = await session.rename(title)
            if (!result.ok) throw new Error(result.error.message)
          },
          // 内容检索：官方 WorkspaceBrowser 的同一 Host 索引 RPC。
          searchSessions: (query: string, signal: AbortSignal) => sessions?.search(query, signal),
        }),
      },
      WorkspaceTree,
    ),
  )

  // Provider 卡片席位：keyed，按命名空间逐个注册。
  for (const ns of PROVIDER_CARD_KEYS) {
    client.slots.inject('settings.models.provider-card', () =>
      client.slots.register(
        {
          name: 'settings.models.provider-card',
          key: ns,
          inject: () => ({ remote: client.remote }),
        },
        ProviderSuspendToggle,
      ),
    )
  }
}
