/**
 * 新建会话的「选择工作区」下拉 —— `conversation.hero.workspace` 席位的替换型占用者。
 *
 * 官方 `dsh-client-ui-workspace` 以默认 priority 0 占用该席位，列表直接取 Host 的
 * `useWorkspaces`，没有过滤入口。本插件以 priority -1 接管（single 席位按 priority
 * 升序取首个存活占用者），复用框架统一注入的 `useWorkspaces` 数据，并在「隐藏任务」
 * 打开时把 superagent 的 `.dsh/state/superagent/work/<ticket>` 工作区从可选列表里剔除。
 *
 * 与官方选择器的差异（有意为之）：
 * - 不提供目录浏览器；「新建工作区」改为输入路径后调用 Host 的
 *   `workspaces.create({ path })`（官方由 directory-picker 插件的流程接管，插件层
 *   无法复用该流程的 UI，只复用同一条创建 RPC）。
 * - 列表按 Host 顺序、纯文本标题展示；不提供官方二级的「搜索」，工作区数量很少。
 *
 * 纯展示过滤：不删除、不改名、不影响 superagent 运行中的会话与工作区。
 */
import React from 'react'
import { createPortal } from 'react-dom'
import { filterPickerWorkspaces, getHideSuperagentTasks } from './superagent-filter.ts'
import { subscribeVisibility } from './visibility-store.ts'

interface WorkspaceViewLike {
  workspaceId: string
  title?: string
  path?: string
  sessionIds?: readonly string[]
}

interface WorkspaceSnapshotLike {
  items: readonly WorkspaceViewLike[]
  phase?: string
}

export interface WorkspacePickerProps {
  open?: boolean
  anchorRef?: React.RefObject<HTMLElement | null>
  selectedId?: string
  onPick?: (workspaceId: string) => void
  onClose?: () => void
  /** 框架统一注入的 Host 工作区快照（GlobalStandardProps 同款）。 */
  useWorkspaces?: <S>(selector: (snapshot: WorkspaceSnapshotLike) => S) => S
  /** 注入面：Host 的工作区创建 RPC（`workspaces.create({ path })`）。 */
  createWorkspace?: (input: { path: string }) => Promise<{ workspaceId: string }>
}

const PANEL_MAX_HEIGHT = 360

