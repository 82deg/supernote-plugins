#!/usr/bin/env node
// Render Lucide icons (https://lucide.dev, ISC licence) to PNGs for Supernote
// toolbar / lasso buttons. Supernote takes image files, not components, so
// icons are rasterised at build time and nothing is added to the plugin.
//
// usage: node tools/render-icons.mjs <outDir> <lucide-name>=<file.png> ... [--size 48] [--stroke 1.75]
// e.g.   node tools/render-icons.mjs ImagePlacer/assets/icons rotate-ccw=rotate_left.png crop=crop.png
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {Resvg} from '@resvg/resvg-js';

const require = createRequire(import.meta.url);
const iconsDir = join(dirname(require.resolve('lucide-static/package.json')), 'icons');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) {
    return fallback;
  }
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return v;
};
const size = opt('size', 48);
// Lucide's default is 2 on a 24 grid; a touch thinner reads crisper on e-ink.
const stroke = opt('stroke', 1.75);
const [outDir, ...pairs] = args;
if (!outDir || pairs.length === 0) {
  console.error('usage: render-icons.mjs <outDir> <lucide-name>=<file.png> ... [--size 48] [--stroke 1.75]');
  process.exit(2);
}
mkdirSync(outDir, {recursive: true});

for (const pair of pairs) {
  const [name, file] = pair.split('=');
  const svg = readFileSync(join(iconsDir, `${name}.svg`), 'utf8')
    .replace(/<!--.*?-->/s, '')
    .replace(/stroke="currentColor"/, 'stroke="#000"')
    .replace(/stroke-width="[\d.]+"/, `stroke-width="${stroke}"`);
  const png = new Resvg(svg, {fitTo: {mode: 'width', value: size}, background: 'rgba(0,0,0,0)'})
    .render()
    .asPng();
  writeFileSync(join(outDir, file), png);
  console.log(`${name} → ${join(outDir, file)} (${size}px, stroke ${stroke})`);
}
