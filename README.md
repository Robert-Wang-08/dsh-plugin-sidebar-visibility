# dsh-plugin-sidebar-visibility 说明

DSH Web GUI（`dsh web`，默认 `http://127.0.0.1:3080`）增强插件，九项功能共用一个包：

| 功能 | 入口 | 行为 |
| --- | --- | --- |
| 工作区可视化隐藏 | 侧栏工作区行尾「隐藏」按钮 | 从树中收起，底部「已隐藏的工作区」折叠区一键恢复；会话数据不动 |
| 工作区折叠 | 工作区标题行的 ▾/▸ 箭头、点标题本身，或树顶「全部折叠 / 全部展开」 | 收起该组会话行、标题行保留原位；折叠态随偏好持久化；与隐藏、归档互不影响 |
| 工作区拖拽排序 | 拖动工作区标题行 | 拖到目标分组的上半 / 下半分别插到它前面 / 后面，落点显示 2px 主色线；顺序经 `IWorkspaces.insertBefore` 写回 Host，刷新后保持 |
| 目录树视图 | 树顶「视图 → 按目录树」 | 已登记工作区按规范化目录的最近严格祖先自动嵌套（12px 缩进，rc.2 同口径）；父组折叠收起整棵子树；隐藏父区时子区上提到最近可见祖先；拖拽**仅同级重排**（目录父子由路径决定，拖不出来）；不虚构未登记目录、不改 Host 归属 |
| 新建会话 | 工作区行尾「+」按钮 | 在该工作区进入新建会话流程；分组处于折叠态时先自动展开 |
| 会话行动作 | 会话行悬停后，标题行**下方**出现竖排的「重命名 / 分叉 / 归档」 | 重命名就地输入（Enter 提交、Escape 取消）；分叉从最后一个完整回合切出子会话；归档后可在「设置 → 已归档会话」恢复 |
| 已完成未读亮点 | 会话行右侧、置顶按钮左侧的小圆点 | 某会话在浏览器观察期间跑完（running true→false）且不是当前会话时出现，主色圆点 + 柔光；打开该会话即清除，状态持久化在同一个 localStorage 键；页面关闭期间完成的运行不记未读（列表没有运行完成时刻，不拿 updatedAt 猜） |
| 会话收藏 + 仅收藏筛选 | 会话行标题行右端 ☆/★（常显）+ 树顶「仅收藏」开关 | 收藏纯前端派生视图，不写 Host 数据；已归档与 subagent 会话不显示也不可收藏 |
| 运行中标识 + 计时 + 模型色 | 会话行标题左侧的彩色转圈环 + 模型徽标 + 分钟数 | 运行中时：转圈环与徽标底色取**该会话所选 provider 的 badge 配色**（用户自选色 > 默认色表 > 调色板，与输入框徽标同源，不复制色表），徽标右侧显示本次已运行 `Nm`；该行开始显示时已在运行的会话只给下限 `≥Nm`（rc.2 列表没有运行起点，不用 updatedAt 冒充）；回合结束即消失。颜色反映**会话选择**，不反映运行期 failover 后的实际执行模型 |
| 会话列表模式切换 | 侧栏页脚「会话列表：插件列表 / 原始列表」按钮 | 一键在**插件增强树**与**官方原始 WorkspaceBrowser**之间热切换，无需重启 dsh；选择持久化在同一个 localStorage 键 |
| Provider 挂起/恢复 | 设置 → 模型 → Provider 卡片上的开关 | 按该卡片自己的 `settingsPath` 定位：用户层有该 Provider 配置时暂存并 unset 这棵子树，纯组合层时写 `models: []` 覆盖；同族其他 Provider 不受影响，恢复时写回 |

所有状态持久化在浏览器 localStorage 单键 `dsh.sidebar-visibility.v1`，与官方侧栏展开状态同一惯例。

## 安装

```powershell
cd dsh-plugin-sidebar-visibility
pnpm install        # 或 npm install
pnpm run bundle     # 产出 lib/index.js + lib/client.js
```

**产物已入库**：`lib/index.js`、`lib/client.js` 与两份 `.d.ts` 跟着源码一起提交，所以以 `link:` 登记的机器 `git pull` + 重启 `dsh web` + 刷新浏览器就能拿到新版，不需要重新 `dsh plugin add`。改动源码后先 `pnpm run bundle` 再提交，否则提交的是旧产物。

### 测试

```powershell
node scripts/test-hierarchy.mjs   # 目录层级纯函数（26 项）
node scripts/test-runtime.mjs     # 运行计时 + badge 展示桥契约（15 项，含跨插件真实契约）
node scripts/test-bundle.mjs      # 构建产物冒烟（需先 bundle）
```

