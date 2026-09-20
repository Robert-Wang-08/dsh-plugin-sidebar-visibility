/**
 * 增强工作区树 —— `sidebar.workspaces` 席位的替换型占用者。
 *
 * 挂载语义：该席位为 single，官方 client-ui-workspace 以默认 priority 0 占用；
 * 本插件以 priority -1 注册，按「priority 升序取首个渲染」的规则遮蔽官方
 * WorkspaceBrowser（见 ./index.ts 的 SHADOW_OFFICIAL_PRIORITY）。
 *
 * 能力对齐：遮蔽意味着官方浏览器整体不再渲染，因此官方原有的三项视图能力
 * 必须在本组件内等价提供，否则会被静默丢失：
 *   1. 分组模式 groupBy：`workspace`（按工作区分段）| `flat`（合并为一个列表）
 *   2. 排序 orderBy：`manual`（沿用 Host 顺序）| `updated`（按最近更新降序）
 *   3. 查找：本地标题 / 路径 / 工作区名匹配 + Host 消息内容索引检索
 * 官方把 deriveGroups / deriveFlat / ViewOptionsMenu / createWorkspaceViewStore
 * 全部留在包内（`./client` 只导出类型与 apply/inject），无法复用，故按官方语义
 * 本地实现，并沿用官方 viewing store 的默认值（workspace + updated）。
 *
 * 在此之上另有两项本插件自有能力：
 *   - 工作区隐藏 / 收藏会话 / 仅收藏（见 ./visibility-store.ts）
 *   - 工作区分组折叠：点标题行箭头或标题本身收起该组会话行，标题行保留原位；
 *     折叠态随其余偏好一起持久化在同一个 localStorage 键。
 *
 * 数据来源（GlobalStandardProps，框架统一注入）：
 * - useWorkspaces → WorkspaceSnapshot { items: WorkspaceView[], archivedSessionIds }
 * - useSessions → SessionListState { ids, byId: SessionSummary, current }
 * 动作面来自本包注册时 inject 的 face（见 ./index.ts），底层走官方
 * ctx.uiWorkspace 导航服务与 ctx.get('sessions') 内容检索。
 */
import React from 'react'
import {
  getVisibility,
  setGroupBy,
  setOrderBy,
  setCollapsedWorkspaces,
  subscribeVisibility,
  toggleCollapsedWorkspace,
  toggleFavoriteSession,
  toggleHiddenWorkspace,
  type SessionGroupBy,
  type SessionOrderBy,
} from './visibility-store.ts'

interface SessionSummaryLike {
  id: string
  displayTitle?: string
  title?: string
  cwd?: string
  origin?: string
  blank?: boolean
  updatedAt?: number
}

interface WorkspaceViewLike {
  workspaceId: string
  title?: string
  path?: string
  sessionIds?: readonly string[]
}

/** `sessions.search` 的返回形状（官方 ISessions.search 的 RemoteResult 包装）。 */
type SearchOutcome =
  | { ok: true; value: { items: { sessionId: string; snippet: string }[]; hasMore: boolean } }
  | { ok: false; error: { message: string } }

export interface WorkspaceTreeProps {
  useSessions?: <S>(selector: (state: any) => S) => S
  useWorkspaces?: <S>(selector: (state: any) => S) => S
  open?: (sessionId: string) => void
  startSession?: (workspaceId?: string) => void
  searchSessions?: (query: string, signal: AbortSignal) => Promise<SearchOutcome> | undefined
  /** 单会话动作面：与官方 WorkspaceBrowser 的注入同名同语义。 */
  renameSession?: (sessionId: string, title: string) => Promise<void>
  forkSession?: (sessionId: string) => void
  archiveSession?: (sessionId: string) => Promise<void>
  t?: (key: string) => string
}

/** 检索输入到发请求之间的去抖；官方同样在输入侧去抖而非逐键发请求。 */
const SEARCH_DEBOUNCE_MS = 250

