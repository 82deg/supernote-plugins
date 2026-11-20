// Edit pictures that are already on the page, via the current lasso selection.
//
// Spike findings:
// - A placed picture's `picturePath` is never readable by the plugin (b9–10).
//   Pictures we tagged have their original kept in our folder; for any other
//   picture the source is the host's render of the selection
//   (`generateLassoPreview`), at page resolution.
// - That render includes ~5px of lasso margin around the picture (b13); left
//   in, every edit grew the picture and added a border. We work only on the
//   picture's true bounds (`inner`) inside the render.
// - The host copies every new image into the note's own store, on insert and
//   on modify (b24), so our rendered files are throwaway.
//
// Every edit (Crop, Rotate, Border) starts from a clean photo: the kept
// original, or else the selection render with any old border cut away. It then
// re-renders photo + corners + border in one go and tags the result.
import {PixelRatio} from 'react-native';
import {FileUtils, PluginCommAPI} from 'sn-plugin-lib';
import {call} from '../sdk';
import {log, fmt} from '../log';
import {frameRect, padRect, photoRect, rotatedRect, type Rect, type Size} from './geometry';
import {decodeTag, encodeTag, fractionsTag, tagFractions, type PictureTag} from './pictureTag';
import {croppedPlacement, originalPlacement, type Edges} from '../image/crop';
import {fullCrop, rotatedRegion, type Crop} from '../image/transform';
import {cornerRadius, type Corners} from '../image/corners';
import {decodeBorder, encodeBorder, frameLayout, insetFractions, NO_BORDER, type Border} from '../image/border';
import {loadSettings, saveSettings} from '../settings';
import {originalsDir, outDir} from './pluginDir';
import {currentPage, imageSize, PICTURE, type CurrentPage} from './page';
import type {RenderFn} from '../image/RenderStage';
import type {OnStage} from '../ui/Progress';
import {clearRenders, pruneOriginals} from './housekeeping';

const noStage: OnStage = () => {};

export interface LassoPicture extends CurrentPage {
  /** The selected picture elements, as the lasso reports them. */
  elements: any[];
  /** The picture(s) on the page (Android px). */
  rect: Rect;
  layer: number;
  /** Our tag, when exactly one picture is selected and it has one. */
  tag: PictureTag | null;
}

/** The host's render of the selection: readable by us, unlike the picture itself. */
interface SelectionRender {
  path: string;
  size: Size;
  /** Where the render sits on the page. */
  rect: Rect;
  /** The picture(s) inside the render, in render px (lasso margin excluded). */
  inner: Edges;
}

export class SelectionError extends Error {}

const sizeOf = (r: Rect): Size => ({width: r.right - r.left, height: r.bottom - r.top});
const toEdges = (c: Crop): Edges => ({left: c.x, top: c.y, right: c.x + c.width, bottom: c.y + c.height});
const toCrop = (e: Edges): Crop => ({x: e.left, y: e.top, width: e.right - e.left, height: e.bottom - e.top});
const extOf = (name: string) => (/\.jpg$/i.test(name) ? 'jpg' : 'png');
const newOriginalName = (ext: string) => `orig-${Date.now()}.${ext}`;

function union(rects: Rect[]): Rect {
  return rects.reduce((a, r) => ({
    left: Math.min(a.left, r.left),
    top: Math.min(a.top, r.top),
    right: Math.max(a.right, r.right),
    bottom: Math.max(a.bottom, r.bottom),
  }));
}

export async function readLassoPicture(): Promise<LassoPicture> {
  const els = (await call<any[]>('getLassoElements', PluginCommAPI.getLassoElements())) ?? [];
  const pics = els.filter(e => e.type === PICTURE && e.picture);
  if (pics.length === 0) {
    throw new SelectionError('Select a picture with the lasso first.');
  }
  if (pics.length !== els.length) {
    throw new SelectionError('Your selection includes writing. Select just the picture.');
  }
  const rect = union(pics.map(p => p.picture.rect as Rect));
  const tag = pics.length === 1 ? decodeTag(pics[0].userData) : null;
  log(`lasso: ${pics.length} picture(s) at ${fmt(rect)}, tag ${fmt(tag)}`);
  return {...(await currentPage()), elements: pics, rect, layer: pics[0].layerNum ?? 0, tag};
}

