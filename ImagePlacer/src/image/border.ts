// Borders: a line (solid, dashed or dotted) or washi tape around a picture.
// Pure maths only, unit-tested. Everything scales with the photo, so the same
// layout works in page px (placement), output px (render) and dp (preview):
// pass `scale` = how many of your units one design dp is.
import type {Size} from '../note/geometry';

export type LineStyle = 'solid' | 'dash' | 'dot';
export type LineWidth = 'thin' | 'med' | 'thick';
export type Tone = 'light' | 'med' | 'dark' | 'black';
export type TapePattern =
  | 'plain'
  | 'stripes'
  | 'dots'
  | 'grid'
  | 'wavy'
  | 'checks'
  | 'crosses'
  | 'zigzag'
  | 'triangles'
  | 'scales'
  | 'diamonds'
  | 'honeycomb'
  | 'plaid'
  | 'houndstooth'
  | 'herringbone'
  | 'terrazzo'
  | 'confetti'
  | 'squiggles'
  | 'stars'
  | 'hearts'
  | 'leaves'
  | 'flowers'
  | 'sprigs'
  | 'moons'
  | 'clouds'
  | 'sparkles'
  | 'snowflakes'
  | 'arrows'
  | 'music'
  | 'coffee'
  | 'doodles';
export type TapeGroup = 'basics' | 'geometric' | 'nature' | 'fun';
export type TapeWidth = 'slim' | 'wide';
export type TapePlacement = 'topCorners' | 'corners' | 'top' | 'frame';

export type Border =
  | {kind: 'none'}
  | {kind: 'line'; style: LineStyle; width: LineWidth; tone: Tone}
  | {kind: 'tape'; pattern: TapePattern; width: TapeWidth; placement: TapePlacement};

export const NO_BORDER: Border = {kind: 'none'};

export const LINE_STYLES: {id: LineStyle; label: string}[] = [
  {id: 'solid', label: 'Solid'},
  {id: 'dash', label: 'Dashed'},
  {id: 'dot', label: 'Dotted'},
];
export const LINE_WIDTHS: {id: LineWidth; label: string}[] = [
  {id: 'thin', label: 'Thin'},
  {id: 'med', label: 'Medium'},
  {id: 'thick', label: 'Thick'},
];
/** Close to Supernote's pen greys. */
export const TONES: {id: Tone; label: string; color: string}[] = [
  {id: 'light', label: 'Light grey', color: '#C9C9C9'},
  {id: 'med', label: 'Medium grey', color: '#9D9D9D'},
  {id: 'dark', label: 'Dark grey', color: '#5A5A5A'},
  {id: 'black', label: 'Black', color: '#000000'},
];
export const TAPE_GROUPS: {id: TapeGroup; label: string}[] = [
  {id: 'basics', label: 'Basics'},
  {id: 'geometric', label: 'Geometric'},
  {id: 'nature', label: 'Nature'},
  {id: 'fun', label: 'Fun'},
];
export const TAPE_PATTERNS: {id: TapePattern; label: string; group: TapeGroup}[] = [
  {id: 'plain', label: 'Plain', group: 'basics'},
  {id: 'stripes', label: 'Stripes', group: 'basics'},
  {id: 'dots', label: 'Dots', group: 'basics'},
  {id: 'grid', label: 'Grid', group: 'basics'},
  {id: 'wavy', label: 'Wavy', group: 'basics'},
  {id: 'checks', label: 'Checks', group: 'basics'},
  {id: 'crosses', label: 'Crosses', group: 'basics'},
  {id: 'zigzag', label: 'Zigzag', group: 'basics'},
  {id: 'triangles', label: 'Triangles', group: 'geometric'},
  {id: 'scales', label: 'Scales', group: 'geometric'},
  {id: 'diamonds', label: 'Diamonds', group: 'geometric'},
  {id: 'honeycomb', label: 'Honeycomb', group: 'geometric'},
  {id: 'plaid', label: 'Plaid', group: 'geometric'},
  {id: 'houndstooth', label: 'Houndstooth', group: 'geometric'},
  {id: 'herringbone', label: 'Herringbone', group: 'geometric'},
  {id: 'terrazzo', label: 'Terrazzo', group: 'geometric'},
  {id: 'confetti', label: 'Confetti', group: 'geometric'},
  {id: 'squiggles', label: 'Squiggles', group: 'geometric'},
  {id: 'leaves', label: 'Leaves', group: 'nature'},
  {id: 'flowers', label: 'Flowers', group: 'nature'},
  {id: 'sprigs', label: 'Sprigs', group: 'nature'},
  {id: 'clouds', label: 'Clouds', group: 'nature'},
  {id: 'moons', label: 'Moons', group: 'nature'},
  {id: 'stars', label: 'Stars', group: 'nature'},
  {id: 'sparkles', label: 'Sparkles', group: 'nature'},
  {id: 'snowflakes', label: 'Snowflakes', group: 'nature'},
  {id: 'hearts', label: 'Hearts', group: 'fun'},
  {id: 'arrows', label: 'Arrows', group: 'fun'},
  {id: 'music', label: 'Music', group: 'fun'},
  {id: 'coffee', label: 'Coffee', group: 'fun'},
  {id: 'doodles', label: 'Doodles', group: 'fun'},
];
export const TAPE_WIDTHS: {id: TapeWidth; label: string}[] = [
  {id: 'slim', label: 'Slim'},
  {id: 'wide', label: 'Wide'},
];
export const TAPE_PLACEMENTS: {id: TapePlacement; label: string}[] = [
  {id: 'topCorners', label: 'Top corners'},
  {id: 'corners', label: 'All corners'},
  {id: 'top', label: 'Top'},
  {id: 'frame', label: 'Frame'},
];

