import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const root = process.cwd()

const checks = []

function file(path) {
  return join(root, path)
}

function read(path) {
  return readFileSync(file(path), 'utf8')
}

function addCheck(name, passed, details = '') {
  checks.push({ name, passed, details })
}

function hasFile(path) {
  return existsSync(file(path))
}

function includesAll(content, tokens) {
  return tokens.every((token) => content.includes(token))
}

const requiredDocs = ['agent.md', '项目设计.md', '项目进度清单.md', 'README.md']
for (const doc of requiredDocs) {
  addCheck(`required doc exists: ${doc}`, hasFile(doc))
}

const requiredFiles = [
  '.env.example',
  'src/vite-env.d.ts',
  'src/App.tsx',
  'src/index.css',
  'src/shared/db/database.ts',
  'src/shared/db/seed.ts',
  'src/entities/place/types.ts',
  'src/entities/place/rating.ts',
  'src/entities/place/filter.ts',
  'src/features/map/mapAdapter.ts',
  'src/features/map/amapAdapter.ts',
  'src/features/map/amapConfig.ts',
  'src/features/backup/backupSchema.ts',
  'src/features/backup/backupService.ts',
  'src/features/places/placeService.ts',
  'src/features/places/uiStore.ts',
]
for (const sourceFile of requiredFiles) {
  addCheck(`required source exists: ${sourceFile}`, hasFile(sourceFile))
}

const packageJson = JSON.parse(read('package.json'))
const deps = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
}

for (const dep of [
  'react',
  'vite',
  'typescript',
  'dexie',
  'dexie-react-hooks',
  'zod',
  'zustand',
  '@radix-ui/react-dialog',
  '@radix-ui/react-tooltip',
  '@radix-ui/react-slider',
  'lucide-react',
  'vitest',
]) {
  addCheck(`required dependency: ${dep}`, Boolean(deps[dep]))
}

for (const forbiddenDep of [
  'firebase',
  '@supabase/supabase-js',
  'next',
  '@react-native/core',
  'electron',
]) {
  addCheck(`forbidden dependency absent: ${forbiddenDep}`, !deps[forbiddenDep])
}

addCheck(
  'alignment script is registered',
  packageJson.scripts?.['check:alignment'] === 'node scripts/check-project-alignment.mjs',
)

addCheck(
  'project remains web-only Vite app',
  packageJson.scripts?.dev === 'vite' && packageJson.scripts?.build?.includes('vite build'),
)

const rating = read('src/entities/place/rating.ts')
addCheck(
  'score weights follow original plan',
  includesAll(rating, ['taste: 40', 'environment: 20', 'service: 20', 'value: 20']),
)
addCheck('score validation keeps 1-10 range', includesAll(rating, ['score >= 1', 'score <= 10']))

const database = read('src/shared/db/database.ts')
addCheck(
  'Dexie tables and indexes match planned schema',
  includesAll(database, [
    'places:',
    'visits:',
    'photos:',
    'categories:',
    'tags:',
    'settings:',
    '[status+categoryId]',
    '*tagIds',
    '[placeId+date]',
  ]),
)

const mapAdapter = read('src/features/map/mapAdapter.ts')
addCheck(
  'map provider is behind MapAdapter boundary',
  includesAll(mapAdapter, [
    'export interface MapAdapter',
    'searchPoi',
    'setMarkers',
    'focusPlace',
    'focusLocation',
    'setSearchPreview',
  ]),
)
addCheck('fallback city remains Shanghai', mapAdapter.includes('121.4737') && mapAdapter.includes('31.2304'))

const amapConfig = read('src/features/map/amapConfig.ts')
addCheck(
  'AMap config uses Vite env variables',
  includesAll(amapConfig, ['VITE_AMAP_KEY', 'VITE_AMAP_SECURITY_JS_CODE']),
)

const amapAdapter = read('src/features/map/amapAdapter.ts')
addCheck(
  'AMap SDK remains lazy-loaded behind adapter',
  includesAll(amapAdapter, [
    'https://webapi.amap.com/loader.js',
    'AMap.PlaceSearch',
    'createAmapAdapter',
    'setFitView',
    'setZoomAndCenter',
    'amap-place-marker',
    'amap-search-marker',
  ]),
)