async function renderSelection(sel: LassoPicture): Promise<SelectionRender> {
  const dir = await outDir();
  await clearRenders(dir); // snapshots from earlier edits are never needed again
  const preview = await call<{imagePath: string; rect: Rect}>(
    'generateLassoPreview',
    PluginCommAPI.generateLassoPreview(`${dir}/lasso-${Date.now()}.png`),
  );
  const size = await imageSize(preview.imagePath);
  // Picture bounds inside the render (render px per page px is ~1, but scale anyway).
  const p = preview.rect;
  const sx = size.width / (p.right - p.left);
  const sy = size.height / (p.bottom - p.top);
  const clampX = (v: number) => Math.min(Math.max(v, 0), size.width);
  const clampY = (v: number) => Math.min(Math.max(v, 0), size.height);
  const inner = {
    left: clampX((sel.rect.left - p.left) * sx),
    top: clampY((sel.rect.top - p.top) * sy),
    right: clampX((sel.rect.right - p.left) * sx),
    bottom: clampY((sel.rect.bottom - p.top) * sy),
  };
  log(`selection render ${size.width}×${size.height} at ${fmt(p)}, inner ${fmt(inner)}`);
  return {path: preview.imagePath, size, rect: p, inner};
}

/** A clean photo to edit from, and everything the picture has now. */
export interface Source {
  path: string;
  /** File name inside originals/. */
  name: string;
  size: Size;
  /** Usable part of the source (no lasso margin, no old border), source px. */
  bounds: Edges;
  /** The crop the picture shows now. */
  edges: Edges;
  corners: Corners;
  border: Border;
  /** Where the whole source sits on the page, given the photo as it is now. */
  fullPlacement: Rect;
}

/**
 * The kept original if it's still there; otherwise the selection render, with
 * the lasso margin and any old border cut away, kept as a new original. Either
 * way every later edit is lossless.
 */
async function ensureOriginal(sel: LassoPicture): Promise<Source> {
  const dir = await originalsDir();
  const tag = sel.tag;
  const fractions = tagFractions(tag?.i);
  if (tag && (await FileUtils.exists(`${dir}/${tag.o}`))) {
    const size = {width: tag.w, height: tag.h};
    return {
      path: `${dir}/${tag.o}`,
      name: tag.o,
      size,
      bounds: tag.b ?? {left: 0, top: 0, right: tag.w, bottom: tag.h},
      edges: tag.e,
      corners: tag.r ?? 'none',
      border: decodeBorder(tag.d),
      fullPlacement: originalPlacement(photoRect(sel.rect, fractions), size, tag.e),
    };
  }
  if (tag) {
    log(`original ${tag.o} is gone; working from the picture as shown`);
  }
  const shown = await renderSelection(sel);
  const {inner} = shown;
  const iw = inner.right - inner.left;
  const ih = inner.bottom - inner.top;
  const clean = fractions
    ? {
        left: inner.left + fractions.l * iw,
        top: inner.top + fractions.t * ih,
        right: inner.right - fractions.r * iw,
        bottom: inner.bottom - fractions.b * ih,
      }
    : inner;
  const name = newOriginalName('png'); // host renders are png
  if (!(await FileUtils.copyFile(shown.path, `${dir}/${name}`))) {
    throw new Error(`could not keep the original (${name})`);
  }
  await pruneOriginals(dir);
  return {
    path: `${dir}/${name}`,
    name,
    size: shown.size,
    bounds: clean,
    edges: clean,
    corners: tag?.r ?? 'none',
    border: tag ? decodeBorder(tag.d) : NO_BORDER,
    fullPlacement: shown.rect,
  };
}

