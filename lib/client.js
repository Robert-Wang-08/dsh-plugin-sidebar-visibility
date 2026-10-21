window.__ModuleLoader__.load({
	id: "@local/dsh-plugin-sidebar-visibility",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
const react = __toESM(require("react"));

//#region src/client/visibility-store.ts
/**

* 可见性偏好本地持久化（浏览器侧，per-account）。

*

* 与官方惯例一致：ui-workspace 的展开状态、手动排序本就是

* 浏览器持久化记录（dsh-client-ui-workspace README「Reordering and view

* options」），本插件沿用 localStorage；跨设备同步留作 Host 升级项。

*

* TODO(verify): 官方记录的 account key 派生方式见

* dsh-client-ui-workspace/lib/types/client/stores.d.ts 的 retainAccountKeys。

* v0 用单一 key，多账号共存的串扰风险在 README 风险节标注。

*/
const STORAGE_KEY = "dsh.sidebar-visibility.v1";
/**

* 默认偏好。`groupBy` / `orderBy` 的取值与官方

* `dsh-client-ui-workspace` 的 viewing store 初始值一致（workspace + updated），

* 使本插件遮蔽官方占用者后，默认观感与官方浏览器保持一致。

*/
const DEFAULTS = {
	hiddenWorkspaceIds: [],
	collapsedWorkspaceIds: [],
	favoriteSessionIds: [],
	providerStash: {},
	groupBy: "workspace-tree",
	orderBy: "updated",
	treeMode: "plugin"
};
const GROUP_BY_VALUES = [
	"workspace-tree",
	"workspace",
	"flat"
];
function read() {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			const groupBy = GROUP_BY_VALUES.includes(parsed.groupBy) ? parsed.groupBy : void 0;
			return {
				...DEFAULTS,
				...parsed,
				...groupBy === void 0 ? {} : { groupBy }
			};
		}
	} catch {}
	return { ...DEFAULTS };
}
function write(next) {
	globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
	listeners.forEach((fn) => fn());
}
const listeners = new Set();
function subscribeVisibility(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}
function getVisibility() {
	return read();
}
function setGroupBy(mode) {
	const prefs = read();
	prefs.groupBy = mode;
	write(prefs);
}
function setOrderBy(mode) {
	const prefs = read();
	prefs.orderBy = mode;
	write(prefs);
}
/**

* 设置侧栏会话列表模式。

*

* 只写偏好 + 通知订阅者；占用者的挂载 / 卸载由 client/index.ts 的订阅回调

* 统一处理（同一 localStorage 键，刷新后保持）。

*/
function setTreeMode(mode) {
	const prefs = read();
	prefs.treeMode = mode;
	write(prefs);
}
/** 在插件树与官方树之间一键切换。 */
function toggleTreeMode() {
	setTreeMode(read().treeMode === "plugin" ? "official" : "plugin");
}
function toggleHiddenWorkspace(workspaceId) {
	const prefs = read();
	const i = prefs.hiddenWorkspaceIds.indexOf(workspaceId);
	if (i >= 0) prefs.hiddenWorkspaceIds.splice(i, 1);
	else prefs.hiddenWorkspaceIds.push(workspaceId);
	write(prefs);
}
/**

* 折叠 / 展开某个工作区。

*

* 折叠是纯展示态：只收起该组的会话行，标题行留在原位，会话数据、归档状态与

* 隐藏状态都不受影响。与 `toggleHiddenWorkspace` 的区别是隐藏会把整组挪到树底

* 的「已隐藏的工作区」折叠区，折叠则保留分组位置。

*/
function toggleCollapsedWorkspace(workspaceId) {
	const prefs = read();
	const i = prefs.collapsedWorkspaceIds.indexOf(workspaceId);
	if (i >= 0) prefs.collapsedWorkspaceIds.splice(i, 1);
	else prefs.collapsedWorkspaceIds.push(workspaceId);
	write(prefs);
}
/**

* 覆盖式设置折叠集合。

*

* 全折叠 / 全展开走整个列表一次写入，避免逐组 toggle 触发多次 localStorage

* 写入与多次订阅回调。

*/
function setCollapsedWorkspaces(workspaceIds) {
	const prefs = read();
	prefs.collapsedWorkspaceIds = [...workspaceIds];
	write(prefs);
}
function toggleFavoriteSession(sessionId) {
	const prefs = read();
	const i = prefs.favoriteSessionIds.indexOf(sessionId);
	if (i >= 0) prefs.favoriteSessionIds.splice(i, 1);
	else prefs.favoriteSessionIds.push(sessionId);
	write(prefs);
}
function stashProvider(settingsNs, entry) {
	const prefs = read();
	prefs.providerStash[settingsNs] = entry;
	write(prefs);
}
function popProviderStash(settingsNs) {
	const prefs = read();
	const entry = prefs.providerStash[settingsNs];
	delete prefs.providerStash[settingsNs];
	write(prefs);
	return entry;
}

//#endregion
//#region src/client/ProviderSuspendToggle.tsx
/** 在 describe() 结果中定位一个命名空间视图（兼容数组与记录两种外形）。 */
function findNamespaceView(desc, ns) {
	const list = Array.isArray(desc?.namespaces) ? desc.namespaces : Object.values(desc?.namespaces ?? desc ?? {});
	for (const v of list) if (v && (v.ns === ns || v.name === ns || v.namespace === ns)) return v;
	return null;
}
/**

* 暂存键。

*

* 同一个命名空间下可以挂多个 Provider（席位按 settingsNs 派发，注册一次收到该族

* 全部卡片），暂存必须按 Provider 的 settingsPath 分开，否则挂起其中一个会覆盖

* 另一个的暂存值。settingsPath 为空表示该 Provider 就是命名空间根，键退回命名空间

* 本身，与旧版本写入的键一致。

*/
function stashKeyOf(ns, settingsPath) {
	return settingsPath.length === 0 ? ns : `${ns}#${settingsPath.join("/")}`;
}
/** 按路径读取普通对象里的值；路径为空时返回对象本身。 */
function readPath(root, path) {
	let node = root;
	for (const key of path) {
		if (node === null || typeof node !== "object") return void 0;
		node = node[key];
	}
	return node;
}
function ProviderSuspendToggle(props) {
	const { provider, remote } = props;
	const ns = provider.settingsNs;
	const settingsPath = [...provider.settingsPath];
	const stashKey = stashKeyOf(ns, settingsPath);
	const [, force] = react.default.useReducer((n) => n + 1, 0);
	react.default.useEffect(() => subscribeVisibility(() => force()), []);
	const [busy, setBusy] = react.default.useState(false);
	const stashes = getVisibility().providerStash;
	const entry = stashes[stashKey];
	const legacy = entry === void 0 && stashKey !== ns ? stashes[ns] : void 0;
	const suspended = entry !== void 0 || legacy !== void 0;
	const label = suspended ? "恢复 Provider" : "挂起 Provider";
	async function suspend() {
		const settings = remote?.settings;
		if (!settings?.describe || !settings.mutate) {
			console.warn("[sidebar-visibility] remote.settings 不可用");
			return;
		}
		const desc = await settings.describe();
		const view = findNamespaceView(desc, ns);
		const revision = typeof view?.revision === "number" ? view.revision : void 0;
		const user = view?.user;
		const at = new Date().toISOString();
		if (settingsPath.length === 0) {
			if (user && typeof user === "object" && !Array.isArray(user) && Object.keys(user).length > 0) {
				const section = user;
				await settings.mutate(ns, Object.keys(section).map((k) => ({
					op: "unset",
					path: [k]
				})), revision);
				stashProvider(stashKey, {
					mode: "unset",
					stashedValue: section,
					suspendedAt: at
				});
				return;
			}
			await settings.mutate(ns, [{
				op: "set",
				path: ["models"],
				value: []
			}], revision);
			stashProvider(stashKey, {
				mode: "models-empty",
				stashedValue: null,
				suspendedAt: at
			});
			return;
		}
		const value = readPath(user, settingsPath);
		if (value !== void 0) {
			await settings.mutate(ns, [{
				op: "unset",
				path: settingsPath
			}], revision);
			stashProvider(stashKey, {
				mode: "unset",
				stashedValue: value,
				suspendedAt: at
			});
			return;
		}
		await settings.mutate(ns, [{
			op: "set",
			path: [...settingsPath, "models"],
			value: []
		}], revision);
		stashProvider(stashKey, {
			mode: "models-empty",
			stashedValue: null,
			suspendedAt: at
		});
	}
	async function resume() {
		const settings = remote?.settings;
		if (!settings?.describe || !settings.mutate) return;
		const desc = await settings.describe();
		const view = findNamespaceView(desc, ns);
		const revision = typeof view?.revision === "number" ? view.revision : void 0;
		if (entry === void 0 && legacy !== void 0) {
			if (legacy.mode === "unset" && legacy.stashedValue && typeof legacy.stashedValue === "object") await settings.update?.(ns, legacy.stashedValue, revision);
			else await settings.mutate(ns, [{
				op: "unset",
				path: ["models"]
			}], revision);
			popProviderStash(ns);
			return;
		}
		if (entry === void 0) return;
		if (entry.mode === "unset") if (settingsPath.length === 0) await settings.update?.(ns, entry.stashedValue, revision);
		else await settings.mutate(ns, [{
			op: "set",
			path: settingsPath,
			value: entry.stashedValue
		}], revision);
		else await settings.mutate(ns, [{
			op: "unset",
			path: [...settingsPath, "models"]
		}], revision);
		popProviderStash(stashKey);
	}
	async function onToggle() {
		setBusy(true);
		try {
			if (suspended) await resume();
			else await suspend();
		} catch (error) {
			console.warn("[sidebar-visibility] provider 挂起/恢复失败", error);
		} finally {
			setBusy(false);
		}
	}
	return react.default.createElement("button", {
		type: "button",
		disabled: busy,
		onClick: onToggle,
		"data-visibility-provider": ns,
		title: suspended ? "恢复该 Provider：暂存的配置写回，模型立即可选" : "挂起该 Provider：配置保留在本插件暂存区，模型从可选项中消失，可随时恢复"
	}, busy ? "…" : label);
}

