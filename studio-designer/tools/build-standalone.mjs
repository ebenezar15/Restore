// Builds dist/RoomTone-standalone.html: one self-contained file (JS, CSS,
// libraries and icon inlined) that works offline even when opened directly
// from disk (file://), where ES modules and service workers are unavailable.
//   npm i -D esbuild && node tools/build-standalone.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => readFileSync(join(root, p), 'utf8');

const result = await build({
  entryPoints: [join(root, 'js/main.js')],
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2020',
  alias: { three: join(root, 'vendor/three/three.module.min.js') },
  plugins: [{
    name: 'addons',
    setup(b) { b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(root, 'vendor/three/addons', a.path.slice('three/addons/'.length)) })); },
  }],
});
const js = result.outputFiles[0].text;
// keep inlined code from confusing the HTML parser
const esc = (s) => { if (s.includes('<' + '!--')) console.warn('warning: inlined script contains an HTML comment opener, which can break parsing'); return s.replace(/<\/script/gi, '<\\/script'); };
const iconData = 'data:image/svg+xml;base64,' + Buffer.from(r('icon.svg')).toString('base64');

let html = r('index.html')
  .replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '')
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/icon\.svg/g, iconData)
  .replace('<link rel="stylesheet" href="css/app.css" />', () => `<style>${r('css/app.css')}</style>`)
  .replace('<script src="vendor/jspdf.umd.min.js"></script>', () => `<script>${esc(r('vendor/jspdf.umd.min.js'))}</script>`)
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>${esc(js)}</script>`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/RoomTone-standalone.html'), html);
console.log(`dist/RoomTone-standalone.html  ${(html.length / 1024 / 1024).toFixed(2)} MB`);
