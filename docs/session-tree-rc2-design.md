# 会话树 rc.2 对齐设计（先设计后实现）

## 目标

在不修改 DSH 本体与 profile 的前提下，把侧栏会话列表升级到 rc.2 的多层工作区树与视觉口径，保留收藏、最高级置顶、隔行异色、悬停放大，并给运行中转圈补上「本次已运行时间」与 badge 同源模型色。

## 决定

### D1 层级 = 客户端按已登记路径派生（与 rc.2 一致）

- rc.2 `WorkspaceView` 只有 `workspaceId/path/title/sessionIds/createdAt/updatedAt`，**没有 parentId**；嵌套由 `owningParentFolder` 按「严格祖先 + 最长 root」派生（`dsh-client-ui-workspace/lib/client.js:616-638`）。
- 本插件新增第三档视图 `workspace-tree`：只对已登记工作区按路径嵌套，**不虚构未登记目录**，不改 Host 归属；12px 缩进沿用官方变量名 `--dsh-workspace-indent`。
- 路径语义照抄 rc.2：Windows 盘符与 UNC 把反斜杠归一为正斜杠并去尾斜杠；**大小写敏感**（`D:\Src` 与 `d:\src` 不合并）；POSIX 不解释反斜杠；`dshX` 不算 `dsh` 的子目录。
- 保留 `workspace`（平铺分组）与 `flat` 两档；旧 localStorage 值原样可用，新用户默认 `workspace-tree`。

### D2 折叠 / 隐藏 / 拖拽的语义边界

- 父组折叠 → 整棵子树收起（对齐 rc.2 `renderGroup` 的 childRows）；组头保留原位。
- 隐藏是插件自有能力：只隐藏该工作区自身，可见子组**提升到最近可见祖先**，避免数据从树里消失。
- 拖拽**仅同级重排**（`parents` 相同的两个分组之间；跨父时 `dropEffect` 设为 none），不支持改父子目录：目录父子由路径决定，而不是拖出来的。

### D3 视觉：保留既有三层底色 + rc.2 的形

- 置顶仍是全局最高级区块（跨工作区、组内去重），收藏与「仅收藏」不变，隔行异色与悬停扩行保留。
- 斑马纹按「每个 `.dshsv-rowList` 的直接子元素序数」取色 → 嵌套后**每个分组各自持有 rowList**，否则子组行进入父 rowList 会整体错位（首验清单第 1 项）。
- 组头/行采用 rc.2 的紧凑排版、文件夹轮廓图标与当前祖先高亮。

### D4 运行计时：只统计观察区间，首见即运行给下限

- rc.2 列表只有 `running: boolean`；`updatedAt` 是最后变更时间，`sessionStats` 是整条日志累计墙钟，**都不能当运行起点**。
- 只统计浏览器观察到的连续 running 区间：挂载时已在运行 → `≥Nm`（下限）；观察到的 false→true → 精确起点；true→false 清空，下次运行重置；时钟回拨不产生负数。
- 所有运行行共用一个 5s 节拍，末位订阅者释放后清除定时器（`scripts/test-runtime.mjs` 断言 `runtimeTickListenerCount() === 0`）。

### D5 颜色：向 badge 要，不复制色表

- badge 在 `apply()` 安装版本化只读桥 `window.__DSH_PROVIDER_BADGE__`（`version: 1`），`presentationFor(sessionId)` 复用**同一份** `ModelDirectoryState` 与 `resolveColor`（用户自选色 > `ROUTE_COLORS` > 自动调色板）、`inkFor`、`badgeOf` 文字。
- 侧栏只消费 `{ color, ink, text, providerId, providerName, modelId, modelName }`；桥缺失/版本不符/目录未就绪 → 中性主色 + 照常计时。
- 语义边界：颜色 = **会话所选** provider，不表示运行期 failover 后的实际执行模型；同时显示模型名以区分同 provider 的不同模型。

## 源码依据

| 事实 | 位置 |
| --- | --- |
| 层级由路径派生、12px 缩进 | `dsh-client-ui-workspace/lib/client.js:2338-2346`、`:2439-2483` |
| 同级拖拽判定 | 同上 `:2407-2422`、`:2442` |
| `WorkspaceView` 无 parentId | `dsh-api-workspace-controller/lib/types/types.d.ts:13-25` |
| `SessionSummary` 只有 running 布尔 | `dsh-api-session-controller/lib/types/client/sessions/service.d.ts:16-41` |
| badge 颜色优先级与字色 | `dsh-plugin-provider-badge/client.js`（`ROUTE_COLORS`、`colorOf`、`resolveColor`、`inkFor`） |
| badge 共享目录与降级 | 同上 `faceOf`：subagent 转址/未装载 → `UNAVAILABLE` |

## 验证

- `node scripts/test-runtime.mjs`：计时纯函数（下限、停止重启、时钟回拨、幂等）、节拍释放、桥缺失/版本不符、**跨插件真实契约**（直接执行 badge `client.js`，断言颜色/字色/文字/模型名/自选色优先/无选择降级/uSES 同对象）。
- `node scripts/test-hierarchy.mjs`：路径归一、严格祖先、大小写与段边界、重复路径、隐藏父提升、同级锚点。
- `pnpm run bundle`（tsdown + classic-script 包装校验）：client.js 必须是单次 `__ModuleLoader__.load`、无模块级 ESM。
- 生效：两个插件都以 `link:` 登记，`git pull` + 重启 `dsh web` + 刷新即可；无新增依赖、无 profile 改动。HMR 只在同一 checkout 的 `dev:web` watcher 运行时成立。

## 已知限制

- 计时是「本次观察窗口」，不是 Host 级累计运行时长；页面刷新后重新开始观察（首帧即运行则显示下限）。
- 颜色与模型反映会话选择，运行期 provider failover 后的真实执行模型不可见（与官方模型席位同口径）。
- 树内不支持把会话/工作区拖成父子关系（rc.2 同样不支持）。
