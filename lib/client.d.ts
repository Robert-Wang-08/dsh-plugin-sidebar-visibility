import { Context } from "@deepseek-ai/cordis";

//#region src/client/index.d.ts
/**
* cordis 服务注入清单（与官方 client 包的 inject 导出同款）。
*
* `sessions` 是官方查找能力的来源：官方 WorkspaceBrowser 的内容检索走
* `ctx.get('sessions').search(query, signal)`（Host 可见消息内容索引），
* 该服务也是官方 ui-workspace 的 inject 项之一。
*
* `workspaces` 是工作区排序的来源：拖拽排序走纯 Workspace Controller 的
* `insertBefore`，与官方 browserInjected() 同一条路径；`uiWorkspace` 只有
* 导航与归档动作，不含排序。
*/

/**
 * cordis 服务注入清单（与官方 client 包的 inject 导出同款）。
 *
 * `sessions` 是官方查找能力的来源：官方 WorkspaceBrowser 的内容检索走
 * `ctx.get('sessions').search(query, signal)`（Host 可见消息内容索引），
 * 该服务也是官方 ui-workspace 的 inject 项之一。
 *
 * `workspaces` 是工作区排序的来源：拖拽排序走纯 Workspace Controller 的
 * `insertBefore`，与官方 browserInjected() 同一条路径；`uiWorkspace` 只有
 * 导航与归档动作，不含排序。
 */
declare const inject: string[];
declare function apply(ctx: Context): void; //#endregion
export { apply, inject };