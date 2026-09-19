/**
 * @local/dsh-plugin-sidebar-visibility — node 半（宿主侧）。
 *
 * v0 职责：仅作为 browser 半的载体被 roster 扫描挂载（dsh.client 清单在
 * package.json）。Provider 挂起的 settings 读写全部走现成的
 * settings document remotes，由 client 半直接发起，本半不注册自定义
 * Typert remote（避免维护 wire 描述符）。
 *
 * 后续扩展挂点（暂未启用，见 README「待验证风险」）：
 * - 注册独立 settings namespace `visibility`，把 Provider 暂存子树与
 *   allowedModels 快照从 localStorage 升级为 Host 持久化（跨浏览器）。
 *   参考：@deepseek-ai/dsh-api-settings-controller/README.md（命名空间注册）。
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'sidebar-visibility'

export function apply(ctx: Context) {
  ctx.logger?.info?.('sidebar-visibility host half mounted (client-driven v0)')
}
