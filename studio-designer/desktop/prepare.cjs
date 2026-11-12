// Copies the single-file build of the app into desktop/app so it can be packaged.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'dist', 'RoomTone-standalone.html');
if (!fs.existsSync(src)) { console.error('Missing ' + src + ' — run "npm run build" in studio-designer first.'); process.exit(1); }
fs.mkdirSync(path.join(__dirname, 'app'), { recursive: true });
fs.copyFileSync(src, path.join(__dirname, 'app', 'index.html'));
console.log('app/index.html ready (' + (fs.statSync(src).size / 1048576).toFixed(2) + ' MB)');