//#endregion
//#region src/client/TreeModeToggle.tsx
function TreeModeToggle(props) {
	const [, force] = react.default.useReducer((n) => n + 1, 0);
	react.default.useEffect(() => subscribeVisibility(() => force()), []);
	const plugin = getVisibility().treeMode === "plugin";
	const wide = props.wide !== false;
	const label = plugin ? "插件列表" : "原始列表";
	const title = plugin ? "当前：插件增强会话列表（点击切换到官方原始列表）" : "当前：官方原始会话列表（点击切换到插件增强列表）";
	const styleTag = react.default.createElement("style", null, ".dshsv-footerToggle{display:flex;align-items:center;gap:6px;width:100%;font-size:11px;line-height:16px;padding:4px 8px;margin:0;border:none;background:transparent;color:inherit;border-radius:6px;cursor:pointer;font-family:inherit;text-align:left;box-sizing:border-box}.dshsv-footerToggle:hover{background:rgba(128,128,128,0.2)}.dshsv-modeDot{width:8px;height:8px;flex:none;border-radius:50%}.dshsv-modeDotPlugin{background:var(--dsw-alias-state-business-primary,#4c8dff)}.dshsv-modeDotOfficial{background:var(--dsw-alias-label-tertiary,#9aa0a6)}");
	const button = react.default.createElement("button", {
		type: "button",
		className: "dshsv-footerToggle",
		title,
		"aria-label": title,
		onClick: () => props.toggleMode?.(),
		style: props.wide === false ? {
			justifyContent: "center",
			padding: "4px",
			width: "auto"
		} : void 0
	}, react.default.createElement("span", {
		className: plugin ? "dshsv-modeDot dshsv-modeDotPlugin" : "dshsv-modeDot dshsv-modeDotOfficial",
		"aria-hidden": "true"
	}), wide ? react.default.createElement("span", { style: {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	} }, `会话列表：${label}`) : null);
	return react.default.createElement(react.default.Fragment, null, styleTag, button);
}

//#endregion
//#region src/client/workspace-hierarchy.ts
/**
* 规范化目录路径：Windows 盘符 / UNC 的反斜杠统一成正斜杠并去掉尾部分隔符；
* POSIX 路径只去尾分隔符。大小写保留、POSIX 反斜杠按普通字符原样保留。
*/
function canonicalFolderPath(path) {
	const unified = /^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\") ? path.replaceAll("\\", "/") : path;
	return unified.replace(/\/+$/, "");
}
/**
* 最近严格祖先（规范化路径域）。要求输入都是 canonicalFolderPath 的输出。
* 按「最长 `root/` 前缀」取最近祖先；自身除外；同长并列取先登记者；
* 比较大小写敏感。
*/
function owningAncestorKey(canonicalChild, canonicalKeys) {
	let owner;
	let length = -1;
	for (const key of canonicalKeys) if (key.length > length && canonicalChild !== key && canonicalChild.startsWith(`${key}/`)) {
		owner = key;
		length = key.length;
	}
	return owner;
}
/**
* 按已登记规范化路径构建层级。多对一：同一规范化路径重复登记时，子区只挂到
* 首个代表上；路径缺失或为空的工作区一律是根。全程环安全。
*/
function buildWorkspaceHierarchy(workspaces) {
	const idByCanonical = new Map();
	const canonicalById = new Map();
	for (const w of workspaces) {
		if (typeof w.path !== "string" || w.path === "") continue;
		const canonical = canonicalFolderPath(w.path);
		if (canonical === "") continue;
		canonicalById.set(w.workspaceId, canonical);
		if (!idByCanonical.has(canonical)) idByCanonical.set(canonical, w.workspaceId);
	}
	const canonicalKeys = [...idByCanonical.keys()];
	const parents = new Map();
	for (const w of workspaces) {
		const canonical = canonicalById.get(w.workspaceId);
		if (canonical === void 0) continue;
		const ownerKey = owningAncestorKey(canonical, canonicalKeys);
		if (ownerKey === void 0) continue;
		const ownerId = idByCanonical.get(ownerKey);
		if (ownerId !== void 0 && ownerId !== w.workspaceId) parents.set(w.workspaceId, ownerId);
	}
	const safeParents = new Map(parents);
	const depthById = new Map();
	for (const w of workspaces) {
		const seen = new Set([w.workspaceId]);
		let depth = 0;
		let cursor = parents.get(w.workspaceId);
		let cyclic = false;
		while (cursor !== void 0) {
			if (seen.has(cursor)) {
				cyclic = true;
				break;
			}
			seen.add(cursor);
			depth += 1;
			cursor = parents.get(cursor);
		}
		if (cyclic) {
			safeParents.delete(w.workspaceId);
			depthById.set(w.workspaceId, 0);
		} else depthById.set(w.workspaceId, depth);
	}
	return {
		order: [...workspaces],
		parents: safeParents,
		depthById
	};
}
/**
* 隐藏提升：把每个工作区的渲染父级换成「最近可见祖先」——直接父被隐藏时继续
* 向上走，直到可见工作区或根。带 seen 检测，环输入安全。
*/
function promotePastHidden(parents, hiddenIds) {
	const promoted = new Map();
	for (const id of parents.keys()) {
		const seen = new Set([id]);
		let cursor = parents.get(id);
		while (cursor !== void 0 && hiddenIds.has(cursor)) {
			if (seen.has(cursor)) {
				cursor = void 0;
				break;
			}
			seen.add(cursor);
			cursor = parents.get(cursor);
		}
		if (cursor !== void 0 && seen.has(cursor)) cursor = void 0;
		promoted.set(id, cursor);
	}
	return promoted;
}
/**
* 可见树：隐藏工作区整体不出现（其子区已由 promotedParents 提升到最近可见
* 祖先）；折叠的工作区保留自身节点、不递归子树；同级按 Host 顺序。环防御：
* 未被链接到任何父下的节点（含防御性孤儿）按根输出。
*/
function visibleTreeNodes(hierarchy, promotedParents, hiddenIds, collapsedIds) {
	const shells = new Map();
	for (const w of hierarchy.order) {
		if (hiddenIds.has(w.workspaceId)) continue;
		shells.set(w.workspaceId, {
			workspace: w,
			depth: 0,
			children: []
		});
	}
	const linked = new Set();
	for (const node of shells.values()) {
		const id = node.workspace.workspaceId;
		const parent = promotedParents.get(id) ?? void 0;
		if (parent === void 0) continue;
		const parentNode = shells.get(parent);
		if (parentNode === void 0 || parentNode === node) continue;
		if (collapsedIds.has(parent)) continue;
		parentNode.children.push(node);
		linked.add(id);
	}
	const roots = [...shells.values()].filter((node) => {
		const parent = promotedParents.get(node.workspace.workspaceId) ?? void 0;
		return parent === void 0 || !shells.has(parent) || shells.get(parent) === node;
	});
	const assigned = new Set();
	const walkDepth = (node, depth) => {
		if (assigned.has(node.workspace.workspaceId)) return;
		assigned.add(node.workspace.workspaceId);
		node.depth = depth;
		for (const child of node.children) walkDepth(child, depth + 1);
	};
	for (const root of roots) walkDepth(root, 0);
	return roots;
}
/**
* 从某工作区向上到根的祖先键集合（不含自身；环安全）。
* 用于「当前会话祖先高亮」：直接父与其所有严格祖先都会点亮。
*/
function ancestorKeys(parents, startId) {
	const keys = new Set();
	if (startId === void 0) return keys;
	const seen = new Set([startId]);
	let cursor = parents.get(startId);
	while (cursor !== void 0 && !seen.has(cursor)) {
		seen.add(cursor);
		keys.add(cursor);
		cursor = parents.get(cursor);
	}
	return keys;
}
/**
* 同级重排锚点（官方 commitWorkspaceDrag 的纯函数化，lib/client.js:2407-2423）。
* 只在同一父级（含同为根）的工作区之间重排；跨级（父子 / 异父）一律 reject，
* 绝不改父子目录。与官方一致的两种无变化情形返回 noop：
* anchor 即自身、以及源与锚点相邻。
*/
function siblingReorderAnchor(workspaces, parents, dragId, overId, half) {
	const siblings = workspaces.filter((w) => parents.get(w.workspaceId) === parents.get(dragId));
	const overIndex = siblings.findIndex((w) => w.workspaceId === overId);
	if (overIndex === -1) return {
		kind: "reject",
		reason: `drop target "${overId}" is not a sibling of "${dragId}"; cross-level reorder is not allowed`
	};
	const anchor = half === "before" ? overId : siblings[overIndex + 1]?.workspaceId;
	if (anchor === dragId) return { kind: "noop" };
	const sourceIndex = siblings.findIndex((w) => w.workspaceId === dragId);
	if (sourceIndex === -1) return {
		kind: "reject",
		reason: `dragged workspace "${dragId}" is not registered`
	};
	const anchorIndex = anchor === void 0 ? siblings.length : siblings.findIndex((w) => w.workspaceId === anchor);
	if (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1) return { kind: "noop" };
	return {
		kind: "move",
		anchor
	};
}