/**
 * Render `edges` of the source with `corners` and `border`, put it in place of
 * the selection (the photo stays where it is; a border grows the picture) and
 * tag it so it can be edited again.
 */
async function applyPicture(
  sel: LassoPicture,
  src: Source,
  edges: Edges,
  corners: Corners,
  border: Border,
  render: RenderFn,
  onStage: OnStage,
  label: string,
  span: [number, number],
): Promise<string> {
  const pr = PixelRatio.get();
  const photo = croppedPlacement(src.fullPlacement, src.size, edges);
  const ps = sizeOf(photo);
  const radius = cornerRadius(corners, ps, pr);
  const frame = frameLayout(ps, radius, border, pr); // page px: one dp is `pr` px
  const rect = frameRect(photo, frame.insets, sel.pageSize);
  const out = await render({
    path: src.path,
    size: src.size,
    rotation: 0,
    crop: toCrop(edges),
    maxSide: Math.max(edges.right - edges.left, edges.bottom - edges.top), // 1:1 with the source
    cornerRadius: ps.width > 0 ? radius / ps.width : 0,
    border,
    borderUnit: ps.width > 0 ? pr / ps.width : 0,
  });
  const tag = encodeTag({
    o: src.name,
    w: src.size.width,
    h: src.size.height,
    b: src.bounds,
    e: edges,
    r: corners === 'none' ? undefined : corners,
    d: border.kind === 'none' ? undefined : encodeBorder(border),
    i: fractionsTag(insetFractions(frame)),
  });
  log(`apply: edges ${fmt(edges)}, ${corners}, ${encodeBorder(border)} → ${out.size.width}×${out.size.height} at ${fmt(rect)}`);
  await replaceLassoPicture(sel, out.path, rect, tag, onStage, label, span);
  return `${out.size.width}×${out.size.height} at ${fmt(rect)}`;
}

/**
 * Put `picturePath` at `rect` instead of the current lasso selection, then
 * select it again. A single picture is changed in place: device-tested
 * (b23–24) to leave no duplicate, with the host copying the new image into the
 * note. The host doesn't record that for Undo; Rotate back or re-crop instead.
 * (Replacing it, insert + delete, left a duplicate after one Undo.) Several
 * pictures, merged into one, are replaced: insert first, then delete, so a
 * failure never loses the originals.
 */
async function replaceLassoPicture(
  sel: LassoPicture,
  picturePath: string,
  rect: Rect,
  userData: string,
  onStage: OnStage,
  label: string,
  span: [number, number],
): Promise<void> {
  const [from, to] = span;
  const mid = from + (to - from) * 0.75; // the host's write is most of the wait
  onStage({from, to: mid, label});
  let done = false;
  if (sel.elements.length === 1) {
    const old = sel.elements[0];
    const changed = {...old, userData, picture: {...old.picture, picturePath, rect}};
    try {
      const nums = await call<number[]>(
        'modifyPageElements',
        PluginCommAPI.modifyPageElements([changed], sel.page, sel.layer),
      );
      done = Array.isArray(nums) && nums.length === 1;
    } catch (e) {
      log(`modify failed (${e}); replacing instead`);
    }
  }
  if (!done) {
    const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
    el.pageNum = sel.page;
    el.layerNum = sel.layer;
    el.userData = userData;
    el.picture = {picturePath, rect};
    await call('insertPageElements', PluginCommAPI.insertPageElements([el], sel.page, sel.layer));
    await call('deleteLassoElements', PluginCommAPI.deleteLassoElements());
  }
  onStage({from: mid, to, label});
  // The lasso keeps drawing what it selected, so the old picture stayed on
  // screen until deselected (b28). Drop the old selection, as tapping away
  // does, then select the new picture.
  try {
    await call('setLassoBoxState', PluginCommAPI.setLassoBoxState(2));
  } catch (e) {
    log(`clearing the old selection failed (${e})`);
  }
  await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, sel.pageSize)));
}

