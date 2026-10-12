/**
 * 会话列表模式一键切换 —— 注入 `sidebar.footer.action` 席位（list，root 作用域）。
 *
 * 为什么放在侧栏页脚：本插件以 priority -1 遮蔽官方 `sidebar.workspaces`
 * 占用者，增强树本身在「原始列表」模式下会被卸载，因此切换控件必须挂在一个
 * 与树是否渲染无关、始终存在的席位上。页脚 action 由官方 ui-sidebar 声明并
 * 常驻渲染（侧栏收起时仍以居中图标形式出现），是唯一满足条件的挂点。
 *
 * 切换语义（热切换，无需重启 dsh）：点击后写 localStorage 偏好并通知订阅者，
 * ./index.ts 的订阅回调据 treeMode 卸载 / 重新注册 `sidebar.workspaces`
 * 占用者 —— 卸载后官方 WorkspaceBrowser 立即接管，重注册后本插件的增强树接管。
 */
import React from 'react'
import { getVisibility, subscribeVisibility } from './visibility-store.ts'

export interface TreeModeToggleProps {
  /** 注册时 inject face 注入（见 ./index.ts）：翻转并持久化模式。 */
  toggleMode?: () => void
  /** 官方 `sidebar.footer.action` owner props：侧栏是否宽态（false = 56px 图标栏）。 */
  wide?: boolean
  t?: (key: string) => string
}

export function TreeModeToggle(props: TreeModeToggleProps) {
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => subscribeVisibility(() => force()), [])
  const plugin = getVisibility().treeMode === 'plugin'
  const wide = props.wide !== false
  const label = plugin ? '插件列表' : '原始列表'
  const title = plugin
    ? '当前：插件增强会话列表（点击切换到官方原始列表）'
    : '当前：官方原始会话列表（点击切换到插件增强列表）'

  const styleTag = React.createElement(
    'style',
    null,
    '.dshsv-footerToggle{display:flex;align-items:center;gap:6px;width:100%;font-size:11px;line-height:16px;padding:4px 8px;margin:0;border:none;background:transparent;color:inherit;border-radius:6px;cursor:pointer;font-family:inherit;text-align:left;box-sizing:border-box}' +
      '.dshsv-footerToggle:hover{background:rgba(128,128,128,0.2)}' +
      '.dshsv-modeDot{width:8px;height:8px;flex:none;border-radius:50%}' +
      '.dshsv-modeDotPlugin{background:var(--dsw-alias-state-business-primary,#4c8dff)}' +
      '.dshsv-modeDotOfficial{background:var(--dsw-alias-label-tertiary,#9aa0a6)}',
  )

  const button = React.createElement(
    'button',
    {
      type: 'button',
      className: 'dshsv-footerToggle',
      title,
      'aria-label': title,
      onClick: () => props.toggleMode?.(),
      style: props.wide === false ? { justifyContent: 'center', padding: '4px', width: 'auto' } : undefined,
    },
    React.createElement('span', {
      className: plugin ? 'dshsv-modeDot dshsv-modeDotPlugin' : 'dshsv-modeDot dshsv-modeDotOfficial',
      'aria-hidden': 'true',
    }),
    wide
      ? React.createElement(
          'span',
          { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
          `会话列表：${label}`,
        )
      : null,
  )

  return React.createElement(React.Fragment, null, styleTag, button)
}
