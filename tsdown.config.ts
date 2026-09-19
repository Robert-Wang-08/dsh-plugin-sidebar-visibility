import { defineConfig } from 'tsdown'

/*
 * 双入口：node 半（宿主侧 Cordis 插件）+ browser 半（/plugins/<id>/client.js）。
 *
 * browser 半的产物形状是硬契约，不是风格选择：
 * dsh 把每个插件的 client.js 当作 **classic script**，与其它插件一起拼进
 * 单个 `/plugins/??…` combo 响应，由浏览器作为一个 <script> 执行。client.js
 * 里出现任何模块级 `import` / `export`，浏览器会判定整段拼接脚本语法错误，
 * combo 内所有模块都不注册，加载器随后抛出 "bundle … loaded without
 * registering …"，且报错指向它当时等待的那个模块，与真正的出错文件无关。
 *
 * 所以 browser 半产出 CJS 形态（`exports.apply = …`），再由
 * `scripts/finalize-client-bundle.mjs` 套上 window.__ModuleLoader__ 包装并做
 * 契约校验。包装放在 tsdown 之后而不是用 outputOptions.banner：rolldown 的
 * banner 会把整块产物包进函数，rolldown-plugin-dts 的 fake-js 解析随即报
 * "import and export may only appear at the top level"，声明文件生成失败。
 * 后置包装同时让产物形状不依赖 rolldown / tsdown 的版本行为。
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    dts: true,
    external: [/^@deepseek-ai\//, 'react', 'react-dom'],
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: true,
    external: [
      /^@deepseek-ai\//,
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'scheduler',
    ],
    // dsh 通过 exports["./client"] 定位 lib/client.js；CJS 默认会写成 .cjs。
    outExtensions: () => ({ js: '.js' }),
  },
])