测试用 Node 内置 type stripping 直接导入 `.ts`，不依赖测试框架或额外安装。

## 挂载到 dsh web

1. 在挂载 profile 的 `cordis.patch.yml`（或 `$DSH_HOME/cordis.patch.yml`）的 browser roster 段加一行，参照 `cordis.patch.example.yml`：

   ```yaml
   - id: sidebar-visibility
     name: '@local/dsh-plugin-sidebar-visibility'
   ```

2. 让 `dsh-client-modules` 能解析到本包：在 DSH 运行目录的依赖里链接本包（`pnpm link` / file: 依赖），或把本目录放进 dsh 的插件搜索路径。
3. 重启 `dsh web` 后打开 GUI 验证：
   - 侧栏会话树被本树替换（顶部出现「仅收藏」开关）；
   - 设置 → 模型 的每个 Provider 卡片出现「挂起 Provider」按钮。

开发时跑 `pnpm run dev:web`（DSH checkout 内）可热重载本插件改动；日常用 `pnpm run watch` 重建产物即可。

## 使用

- **隐藏工作区**：工作区标题行点「隐藏」→ 整个工作区（含其会话）从树消失；树底「已隐藏的工作区（N）」展开后点「恢复」还原。
- **折叠工作区**：点标题行左侧 ▾/▸ 箭头，或直接点标题 → 该组会话行收起 / 展开，标题行始终留在原位；折叠时标题右侧显示组内会话数。折叠态与隐藏态相互独立，刷新后保持。
- **目录树视图**：树顶「视图」选「按目录树」→ 已登记工作区按目录的最近严格祖先自动嵌套成多层（rc.2 口径：Windows 盘符/UNC 归一斜杠、**大小写敏感**、按完整路径段比较），组头有文件夹轮廓与缩进；折叠父组会收起**整棵子树**；隐藏某个父工作区时，其可见子工作区上提到最近可见祖先（底部折叠区只留恢复入口）。拖拽只在**同一父级**内重排，跨级落点显示禁止光标且不写 Host；「未分组」伪组固定追加在树尾。原有的「按工作区 / 一个列表」两档仍然保留，旧偏好不受影响。
- **全部折叠 / 全部展开**：树顶视图选项行右侧的按钮，一次收起或展开当前所有可见分组；有任一分组展开时显示「全部折叠」，全部分组已折叠后显示「全部展开」。已隐藏的分组不参与（它们本就没有折叠箭头），其折叠态原样保留；平铺模式下不显示该按钮。
- **工作区拖拽排序**：按住工作区标题行拖动 → 拖到目标分组的**上半**插到它前面、**下半**插到它后面，落点位置显示一条 2px 主色线。松开即写入 Host 顺序，刷新后保持。「未分组」伪组不参与拖拽，也不能作为落点；拖回原位不发请求。
- **新建会话**：工作区行尾点「+」→ 在该工作区进入新建会话流程。分组处于折叠态时先自动展开，与官方项目行加号的行为一致。
- **会话行动作**：鼠标移到会话行上，标题行**下方**出现竖排的「重命名 / 分叉 / 归档」三个按钮；☆/★ 常显在标题行右端。
  - 重命名：点「重命名」→ 标题就地变成输入框 → Enter 提交、Escape 取消；宿主拒绝时错误消息显示在标题下方。
  - 分叉：点「分叉」→ 从该会话的最后一个完整回合切出新会话并打开。
  - 归档：点「归档」→ 会话从树中消失，可在「设置 → 已归档会话」恢复。
- **已完成未读**：某个会话跑完（转圈消失）且你还没打开它时，行右侧会出现一个主色小圆点（置顶按钮左边）；点开该会话即清除。仅记录**页面打开期间**观察到的完成，刷新或换设备后不复现；正在看的会话跑完不算未读。
- **收藏会话**：会话行点 ☆ 变 ★；勾选树顶「仅收藏」后全树只显示收藏行，标题栏显示收藏数。
- **运行中标识与计时**：某会话正在运行时，其标题左侧出现**彩色**转圈环 + 模型徽标 + 已运行分钟数（如 `[a1gpt] 3m`）。颜色来自 provider-badge 的只读展示桥（与输入框徽标同一种颜色解析，含你的自选色）；**非当前打开的会话**用会话投影里的 provider + badge 纯色表上色，不必先把会话点开，悬停显示 provider 全名、模型名与计时口径。计时只统计**浏览器实际观察到的连续运行区间**：该行开始显示时已在运行的会话显示 `≥Nm` 下限，不拿最后更新时间冒充起点；回合结束后自动消失。语义与官方 ongoing 状态一致，对分组视图与检索结果行同样生效。
- **切换会话列表模式**：点侧栏页脚的「会话列表：插件列表 / 原始列表」按钮，在插件增强树与官方原始列表之间一键热切换（无需重启 dsh）。切到「原始列表」时本插件的 `sidebar.workspaces` 占用者被卸载，官方 WorkspaceBrowser 立即接管；切回「插件列表」即重新注册，增强功能（隐藏 / 折叠 / 收藏 / 拖拽排序等）全部恢复。页脚按钮常驻，两种模式下都可见。
- **挂起 Provider**：设置 → 模型，在目标卡片点「挂起 Provider」→ 该 Provider 的配置被暂存、模型从选择器消失；同位置点「恢复 Provider」写回。**粒度是该卡片自己的 `settingsPath`**，同一命名空间下的其他 Provider 不受影响。挂起期间新会话无法选到该 Provider；已固定在它上面的存量会话预期进入不可路由禁用态，恢复后自动解除（此点为首验清单第 2 项）。