//#endregion
//#region src/client/runtime-bridge.ts
/**
* provider-badge 只读展示桥的消费面（纯函数，不含 React）。
*
* badge 是模型与配色的事实源：颜色 = 用户自选色 > ROUTE_COLORS > 自动调色板，
* 字色 = inkFor，模型名取自同一份 ModelDirectoryState。侧栏**不复制色表**，
* 只消费 `window.__DSH_PROVIDER_BADGE__.presentationFor(sessionId)`。
*
* 版本不符、桥缺失、目录未就绪或读取抛错 → null，调用方中性降级（照常计时）。
* 语义边界：颜色/模型代表会话**所选** provider 与模型，不反映运行期 failover
* 后的实际执行模型（与输入框徽标同口径）。
*/
/** 桥接全局名（badge 侧同名字符串）。 */
const BRIDGE_GLOBAL = "__DSH_PROVIDER_BADGE__";
/** badge 安装桥后广播的事件名：消费方可能在桥安装前已渲染。 */
const BRIDGE_EVENT = "dsh-provider-badge:bridge";
/** 桥协议版本；任一侧改动必须同步升版本。 */
const BRIDGE_VERSION = 1;
/** 读取 badge 桥；未装 badge、版本不符或读取抛错时返回 null（中性降级）。 */
function readBridge() {
	const root = typeof window === "undefined" ? void 0 : window;
	const bridge = root?.[BRIDGE_GLOBAL];
	if (bridge === null || bridge === void 0 || typeof bridge !== "object") return null;
	if (bridge.version !== BRIDGE_VERSION || typeof bridge.presentationFor !== "function") return null;
	return bridge;
}

//#endregion
//#region src/client/runtime-timer.ts
/** 初始观察：挂载时已 running 的会话没有可信起点，标为下限。 */
function initialObservation(now, running) {
	return {
		startedAt: running ? now : null,
		lowerBound: running,
		running
	};
}
/** 观察步进：false→true 记起点；true→false 清空；同一状态保持（返回同一对象）。 */
function stepObservation(previous, running, now) {
	if (running === previous.running) return previous;
	if (running) return {
		startedAt: now,
		lowerBound: false,
		running: true
	};
	return {
		startedAt: null,
		lowerBound: false,
		running: false
	};
}
/** 已运行毫秒；未运行时为 null；时钟回拨不产生负数。 */
function elapsedOf(observation, now) {
	if (observation.startedAt === null) return null;
	return Math.max(0, now - observation.startedAt);
}
/**
* 分钟文案：`Nm`；不足一分钟 `<1m`；下限观察 `≥Nm`（不足一分钟按 ≥1m 表达，
* 避免「≥<1m」这种无意义组合）。
*/
function formatElapsed(ms, lowerBound) {
	if (ms === null) return "";
	const minutes = Math.floor(ms / 6e4);
	if (lowerBound) return `≥${Math.max(1, minutes)}m`;
	return minutes < 1 ? "<1m" : `${minutes}m`;
}
let tickCount = 0;
let tickTimer = null;
const tickListeners = new Set();
function startTicker() {
	if (tickTimer !== null) return;
	tickTimer = setInterval(() => {
		tickCount += 1;
		for (const listener of [...tickListeners]) listener();
	}, 5e3);
}
/** 订阅共享节拍（末位订阅者释放后清除定时器，不留残余 interval）。 */
function subscribeRuntimeTick(listener) {
	tickListeners.add(listener);
	startTicker();
	return () => {
		tickListeners.delete(listener);
		if (tickListeners.size === 0 && tickTimer !== null) {
			clearInterval(tickTimer);
			tickTimer = null;
		}
	};
}
/** 节拍快照（uSES 要求同一状态返回同一值）。 */
function runtimeTickSnapshot() {
	return tickCount;
}

//#endregion
//#region src/client/runtime-indicator.tsx
/** 无模型信息时的中性主色（与官方 ongoing 转圈同色）。 */
const FALLBACK_COLOR = "var(--dsw-alias-state-business-primary, #4c8dff)";
function usePresentation(sessionId) {
	const [handle, setHandle] = react.default.useState(() => readBridge()?.presentationFor?.(sessionId) ?? null);
	react.default.useEffect(() => {
		const refresh = () => setHandle(readBridge()?.presentationFor?.(sessionId) ?? null);
		refresh();
		window.addEventListener(BRIDGE_EVENT, refresh);
		return () => window.removeEventListener(BRIDGE_EVENT, refresh);
	}, [sessionId]);
	const subscribe = react.default.useCallback((listener) => handle === null ? () => {} : handle.subscribe(listener), [handle]);
	const getSnapshot = react.default.useCallback(() => handle === null ? null : handle.getSnapshot(), [handle]);
	react.default.useEffect(() => {
		if (handle === null) return;
		try {
			handle.load?.();
		} catch {}
	}, [handle]);
	return react.default.useSyncExternalStore(subscribe, getSnapshot, () => null);
}
function useObservedRuntime(running) {
	const [observation, setObservation] = react.default.useState(() => initialObservation(Date.now(), running));
	react.default.useEffect(() => {
		setObservation((previous) => stepObservation(previous, running, Date.now()));
	}, [running]);
	react.default.useSyncExternalStore(subscribeRuntimeTick, runtimeTickSnapshot, () => 0);
	return observation;
}
function runtimeTitle(presentation, ms, lowerBound) {
	const minutes = ms === null ? 0 : Math.floor(ms / 6e4);
	const span = ms === null ? "正在运行" : lowerBound ? `已运行至少 ${Math.max(1, minutes)} 分钟（这一行开始显示时已在运行，真实起点不可知）` : minutes < 1 ? "本次运行不足 1 分钟" : `本次运行约 ${minutes} 分钟`;
	if (presentation === null) return `${span} · 模型信息不可用（provider-badge 未启用或目录未就绪）`;
	return `${span} · ${presentation.providerName} · ${presentation.modelName}`;
}
/**
* 运行中标识：彩色转圈环 + 模型徽标 + 已运行时间。
* 总宽在窄侧栏内约 96px，超出省略；完整说明放 title/aria-label。
*/
function RunningIndicator(props) {
	const { sessionId, running } = props;
	const presentation = usePresentation(sessionId);
	const observation = useObservedRuntime(running);
	if (!running) return null;
	const elapsed = elapsedOf(observation, Date.now());
	const title = runtimeTitle(presentation, elapsed, observation.lowerBound);
	const color = presentation?.color ?? FALLBACK_COLOR;
	return react.default.createElement("span", {
		className: "dshsv-run",
		title,
		"aria-label": title
	}, react.default.createElement("span", {
		className: "dshsv-spin",
		"aria-hidden": true,
		style: {
			borderTopColor: color,
			borderRightColor: color
		}
	}), presentation === null ? null : react.default.createElement("span", {
		className: "dshsv-runBadge",
		style: {
			background: presentation.color,
			color: presentation.ink
		}
	}, presentation.text), react.default.createElement("span", { className: "dshsv-runTime" }, formatElapsed(elapsed, observation.lowerBound)));
}

