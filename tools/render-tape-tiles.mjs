#!/usr/bin/env node
// Render seamless washi-tape pattern tiles to PNG (build time only; nothing is
// added to the plugin's code). Each tile is 24 dp: <name>.png at 24 px and
// <name>@2x.png at 48 px, so React Native picks the right density.
// Icon motifs (stars, hearts, leaves, moons, coffee…) come from Lucide
// (https://lucide.dev, ISC).
//
// usage: node tools/render-tape-tiles.mjs <outDir>
// e.g.   node tools/render-tape-tiles.mjs ImagePlacer/assets/tape
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join, dirname} from 'node:path';
import {Resvg} from '@resvg/resvg-js';

const require = createRequire(import.meta.url);
const iconsDir = join(dirname(require.resolve('lucide-static/package.json')), 'icons');
const INK = '#7A7A7A';

/** The shapes inside a Lucide icon's <svg>, minus its own styling. */
const lucideBody = name =>
  /<svg[^>]*>([\s\S]*)<\/svg>/.exec(readFileSync(join(iconsDir, `${name}.svg`), 'utf8').replace(/<!--[\s\S]*?-->/g, ''))[1];

/** One Lucide icon at (x, y), `size` px: filled for solid shapes, outlined for detailed ones. */
const icon = (name, x, y, size, filled) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" stroke="${INK}" stroke-width="${filled ? 2 : 2.6}" ` +
  `stroke-linecap="round" stroke-linejoin="round" fill="${filled ? INK : 'none'}">${lucideBody(name)}</g>`;

/** A motif twice per tile: top-left cell and offset half a tile, so rows stagger. */
const motif = (name, filled = true) => icon(name, 1, 1, 10, filled) + icon(name, 13, 13, 10, filled);