export function WorkspacePicker(props: WorkspacePickerProps) {
  const { open = false, anchorRef, selectedId, onPick, onClose, useWorkspaces, createWorkspace } = props
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => subscribeVisibility(() => force()), [])
  const [rect, setRect] = React.useState<{ left: number; top: number; width: number } | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [draftPath, setDraftPath] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>(undefined)
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const snapshot = useWorkspaces?.((s) => s) ?? { items: [], phase: 'ready' }
  const hideTasks = getHideSuperagentTasks()
  const items = filterPickerWorkspaces(snapshot.items ?? [], hideTasks)

  /* 每次打开时按触发按钮重新定位；视口尺寸变化或滚动时收起（官方菜单同语义）。 */
  React.useLayoutEffect(() => {
    if (!open) return undefined
    const anchor = anchorRef?.current ?? null
    if (anchor === null) return undefined
    const place = () => {
      const box = anchor.getBoundingClientRect()
      setRect({ left: box.left, top: box.bottom + 6, width: Math.max(box.width, 280) })
    }
    place()
    const close = () => onClose?.()
    globalThis.addEventListener('resize', close)
    globalThis.addEventListener('scroll', close, true)
    return () => {
      globalThis.removeEventListener('resize', close)
      globalThis.removeEventListener('scroll', close, true)
    }
  }, [open, anchorRef, onClose])

  React.useEffect(() => {
    if (!open) {
      setCreating(false)
      setDraftPath('')
      setError(undefined)
      return undefined
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) === true) return
      if (anchorRef?.current?.contains(target) === true) return
      onClose?.()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
    }
    globalThis.addEventListener('pointerdown', onPointerDown, true)
    globalThis.addEventListener('keydown', onKeyDown, true)
    return () => {
      globalThis.removeEventListener('pointerdown', onPointerDown, true)
      globalThis.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, anchorRef, onClose])

  if (!open) return null

  const commitCreate = () => {
    const path = draftPath.trim()
    if (path === '' || busy) return
    if (createWorkspace === undefined) {
      setError('宿主未提供创建工作区的动作')
      return
    }
    setBusy(true)
    setError(undefined)
    createWorkspace({ path })
      .then((workspace) => {
        setBusy(false)
        setCreating(false)
        setDraftPath('')
        onPick?.(workspace.workspaceId)
      })
      .catch((reason: unknown) => {
        setBusy(false)
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: rect?.left ?? 0,
    top: rect?.top ?? 0,
    width: rect?.width ?? 280,
    maxHeight: PANEL_MAX_HEIGHT,
    overflowY: 'auto',
    zIndex: 2147483000,
    background: 'var(--dsw-alias-bg-elevated, #1e1e1e)',
    color: 'var(--dsw-alias-label-primary, #eee)',
    border: '1px solid var(--dsw-alias-border-l4, rgba(128,128,128,0.35))',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    padding: 4,
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  }

  const panel = React.createElement(
    'div',
    { ref: panelRef, className: 'dshsv-picker', style, role: 'listbox', 'aria-label': '选择工作区' },
    items.length === 0
      ? React.createElement('div', { style: { padding: '6px 8px', opacity: 0.7 } }, '没有可用的工作区')
      : items.map((w) =>
          React.createElement(
            'button',
            {
              key: w.workspaceId,
              type: 'button',
              role: 'option',
              className: 'dshsv-pickerItem',
              'aria-selected': w.workspaceId === selectedId,
              title: w.path ?? w.title,
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                border: 'none',
                borderRadius: 4,
                background: w.workspaceId === selectedId ? 'rgba(128,128,128,0.22)' : 'transparent',
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                font: 'inherit',
              },
              onClick: () => onPick?.(w.workspaceId),
            },
            React.createElement('span', { style: { opacity: 0.7, flex: 'none' } }, '📁'),
            React.createElement(
              'span',
              { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              w.title ?? w.path ?? w.workspaceId,
            ),
          ),
        ),
    React.createElement('div', { style: { height: 1, background: 'rgba(128,128,128,0.25)', margin: '4px 0' } }),
    creating
      ? React.createElement(
          'div',
          { style: { display: 'flex', gap: 4, padding: '2px 4px' } },
          React.createElement('input', {
            autoFocus: true,
            value: draftPath,
            placeholder: '工作区目录绝对路径，如 D:\\src\\demo',
            'aria-label': '工作区目录路径',
            style: {
              flex: 1,
              minWidth: 0,
              padding: '4px 6px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid rgba(128,128,128,0.35)',
              background: 'transparent',
              color: 'inherit',
            },
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraftPath(e.target.value),
            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') commitCreate()
              if (e.key === 'Escape') {
                e.stopPropagation()
                setCreating(false)
              }
            },
          }),
          React.createElement(
            'button',
            { type: 'button', className: 'dshsv-btn', disabled: busy, onClick: commitCreate },
            busy ? '创建中…' : '创建',
          ),
        )
      : React.createElement(
          'button',
          {
            type: 'button',
            className: 'dshsv-pickerAdd',
            style: {
              textAlign: 'left',
              padding: '5px 8px',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              font: 'inherit',
              opacity: 0.85,
            },
            onClick: () => setCreating(true),
          },
          '＋ 新建工作区…',
        ),
    error === undefined
      ? null
      : React.createElement('div', { role: 'alert', style: { padding: '2px 8px', color: 'var(--dsw-alias-state-error-primary, #f66)' } }, error),
  )

  return createPortal(panel, document.body)
}
