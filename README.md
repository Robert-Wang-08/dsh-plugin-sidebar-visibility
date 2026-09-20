# dsh-plugin-sidebar-visibility 说明

DSH Web GUI（`dsh web`，默认 `http://127.0.0.1:3080`）增强插件，七项功能共用一个包：

| 功能 | 入口 | 行为 |
| --- | --- | --- |
| 工作区可视化隐藏 | 侧栏工作区行尾「隐藏」按钮 | 从树中收起，底部「已隐藏的工作区」折叠区一键恢复；会话数据不动 |
| 工作区折叠 | 工作区标题行的 ▾/▸ 箭头、点标题本身，或树顶「全部折叠 / 全部展开」 | 收起该组会话行、标题行保留原位；折叠态随偏好持久化；与隐藏、归档互不影响 |
| 工作区拖拽排序 | 拖动工作区标题行 | 拖到目标分组的上半 / 下半分别插到它前面 / 后面，落点显示 2px 主色线；顺序经 `IWorkspaces.insertBefore` 写回 Host，刷新后保持 |
| 新建会话 | 工作区行尾「+」按钮 | 在该工作区进入新建会话流程；分组处于折叠态时先自动展开 |
| 会话行动作 | 会话行悬停后，标题行**下方**出现竖排的「重命名 / 分叉 / 归档」 | 重命名就地输入（Enter 提交、Escape 取消）；分叉从最后一个完整回合切出子会话；归档后可在「设置 → 已归档会话」恢复 |
| 会话收藏 + 仅收藏筛选 | 会话行标题行右端 ☆/★（常显）+ 树顶「仅收藏」开关 | 收藏纯前端派生视图，不写 Host 数据；已归档与 subagent 会话不显示也不可收藏 |
| Provider 挂起/恢复 | 设置 → 模型 → Provider 卡片上的开关 | 按该卡片自己的 `settingsPath` 定位：用户层有该 Provider 配置时暂存并 unset 这棵子树，纯组合层时写 `models: []` 覆盖；同族其他 Provider 不受影响，恢复时写回 |

所有状态持久化在浏览器 localStorage 单键 `dsh.sidebar-visibility.v1`，与官方侧栏展开状态同一惯例。

## 安装

```powershell
cd dsh-plugin-sidebar-visibility
pnpm install        # 或 npm install
pnpm run bundle     # 产出 lib/index.js + lib/client.js
```

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
- **全部折叠 / 全部展开**：树顶视图选项行右侧的按钮，一次收起或展开当前所有可见分组；有任一分组展开时显示「全部折叠」，全部分组已折叠后显示「全部展开」。已隐藏的分组不参与（它们本就没有折叠箭头），其折叠态原样保留；平铺模式下不显示该按钮。
- **工作区拖拽排序**：按住工作区标题行拖动 → 拖到目标分组的**上半**插到它前面、**下半**插到它后面，落点位置显示一条 2px 主色线。松开即写入 Host 顺序，刷新后保持。「未分组」伪组不参与拖拽，也不能作为落点；拖回原位不发请求。
- **新建会话**：工作区行尾点「+」→ 在该工作区进入新建会话流程。分组处于折叠态时先自动展开，与官方项目行加号的行为一致。
- **会话行动作**：鼠标移到会话行上，标题行**下方**出现竖排的「重命名 / 分叉 / 归档」三个按钮；☆/★ 常显在标题行右端。
  - 重命名：点「重命名」→ 标题就地变成输入框 → Enter 提交、Escape 取消；宿主拒绝时错误消息显示在标题下方。
  - 分叉：点「分叉」→ 从该会话的最后一个完整回合切出新会话并打开。
  - 归档：点「归档」→ 会话从树中消失，可在「设置 → 已归档会话」恢复。
- **收藏会话**：会话行点 ☆ 变 ★；勾选树顶「仅收藏」后全树只显示收藏行，标题栏显示收藏数。
- **挂起 Provider**：设置 → 模型，在目标卡片点「挂起 Provider」→ 该 Provider 的配置被暂存、模型从选择器消失；同位置点「恢复 Provider」写回。**粒度是该卡片自己的 `settingsPath`**，同一命名空间下的其他 Provider 不受影响。挂起期间新会话无法选到该 Provider；已固定在它上面的存量会话预期进入不可路由禁用态，恢复后自动解除（此点为首验清单第 2 项）。

## 复核确认的事实（本版代码的全部依据）

- 席位注册：`ctx.slots.inject(seat, () => ctx.slots.register(options, Component))`，options 含 `name / key / children / store / inject / locale`（先例 `dsh-client-ui-workspace/lib/client.js`）。
- 席位遮蔽：single 席位后注册者遮蔽官方占用者（`dsh-client-ui-renderer` registry.d.ts 的优先级注释），官方树无需禁用。
- keyed 席位：注册带 `key`，无通配；本版覆盖 `llm-deepseek` / `llm-pi-ai` 两个内置命名空间。
- 数据钩子：`useWorkspaces` → `WorkspaceSnapshot { items, archivedSessionIds }`；`useSessions` → `SessionListState { ids, byId, current }`；`WorkspaceView { workspaceId, title, path, sessionIds }`；`SessionSummary { id, displayTitle, origin, blank, updatedAt }`。
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

## 首验清单（实跑时按序确认）

1. 本树遮蔽官方树后，仍缺的官方交互：会话级拖拽排序、工作区重命名 / 删除、新建工作区（工作区级 拖拽排序 / 新建会话，以及会话级 重命名 / 分叉 / 归档 已补齐）。
2. 挂起对存量会话的实际表现（预期不可路由禁用态）。
3. `llm-pi-ai` 用户层 unset 后路由是否热注销（`llm/adapters-updated` 广播）。
4. localStorage 单键的多账号串扰（官方有 account key 派生，迭代 2 对齐）。
5. 用户手配命名空间的 Provider 卡片注册（当前只覆盖两个内置 key）。
6. 重命名对未绑定会话的表现（官方同路径会抛 `unknown session`；若列表里的非当前会话普遍未绑定，需改走 `sessionController` 的 rename RPC）。

## 迭代计划

- 迭代 1（当前）：挂载跑通 + 七功能最小闭环（隐藏 / 折叠 / 工作区拖拽排序 / 新建会话 / 会话行动作 / 收藏 / Provider 挂起）。
- 迭代 2：subagent `allowedModels` 快照剔除；树内搜索框与「仅收藏」对 Host 内容搜索的二次过滤；account key 对齐；补齐官方树交互（会话级拖拽排序、工作区重命名 / 删除）。
- 迭代 3：评估给上游提 `hiddenWorkspaceIds` / `favoriteSessionIds` / `collapsedWorkspaceIds`（照 `archivedSessionIds` 模式进 Host 基线）。