## 复核确认的事实（本版代码的全部依据）

- 席位注册：`ctx.slots.inject(seat, () => ctx.slots.register(options, Component))`，options 含 `name / key / children / store / inject / locale`（先例 `dsh-client-ui-workspace/lib/client.js`）。
- 席位遮蔽：single 席位后注册者遮蔽官方占用者（`dsh-client-ui-renderer` registry.d.ts 的优先级注释），官方树无需禁用。
- keyed 席位：注册带 `key`，无通配；本版覆盖 `llm-deepseek` / `llm-pi-ai` 两个内置命名空间。
- 数据钩子：`useWorkspaces` → `WorkspaceSnapshot { items, archivedSessionIds }`；`useSessions` → `SessionListState { ids, byId, current }`；`WorkspaceView { workspaceId, title, path, sessionIds }`；`SessionSummary { id, displayTitle, origin, blank, running, updatedAt }`。
- 动作服务：`ctx.uiWorkspace`（`openSession / startSession / openWorkspace / connectWorkspace / forkSession / archiveSession`），cordis inject 名 `uiWorkspace`。
- 会话重命名：官方 `renameSession` 走 `ctx.get('sessions').binding(id)?.session.rename(title)`，返回 `RemoteResult<{ title, seq }>`；未绑定会话与拒绝结果都由调用方抛错（先例 `dsh-client-ui-workspace/lib/client.js` 的 `browserInjected()`）。本插件复用同一条路径，错误消息就地显示在标题下方。
- 官方会话行菜单：`dsh-client-ui-workspace` 的 `SessionNodeItem` 提供 `rename / fork / archive` 三项（工作区行另有 `rename / delete`，本插件未实现）；`rowActions` 平时隐藏、行悬停显示，本插件用 `.dshsv-rowActions` + 内联 `<style>` 复刻该行为，并把三个动作改为标题行下方的竖排，避免窄侧栏里遮挡会话名。
- 官方新建会话按钮：工作区行右侧的加号（`IconPlusOutline16`）在 `onClick` 里先 `setGroupExpanded(key, true)` 再 `startSession(workspaceId)`；本插件按同一语义实现，折叠态下点击会先解除折叠。
- 工作区拖拽排序：走**纯 Workspace Controller**，不是 `uiWorkspace` —— cordis inject 名 `workspaces`，方法 `insertBefore(workspaceId, beforeWorkspaceId?)`，`beforeWorkspaceId` 省略表示移到末尾（官方 `browserInjected()` 的 `insertWorkspaceBefore` 同一条路径）。落点半边由指针是否在目标组高度的上半决定（官方 `workspaceGroupHalf`）；自身位置与「已在锚点前一位」两种无变化情形直接返回，不发请求。
- 内联 `<style>` 的转义陷阱（踩过两次）：React 会把文本里的 `"` `'` `&` `<` `>` 转成 HTML 实体，而 `<style>` 是 raw text 元素**不解码**实体，规则会静默失效。因此该 CSS 串里不能出现这些字符 —— 例如 `content:""` 会变成 `content:&quot;&quot;`。画线改用 `box-shadow`（无引号、不占布局）。
- 侧栏按钮尺寸：浏览器默认 `button` 样式在窄侧栏里偏大，本插件统一用 `.dshsv-btn` 压到 11px / 16px 行高 / `1px 6px` 内边距，悬停给一层浅底色。
- 席位派发粒度（踩过坑）：`settings.models.provider-card` 按 `settingsNs` 派发 —— 注册一次会收到该命名空间下的**每一张**卡片（已保存、新增、手写声明的都算），每张卡片带自己的 `settingsPath`（官方 slot-contract 原文：an adapter family's companion plugin registers one entry under the family's namespace and receives every card of that family）。因此挂起/恢复必须按 `settingsPath` 定位；动整个命名空间会把同族 Provider 一起清掉。官方删除 Provider 用的也是 `{ op: 'unset', path: [...settingsPath] }`。
- 根级 Provider（`settingsPath` 为空，如 `deepseek-official` 之于 `llm-deepseek`）拥有整个命名空间：挂起走用户层整段逐键 unset，恢复必须用 `update(ns, section)` 整段合并写回 —— 空路径无法用 `mutate set path: []` 寻址命名空间根。
- settings 写读：`ctx.remote.settings.describe() → { user?, revision }`；`update / replace / mutate(ns, [{ op: 'set'|'unset', path, value? }], expectedRevision)`（op 先例 `pathOps()`）；Provider 卡片 owner props 携带 `settingsPath` 直接给出用户层寻址路径。
- 运行中数据源：`SessionSummary.running`（官方 0.2.0-rc.2 与本仓 0.1.6-alpha.2 同形）。官方树以 `status?.running ?? summary.running` 派生 `ongoing` 状态点，本插件直接取 `byId[id].running` 显示转圈环。
- 页脚席位：`sidebar.footer.action`（`kind: 'list'`、`scope: 'root'`、owner props `{ wide }`），由官方 ui-sidebar 的 `sidebar` 条目声明并在 `SidebarRoot` 常驻渲染；list 注册带 `id` / `order`。
- 热切换的 API 依据：`ctx.slots.register(...)` 与 `ctx.slots.inject(...)` 都返回幂等 disposer，调用即移除占用者。single 席位按 priority 升序取**首个存活**条目（`dsh-client-ui-slots` renderer：first live entry per cell in priority order），故卸载 priority -1 的插件占用者后，官方 priority 0 占用者立即接管；重新注入即恢复。