// Every tile repeats seamlessly on a 24 × 24 grid.
const TILES = {
  stripes: [-24, -12, 0, 12, 24]
    // Run past the tile edges so the stripes join without a seam.
    .map(o => `<line x1="${o - 6}" y1="30" x2="${o + 30}" y2="-6" stroke="${INK}" stroke-width="3.2"/>`)
    .join(''),
  dots: `<circle cx="6" cy="6" r="2.6" fill="${INK}"/><circle cx="18" cy="18" r="2.6" fill="${INK}"/>`,
  grid:
    `<line x1="6" y1="0" x2="6" y2="24" stroke="${INK}" stroke-width="1.4"/>` +
    `<line x1="18" y1="0" x2="18" y2="24" stroke="${INK}" stroke-width="1.4"/>` +
    `<line x1="0" y1="6" x2="24" y2="6" stroke="${INK}" stroke-width="1.4"/>` +
    `<line x1="0" y1="18" x2="24" y2="18" stroke="${INK}" stroke-width="1.4"/>`,
  // One full sine period across the tile, so neighbouring tiles join up.
  wavy:
    `<path d="M0 8 C 4 4, 8 4, 12 8 S 20 12, 24 8" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M0 20 C 4 16, 8 16, 12 20 S 20 24, 24 20" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
  diamonds: motif('diamond'),
  stars: motif('star'),
  hearts: motif('heart'),

  // Geometric, a bit more playful (1.1).
  zigzag:
    `<path d="M-6 9 L0 3 L6 9 L12 3 L18 9 L24 3 L30 9M-6 21 L0 15 L6 21 L12 15 L18 21 L24 15 L30 21" ` +
    `fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  checks: [0, 6, 12, 18]
    .flatMap(y => [0, 6, 12, 18].filter(x => (x + y) % 12 === 0).map(x => `<rect x="${x}" y="${y}" width="6" height="6" fill="#9A9A9A"/>`))
    .join(''),
  triangles:
    `<g fill="${INK}"><path d="M0 1 L6 9 L12 1Z"/><path d="M12 1 L18 9 L24 1Z"/>` +
    `<path d="M-6 13 L0 21 L6 13Z"/><path d="M6 13 L12 21 L18 13Z"/><path d="M18 13 L24 21 L30 13Z"/></g>`,
  // Fish scales: a row of arcs every 6 px, every other row shifted half a scale.
  scales:
    `<g fill="none" stroke="${INK}" stroke-width="1.4">` +
    [0, 6, 12, 18, 24]
      .map((y, k) => {
        const o = k % 2 ? -6 : 0;
        return `<path d="M${o - 12} ${y} A6 6 0 0 0 ${o} ${y} A6 6 0 0 0 ${o + 12} ${y} A6 6 0 0 0 ${o + 24} ${y} A6 6 0 0 0 ${o + 36} ${y}"/>`;
      })
      .join('') +
    `</g>`,
  confetti:
    `<g fill="${INK}" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M3 7 L7 3" stroke-width="1.8"/>` +
    `<circle cx="16" cy="5" r="1.8" stroke="none"/>` +
    `<path d="M10.5 14 L14 12 L13.5 16Z" stroke-width="0.8"/>` +
    `<rect x="18.5" y="13.5" width="3.2" height="3.2" transform="rotate(30 20 15)" stroke="none"/>` +
    `<path d="M3 18 v4 M1 20 h4" fill="none" stroke-width="1.4"/>` +
    `<path d="M15 21 q1.5 -2 3 0 t3 0" fill="none" stroke-width="1.4"/></g>`,
  crosses:
    `<g stroke="${INK}" stroke-width="2.2" stroke-linecap="round">` +
    `<path d="M6 3 V9 M3 6 H9"/><path d="M18 15 V21 M15 18 H21"/></g>` +
    `<circle cx="18" cy="6" r="1.3" fill="${INK}"/><circle cx="6" cy="18" r="1.3" fill="${INK}"/>`,
  squiggles:
    `<g fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round">` +
    `<path d="M2 7 q2.5 -3 5 0 t5 0"/><circle cx="18" cy="6" r="2.4"/>` +
    `<path d="M14 19 q2.5 -3 5 0 t5 0" transform="translate(-1 0)"/><path d="M3 15 L7 21"/></g>`,
  // Classic textiles.
  plaid:
    `<g fill="${INK}"><rect x="3" y="0" width="6" height="24" opacity="0.45"/><rect x="0" y="3" width="24" height="6" opacity="0.45"/>` +
    `<rect x="15.5" y="0" width="1.4" height="24" opacity="0.8"/><rect x="0" y="15.5" width="24" height="1.4" opacity="0.8"/></g>`,
  // Houndstooth, woven: a 2/2 twill of 4 dark + 4 light threads each way.
  // A thread shows its warp colour where (x + y) mod 4 < 2, else its weft
  // colour. 1.5 px per thread, so the 8-thread repeat fits twice per tile.
  houndstooth: Array.from({length: 16 * 16}, (_, k) => {
    const x = k % 16;
    const y = Math.floor(k / 16);
    const warpOnTop = (x + y) % 4 < 2;
    const dark = warpOnTop ? x % 8 < 4 : y % 8 < 4;
    return dark ? `<rect x="${x * 1.5}" y="${y * 1.5}" width="1.55" height="1.55" fill="${INK}"/>` : '';
  }).join(''),
  // Herringbone: columns of short slanted bars, alternating direction, offset half a step.
  herringbone: [0, 12]
    .map(
      x =>
        `<g stroke="${INK}" stroke-width="2" stroke-linecap="round">` +
        [-6, 0, 6, 12, 18, 24]
          .map(y => `<line x1="${x + 1}" y1="${y + 5}" x2="${x + 5}" y2="${y + 1}"/><line x1="${x + 7}" y1="${y + 4}" x2="${x + 11}" y2="${y + 8}"/>`)
          .join('') +
        `</g>`,
    )
    .join(''),
  // Flat-top hexagons, 8 wide and 6 tall, so they tile on the 24 grid.
  honeycomb:
    `<g fill="none" stroke="${INK}" stroke-width="1.3">` +
    [-6, 0, 6, 12, 18, 24, 30]
      .flatMap((cx, col) =>
        [-6, 0, 6, 12, 18, 24, 30].map(r => {
          const cy = r + (col % 2 ? 3 : 0);
          return `<path d="M${cx - 4} ${cy} L${cx - 2} ${cy - 3} L${cx + 2} ${cy - 3} L${cx + 4} ${cy} L${cx + 2} ${cy + 3} L${cx - 2} ${cy + 3}Z"/>`;
        }),
      )
      .join('') +
    `</g>`,

  // Botanical.
  leaves: icon('leaf', 1, 2, 10, true) + icon('leaf', 13, 14, 9, false),
  flowers: icon('flower', 1, 1, 11, false) + icon('flower', 13, 13, 11, false),
  sprigs: motif('sprout', false),

  // Sky and seasons.
  moons: icon('moon', 1, 1, 10, true) + icon('star', 14, 14, 8, true) + `<circle cx="19" cy="5" r="1" fill="${INK}"/><circle cx="5" cy="19" r="1" fill="${INK}"/>`,
  clouds: motif('cloud', true),
  sparkles: motif('sparkles', false),
  snowflakes: motif('snowflake', false),

  // Doodles.
  arrows: motif('arrow-right', false),
  music: icon('music', 1, 1, 10, false) + icon('music-2', 13, 13, 10, false),
  coffee: motif('coffee', false),
  doodles: icon('heart', 1, 1, 9, true) + icon('star', 14, 2, 8, true) + icon('arrow-right', 2, 14, 9, false) + icon('sparkles', 13, 13, 10, false),

  terrazzo:
    `<g fill="${INK}">` +
    `<path d="M2 3 L6 2 L7 5 L3 7Z"/><path d="M14 4 L17 3 L16 7Z"/><path d="M19 9 L22 10 L21 13 L18 12Z"/>` +
    `<path d="M8 11 L11 10 L12 13 L9 14Z"/><path d="M3 17 L6 16 L5 20Z"/><path d="M13 18 L17 17 L18 20 L14 21Z"/>` +
    `<circle cx="10" cy="5" r="0.9"/><circle cx="20" cy="18" r="0.9"/><circle cx="5" cy="12" r="0.8"/></g>`,
};

const [outDir] = process.argv.slice(2);
if (!outDir) {
  console.error('usage: render-tape-tiles.mjs <outDir>');
  process.exit(2);
}
mkdirSync(outDir, {recursive: true});
for (const [name, body] of Object.entries(TILES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;
  for (const [suffix, px] of [
    ['', 24],
    ['@2x', 48],
  ]) {
    const png = new Resvg(svg, {fitTo: {mode: 'width', value: px}, background: 'rgba(0,0,0,0)'}).render().asPng();
    writeFileSync(join(outDir, `${name}${suffix}.png`), png);
  }
  console.log(`${name} → ${outDir}/${name}.png (+@2x)`);
}