//#endregion
//#region src/client/WorkspaceTree.tsx
/** 检索输入到发请求之间的去抖；官方同样在输入侧去抖而非逐键发请求。 */
const SEARCH_DEBOUNCE_MS = 250;
function WorkspaceTree(props) {
	const { useSessions, useWorkspaces, open, startSession, searchSessions, renameSession, forkSession, archiveSession, pinSession, unpinSession, insertWorkspaceBefore } = props;
	const [, force] = react.default.useReducer((n) => n + 1, 0);
	react.default.useEffect(() => subscribeVisibility(() => force()), []);
	const [favoritesOnly, setFavoritesOnly] = react.default.useState(false);
	const [query, setQuery] = react.default.useState("");
	const [contentHits, setContentHits] = react.default.useState([]);
	const [searchPhase, setSearchPhase] = react.default.useState("idle");
	const [searchError, setSearchError] = react.default.useState(void 0);
	/**
	* 行内重命名。官方用 Modal 对话框承载，本插件拿不到该原语，改为把标题行
	* 就地换成输入框：Enter 提交、Escape 取消，失败消息显示在标题下方。
	*/
	const [renaming, setRenaming] = react.default.useState(null);
	const [renameBusy, setRenameBusy] = react.default.useState(false);
	const [renameError, setRenameError] = react.default.useState(void 0);
	const [workspaceDrag, setWorkspaceDrag] = react.default.useState(null);
	const workspaceDropCommitted = react.default.useRef(false);
	const prefs = getVisibility();
	const favorites = new Set(prefs.favoriteSessionIds);
	const hidden = new Set(prefs.hiddenWorkspaceIds);
	const collapsed = new Set(prefs.collapsedWorkspaceIds);
	const groupBy = prefs.groupBy;
	const orderBy = prefs.orderBy;
	const byId = useSessions?.((s) => s.byId) ?? {};
	const sessionIds = useSessions?.((s) => s.ids) ?? [];
	const current = useSessions?.((s) => s.current);
	const workspaces = useWorkspaces?.((s) => s.items) ?? [];
	const archived = useWorkspaces?.((s) => s.archivedSessionIds) ?? [];
	const archivedSet = new Set(archived);
	const pinned = useWorkspaces?.((s) => s.pinnedSessionIds) ?? [];
	const pinnedSet = new Set(pinned);
	const treeHierarchy = groupBy === "workspace-tree" ? buildWorkspaceHierarchy(workspaces) : null;
	const promotedParents = treeHierarchy === null ? null : promotePastHidden(treeHierarchy.parents, hidden);
	const currentGroupKey = treeHierarchy === null || current === void 0 ? void 0 : workspaces.find((w) => (w.sessionIds ?? []).includes(current))?.workspaceId;
	const currentAncestors = treeHierarchy === null ? new Set() : ancestorKeys(treeHierarchy.parents, currentGroupKey);
	const visibleSession = react.default.useCallback((id) => {
		const s = byId[id];
		if (!s || archivedSet.has(id) || s.origin === "subagent") return null;
		return s;
	}, [byId, archivedSet]);
	/**
	* 去重：置顶会话已在全局置顶区显示，其所属分组 / 平铺列表内不再重复出现。
	* 只在分组与平铺两条渲染路径上过滤，检索结果不过滤（否则置顶会话会从检索里
	* 消失），故不把该过滤写进 buildGroups / buildFlat。
	*/
	const withoutPinned = (list) => list.filter((s) => !pinnedSet.has(s.id));
	/**
	* 全局置顶区成员：直接从快照 pinnedSessionIds 取 id（即使该会话不在当前分组
	* 视图里也能出现），过 visibleSession 沿用归档 / subagent 排除规则，固定按
	* updatedAt 降序（不随 orderBy 档位变化）。
	*/
	const pinnedSessions = () => {
		const seen = new Set();
		const rows = [];
		for (const id of pinned) {
			if (seen.has(id)) continue;
			seen.add(id);
			const s = visibleSession(id);
			if (s !== null) rows.push(s);
		}
		return rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
	};
	const normalizedQuery = query.trim();
	react.default.useEffect(() => {
		if (normalizedQuery === "" || searchSessions === void 0) {
			setContentHits([]);
			setSearchPhase("idle");
			return void 0;
		}
		const controller = new AbortController();
		setSearchPhase("loading");
		const timer = globalThis.setTimeout(() => {
			const pending = searchSessions(normalizedQuery, controller.signal);
			if (pending === void 0) {
				setContentHits([]);
				setSearchPhase("idle");
				return;
			}
			pending.then((result) => {
				if (controller.signal.aborted) return;
				if (result.ok) {
					setContentHits(result.value.items);
					setSearchPhase("idle");
					setSearchError(void 0);
				} else {
					setContentHits([]);
					setSearchPhase("error");
					setSearchError(result.error.message);
				}
			}).catch((error) => {
				if (controller.signal.aborted) return;
				setContentHits([]);
				setSearchPhase("error");
				setSearchError(error instanceof Error ? error.message : String(error));
			});
		}, SEARCH_DEBOUNCE_MS);
		return () => {
			controller.abort();
			globalThis.clearTimeout(timer);
		};
	}, [normalizedQuery, searchSessions]);
	const byRecency = (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
	/**
	* 会话 → 所属工作区标签。预先建表，避免逐会话线性扫描工作区列表
	* （会话数 × 工作区数 的重复开销）。
	*/
	const workspaceLabelBySession = new Map();
	for (const w of workspaces) {
		const label = w.title || w.path || w.workspaceId;
		for (const id of w.sessionIds ?? []) if (!workspaceLabelBySession.has(id)) workspaceLabelBySession.set(id, label);
	}
	/**
	* 排序档位。官方 `manual` 是「用户拖拽顺序 + 活动提升」，本插件没有拖拽
	* 能力，因此 manual 取 Host / 工作区给出的顺序，updated 按最近更新降序。
	*/
	const ordered = (list) => orderBy === "updated" ? [...list].sort(byRecency) : list;
	/** 每个工作区的标题与路径，用于本地匹配与检索结果的工作区上下文。 */
	const workspaceLabelOf = (id) => workspaceLabelBySession.get(id);
	const matchesLocally = (s, needle) => {
		const haystack = [
			s.displayTitle,
			s.title,
			s.cwd,
			workspaceLabelOf(s.id)
		];
		return haystack.some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
	};
	const buildGroups = () => {
		const groups$1 = workspaces.map((w) => ({
			workspace: w,
			key: w.workspaceId,
			title: w.title || w.path || w.workspaceId,
			sessions: (w.sessionIds ?? []).map(visibleSession).filter(Boolean)
		}));
		const groupedIds = new Set(groups$1.flatMap((g) => g.sessions.map((s) => s.id)));
		const ungrouped = sessionIds.filter((id) => !groupedIds.has(id)).map(visibleSession).filter(Boolean);
		if (ungrouped.length > 0) groups$1.push({
			workspace: null,
			key: "__ungrouped__",
			title: "未分组",
			sessions: ungrouped
		});
		return groups$1.map((g) => ({
			...g,
			sessions: ordered(g.sessions)
		}));
	};
	/** 平铺模式：所有可见会话合并为一个列表，按当前排序档位排列。 */
	const buildFlat = () => {
		const groupedIds = new Set(workspaces.flatMap((w) => w.sessionIds ?? []));
		const head = sessionIds.filter((id) => !groupedIds.has(id));
		const tail = workspaces.flatMap((w) => (w.sessionIds ?? []).slice());
		const seen = new Set();
		const rows = [];
		for (const id of [...head, ...tail]) {
			if (seen.has(id)) continue;
			seen.add(id);
			const s = visibleSession(id);
			if (s !== null) rows.push(s);
		}
		return ordered(rows);
	};
	/**
	* 合并本地匹配与 Host 内容命中，沿用官方 deriveSearchResults 的次序约定：
	* 本地行按最近更新在前，纯内容命中保持后端顺序，重复会话就地补上后端片段。
	*/
	const buildSearchRows = () => {
		const needle = normalizedQuery.toLowerCase();
		const rows = [];
		const seen = new Set();
		const snippetOf = new Map(contentHits.map((hit) => [hit.sessionId, hit.snippet]));
		for (const s of buildFlat()) {
			if (!matchesLocally(s, needle)) continue;
			seen.add(s.id);
			const snippet = snippetOf.get(s.id);
			rows.push({
				session: s,
				workspaceLabel: workspaceLabelOf(s.id),
				...snippet === void 0 ? {} : { snippet }
			});
		}
		for (const hit of contentHits) {
			if (seen.has(hit.sessionId)) continue;
			const s = visibleSession(hit.sessionId);
			if (s === null) continue;
			seen.add(hit.sessionId);
			rows.push({
				session: s,
				snippet: hit.snippet,
				workspaceLabel: workspaceLabelOf(hit.sessionId)
			});
		}
		return rows;
	};
	const startRename = (s) => {
		setRenaming({
			id: s.id,
			draft: s.displayTitle || s.title || s.id
		});
		setRenameError(void 0);
	};
	const cancelRename = () => {
		if (renameBusy) return;
		setRenaming(null);
		setRenameError(void 0);
	};
	const confirmRename = () => {
		if (renaming === null || renameBusy) return;
		const title = renaming.draft.trim();
		if (title === "") return;
		setRenameBusy(true);
		setRenameError(void 0);
		const pending = renameSession?.(renaming.id, title);
		if (pending === void 0) {
			setRenameBusy(false);
			setRenameError("宿主未提供重命名动作");
			return;
		}
		pending.then(() => {
			setRenameBusy(false);
			setRenaming(null);
		}).catch((error) => {
			setRenameBusy(false);
			setRenameError(error instanceof Error ? error.message : String(error));
		});
	};
	/** 归档失败只记警告：与官方 onSessionArchive 的处理一致，不打断列表。 */
	const requestArchive = (sessionId) => {
		const pending = archiveSession?.(sessionId);
		if (pending === void 0) return;
		pending.catch((error) => {
			console.warn("session archive rejected:", error);
		});
	};
	/**
	* 置顶 / 取消置顶。状态由 Host 快照回推（pinSession 成功后 pinnedSessionIds
	* 更新触发重渲染），此处只发动作；失败仿照 requestArchive 记警告，不打断列表。
	*/
	const requestPinToggle = (sessionId) => {
		const isPinned = pinnedSet.has(sessionId);
		const pending = isPinned ? unpinSession?.(sessionId) : pinSession?.(sessionId);
		if (pending === void 0) return;
		pending.catch((error) => {
			console.warn(isPinned ? "session unpin rejected:" : "session pin rejected:", error);
		});
	};
	function sessionRow(s, snippet) {
		if (favoritesOnly && !favorites.has(s.id)) return null;
		const editing = renaming !== null && renaming.id === s.id ? renaming : null;
		const actions = react.default.createElement("span", { className: "dshsv-rowActions" }, react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn dshsv-btnSm",
			title: "重命名该会话",
			onClick: () => startRename(s)
		}, "重命名"), react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn dshsv-btnSm",
			title: "从该会话的最后一个完整回合分叉出新会话",
			onClick: () => forkSession?.(s.id)
		}, "分叉"), react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn dshsv-btnSm",
			title: "归档该会话（可在「设置 → 已归档会话」恢复）",
			onClick: () => requestArchive(s.id)
		}, "归档"));
		return react.default.createElement("div", {
			key: s.id,
			"data-session-id": s.id,
			className: s.id === current ? "dshsv-sessionRow dshsv-currentRow" : "dshsv-sessionRow",
			style: {
				display: "flex",
				flexDirection: "column",
				gap: 4,
				cursor: "pointer"
			}
		}, react.default.createElement("div", { style: {
			display: "flex",
			alignItems: "center",
			gap: 4
		} }, s.running === true ? react.default.createElement(RunningIndicator, {
			sessionId: s.id,
			running: true
		}) : null, react.default.createElement("span", { style: {
			flex: 1,
			minWidth: 0
		} }, editing === null ? react.default.createElement("span", {
			style: {
				display: "block",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			onClick: () => open?.(s.id)
		}, s.displayTitle || s.title || s.id) : react.default.createElement("input", {
			type: "text",
			value: editing.draft,
			autoFocus: true,
			disabled: renameBusy,
			"aria-label": "重命名会话",
			style: {
				width: "100%",
				boxSizing: "border-box",
				fontSize: 11,
				padding: "1px 4px"
			},
			onChange: (e) => setRenaming({
				id: s.id,
				draft: e.target.value
			}),
			onKeyDown: (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					confirmRename();
				} else if (e.key === "Escape") {
					e.preventDefault();
					cancelRename();
				}
			}
		}), snippet === void 0 || editing !== null ? null : react.default.createElement("span", { style: {
			display: "block",
			fontSize: 10,
			opacity: .7,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		} }, snippet), editing !== null && renameError !== void 0 ? react.default.createElement("span", { style: {
			display: "block",
			fontSize: 10,
			opacity: .8
		} }, renameError) : null), react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn",
			title: pinnedSet.has(s.id) ? "取消置顶该会话" : "置顶该会话（跨工作区集中显示）",
			"aria-label": pinnedSet.has(s.id) ? "取消置顶" : "置顶该会话",
			"aria-pressed": pinnedSet.has(s.id),
			onClick: () => requestPinToggle(s.id)
		}, pinnedSet.has(s.id) ? "📌" : "📍"), react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn",
			title: favorites.has(s.id) ? "取消收藏" : "收藏",
			onClick: () => toggleFavoriteSession(s.id)
		}, favorites.has(s.id) ? "★" : "☆")), editing === null ? actions : react.default.createElement("span", {
			className: "dshsv-rowActions",
			style: { display: "flex" }
		}, react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn dshsv-btnSm",
			disabled: renameBusy,
			onClick: confirmRename
		}, "确定"), react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn dshsv-btnSm",
			disabled: renameBusy,
			onClick: cancelRename
		}, "取消")));
	}
	/**
	* 全局「置顶（N）」区：跨工作区集中显示置顶会话，位置在 header 之后、工作区
	* 分组之前，分组模式与平铺模式都渲染。成员来自快照 pinnedSessionIds 与
	* visibleSession 的交集，因此不受所属分组折叠、隐藏或平铺合并影响 —— 折叠组
	* 里的置顶会话照样出现；排序固定按 updatedAt 降序。
	*
	* 与「仅收藏」的交叉：沿用现有过滤语义，开启「仅收藏」时置顶区同样按收藏过滤，
	* 标题里的 N 为过滤后实际显示条数。
	*/
	const pinnedBlock = () => {
		const rows = pinnedSessions().filter((s) => !favoritesOnly || favorites.has(s.id));
		if (rows.length === 0) return null;
		return react.default.createElement("div", {
			className: "dshsv-pinnedSection",
			style: { marginBottom: 6 }
		}, react.default.createElement("div", { style: {
			display: "flex",
			alignItems: "center",
			gap: 4,
			padding: "2px 8px",
			fontWeight: 600
		} }, react.default.createElement("span", {
			style: {
				flex: 1,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			title: "跨工作区集中显示已置顶会话（按最近更新排序）"
		}, `置顶（${rows.length}）`)), react.default.createElement("div", { className: "dshsv-rowList" }, rows.map((s) => sessionRow(s))));
	};
	/** 落点半边：指针在整组的上半 → 插到它前面，下半 → 插到它后面（官方 workspaceGroupHalf）。 */
	const workspaceHalfOf = (e) => {
		const rect = e.currentTarget.getBoundingClientRect();
		return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
	};
	/**
	* 提交排序。锚点是「插到谁之前」，省略表示移到末尾；自身位置与相邻同位这两种
	* 无变化情形直接返回，不发请求。与官方 commitWorkspaceDrag 逐条一致。
	*/
	const commitWorkspaceDrag = (activeDrag, over) => {
		if (workspaceDropCommitted.current) return;
		workspaceDropCommitted.current = true;
		setWorkspaceDrag(null);
		if (groupBy === "workspace-tree") {
			if (treeHierarchy === null) return;
			const outcome = siblingReorderAnchor(workspaces, treeHierarchy.parents, activeDrag.workspaceId, over.id, over.half);
			if (outcome.kind === "move") insertWorkspaceBefore?.(activeDrag.workspaceId, outcome.anchor).catch((reason) => {
				console.warn("workspace reorder rejected:", reason);
			});
			else if (outcome.kind === "reject") console.warn("workspace reorder rejected:", outcome.reason);
			return;
		}
		const rowIndex = workspaces.findIndex((w) => w.workspaceId === over.id);
		if (rowIndex === -1) return;
		const anchor = over.half === "before" ? over.id : workspaces[rowIndex + 1]?.workspaceId;
		if (anchor === activeDrag.workspaceId) return;
		const sourceIndex = workspaces.findIndex((w) => w.workspaceId === activeDrag.workspaceId);
		const anchorIndex = anchor === void 0 ? workspaces.length : workspaces.findIndex((w) => w.workspaceId === anchor);
		if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
		insertWorkspaceBefore?.(activeDrag.workspaceId, anchor).catch((reason) => {
			console.warn("workspace reorder rejected:", reason);
		});
	};
	const startWorkspaceDrag = (workspaceId) => {
		workspaceDropCommitted.current = false;
		setWorkspaceDrag({
			workspaceId,
			over: null
		});
	};
	const endWorkspaceDrag = () => {
		if (workspaceDrag !== null && workspaceDrag.over !== null) commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
		else setWorkspaceDrag(null);
		workspaceDropCommitted.current = false;
	};
	const hoverWorkspace = (workspaceId, half) => {
		setWorkspaceDrag((active) => active === null ? active : {
			...active,
			over: {
				id: workspaceId,
				half
			}
		});
	};
	function workspaceBlock(g, isHidden) {
		const isCollapsed = collapsed.has(g.key);
		const expanded = !isHidden && !isCollapsed;
		const groupSessions = withoutPinned(g.sessions);
		const rowCount = groupSessions.filter((s) => !favoritesOnly || favorites.has(s.id)).length;
		const rows = expanded ? groupSessions.map((s) => sessionRow(s)).filter((row) => row !== null) : [];
		const dropMarker = g.workspace !== null && workspaceDrag !== null && workspaceDrag.over?.id === g.key ? workspaceDrag.over.half : null;
		return react.default.createElement("div", {
			key: g.key,
			className: dropMarker === "before" ? "dshsv-dropBefore" : dropMarker === "after" ? "dshsv-dropAfter" : void 0,
			style: { marginBottom: 6 },
			onDragOver: g.workspace === null || workspaceDrag === null ? void 0 : (e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				hoverWorkspace(g.key, workspaceHalfOf(e));
			},
			onDrop: g.workspace === null || workspaceDrag === null ? void 0 : (e) => {
				e.preventDefault();
				commitWorkspaceDrag(workspaceDrag, {
					id: g.key,
					half: workspaceHalfOf(e)
				});
			}
		}, react.default.createElement("div", {
			draggable: g.workspace !== null,
			onDragStart: g.workspace === null ? void 0 : (e) => {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", g.key);
				startWorkspaceDrag(g.key);
			},
			onDragEnd: g.workspace === null ? void 0 : endWorkspaceDrag,
			style: {
				display: "flex",
				alignItems: "center",
				gap: 4,
				padding: "2px 8px",
				fontWeight: 600
			}
		}, isHidden ? null : react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn dshsv-caret",
			"aria-expanded": !isCollapsed,
			"aria-label": `${isCollapsed ? "展开" : "折叠"}工作区 ${g.title}`,
			title: isCollapsed ? "展开该工作区" : "折叠该工作区（收起组内会话）",
			onClick: () => toggleCollapsedWorkspace(g.key)
		}, isCollapsed ? "▸" : "▾"), react.default.createElement("span", {
			style: {
				flex: 1,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				cursor: isHidden ? void 0 : "pointer"
			},
			title: g.workspace?.path ?? g.title,
			onClick: isHidden ? void 0 : () => toggleCollapsedWorkspace(g.key)
		}, g.title), isCollapsed && rowCount > 0 ? react.default.createElement("span", { style: {
			fontSize: 10,
			opacity: .6
		} }, String(rowCount)) : null, g.workspace ? react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn",
			title: isHidden ? "恢复显示该工作区" : "隐藏该工作区（可恢复，会话数据不受影响）",
			onClick: () => toggleHiddenWorkspace(g.key)
		}, isHidden ? "恢复" : "隐藏") : null, g.workspace ? react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn",
			"aria-label": `在“${g.title}”中新建会话`,
			title: `在“${g.title}”中新建会话`,
			onClick: () => {
				if (isCollapsed) toggleCollapsedWorkspace(g.key);
				startSession?.(g.key);
			}
		}, "+") : null), expanded ? react.default.createElement("div", { className: "dshsv-rowList" }, rows) : null);
	}
	const selectStyle = {
		fontSize: "calc(11px + var(--dsh-content-font-delta, 0px))",
		maxWidth: 108
	};
	const searchInputStyle = {
		flex: 1,
		minWidth: 0,
		fontSize: "calc(12px + var(--dsh-content-font-delta, 0px))",
		padding: "2px 6px",
		boxSizing: "border-box"
	};
	const rootStyle = {
		display: "flex",
		flexDirection: "column",
		flex: 1,
		minHeight: 0,
		boxSizing: "border-box"
	};
	const scrollStyle = {
		flex: 1,
		minHeight: 0,
		overflowY: "auto",
		paddingBottom: 16
	};
	const styleTag = react.default.createElement("style", null, ".dshsv-btn{font-size:11px;line-height:16px;padding:1px 6px;border:none;background:transparent;color:inherit;border-radius:var(--dsw-radius-sm,4px);cursor:pointer;flex:none;font-family:inherit}.dshsv-btn:hover{background:rgba(128,128,128,0.22)}.dshsv-btn:disabled{opacity:0.5;cursor:default;background:transparent}.dshsv-btnSm{font-size:10px;line-height:14px;padding:0 5px}.dshsv-caret{width:14px;padding:0;font-size:10px;opacity:0.7}.dshsv-caret:hover{opacity:1;background:transparent}.dshsv-wsHeader{border-radius:var(--dsw-radius-md,6px)}.dshsv-wsHeader:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,0.12))}.dshsv-folderIcon{display:inline-flex;flex:none;color:var(--dsw-alias-label-tertiary,#9a9a9a)}.dshsv-ancestorRow{color:var(--dsw-alias-state-business-primary,#4c8dff)}.dshsv-pinnedSection{box-shadow:0 1px 0 0 rgba(128,128,128,0.25)}.dshsv-spin{width:10px;height:10px;flex:none;box-sizing:border-box;border-radius:50%;border:2px solid rgba(128,128,128,0.3);border-top-color:var(--dsw-alias-state-business-primary,#4c8dff);animation:dshsv-spin .8s linear infinite}@keyframes dshsv-spin{to{transform:rotate(360deg)}}.dshsv-run{display:inline-flex;align-items:center;gap:4px;flex:none;max-width:104px;min-width:0;overflow:hidden;font-size:10px;line-height:14px}.dshsv-runBadge{flex:none;padding:0 4px;border-radius:var(--dsw-radius-sm,4px);font-size:9px;line-height:13px;font-weight:600;letter-spacing:0}.dshsv-runTime{flex:none;opacity:0.75;font-variant-numeric:tabular-nums}.dshsv-rowActions{display:none;flex-direction:row;align-items:center;gap:4px;margin-top:2px}.dshsv-sessionRow:hover .dshsv-rowActions{display:flex}.dshsv-rowActions .dshsv-btn{text-align:center;flex:none}.dshsv-rowList > :nth-child(even){background:rgba(128,128,128,0.08)}.dshsv-sessionRow{padding:4px 8px;padding-inline-start:calc(8px + var(--dsh-workspace-indent,0px));transition:background .1s ease,padding .1s ease}.dshsv-sessionRow.dshsv-currentRow{background:rgba(128,128,128,0.15)}.dshsv-sessionRow:hover{background:rgba(128,128,128,0.25);padding-block:7px;padding-inline-end:8px;padding-inline-start:calc(8px + var(--dsh-workspace-indent,0px))}.dshsv-dropBefore{box-shadow:0 -2px 0 0 var(--dsw-alias-state-business-primary,#4c8dff)}.dshsv-dropAfter{box-shadow:0 2px 0 0 var(--dsw-alias-state-business-primary,#4c8dff)}");
	const groups = buildGroups();
	const visibleGroups = groups.filter((g) => g.workspace === null || !hidden.has(g.key));
	const hiddenGroups = groups.filter((g) => g.workspace !== null && hidden.has(g.key));
	const groupsByKey = new Map(groups.map((g) => [g.key, g]));
	const treeNodes = treeHierarchy !== null && promotedParents !== null ? visibleTreeNodes(treeHierarchy, promotedParents, hidden, collapsed) : [];
	/** rc.2 文件夹轮廓图标：stroke 用 currentColor，随组头文字基线对齐。 */
	const folderGlyph = () => react.default.createElement("svg", {
		className: "dshsv-folderIcon",
		width: 14,
		height: 14,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.6,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": true
	}, react.default.createElement("path", { d: "M3 7a2 2 0 0 1 2-2h4.6a2 2 0 0 1 1.5.7L12.6 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" }));
	/**
	* 目录树节点渲染：组头（文件夹轮廓 + 折叠箭头 + 标题）→ 子组（递归）→ 本组
	* 会话行（官方 rc.2 同序，lib/client.js:2447-2544）。缩进沿用官方变量名
	* --dsh-workspace-indent（12px × 深度），组头与会话行各自读取；每个分组自带
	* 独立的 .dshsv-rowList，子组行不落进父组列表（斑马纹按列表内序数取色，隔离）。
	* 「未分组」伪组没有 workspace：不拖拽、不可作为落点、无隐藏 / 新建按钮。
	*/
	function renderTreeGroup(node, depth) {
		const g = groupsByKey.get(node.workspace.workspaceId);
		if (g === void 0) return null;
		const isPseudo = g.workspace === null;
		const isCollapsed = collapsed.has(g.key);
		const groupSessions = withoutPinned(g.sessions);
		const rowCount = groupSessions.filter((s) => !favoritesOnly || favorites.has(s.id)).length;
		const rows = isCollapsed ? [] : groupSessions.map((s) => sessionRow(s)).filter((row) => row !== null);
		const isCurrentLineage = currentAncestors.has(g.key) || currentGroupKey === g.key;
		const dropMarker = workspaceDrag !== null && workspaceDrag.over?.id === g.key ? workspaceDrag.over.half : null;
		const compatibleDrag = !isPseudo && workspaceDrag !== null && treeHierarchy !== null && treeHierarchy.parents.get(workspaceDrag.workspaceId) === treeHierarchy.parents.get(g.key);
		const hasParent = treeHierarchy !== null && treeHierarchy.parents.get(g.key) !== void 0;
		const acceptsDrop = !isPseudo && workspaceDrag !== null;
		return react.default.createElement("div", {
			key: g.key,
			className: dropMarker === "before" ? "dshsv-dropBefore" : dropMarker === "after" ? "dshsv-dropAfter" : void 0,
			style: {
				marginBottom: 6,
				["--dsh-workspace-indent"]: String(depth * 12) + "px"
			},
			onDragOver: acceptsDrop ? (e) => {
				e.preventDefault();
				if (!compatibleDrag && hasParent) return;
				e.stopPropagation();
				if (compatibleDrag) {
					e.dataTransfer.dropEffect = "move";
					hoverWorkspace(g.key, workspaceHalfOf(e));
				} else {
					e.dataTransfer.dropEffect = "none";
					setWorkspaceDrag((active) => active === null || active.over === null ? active : {
						...active,
						over: null
					});
				}
			} : void 0,
			onDrop: acceptsDrop ? (e) => {
				e.preventDefault();
				if (!compatibleDrag && hasParent) return;
				e.stopPropagation();
				if (compatibleDrag && workspaceDrag !== null) commitWorkspaceDrag(workspaceDrag, {
					id: g.key,
					half: workspaceHalfOf(e)
				});
				else {
					workspaceDropCommitted.current = true;
					setWorkspaceDrag(null);
				}
			} : void 0
		}, react.default.createElement("div", {
			draggable: !isPseudo,
			onDragStart: isPseudo ? void 0 : (e) => {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", g.key);
				startWorkspaceDrag(g.key);
			},
			onDragEnd: isPseudo ? void 0 : endWorkspaceDrag,
			className: "dshsv-wsHeader",
			style: {
				display: "flex",
				alignItems: "center",
				gap: 4,
				padding: "2px 8px",
				paddingInlineStart: "calc(8px + var(--dsh-workspace-indent, 0px))",
				fontWeight: 600
			}
		}, isPseudo ? null : folderGlyph(), isPseudo ? null : react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn dshsv-caret",
			"aria-expanded": !isCollapsed,
			"aria-label": (isCollapsed ? "展开" : "折叠") + "工作区 " + g.title,
			title: isCollapsed ? "展开该工作区（含子工作区）" : "折叠该工作区（收起整棵子树）",
			onClick: () => toggleCollapsedWorkspace(g.key)
		}, isCollapsed ? "▸" : "▾"), react.default.createElement("span", {
			className: isCurrentLineage ? "dshsv-ancestorRow" : void 0,
			style: {
				flex: 1,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				cursor: "pointer",
				fontSize: "calc(12px + var(--dsh-content-font-delta, 0px))"
			},
			title: g.workspace?.path ?? g.title,
			onClick: () => toggleCollapsedWorkspace(g.key)
		}, g.title), isCollapsed && rowCount > 0 ? react.default.createElement("span", { style: {
			fontSize: 10,
			opacity: .6
		} }, String(rowCount)) : null, isPseudo ? null : react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn",
			title: "隐藏该工作区（可恢复，会话数据不受影响；子工作区自动上提）",
			onClick: () => toggleHiddenWorkspace(g.key)
		}, "隐藏"), isPseudo ? null : react.default.createElement("button", {
			type: "button",
			className: "dshsv-btn",
			"aria-label": "在“" + g.title + "”中新建会话",
			title: "在“" + g.title + "”中新建会话",
			onClick: () => {
				if (isCollapsed) toggleCollapsedWorkspace(g.key);
				startSession?.(g.key);
			}
		}, "+")), !isCollapsed && node.children.length > 0 ? react.default.createElement("div", { role: "group" }, node.children.map((c) => renderTreeGroup(c, depth + 1))) : null, !isCollapsed && rows.length > 0 ? react.default.createElement("div", { className: "dshsv-rowList" }, rows) : null);
	}
	/** 目录树模式「已隐藏的工作区」折叠区的一行：仅保留恢复入口，无拖拽。 */
	const hiddenTreeRow = (g) => react.default.createElement("div", {
		key: g.key,
		style: {
			display: "flex",
			alignItems: "center",
			gap: 4,
			padding: "2px 8px"
		}
	}, folderGlyph(), react.default.createElement("span", {
		style: {
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		},
		title: g.workspace?.path ?? g.title
	}, g.title), react.default.createElement("button", {
		type: "button",
		className: "dshsv-btn",
		title: "恢复显示该工作区",
		onClick: () => toggleHiddenWorkspace(g.key)
	}, "恢复"));
	const collapsibleKeys = groupBy !== "flat" ? visibleGroups.map((g) => g.key) : [];
	const allCollapsed = collapsibleKeys.length > 0 && collapsibleKeys.every((key) => collapsed.has(key));
	/** 全折叠 / 全展开：一次覆盖写入，只作用于当前可折叠范围。 */
	const toggleAllCollapsed = () => {
		const scope = new Set(collapsibleKeys);
		setCollapsedWorkspaces(allCollapsed ? prefs.collapsedWorkspaceIds.filter((id) => !scope.has(id)) : [...new Set([...prefs.collapsedWorkspaceIds, ...collapsibleKeys])]);
	};
	const header = react.default.createElement("div", { style: {
		display: "flex",
		flexDirection: "column",
		gap: 4,
		padding: "4px 8px"
	} }, react.default.createElement("div", { style: {
		display: "flex",
		alignItems: "center",
		gap: 4
	} }, react.default.createElement("input", {
		type: "search",
		value: query,
		placeholder: "查找会话…",
		"aria-label": "查找会话",
		style: searchInputStyle,
		onChange: (e) => setQuery(e.target.value),
		onKeyDown: (e) => {
			if (e.key === "Escape") setQuery("");
		}
	}), searchPhase === "loading" ? react.default.createElement("span", { style: {
		fontSize: 11,
		opacity: .6
	} }, "检索中") : null, searchPhase === "error" ? react.default.createElement("span", {
		style: {
			fontSize: 11,
			opacity: .6
		},
		title: `内容检索不可用，仅显示本地匹配：${searchError ?? "unknown"}`
	}, "仅本地") : null), react.default.createElement("div", { style: {
		display: "flex",
		gap: 6,
		alignItems: "center",
		flexWrap: "wrap"
	} }, react.default.createElement("label", { style: {
		display: "flex",
		gap: 3,
		alignItems: "center",
		fontSize: 11
	} }, "视图", react.default.createElement("select", {
		value: groupBy,
		"aria-label": "分组模式",
		style: selectStyle,
		onChange: (e) => setGroupBy(e.target.value)
	}, react.default.createElement("option", { value: "workspace-tree" }, "按目录树"), react.default.createElement("option", { value: "workspace" }, "按工作区"), react.default.createElement("option", { value: "flat" }, "一个列表"))), react.default.createElement("label", { style: {
		display: "flex",
		gap: 3,
		alignItems: "center",
		fontSize: 11
	} }, "排序", react.default.createElement("select", {
		value: orderBy,
		"aria-label": "排序方式",
		style: selectStyle,
		onChange: (e) => setOrderBy(e.target.value)
	}, react.default.createElement("option", { value: "manual" }, "Host 顺序"), react.default.createElement("option", { value: "updated" }, "最近更新"))), react.default.createElement("label", { style: {
		display: "flex",
		gap: 4,
		alignItems: "center",
		cursor: "pointer",
		fontSize: 11
	} }, react.default.createElement("input", {
		type: "checkbox",
		checked: favoritesOnly,
		onChange: (e) => setFavoritesOnly(e.target.checked)
	}), "仅收藏"), collapsibleKeys.length > 0 ? react.default.createElement("button", {
		type: "button",
		className: "dshsv-btn",
		title: allCollapsed ? "展开所有工作区分组" : "折叠所有工作区分组（收起组内会话）",
		onClick: toggleAllCollapsed
	}, allCollapsed ? "全部展开" : "全部折叠") : null));
	if (normalizedQuery !== "") {
		const rows = buildSearchRows();
		const shown = rows.filter((row) => !favoritesOnly || favorites.has(row.session.id));
		return react.default.createElement("div", {
			"data-plugin": "sidebar-visibility",
			style: rootStyle
		}, styleTag, header, react.default.createElement("div", { style: scrollStyle }, react.default.createElement("div", { style: {
			padding: "2px 8px",
			fontSize: 11,
			opacity: .7
		} }, `${shown.length} 个匹配`), shown.length === 0 ? react.default.createElement("div", { style: {
			padding: "4px 8px",
			opacity: .7
		} }, searchPhase === "loading" ? "检索中…" : "没有匹配的会话") : react.default.createElement("div", { className: "dshsv-rowList" }, shown.map((row) => react.default.createElement("div", { key: row.session.id }, row.workspaceLabel === void 0 ? null : react.default.createElement("div", { style: {
			padding: "2px 8px 0",
			fontSize: 10,
			opacity: .6
		} }, row.workspaceLabel), sessionRow(row.session, row.snippet))))));
	}
	let body;
	if (groupBy === "flat") {
		const flatRows = withoutPinned(buildFlat());
		body = react.default.createElement("div", null, pinnedBlock(), react.default.createElement("div", { style: {
			padding: "2px 8px",
			fontSize: 11,
			opacity: .7
		} }, `${flatRows.length} 个会话`), react.default.createElement("div", { className: "dshsv-rowList" }, flatRows.map((s) => sessionRow(s))));
	} else if (groupBy === "workspace-tree") {
		const ungroupedGroup = groupsByKey.get("__ungrouped__");
		body = react.default.createElement("div", null, pinnedBlock(), treeNodes.map((n) => renderTreeGroup(n, 0)), ungroupedGroup !== void 0 ? renderTreeGroup({
			workspace: { workspaceId: "__ungrouped__" },
			depth: 0,
			children: []
		}, 0) : null, hiddenGroups.length > 0 ? react.default.createElement("details", { style: {
			marginTop: 8,
			padding: "0 8px",
			opacity: .75
		} }, react.default.createElement("summary", null, `已隐藏的工作区（${hiddenGroups.length}）`), hiddenGroups.map((g) => hiddenTreeRow(g))) : null);
	} else body = react.default.createElement("div", null, pinnedBlock(), visibleGroups.map((g) => workspaceBlock(g, false)), hiddenGroups.length > 0 ? react.default.createElement("details", { style: {
		marginTop: 8,
		padding: "0 8px",
		opacity: .75
	} }, react.default.createElement("summary", null, `已隐藏的工作区（${hiddenGroups.length}）`), hiddenGroups.map((g) => workspaceBlock(g, true))) : null);
	return react.default.createElement("div", {
		"data-plugin": "sidebar-visibility",
		style: rootStyle
	}, styleTag, header, react.default.createElement("div", { style: scrollStyle }, body));
}

