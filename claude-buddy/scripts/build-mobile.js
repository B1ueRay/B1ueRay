'use strict';
// Собирает мобильную версию в один HTML: сцена, голос и звуки — те же модули, что на компе,
// плюс mobile/app.js. three.js грузится ES-модулем с jsDelivr.
//   node scripts/build-mobile.js [выходной файл]
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

function asModule(src, names, transform = (x) => x) {
  const body = transform(src)
    .replace(/^import .*$/gm, '')
    .replace(/^export (class|function|const) /gm, '$1 ');
  return `const { ${names.join(', ')} } = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();\n`;
}

// на телефоне холст не во весь экран (снизу строка чата) — размеры берём у холста, а не у окна
const sceneFix = (s) => s.replace(/window\.innerWidth/g, 'this.canvas.clientWidth').replace(/window\.innerHeight/g, 'this.canvas.clientHeight');

const js = [
  `import * as THREE from '${THREE_URL}';`,
  asModule(read('src/renderer/scene.js'), ['BuddyScene'], sceneFix),
  asModule(read('src/renderer/voice.js'), ['Voice']),
  asModule(read('src/renderer/sfx.js'), ['Sfx']),
  read('mobile/app.js'),
].join('\n');

const html = `${read('mobile/shell.html')}\n<script type="module">\n${js}\n</script>\n`;
const out = process.argv[2] || path.join(root, 'dist', 'mobile', 'claude-buddy.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`mobile build: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