## 首验清单（实跑时按序确认）

1. 本树遮蔽官方树后，仍缺的官方交互：会话级拖拽排序、工作区重命名 / 删除、新建工作区（工作区级 拖拽排序 / 新建会话，以及会话级 重命名 / 分叉 / 归档 已补齐）。
2. 挂起对存量会话的实际表现（预期不可路由禁用态）。
3. `llm-pi-ai` 用户层 unset 后路由是否热注销（`llm/adapters-updated` 广播）。
4. localStorage 单键的多账号串扰（官方有 account key 派生，迭代 2 对齐）。
5. 用户手配命名空间的 Provider 卡片注册（当前只覆盖两个内置 key）。
6. 重命名对未绑定会话的表现（官方同路径会抛 `unknown session`；若列表里的非当前会话普遍未绑定，需改走 `sessionController` 的 rename RPC）。
7. 会话列表模式热切换：点页脚按钮切到「原始列表」后官方 WorkspaceBrowser 是否完整接管、切回「插件列表」后本插件功能是否全部恢复；以及侧栏 rail 模式下页脚按钮的显示。

## 迭代计划

- 迭代 1（当前）：挂载跑通 + 七功能最小闭环（隐藏 / 折叠 / 工作区拖拽排序 / 新建会话 / 会话行动作 / 收藏 / Provider 挂起）。
- 迭代 2：subagent `allowedModels` 快照剔除；树内搜索框与「仅收藏」对 Host 内容搜索的二次过滤；account key 对齐；补齐官方树交互（会话级拖拽排序、工作区重命名 / 删除）。
- 迭代 3：评估给上游提 `hiddenWorkspaceIds` / `favoriteSessionIds` / `collapsedWorkspaceIds`（照 `archivedSessionIds` 模式进 Host 基线）。

## 宿主兼容性（2026-09-23 复查：dsh 0.1.5-rc.3 + dsh-permission-compat）

宿主升级 `0.1.5-rc.2 → rc.3`（npm latest）并打上全局 `dsh-permission-compat` 沙箱补丁（改 `dsh-sandbox` + 三个工具守卫）后复查，**本插件零改动可用**：

- 与补丁无关：源码与构建产物（`lib/index.js`、`lib/client.js`）不引用 `sandbox_permissions` / `justification` / `approveEscalation` 等提权 API（grep 零命中）。
- 与 rc.3 无关：rc.3 的 `dsh-client-ui-sidebar/lib/client.js` 相比 rc.2 仅 `localBuildVersion()` 里品牌徽标版本号字符串 1 行差异，无 API/行为变化，本插件不依赖该值。
- 已知构建现状（非本次引入）：`src/index.ts` import 了 `@deepseek-ai/dsh-api-settings-controller`，但构建出的 `lib/index.js` 是无 import 的 199B 占位 stub——rc.3 下无影响；下次改动本插件时核对 `tsdown.config.ts`。

复查记录见 vault `70-WorkSpace/dsh工具维护日志.md` 2026-09-23 条目；复装说明见 `70-WorkSpace/dsh复装说明.md`。