//#endregion
//#region src/client/index.ts
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
const inject = [
	"slots",
	"uiWorkspace",
	"sessions",
	"workspaces",
	"remote",
	"remote.settings"
];
/** Provider 卡片席位按命名空间注册的 key 清单。 */
const PROVIDER_CARD_KEYS = ["llm-deepseek", "llm-pi-ai"];
/**

* 遮蔽 `sidebar.workspaces` 官方占用者所需的 priority。

*

* 席位按 priority 升序排列、取第一个渲染；官方 client-ui-workspace 用默认 0，

* 因此这里必须低于 0。single 席位只在 priority 相同时报重复占用。

*/
const SHADOW_OFFICIAL_PRIORITY = -1;
function apply(ctx) {
	const client = ctx;
	const sessions = client.get?.("sessions");
	const workspaces = client.get?.("workspaces");
	/** 工作区树占用者的注入面：每次注册都重建（动作面走官方导航服务）。 */
	const browserFace = () => ({
		open: (sessionId) => client.uiWorkspace?.openSession(sessionId),
		startSession: (workspaceId) => client.uiWorkspace?.startSession(workspaceId),
		forkSession: (sessionId) => {
			client.uiWorkspace?.forkSession(sessionId).catch(() => {});
		},
		archiveSession: (sessionId) => client.uiWorkspace?.archiveSession(sessionId) ?? Promise.resolve(),
		pinSession: (sessionId) => client.uiWorkspace?.pinSession(sessionId) ?? Promise.resolve(),
		unpinSession: (sessionId) => client.uiWorkspace?.unpinSession(sessionId) ?? Promise.resolve(),
		renameSession: async (sessionId, title) => {
			const session = sessions?.binding(sessionId)?.session;
			if (session === void 0) throw new Error(`unknown session "${sessionId}"`);
			const result = await session.rename(title);
			if (!result.ok) throw new Error(result.error.message);
		},
		searchSessions: (query, signal) => sessions?.search(query, signal),
		insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
			await workspaces?.insertBefore(workspaceId, beforeWorkspaceId);
		}
	});
	let disposeTree;
	const mountTree = () => {
		if (disposeTree !== void 0) return;
		disposeTree = client.slots.inject("sidebar.workspaces", () => client.slots.register({
			name: "sidebar.workspaces",
			priority: SHADOW_OFFICIAL_PRIORITY,
			inject: browserFace
		}, WorkspaceTree));
	};
	const unmountTree = () => {
		disposeTree?.();
		disposeTree = void 0;
	};
	const syncTreeMode = () => {
		if (getVisibility().treeMode === "official") unmountTree();
		else mountTree();
	};
	syncTreeMode();
	ctx.effect(() => subscribeVisibility(syncTreeMode), "sidebar-visibility: tree mode");
	client.slots.inject("sidebar.footer.action", () => client.slots.register({
		name: "sidebar.footer.action",
		id: "sidebar-visibility-tree-mode",
		order: 100,
		inject: () => ({
			toggleMode: toggleTreeMode,
			getMode: () => getVisibility().treeMode
		})
	}, TreeModeToggle));
	for (const ns of PROVIDER_CARD_KEYS) client.slots.inject("settings.models.provider-card", () => client.slots.register({
		name: "settings.models.provider-card",
		key: ns,
		inject: () => ({ remote: client.remote })
	}, ProviderSuspendToggle));
}

//#endregion
exports.apply = apply;
exports.inject = inject;
return module.exports; } });