/** Sizes in dp (tuned on the device). */
const LINE_DP: Record<LineWidth, number> = {thin: 2, med: 4, thick: 7};
const TAPE_DP: Record<TapeWidth, number> = {slim: 22, wide: 36};
/** Clamps against the photo's short side, so small pictures stay readable. */
const MAX_LINE = 0.08;
const MAX_TAPE = 0.22;
const TAPE_LENGTH = 0.32;

export const toneColor = (t: Tone) => TONES.find(x => x.id === t)!.color;

const ids = <T extends string>(list: {id: T}[]) => list.map(x => x.id) as string[];

export function encodeBorder(b: Border): string {
  if (b.kind === 'line') {
    return `l.${b.style}.${b.width}.${b.tone}`;
  }
  if (b.kind === 'tape') {
    return `t.${b.pattern}.${b.width}.${b.placement}`;
  }
  return 'none';
}

/** Anything that isn't a valid code is no border. */
export function decodeBorder(code: unknown): Border {
  if (typeof code !== 'string') {
    return NO_BORDER;
  }
  const [k, a, b, c, ...rest] = code.split('.');
  if (rest.length) {
    return NO_BORDER;
  }
  if (k === 'l' && ids(LINE_STYLES).includes(a) && ids(LINE_WIDTHS).includes(b) && ids(TONES).includes(c)) {
    return {kind: 'line', style: a as LineStyle, width: b as LineWidth, tone: c as Tone};
  }
  if (k === 't' && ids(TAPE_PATTERNS).includes(a) && ids(TAPE_WIDTHS).includes(b) && ids(TAPE_PLACEMENTS).includes(c)) {
    return {kind: 'tape', pattern: a as TapePattern, width: b as TapeWidth, placement: c as TapePlacement};
  }
  return NO_BORDER;
}

export const sameBorder = (a: Border, b: Border) => encodeBorder(a) === encodeBorder(b);

