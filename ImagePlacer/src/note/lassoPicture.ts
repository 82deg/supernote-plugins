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
import {PixelRatio} from 'react-native';
import {FileUtils, PluginCommAPI} from 'sn-plugin-lib';
import {call} from '../sdk';
import {log, fmt} from '../log';
import {padRect, rotatedRect, type Rect, type Size} from './geometry';
import {decodeTag, encodeTag, type PictureTag} from './pictureTag';
import {croppedPlacement, originalPlacement, type Edges} from '../image/crop';
import {fullCrop, rotatedRegion, type Crop} from '../image/transform';
import {cornerShare, type Corners} from '../image/corners';
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

/** The kept original for a tagged picture, if it's still there. */
async function keptOriginal(sel: LassoPicture): Promise<{dir: string; tag: PictureTag} | null> {
  if (!sel.tag) {
    return null;
  }
  const dir = await originalsDir();
  if (await FileUtils.exists(`${dir}/${sel.tag.o}`)) {
    return {dir, tag: sel.tag};
  }
  log(`original ${sel.tag.o} is gone; working from the picture as shown`);
  return null;
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
  await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, sel.pageSize)));
}

/** Rotate the lassoed picture(s) a quarter turn, in place. */
export async function rotateLassoPicture(
  render: RenderFn,
  rotation: 90 | 270,
  onStage: OnStage = noStage,
): Promise<string> {
  const label = 'Rotating the image…';
  const side = rotation === 90 ? 'right' : 'left';
  onStage({from: 0, to: 0.25, label});
  const sel = await readLassoPicture();
  const rect = rotatedRect(sel.rect, sel.pageSize);
  const kept = await keptOriginal(sel);
  if (kept) {
    // Turn the kept original too, so the crop and the corners stay editable.
    const {dir, tag} = kept;
    onStage({from: 0.25, to: 0.32, label});
    const size = {width: tag.w, height: tag.h};
    const ext = extOf(tag.o);
    const turned = await render({
      path: `${dir}/${tag.o}`,
      size,
      rotation,
      crop: fullCrop(size, rotation),
      maxSide: Math.max(size.width, size.height),
      format: ext,
      quality: 0.9,
    });
    const name = newOriginalName(ext);
    if (!(await FileUtils.copyFile(turned.path, `${dir}/${name}`))) {
      throw new Error(`could not keep the turned original (${name})`);
    }
    await pruneOriginals(dir);
    const e = toEdges(rotatedRegion(tag.e, size, rotation));
    const b = tag.b ? toEdges(rotatedRegion(tag.b, size, rotation)) : undefined;
    onStage({from: 0.32, to: 0.4, label});
    const out = await render({
      path: `${dir}/${name}`,
      size: turned.size,
      rotation: 0,
      crop: toCrop(e),
      maxSide: Math.max(e.right - e.left, e.bottom - e.top), // 1:1
      cornerRadius: cornerShare(tag.r ?? 'none', sizeOf(rect), PixelRatio.get()),
    });
    const newTag = encodeTag({o: name, w: turned.size.width, h: turned.size.height, b, e, r: tag.r});
    await replaceLassoPicture(sel, out.path, rect, newTag, onStage, label, [0.4, 1]);
    return `${side} (from original): ${out.size.width}×${out.size.height} at ${fmt(rect)}`;
  }

  const shown = await renderSelection(sel);
  onStage({from: 0.25, to: 0.4, label});
  const out = await render({
    path: shown.path,
    size: shown.size,
    rotation,
    crop: rotatedRegion(shown.inner, shown.size, rotation), // drops the lasso margin
    maxSide: Math.max(shown.size.width, shown.size.height), // page resolution: 1:1
  });
  // No original to turn: this starts a fresh picture without crop history.
  await replaceLassoPicture(sel, out.path, rect, '', onStage, label, [0.4, 1]);
  return `${side}: ${out.size.width}×${out.size.height} at ${fmt(rect)}`;
}

/** Everything the crop screen needs, plus how to put the result back. */
export interface CropJob {
  sel: LassoPicture;
  /** Image shown in the crop screen: the kept original if we have one, else the selection render. */
  sourcePath: string;
  sourceSize: Size;
  /** Usable part of the source (excludes the lasso margin). */
  bounds: Edges;
  initialEdges?: Edges;
  /** Corner style the picture has now. */
  initialCorners: Corners;
  /** Where the full source image sits on the page. */
  fullPlacement: Rect;
  originalName: string;
}

export async function startCropJob(onStage: OnStage = noStage): Promise<CropJob> {
  onStage({from: 0, to: 0.9, label: 'Opening the image…'});
  const sel = await readLassoPicture();
  const kept = await keptOriginal(sel);
  if (kept) {
    const {dir, tag} = kept;
    const size = {width: tag.w, height: tag.h};
    return {
      sel,
      sourcePath: `${dir}/${tag.o}`,
      sourceSize: size,
      bounds: tag.b ?? {left: 0, top: 0, right: tag.w, bottom: tag.h},
      initialEdges: tag.e,
      initialCorners: tag.r ?? 'none',
      fullPlacement: originalPlacement(sel.rect, size, tag.e),
      originalName: tag.o,
    };
  }
  // First crop: keep the selection render as the original.
  const shown = await renderSelection(sel);
  const dir = await originalsDir();
  const name = newOriginalName('png'); // host renders are png
  if (!(await FileUtils.copyFile(shown.path, `${dir}/${name}`))) {
    throw new Error(`could not keep the original (${name})`);
  }
  await pruneOriginals(dir);
  return {
    sel,
    sourcePath: `${dir}/${name}`,
    sourceSize: shown.size,
    bounds: shown.inner,
    initialCorners: 'none',
    fullPlacement: shown.rect,
    originalName: name,
  };
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
  const rect = croppedPlacement(job.fullPlacement, job.sourceSize, edges);
  const out = await render({
    path: job.sourcePath,
    size: job.sourceSize,
    rotation: 0,
    crop: toCrop(edges),
    maxSide: Math.max(edges.right - edges.left, edges.bottom - edges.top), // 1:1 with the original
    cornerRadius: cornerShare(corners, sizeOf(rect), PixelRatio.get()),
  });
  const tag = encodeTag({
    o: job.originalName,
    w: job.sourceSize.width,
    h: job.sourceSize.height,
    b: job.bounds,
    e: edges,
    r: corners === 'none' ? undefined : corners,
  });
  log(`crop: edges ${fmt(edges)}, corners ${corners} → ${out.size.width}×${out.size.height} at ${fmt(rect)}`);
  await replaceLassoPicture(job.sel, out.path, rect, tag, onStage, label, [0.2, 1]);
  return `cropped to ${out.size.width}×${out.size.height} at ${fmt(rect)}`;
}
