/**
 * Post-build step for the browser half: wrap `lib/client.js` in the
 * window.__ModuleLoader__ classic-script envelope, then assert the contract.
 *
 * Why this exists
 * ---------------
 * dsh serves each plugin's `lib/client.js` as a **classic script**, and the
 * browser fetches every plugin's client.js as ONE concatenated `/plugins/??…`
 * response executed as a single <script>. A module-level `import` / `export`
 * anywhere in that concatenation is a SyntaxError for the whole combo, so no
 * module registers and the loader reports "bundle … loaded without registering
 * <id>" against whichever module it happened to await — naming an innocent
 * package.
 *
 * That failure is invisible at build time and misleading at runtime, so this
 * step both produces the required shape and fails the build when the shape is
 * wrong. It compiles the artifact as a classic script, which is exactly the
 * browser's parse step.
 *
 * The wrap lives here rather than in tsdown's `outputOptions.banner` because
 * rolldown's banner encloses the whole chunk in a function, after which
 * rolldown-plugin-dts' fake-js pass fails with "import and export may only
 * appear at the top level" and no declaration file is emitted.
 *
 * Idempotent: an already-wrapped file is unwrapped and re-wrapped, so the
 * registered id always follows package.json.
 *
 * Usage: node scripts/finalize-client-bundle.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const clientPath = `${root}lib/client.js`
const hostPath = `${root}lib/index.js`
const clientTypesPath = `${root}lib/client.d.ts`

const LOAD_PREFIX = 'window.__ModuleLoader__.load({'
const INTEROP_END = 'var exports = module.exports;'
const FOOTER = 'return module.exports; } });'
const SOURCE_MAP_TRAILER = /\/\/# sourceMappingURL=(\S+)\s*$/

const banner = `${LOAD_PREFIX}\n\tid: ${JSON.stringify(pkg.name)},\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\t${INTEROP_END}`

const failures = []
const notes = []

/** Strip a previous wrap so the step can run twice without nesting. */
function unwrap(source) {
  if (!source.startsWith(LOAD_PREFIX)) return source
  const interopAt = source.indexOf(INTEROP_END)
  if (interopAt === -1) return source
  const bodyStart = source.indexOf('\n', interopAt + INTEROP_END.length) + 1
  const footerAt = source.lastIndexOf(FOOTER)
  if (footerAt === -1) return source
  return source.slice(bodyStart, footerAt)
}

if (!existsSync(clientPath)) {
  failures.push(`missing lib/client.js — run tsdown before this step`)
} else {
  const built = readFileSync(clientPath, 'utf8')
  let body = unwrap(built)

  // Keep the sourcemap trailer last, where devtools expects it.
  const trailerMatch = SOURCE_MAP_TRAILER.exec(body)
  const trailer = trailerMatch === null ? '' : `\n//# sourceMappingURL=${trailerMatch[1]}\n`
  if (trailerMatch !== null) body = body.slice(0, trailerMatch.index)

  body = body.replace(/^\s*\n/, '').replace(/\s+$/, '')

  // The raw chunk must be a plain CJS module: no module-level ESM syntax.
  try {
    new vm.Script(body, { filename: 'client.body.js' })
  } catch (error) {
    failures.push(
      `tsdown emitted module-level ESM syntax in lib/client.js: ${error.message}\n` +
        '    The browser half must be CommonJS; check the client entry format in tsdown.config.ts.',
    )
  }

  const wrapped = `${banner}\n${body}\n${FOOTER}${trailer}`
  writeFileSync(clientPath, wrapped)
  notes.push(`client.js  wrapped for ${pkg.name} (${Buffer.byteLength(wrapped)} bytes)`)
}

if (existsSync(clientPath)) {
  const source = readFileSync(clientPath, 'utf8')

  try {
    new vm.Script(source, { filename: 'client.js' })
  } catch (error) {
    failures.push(
      `lib/client.js does not parse as a classic script: ${error.message}\n` +
        '    A module-level import/export breaks the whole /plugins/?? combo, not just this plugin.',
    )
  }

  if (!source.startsWith(LOAD_PREFIX)) failures.push('lib/client.js does not start with window.__ModuleLoader__.load({')
  if (!source.includes(`id: ${JSON.stringify(pkg.name)}`)) {
    failures.push(`lib/client.js does not register id ${JSON.stringify(pkg.name)} from package.json`)
  }
  if (!new RegExp(`${FOOTER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:\\/\\/# sourceMappingURL=\\S*)?\\s*$`).test(source)) {
    failures.push('lib/client.js does not end with "return module.exports; } });"')
  }
  const registrations = [...source.matchAll(/__ModuleLoader__\.load\(/g)].length
  if (registrations !== 1) failures.push(`expected exactly 1 __ModuleLoader__.load() call, found ${registrations}`)
  notes.push('client.js  classic-script parse ok, 1 registration')
}

if (!existsSync(hostPath)) {
  failures.push('missing lib/index.js')
} else {
  const host = readFileSync(hostPath, 'utf8')
  if (!/^\s*export\s*\{/m.test(host)) failures.push('lib/index.js has no ESM export — the host half stays ESM for Node')
  notes.push('index.js   ESM host half ok')
}

if (!existsSync(clientTypesPath)) {
  failures.push('missing lib/client.d.ts — exports["./client"].types would dangle')
} else {
  notes.push('client.d.ts ok')
}

if (pkg.exports?.['./client']?.default !== './lib/client.js') {
  failures.push(`package.json exports["./client"].default is ${String(pkg.exports?.['./client']?.default)}, expected ./lib/client.js`)
}

for (const note of notes) console.log(`  ok  ${note}`)

if (failures.length > 0) {
  console.error('')
  console.error('client bundle contract FAILED:')
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error('')
  console.error('See the browser-half note in tsdown.config.ts for the required shape.')
  process.exit(1)
}

console.log('  ok  client bundle contract satisfied')