export interface Insets {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** A rounded bar: dash, dot, or tape strip; centred at (cx, cy), rotated `angle` degrees. */
export interface Bar {
  cx: number;
  cy: number;
  angle: number;
  length: number;
  thickness: number;
}

export interface FrameLayout {
  insets: Insets;
  canvas: Size;
  /** The photo inside the canvas. */
  photo: {left: number; top: number; width: number; height: number; radius: number};
  /** Solid line: a rounded outline around the photo. */
  outline?: {left: number; top: number; width: number; height: number; radius: number; stroke: number; color: string};
  /** Dashed / dotted line: fully rounded bars. */
  pills: Bar[];
  pillColor?: string;
  /** Washi tape strips. */
  tapes: Bar[];
  pattern?: TapePattern;
  /** One design dp in this layout's units (tape pattern tiles are 24 dp). */
  scale: number;
}

const NO_INSETS: Insets = {l: 0, t: 0, r: 0, b: 0};

/**
 * Lay out a border around a photo of `photo` size with corner `radius`, in
 * any unit; `scale` is one design dp in that unit.
 */
export function frameLayout(photo: Size, radius: number, border: Border, scale: number): FrameLayout {
  const short = Math.min(photo.width, photo.height);
  const r = Math.max(0, Math.min(radius, short / 2));
  let insets = NO_INSETS;
  let pills: Bar[] = [];
  let tapes: Bar[] = [];
  let outline: FrameLayout['outline'];
  let pillColor: string | undefined;
  let pattern: TapePattern | undefined;

  if (border.kind === 'line' && short > 0) {
    const w = Math.min(LINE_DP[border.width] * scale, short * MAX_LINE);
    insets = {l: w, t: w, r: w, b: w};
    const color = toneColor(border.tone);
    if (border.style === 'solid') {
      outline = {
        left: -w,
        top: -w,
        width: photo.width + 2 * w,
        height: photo.height + 2 * w,
        radius: r > 0 ? r + w : 0,
        stroke: w,
        color,
      };
    } else {
      pills = dashes(photo, r, w, border.style);
      pillColor = color;
    }
  } else if (border.kind === 'tape' && short > 0) {
    const t = Math.min(TAPE_DP[border.width] * scale, short * MAX_TAPE);
    const len = Math.min(Math.max(short * TAPE_LENGTH, 3 * t), 6 * t);
    tapes = tapeStrips(photo, r, t, len, border.placement);
    insets = overhang(tapes, photo);
    pattern = border.pattern;
  }

  const shift = (b: Bar): Bar => ({...b, cx: b.cx + insets.l, cy: b.cy + insets.t});
  return {
    insets,
    canvas: {width: photo.width + insets.l + insets.r, height: photo.height + insets.t + insets.b},
    photo: {left: insets.l, top: insets.t, width: photo.width, height: photo.height, radius: r},
    outline: outline && {...outline, left: outline.left + insets.l, top: outline.top + insets.t},
    pills: pills.map(shift),
    pillColor,
    tapes: tapes.map(shift),
    pattern,
    scale,
  };
}

/** Insets as shares of the whole picture (canvas), so they survive a lasso resize. */
export function insetFractions(f: FrameLayout): Insets {
  const {width: W, height: H} = f.canvas;
  return {l: f.insets.l / W, t: f.insets.t / H, r: f.insets.r / W, b: f.insets.b / H};
}

/**
 * The centre line of the border: a rounded rect around the photo at w/2,
 * walked clockwise from the start of the top edge. Returns the point and the
 * tangent angle (degrees) at arc length `s`.
 */
function pathAt(photo: Size, r: number, w: number, s: number): {x: number; y: number; angle: number} {
  const rc = r > 0 ? r + w / 2 : 0;
  const left = -w / 2;
  const top = -w / 2;
  const right = photo.width + w / 2;
  const bottom = photo.height + w / 2;
  const sx = right - left - 2 * rc;
  const sy = bottom - top - 2 * rc;
  const arc = (Math.PI / 2) * rc;
  const parts: {len: number; at: (u: number) => {x: number; y: number; angle: number}}[] = [
    {len: sx, at: u => ({x: left + rc + u, y: top, angle: 0})},
    {len: arc, at: u => corner(right - rc, top + rc, -90, u / (rc || 1))},
    {len: sy, at: u => ({x: right, y: top + rc + u, angle: 90})},
    {len: arc, at: u => corner(right - rc, bottom - rc, 0, u / (rc || 1))},
    {len: sx, at: u => ({x: right - rc - u, y: bottom, angle: 180})},
    {len: arc, at: u => corner(left + rc, bottom - rc, 90, u / (rc || 1))},
    {len: sy, at: u => ({x: left, y: bottom - rc - u, angle: 270})},
    {len: arc, at: u => corner(left + rc, top + rc, 180, u / (rc || 1))},
  ];
  function corner(cx: number, cy: number, startDeg: number, t: number) {
    const a = ((startDeg + (t * 180) / Math.PI) * Math.PI) / 180;
    return {x: cx + rc * Math.cos(a), y: cy + rc * Math.sin(a), angle: startDeg + 90 + (t * 180) / Math.PI};
  }
  let rest = s;
  for (const p of parts) {
    if (rest <= p.len || p === parts[parts.length - 1]) {
      return p.at(Math.min(rest, p.len));
    }
    rest -= p.len;
  }
  return parts[0].at(0);
}

export function perimeter(photo: Size, r: number, w: number): number {
  const rc = r > 0 ? r + w / 2 : 0;
  const W = photo.width + w;
  const H = photo.height + w;
  return 2 * (W + H) - 8 * rc + 2 * Math.PI * rc;
}

/** Evenly spaced, fully rounded dashes or dots along the border's centre line. */
function dashes(photo: Size, r: number, w: number, style: 'dash' | 'dot'): Bar[] {
  const P = perimeter(photo, r, w);
  const dash = style === 'dash' ? 3 * w : w;
  const gap = style === 'dash' ? 2 * w : 1.2 * w;
  const n = Math.max(4, Math.round(P / (dash + gap))); // whole units: no odd gap where the loop closes
  const step = P / n;
  const len = style === 'dash' ? (dash * step) / (dash + gap) : w; // dots stay round
  const bars: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const p = pathAt(photo, r, w, i * step + step / 2);
    bars.push({cx: p.x, cy: p.y, angle: p.angle, length: Math.max(len, w), thickness: w});
  }
  return bars;
}