const envExample = read('.env.example')
addCheck(
  'env example documents optional AMap keys',
  includesAll(envExample, ['VITE_AMAP_KEY=', 'VITE_AMAP_SECURITY_JS_CODE=']),
)

const viteEnv = read('src/vite-env.d.ts')
addCheck(
  'Vite env typing documents optional AMap keys',
  includesAll(viteEnv, ['VITE_AMAP_KEY', 'VITE_AMAP_SECURITY_JS_CODE']),
)

const app = read('src/App.tsx')
const mapCanvas = read('src/features/map/ui/MapCanvas.tsx')
const mapSearchBar = read('src/features/map/ui/MapSearchBar.tsx')
const placeEditor = read('src/features/places/ui/PlaceEditorDialog.tsx')
const poiSearch = read('src/features/map/usePoiSearch.ts')
addCheck(
  'app shell keeps core product language',
  includesAll(app, ['干饭地图指北', 'Private Food Atlas']) &&
    includesAll(placeEditor, ['新增店铺']) &&
    includesAll(mapSearchBar, ['搜索地图地点']),
)
addCheck(
  'POI search state machine is shared through usePoiSearch',
  includesAll(poiSearch, ['usePoiSearch', 'createAmapAdapter', 'createRequestTracker']) &&
    includesAll(app, ['usePoiSearch']) &&
    includesAll(placeEditor, ['usePoiSearch']),
)
addCheck('motion is CSS-driven without a runtime animation library', !app.includes('gsap'))
addCheck('app does not directly import AMap SDK', !app.includes('@amap') && !app.includes('AMap.'))
addCheck(
  'app mounts real AMap layer through adapter in command layout',
  includesAll(app, ['command-shell']) &&
    includesAll(mapSearchBar, ['map-search-console']) &&
    includesAll(mapCanvas, ['amap-map-layer', 'mapProvider', 'setSearchPreview']),
)
addCheck(
  'command layout removes verbose map/storage status copy',
  !app.includes('已接入高德地图') && !app.includes('本地优先 · IndexedDB 自动保存'),
)

const css = read('src/index.css')
addCheck(
  'editorial map visual tokens are present',
  includesAll(css, ['--accent', '--accent-2', '--accent-3', '--serif']),
)
addCheck(
  'real AMap layer keeps editorial marker styling',
  includesAll(css, [
    '.amap-map-layer',
    '.amap-place-marker',
    '.amap-search-marker',
    '.map-canvas.amap-enabled',
    '.map-search-console',
  ]),
)
addCheck('reduced motion is respected', css.includes('prefers-reduced-motion'))
addCheck('transition all is not used', !css.includes('transition: all'))

const agent = read('agent.md')
addCheck(
  'agent constraints require design doc sync',
  includesAll(agent, ['项目设计.md', '必须同步更新']),
)
addCheck(
  'agent constraints require progress checklist sync',
  includesAll(agent, ['项目进度清单.md', '进度清单同步']),
)

const design = read('项目设计.md')
addCheck(
  'design doc records original product boundaries',
  includesAll(design, ['只做 Web', '本地优先', '编辑部地图', '不做登录', '不做云同步']),
)

const progress = read('项目进度清单.md')
addCheck(
  'progress checklist has overview and modules',
  includesAll(progress, ['## 总览', '## 1. 项目文档与约束模块', '- [x]', '- [ ]']),
)

const failed = checks.filter((check) => !check.passed)

for (const check of checks) {
  const prefix = check.passed ? '✓' : '✗'
  console.log(`${prefix} ${check.name}`)
  if (!check.passed && check.details) {
    console.log(`  ${check.details}`)
  }
}

if (failed.length > 0) {
  console.error(`\nProject alignment check failed: ${failed.length} issue(s).`)
  process.exit(1)
}

console.log('\nProject alignment check passed.')