/** Rotate the lassoed picture(s) a quarter turn, in place, keeping crop, corners and border. */
export async function rotateLassoPicture(
  render: RenderFn,
  rotation: 90 | 270,
  onStage: OnStage = noStage,
): Promise<string> {
  const label = 'Rotating the image…';
  onStage({from: 0, to: 0.25, label});
  const sel = await readLassoPicture();
  const src0 = await ensureOriginal(sel);
  onStage({from: 0.25, to: 0.32, label});
  // Turn the original itself, so the crop, corners and border stay editable.
  const ext = extOf(src0.name);
  const turned = await render({
    path: src0.path,
    size: src0.size,
    rotation,
    crop: fullCrop(src0.size, rotation),
    maxSide: Math.max(src0.size.width, src0.size.height),
    format: ext,
    quality: 0.9,
  });
  const dir = await originalsDir();
  const name = newOriginalName(ext);
  if (!(await FileUtils.copyFile(turned.path, `${dir}/${name}`))) {
    throw new Error(`could not keep the turned original (${name})`);
  }
  await pruneOriginals(dir);
  const edges = toEdges(rotatedRegion(src0.edges, src0.size, rotation));
  const photoNow = croppedPlacement(src0.fullPlacement, src0.size, src0.edges);
  const photoTurned = rotatedRect(photoNow, sel.pageSize);
  const src: Source = {
    path: `${dir}/${name}`,
    name,
    size: turned.size,
    bounds: toEdges(rotatedRegion(src0.bounds, src0.size, rotation)),
    edges,
    corners: src0.corners,
    border: src0.border,
    fullPlacement: originalPlacement(photoTurned, turned.size, edges),
  };
  const done = await applyPicture(sel, src, edges, src.corners, src.border, render, onStage, label, [0.32, 1]);
  return `${rotation === 90 ? 'right' : 'left'}: ${done}`;
}

/** Everything the crop screen needs, plus how to put the result back. */
export interface CropJob {
  sel: LassoPicture;
  src: Source;
}

export async function startCropJob(onStage: OnStage = noStage): Promise<CropJob> {
  onStage({from: 0, to: 0.9, label: 'Opening the image…'});
  const sel = await readLassoPicture();
  return {sel, src: await ensureOriginal(sel)};
}

export async function finishCropJob(
  job: CropJob,
  edges: Edges,
  corners: Corners,
  render: RenderFn,
  onStage: OnStage = noStage,
): Promise<string> {
  const label = 'Cropping the image…';
  onStage({from: 0, to: 0.2, label});
  const done = await applyPicture(job.sel, job.src, edges, corners, job.src.border, render, onStage, label, [0.2, 1]);
  return `cropped: ${done}`;
}

/** The Border screen's input: the clean photo and the border to start from. */
export interface BorderJob {
  sel: LassoPicture;
  src: Source;
  /** The picture's border, or the last one applied if it has none. */
  start: Border;
}

export async function startBorderJob(onStage: OnStage = noStage): Promise<BorderJob> {
  onStage({from: 0, to: 0.9, label: 'Opening the image…'});
  const sel = await readLassoPicture();
  if (sel.elements.length !== 1) {
    throw new SelectionError('Select one picture at a time to add a border.');
  }
  const src = await ensureOriginal(sel);
  const {lastBorder} = await loadSettings();
  return {sel, src, start: src.border.kind === 'none' ? lastBorder : src.border};
}

export async function finishBorderJob(
  job: BorderJob,
  border: Border,
  render: RenderFn,
  onStage: OnStage = noStage,
): Promise<string> {
  const label = 'Adding the border…';
  onStage({from: 0, to: 0.2, label});
  const {src} = job;
  const done = await applyPicture(job.sel, src, src.edges, src.corners, border, render, onStage, label, [0.2, 1]);
  if (border.kind !== 'none') {
    try {
      await saveSettings({...(await loadSettings()), lastBorder: border});
    } catch (e) {
      log(`could not remember the border (${e})`);
    }
  }
  return `border ${encodeBorder(border)}: ${done}`;
}