/** Tape strips for a placement, relative to the photo's top-left. */
function tapeStrips(photo: Size, r: number, t: number, len: number, placement: TapePlacement): Bar[] {
  const {width: W, height: H} = photo;
  const k = r - r / Math.SQRT2; // 45° point on a rounded corner, from the bounding corner
  const corner = (x: number, y: number, angle: number): Bar => ({cx: x, cy: y, angle, length: len, thickness: t});
  const tl = corner(k, k, -45);
  const tr = corner(W - k, k, 45);
  const bl = corner(k, H - k, 45);
  const br = corner(W - k, H - k, -45);
  switch (placement) {
    case 'topCorners':
      return [tl, tr];
    case 'corners':
      return [tl, tr, bl, br];
    case 'top':
      return [{cx: W / 2, cy: 0, angle: 0, length: Math.min(len * 1.25, W * 0.8), thickness: t}];
    case 'frame':
      return [
        {cx: W / 2, cy: 0, angle: 0, length: W + t, thickness: t},
        {cx: W, cy: H / 2, angle: 90, length: H + t, thickness: t},
        {cx: W / 2, cy: H, angle: 0, length: W + t, thickness: t},
        {cx: 0, cy: H / 2, angle: 90, length: H + t, thickness: t},
      ];
  }
}

/** The four corners of a bar. */
export function barCorners(b: Bar): {x: number; y: number}[] {
  const a = (b.angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const hl = b.length / 2;
  const ht = b.thickness / 2;
  return [
    [hl, ht],
    [hl, -ht],
    [-hl, ht],
    [-hl, -ht],
  ].map(([u, v]) => ({x: b.cx + u * ux - v * uy, y: b.cy + u * uy + v * ux}));
}

/** How far the strips stick out past the photo on each side. */
function overhang(bars: Bar[], photo: Size): Insets {
  const pts = bars.flatMap(barCorners);
  const minX = Math.min(0, ...pts.map(p => p.x));
  const minY = Math.min(0, ...pts.map(p => p.y));
  const maxX = Math.max(photo.width, ...pts.map(p => p.x));
  const maxY = Math.max(photo.height, ...pts.map(p => p.y));
  return {l: -minX, t: -minY, r: maxX - photo.width, b: maxY - photo.height};
}
