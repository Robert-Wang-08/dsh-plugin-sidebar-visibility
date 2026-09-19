---
title: dsh-plugin-sidebar-visibility 成果物索引
date created: 2026-09-18
date modified: 2026-09-18
tags:
  - dsh
  - plugin
  - build-output-index
---

# 成果物索引

- `package.json`：插件包清单（含 `dsh.client` browser roster 声明与 tsdown 构建脚本），按官方 dsh-client-ui-* 包布局建立。
- `tsdown.config.ts`：双入口构建配置（node 半 `lib/index.js` + browser 半 `lib/client.js`）。
- `src/index.ts`：node 半占位插件，v0 仅承担 roster 载体，host 扩展挂点见注释。
- `src/client/visibility-store.ts`：localStorage 可见性偏好存储（隐藏工作区 / 折叠工作区 / 收藏会话 / 分组与排序档位 / Provider 暂存）。
- `src/client/ProviderSuspendToggle.tsx`：`settings.models.provider-card` 席位（keyed）的挂起/恢复开关，走已核实的 `ctx.remote.settings` describe/update/mutate。
- `src/client/WorkspaceTree.tsx`：`sidebar.workspaces` 席位替换型占用者；本地最小分组（官方 deriveGroups 未挂 ./client 导出面），叠加隐藏 / 折叠（单组 + 全部折叠展开）/ 收藏过滤、查找框与视图选项，会话行提供重命名（就地输入）/ 分叉 / 归档 / 收藏四个动作。
- `src/client/index.ts`：browser 半入口，按官方 workspace 包的 inject/register 先例注册两个席位；动作面注入 `open / startSession / forkSession / archiveSession / renameSession / searchSessions`。
- `cordis.patch.example.yml`：profile 挂载示例与官方 ui-workspace 冲突时的禁用提示。
- `README.md`：功能-实现对照、安装与使用说明、复核确认事实、首验清单与迭代计划。
- `lib/index.js` / `lib/client.js`（+ `.d.ts`）：tsdown 构建产物（2026-09-18 最新构建通过，client.js 28.3 kB，external 仅 react）。