interface Group {
  workspace: WorkspaceViewLike | null
  key: string
  title: string
  sessions: SessionSummaryLike[]
}

interface SearchRow {
  session: SessionSummaryLike
  snippet?: string
  workspaceLabel?: string
}

export function WorkspaceTree(props: WorkspaceTreeProps) {
  const { useSessions, useWorkspaces, open, startSession, searchSessions, renameSession, forkSession, archiveSession } = props
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => subscribeVisibility(() => force()), [])
  const [favoritesOnly, setFavoritesOnly] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [contentHits, setContentHits] = React.useState<{ sessionId: string; snippet: string }[]>([])
  const [searchPhase, setSearchPhase] = React.useState<'idle' | 'loading' | 'error'>('idle')
  const [searchError, setSearchError] = React.useState<string | undefined>(undefined)
  /**
   * 行内重命名。官方用 Modal 对话框承载，本插件拿不到该原语，改为把标题行
   * 就地换成输入框：Enter 提交、Escape 取消，失败消息显示在标题下方。
   */
  const [renaming, setRenaming] = React.useState<{ id: string; draft: string } | null>(null)
  const [renameBusy, setRenameBusy] = React.useState(false)
  const [renameError, setRenameError] = React.useState<string | undefined>(undefined)

  const prefs = getVisibility()
  const favorites = new Set(prefs.favoriteSessionIds)
  const hidden = new Set(prefs.hiddenWorkspaceIds)
  const collapsed = new Set(prefs.collapsedWorkspaceIds)
  const groupBy: SessionGroupBy = prefs.groupBy
  const orderBy: SessionOrderBy = prefs.orderBy

  const byId: Record<string, SessionSummaryLike> = useSessions?.((s) => s.byId) ?? {}
  const sessionIds: readonly string[] = useSessions?.((s) => s.ids) ?? []
  const current: string | undefined = useSessions?.((s) => s.current)
  const workspaces: readonly WorkspaceViewLike[] = useWorkspaces?.((s) => s.items) ?? []
  const archived: readonly string[] = useWorkspaces?.((s) => s.archivedSessionIds) ?? []
  const archivedSet = new Set(archived)

  // 归档语义优先：已归档会话一律不出现在树里（含收藏视图与检索结果）。
  const visibleSession = React.useCallback(
    (id: string): SessionSummaryLike | null => {
      const s = byId[id]
      if (!s || archivedSet.has(id) || s.origin === 'subagent') return null
      return s
    },
    [byId, archivedSet],
  )

  const normalizedQuery = query.trim()

  // 内容检索：官方 WorkspaceBrowser 走同一 Host 可见消息内容索引。
  React.useEffect(() => {
    if (normalizedQuery === '' || searchSessions === undefined) {
      setContentHits([])
      setSearchPhase('idle')
      return undefined
    }
    const controller = new AbortController()
    setSearchPhase('loading')
    const timer = globalThis.setTimeout(() => {
      const pending = searchSessions(normalizedQuery, controller.signal)
      if (pending === undefined) {
        setContentHits([])
        setSearchPhase('idle')
        return
      }
      pending
        .then((result) => {
          if (controller.signal.aborted) return
          if (result.ok) {
            setContentHits(result.value.items)
            setSearchPhase('idle')
            setSearchError(undefined)
          } else {
            setContentHits([])
            setSearchPhase('error')
            setSearchError(result.error.message)
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          setContentHits([])
          setSearchPhase('error')
          setSearchError(error instanceof Error ? error.message : String(error))
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      globalThis.clearTimeout(timer)
    }
  }, [normalizedQuery, searchSessions])

  const byRecency = (a: SessionSummaryLike, b: SessionSummaryLike) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)

  /**
   * 会话 → 所属工作区标签。预先建表，避免逐会话线性扫描工作区列表
   * （会话数 × 工作区数 的重复开销）。
   */
  const workspaceLabelBySession = new Map<string, string>()
  for (const w of workspaces) {
    const label = w.title || w.path || w.workspaceId
    for (const id of w.sessionIds ?? []) if (!workspaceLabelBySession.has(id)) workspaceLabelBySession.set(id, label)
  }

  /**
   * 排序档位。官方 `manual` 是「用户拖拽顺序 + 活动提升」，本插件没有拖拽
   * 能力，因此 manual 取 Host / 工作区给出的顺序，updated 按最近更新降序。
   */
  const ordered = (list: SessionSummaryLike[]): SessionSummaryLike[] =>
    orderBy === 'updated' ? [...list].sort(byRecency) : list

  /** 每个工作区的标题与路径，用于本地匹配与检索结果的工作区上下文。 */
  const workspaceLabelOf = (id: string): string | undefined => workspaceLabelBySession.get(id)

  const matchesLocally = (s: SessionSummaryLike, needle: string): boolean => {
    const haystack = [s.displayTitle, s.title, s.cwd, workspaceLabelOf(s.id)]
    return haystack.some((value) => typeof value === 'string' && value.toLowerCase().includes(needle))
  }

  // ---- 分组模式 -----------------------------------------------------------

  const buildGroups = (): Group[] => {
    const groups: Group[] = workspaces.map((w) => ({
      workspace: w,
      key: w.workspaceId,
      title: w.title || w.path || w.workspaceId,
      sessions: (w.sessionIds ?? []).map(visibleSession).filter(Boolean) as SessionSummaryLike[],
    }))

    const groupedIds = new Set(groups.flatMap((g) => g.sessions.map((s) => s.id)))
    const ungrouped = sessionIds
      .filter((id) => !groupedIds.has(id))
      .map(visibleSession)
      .filter(Boolean) as SessionSummaryLike[]
    if (ungrouped.length > 0) {
      groups.push({ workspace: null, key: '__ungrouped__', title: '未分组', sessions: ungrouped })
    }
    return groups.map((g) => ({ ...g, sessions: ordered(g.sessions) }))
  }

  /** 平铺模式：所有可见会话合并为一个列表，按当前排序档位排列。 */
  const buildFlat = (): SessionSummaryLike[] => {
    const groupedIds = new Set(workspaces.flatMap((w) => w.sessionIds ?? []))
    const head = sessionIds.filter((id) => !groupedIds.has(id))
    const tail = workspaces.flatMap((w) => (w.sessionIds ?? []).slice())
    const seen = new Set<string>()
    const rows: SessionSummaryLike[] = []
    for (const id of [...head, ...tail]) {
      if (seen.has(id)) continue
      seen.add(id)
      const s = visibleSession(id)
      if (s !== null) rows.push(s)
    }
    return ordered(rows)
  }

  // ---- 检索结果 -----------------------------------------------------------

  /**
   * 合并本地匹配与 Host 内容命中，沿用官方 deriveSearchResults 的次序约定：
   * 本地行按最近更新在前，纯内容命中保持后端顺序，重复会话就地补上后端片段。
   */
  const buildSearchRows = (): SearchRow[] => {
    const needle = normalizedQuery.toLowerCase()
    const rows: SearchRow[] = []
    const seen = new Set<string>()
    const snippetOf = new Map(contentHits.map((hit) => [hit.sessionId, hit.snippet]))

    for (const s of buildFlat()) {
      if (!matchesLocally(s, needle)) continue
      seen.add(s.id)
      const snippet = snippetOf.get(s.id)
      rows.push({ session: s, workspaceLabel: workspaceLabelOf(s.id), ...(snippet === undefined ? {} : { snippet }) })
    }

    for (const hit of contentHits) {
      if (seen.has(hit.sessionId)) continue
      const s = visibleSession(hit.sessionId)
      if (s === null) continue
      seen.add(hit.sessionId)
      rows.push({ session: s, snippet: hit.snippet, workspaceLabel: workspaceLabelOf(hit.sessionId) })
    }
    return rows
  }

  // ---- 单会话动作（重命名 / 分叉 / 归档 / 收藏）---------------------------

  const startRename = (s: SessionSummaryLike) => {
    setRenaming({ id: s.id, draft: s.displayTitle || s.title || s.id })
    setRenameError(undefined)
  }

  const cancelRename = () => {
    if (renameBusy) return
    setRenaming(null)
    setRenameError(undefined)
  }

  const confirmRename = () => {
    if (renaming === null || renameBusy) return
    const title = renaming.draft.trim()
    if (title === '') return
    setRenameBusy(true)
    setRenameError(undefined)
    const pending = renameSession?.(renaming.id, title)
    if (pending === undefined) {
      setRenameBusy(false)
      setRenameError('宿主未提供重命名动作')
      return
    }
    pending
      .then(() => {
        setRenameBusy(false)
        setRenaming(null)
      })
      .catch((error: unknown) => {
        setRenameBusy(false)
        setRenameError(error instanceof Error ? error.message : String(error))
      })
  }

  /** 归档失败只记警告：与官方 onSessionArchive 的处理一致，不打断列表。 */
  const requestArchive = (sessionId: string) => {
    const pending = archiveSession?.(sessionId)
    if (pending === undefined) return
    pending.catch((error: unknown) => {
      console.warn('session archive rejected:', error)
    })
  }

  // ---- 渲染 ---------------------------------------------------------------

  function sessionRow(s: SessionSummaryLike, snippet?: string) {
    if (favoritesOnly && !favorites.has(s.id)) return null
    const editing = renaming !== null && renaming.id === s.id ? renaming : null

    /*
     * 动作竖排在标题行下方，标题因此独占整行宽度。
     * 三者原先与标题同排，窄侧栏里会盖住会话名，且按钮贴得太近容易误点。
     */
    const actions = React.createElement(
      'span',
      { className: 'dshsv-rowActions' },
      React.createElement('button', { type: 'button', className: 'dshsv-btn', title: '重命名该会话', onClick: () => startRename(s) }, '重命名'),
      React.createElement(
        'button',
        { type: 'button', className: 'dshsv-btn', title: '从该会话的最后一个完整回合分叉出新会话', onClick: () => forkSession?.(s.id) },
        '分叉',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'dshsv-btn',
          title: '归档该会话（可在「设置 → 已归档会话」恢复）',
          onClick: () => requestArchive(s.id),
        },
        '归档',
      ),
    )

    return React.createElement(
      'div',
      {
        key: s.id,
        'data-session-id': s.id,
        className: 'dshsv-sessionRow',
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '2px 8px',
          cursor: 'pointer',
          background: s.id === current ? 'rgba(128,128,128,0.15)' : undefined,
        },
      },
      // 第一行：标题占满宽度，收藏常显在右端。
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement(
          'span',
          { style: { flex: 1, minWidth: 0 } },
          editing === null
            ? React.createElement(
                'span',
                {
                  style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                  onClick: () => open?.(s.id),
                },
                s.displayTitle || s.title || s.id,
              )
            : React.createElement('input', {
                type: 'text',
                value: editing.draft,
                autoFocus: true,
                disabled: renameBusy,
                'aria-label': '重命名会话',
                style: { width: '100%', boxSizing: 'border-box', fontSize: 11, padding: '1px 4px' },
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRenaming({ id: s.id, draft: e.target.value }),
                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    confirmRename()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelRename()
                  }
                },
              }),
          snippet === undefined || editing !== null
            ? null
            : React.createElement(
                'span',
                {
                  style: {
                    display: 'block',
                    fontSize: 10,
                    opacity: 0.7,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                snippet,
              ),
          editing !== null && renameError !== undefined
            ? React.createElement('span', { style: { display: 'block', fontSize: 10, opacity: 0.8 } }, renameError)
            : null,
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshsv-btn',
            title: favorites.has(s.id) ? '取消收藏' : '收藏',
            onClick: () => toggleFavoriteSession(s.id),
          },
          favorites.has(s.id) ? '★' : '☆',
        ),
      ),
      // 第二行：竖排动作。重命名进行中换成 确定 / 取消 并常显。
      editing === null
        ? actions
        : React.createElement(
            'span',
            { className: 'dshsv-rowActions', style: { display: 'flex' } },
            React.createElement('button', { type: 'button', className: 'dshsv-btn', disabled: renameBusy, onClick: confirmRename }, '确定'),
            React.createElement('button', { type: 'button', className: 'dshsv-btn', disabled: renameBusy, onClick: cancelRename }, '取消'),
          ),
    )
  }

  function workspaceBlock(g: Group, isHidden: boolean) {
    const isCollapsed = collapsed.has(g.key)
    // 折叠与隐藏都收起组内会话；隐藏还会把整组挪到树底折叠区，折叠保留分组位置。
    const expanded = !isHidden && !isCollapsed
    /*
     * 行数用与 sessionRow 同一个「仅收藏」判据独立算出，折叠时就不必先造一遍
     * 元素再丢弃；展开时元素数量与徽标数字一致。
     */
    const rowCount = g.sessions.filter((s) => !favoritesOnly || favorites.has(s.id)).length
    const rows = expanded
      ? g.sessions.map((s) => sessionRow(s)).filter((row): row is React.ReactElement => row !== null)
      : []
    return React.createElement(
      'div',
      { key: g.key, style: { marginBottom: 6 } },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontWeight: 600 } },
        isHidden
          ? null
          : React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshsv-btn dshsv-caret',
                'aria-expanded': !isCollapsed,
                'aria-label': `${isCollapsed ? '展开' : '折叠'}工作区 ${g.title}`,
                title: isCollapsed ? '展开该工作区' : '折叠该工作区（收起组内会话）',
                onClick: () => toggleCollapsedWorkspace(g.key),
              },
              isCollapsed ? '▸' : '▾',
            ),
        React.createElement(
          'span',
          {
            style: {
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: isHidden ? undefined : 'pointer',
            },
            title: g.workspace?.path ?? g.title,
            onClick: isHidden ? undefined : () => toggleCollapsedWorkspace(g.key),
          },
          g.title,
        ),
        isCollapsed && rowCount > 0
          ? React.createElement('span', { style: { fontSize: 10, opacity: 0.6 } }, String(rowCount))
          : null,
        g.workspace
          ? React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshsv-btn',
                title: isHidden ? '恢复显示该工作区' : '隐藏该工作区（可恢复，会话数据不受影响）',
                onClick: () => toggleHiddenWorkspace(g.key),
              },
              isHidden ? '恢复' : '隐藏',
            )
          : null,
        // 新建会话：与官方项目行右侧的加号同一语义，先展开分组再进入新建流程。
        g.workspace
          ? React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshsv-btn',
                'aria-label': `在“${g.title}”中新建会话`,
                title: `在“${g.title}”中新建会话`,
                onClick: () => {
                  if (isCollapsed) toggleCollapsedWorkspace(g.key)
                  startSession?.(g.key)
                },
              },
              '+',
            )
          : null,
      ),
      expanded ? rows : null,
    )
  }

  const selectStyle: React.CSSProperties = { fontSize: 11, maxWidth: 108 }
  const searchInputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    padding: '2px 6px',
    boxSizing: 'border-box',
  }

  /*
   * 滚动结构必须与官方 WorkspaceBrowser 一致。
   *
   * 席位外层 hHd-Xa_regionArea 是 height 固定的 flex 容器且 overflow:hidden。
   * 占用者若按普通块级元素渲染（height 随内容增长、overflow:visible），内容会
   * 长到数千像素而被外层裁掉，侧栏既滚不动也看不全。官方把根节点做成
   * `flex:1 + min-height:0` 的纵向 flex 容器，再让列表层 `flex:1 + min-height:0
   * + overflow-y:auto` 自己滚；本组件照此对齐。
   */
  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    boxSizing: 'border-box',
  }
  const scrollStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBottom: 16,
  }

  /*
   * 本插件不引入样式表，只把需要 `:hover` 与「浏览器默认 button 太大」这两类
   * 内联样式表达不了的东西放在这里，前缀固定 `.dshsv-`，避免引入 React 悬停
   * 状态（会话可达数百，悬停重渲染整棵树不划算）。
   *
   * - `.dshsv-btn`：侧栏内的紧凑按钮，默认 button 在窄侧栏里偏大。
   * - `.dshsv-caret`：折叠箭头，固定宽度以免折叠 / 展开时标题横向跳动。
   * - `.dshsv-rowActions`：会话动作竖排，平时隐藏、行悬停显示，与官方
   *   `YDXeBa_rowActions` 的行为一致。重命名进行中时用内联 `display:flex`
   *   覆盖，保持常显。
   */
  const styleTag = React.createElement(
    'style',
    null,
    '.dshsv-btn{font-size:11px;line-height:16px;padding:1px 6px;border:none;background:transparent;color:inherit;border-radius:4px;cursor:pointer;flex:none;font-family:inherit}' +
      '.dshsv-btn:hover{background:rgba(128,128,128,0.22)}' +
      '.dshsv-btn:disabled{opacity:0.5;cursor:default;background:transparent}' +
      '.dshsv-caret{width:14px;padding:0;font-size:10px;opacity:0.7}' +
      '.dshsv-caret:hover{opacity:1;background:transparent}' +
      '.dshsv-rowActions{display:none;flex-direction:column;align-items:stretch;gap:1px;margin-top:1px}' +
      '.dshsv-sessionRow:hover .dshsv-rowActions{display:flex}' +
      '.dshsv-rowActions .dshsv-btn{text-align:left;width:100%}',
  )

  /*
   * 分组结果提前到这里算：头部要放「全部折叠 / 全部展开」，按钮文案与动作都
   * 依赖当前折叠范围与折叠态。放在 header 之前可避免 buildGroups 被调用两次。
   */
  const groups = buildGroups()
  const visibleGroups = groups.filter((g) => g.workspace === null || !hidden.has(g.key))
  const hiddenGroups = groups.filter((g) => g.workspace !== null && hidden.has(g.key))

  /*
   * 可折叠范围 = 当前可见分组（含「未分组」），仅分组模式适用。已隐藏的分组
   * 没有折叠箭头，不参与全折叠，其折叠态也原样保留。
   */
  const collapsibleKeys = groupBy === 'workspace' ? visibleGroups.map((g) => g.key) : []
  const allCollapsed = collapsibleKeys.length > 0 && collapsibleKeys.every((key) => collapsed.has(key))

  /** 全折叠 / 全展开：一次覆盖写入，只作用于当前可折叠范围。 */
  const toggleAllCollapsed = () => {
    const scope = new Set(collapsibleKeys)
    setCollapsedWorkspaces(
      allCollapsed
        ? prefs.collapsedWorkspaceIds.filter((id) => !scope.has(id))
        : [...new Set([...prefs.collapsedWorkspaceIds, ...collapsibleKeys])],
    )
  }

  const header = React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 8px' } },
    // 查找
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 4 } },
      React.createElement('input', {
        type: 'search',
        value: query,
        placeholder: '查找会话…',
        'aria-label': '查找会话',
        style: searchInputStyle,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Escape') setQuery('')
        },
      }),
      searchPhase === 'loading' ? React.createElement('span', { style: { fontSize: 11, opacity: 0.6 } }, '检索中') : null,
      searchPhase === 'error' ? React.createElement('span', { style: { fontSize: 11, opacity: 0.6 }, title: `内容检索不可用，仅显示本地匹配：${searchError ?? 'unknown'}` }, '仅本地') : null,
    ),
    // 视图选项：分组模式 + 排序档位 + 仅收藏
    React.createElement(
      'div',
      { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
      React.createElement(
        'label',
        { style: { display: 'flex', gap: 3, alignItems: 'center', fontSize: 11 } },
        '视图',
        React.createElement(
          'select',
          {
            value: groupBy,
            'aria-label': '分组模式',
            style: selectStyle,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setGroupBy(e.target.value as SessionGroupBy),
          },
          React.createElement('option', { value: 'workspace' }, '按工作区'),
          React.createElement('option', { value: 'flat' }, '一个列表'),
        ),
      ),
      React.createElement(
        'label',
        { style: { display: 'flex', gap: 3, alignItems: 'center', fontSize: 11 } },
        '排序',
        React.createElement(
          'select',
          {
            value: orderBy,
            'aria-label': '排序方式',
            style: selectStyle,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setOrderBy(e.target.value as SessionOrderBy),
          },
          React.createElement('option', { value: 'manual' }, 'Host 顺序'),
          React.createElement('option', { value: 'updated' }, '最近更新'),
        ),
      ),
      React.createElement(
        'label',
        { style: { display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer', fontSize: 11 } },
        React.createElement('input', {
          type: 'checkbox',
          checked: favoritesOnly,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFavoritesOnly(e.target.checked),
        }),
        '仅收藏',
      ),
      // 全折叠 / 全展开：只在分组模式下出现（平铺模式没有可折叠的分组）。
      collapsibleKeys.length > 0
        ? React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshsv-btn',
              title: allCollapsed ? '展开所有工作区分组' : '折叠所有工作区分组（收起组内会话）',
              onClick: toggleAllCollapsed,
            },
            allCollapsed ? '全部展开' : '全部折叠',
          )
        : null,
    ),
  )

  if (normalizedQuery !== '') {
    const rows = buildSearchRows()
    const shown = rows.filter((row) => !favoritesOnly || favorites.has(row.session.id))
    return React.createElement(
      'div',
      { 'data-plugin': 'sidebar-visibility', style: rootStyle },
      styleTag,
      header,
      React.createElement(
        'div',
        { style: scrollStyle },
        React.createElement(
          'div',
          { style: { padding: '2px 8px', fontSize: 11, opacity: 0.7 } },
          `${shown.length} 个匹配`,
        ),
        shown.length === 0
          ? React.createElement(
              'div',
              { style: { padding: '4px 8px', opacity: 0.7 } },
              searchPhase === 'loading' ? '检索中…' : '没有匹配的会话',
            )
          : shown.map((row) =>
              React.createElement(
                'div',
                { key: row.session.id },
                row.workspaceLabel === undefined
                  ? null
                  : React.createElement(
                      'div',
                      { style: { padding: '2px 8px 0', fontSize: 10, opacity: 0.6 } },
                      row.workspaceLabel,
                    ),
                sessionRow(row.session, row.snippet),
              ),
            ),
      ),
    )
  }

  let body: React.ReactElement
  if (groupBy === 'flat') {
    const flatRows = buildFlat()
    body = React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { style: { padding: '2px 8px', fontSize: 11, opacity: 0.7 } },
        `${flatRows.length} 个会话`,
      ),
      flatRows.map((s) => sessionRow(s)),
    )
  } else {
    body = React.createElement(
      'div',
      null,
      visibleGroups.map((g) => workspaceBlock(g, false)),
      hiddenGroups.length > 0
        ? React.createElement(
            'details',
            { style: { marginTop: 8, padding: '0 8px', opacity: 0.75 } },
            React.createElement('summary', null, `已隐藏的工作区（${hiddenGroups.length}）`),
            hiddenGroups.map((g) => workspaceBlock(g, true)),
          )
        : null,
    )
  }

  return React.createElement(
    'div',
    { 'data-plugin': 'sidebar-visibility', style: rootStyle },
    styleTag,
    header,
    React.createElement('div', { style: scrollStyle }, body),
  )
}
