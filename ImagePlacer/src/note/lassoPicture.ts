// Edit pictures that are already on the page, via the current lasso selection.
//
// Spike findings:
// - A placed picture's `picturePath` is never readable by the plugin (b9–10),
//   so the source image comes from the host rendering the selection
//   (`generateLassoPreview`), at page resolution.
// - That render includes ~5px of lasso margin around the picture (b13); left
//   in, every edit grew the picture and added a border. We work only on the
//   picture's true bounds (`inner`) inside the render.
// - `deleteLassoElements` removes EVERYTHING selected, so we only operate on
//   pictures-only selections, and always insert the replacement first.
// - The host copies every inserted image into its own store, so our rendered
//   files are throwaway.
import {Image, PixelRatio} from 'react-native';
import {FileUtils, PluginCommAPI, PluginFileAPI} from 'sn-plugin-lib';
import {call} from '../sdk';
import {log, fmt} from '../log';
import {padRect, rotatedRect, type Rect, type Size} from './geometry';
import {decodeTag, encodeTag, type PictureTag} from './pictureTag';
import {croppedPlacement, originalPlacement, type Edges} from '../image/crop';
import {fullCrop, rotatedRegion, type Crop} from '../image/transform';
import {cornerShare, type Corners} from '../image/corners';
import {originalsDir, outDir} from './pluginDir';
import type {RenderFn} from '../image/RenderStage';
import type {OnStage} from '../ui/Progress';
import {clearRenders, pruneOriginals} from './housekeeping';

const PICTURE = 200; // Element.TYPE_PICTURE
const noStage: OnStage = () => {};

export interface LassoPicture {
  /** Host render of the selection (includes a small margin), readable by us. */
  sourcePath: string;
  sourceSize: Size;
  /** Where that render sits on the page. */
  previewRect: Rect;
  /** The picture(s) inside the render, in render px (margin excluded). */
  inner: Edges;
  /** The picture(s) on the page (Android px). */
  rect: Rect;
  layer: number;
  page: number;
  pageSize: Size;
  pictureCount: number;
  /** userData of the picture, when exactly one is selected. */
  userData?: string;
  notePath: string;
  /** The selected picture elements, as the lasso reports them. */
  elements: any[];
}

export class SelectionError extends Error {}

const sizeOf = (r: Rect): Size => ({width: r.right - r.left, height: r.bottom - r.top});
const toEdges = (c: Crop): Edges => ({left: c.x, top: c.y, right: c.x + c.width, bottom: c.y + c.height});
const extOf = (name: string) => (/\.jpg$/i.test(name) ? 'jpg' : 'png');

function imageSize(path: string): Promise<Size> {
  return new Promise((resolve, reject) =>
    Image.getSize(`file://${path}`, (width, height) => resolve({width, height}), reject),
  );
}

function union(rects: Rect[]): Rect {
  return rects.reduce((a, r) => ({
    left: Math.min(a.left, r.left),
    top: Math.min(a.top, r.top),
    right: Math.max(a.right, r.right),
    bottom: Math.max(a.bottom, r.bottom),
  }));
}

export async function readLassoPicture(): Promise<LassoPicture> {
  const els = await call<any[]>('getLassoElements', PluginCommAPI.getLassoElements());
  const pics = els.filter(e => e.type === PICTURE && e.picture);
  if (pics.length === 0) {
    throw new SelectionError('Select a picture with the lasso first.');
  }
  if (pics.length !== els.length) {
    throw new SelectionError('Your selection includes writing. Select just the picture.');
  }
  const notePath = await call<string>('getCurrentFilePath', PluginCommAPI.getCurrentFilePath());
  const page = await call<number>('getCurrentPageNum', PluginCommAPI.getCurrentPageNum());
  const pageSize = await call<Size>('getPageSize', PluginFileAPI.getPageSize(notePath, page));

  const dir = await outDir();
  await clearRenders(dir); // snapshots from earlier edits are never needed again
  const preview = await call<{imagePath: string; rect: Rect}>(
    'generateLassoPreview',
    PluginCommAPI.generateLassoPreview(`${dir}/lasso-${Date.now()}.png`),
  );
  const sourceSize = await imageSize(preview.imagePath);
  const rect = union(pics.map(p => p.picture.rect as Rect));

  // Picture bounds inside the render (render px per page px is ~1, but scale anyway).
  const p = preview.rect;
  const sx = sourceSize.width / (p.right - p.left);
  const sy = sourceSize.height / (p.bottom - p.top);
  const clampX = (v: number) => Math.min(Math.max(v, 0), sourceSize.width);
  const clampY = (v: number) => Math.min(Math.max(v, 0), sourceSize.height);
  const inner = {
    left: clampX((rect.left - p.left) * sx),
    top: clampY((rect.top - p.top) * sy),
    right: clampX((rect.right - p.left) * sx),
    bottom: clampY((rect.bottom - p.top) * sy),
  };

  const userData = pics.length === 1 ? pics[0].userData : undefined;
  log(
    `lasso picture: ${pics.length} picture(s) at ${fmt(rect)}; render ${sourceSize.width}×${sourceSize.height} ` +
      `at ${fmt(p)}, inner ${fmt(inner)}; userData=${fmt(userData)}`,
  );
  return {
    sourcePath: preview.imagePath,
    sourceSize,
    previewRect: p,
    inner,
    rect,
    layer: pics[0].layerNum ?? 0,
    page,
    pageSize,
    pictureCount: pics.length,
    userData,
    notePath,
    elements: pics,
  };
}

const near = (a: Rect, b: Rect) =>
  Math.abs(a.left - b.left) <= 1 &&
  Math.abs(a.top - b.top) <= 1 &&
  Math.abs(a.right - b.right) <= 1 &&
  Math.abs(a.bottom - b.bottom) <= 1;

/**
 * In-page numbers of the selected pictures, double-checked against the page
 * itself (same type, layer, position and uuid), or null when they can't be
 * confirmed. A delete by number must never hit anything else.
 */
async function confirmedNumbers(sel: LassoPicture): Promise<number[] | null> {
  try {
    const page = ((await call<any[]>('getElements', PluginFileAPI.getElements(sel.page, sel.notePath))) ?? []) as any[];
    const nums: number[] = [];
    for (const el of sel.elements) {
      const n = el.numInPage;
      const onPage = page.find(p => p.numInPage === n);
      const ok =
        Number.isInteger(n) &&
        n >= 1 &&
        onPage &&
        onPage.type === PICTURE &&
        (onPage.layerNum ?? 0) === (el.layerNum ?? 0) &&
        onPage.picture?.rect &&
        near(onPage.picture.rect, el.picture.rect) &&
        (!el.uuid || !onPage.uuid || el.uuid === onPage.uuid);
      if (!ok) {
        log(`replace: can't confirm element ${fmt(n)}; using insert + delete`);
        return null;
      }
      nums.push(n);
    }
    return nums;
  } catch (e) {
    log(`replace: page read failed (${e}); using insert + delete`);
    return null;
  }
}

/**
 * Put `picturePath` at `rect` instead of the current lasso selection, then
 * select the new picture. A single picture is changed in place. Several
 * pictures (merged into one) are replaced: as one batch update when they can
 * be identified safely, else insert first, then delete, so a failure never
 * loses the original.
 * Progress keeps the caller's label: users don't need the steps.
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
  const mid = from + (to - from) * 0.75; // the insert is most of the wait
  onStage({from, to: mid, label});
  // Change the picture element in place. Device-tested (1.0.0 b23–24): no
  // duplicate, and the host copies the new image into the note's own store,
  // as on insert. The host doesn't record it for Undo (Undo greys out); Rotate
  // the other way, or Crop → Reset / Corners None, reverse it instead. Replacing
  // (insert + delete) left a duplicate after one Undo; the b22 batch attempt did too.
  if (sel.elements.length === 1) {
    try {
      const old = sel.elements[0];
      old.picture = {...old.picture, picturePath, rect};
      old.userData = userData;
      const changed = await call<number[]>(
        'modifyPageElements',
        PluginCommAPI.modifyPageElements([old], sel.page, sel.layer),
      );
      if (Array.isArray(changed) && changed.length === 1) {
        onStage({from: mid, to, label});
        await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, sel.pageSize)));
        return;
      }
      log(`replace: modify changed ${fmt(changed)}; trying batch`);
    } catch (e) {
      log(`replace: modify failed (${e}); trying batch`);
    }
  }
  const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
  el.pageNum = sel.page;
  el.layerNum = sel.layer;
  el.userData = userData;
  el.picture = {picturePath, rect};
  const nums = await confirmedNumbers(sel);
  if (nums) {
    const ok = await call<boolean>(
      'batchUpdatePageElements',
      PluginCommAPI.batchUpdatePageElements(nums, [el], sel.page, sel.layer),
    );
    if (ok !== true) {
      throw new Error('batch update was not applied');
    }
    onStage({from: mid, to, label});
  } else {
    await call('insertPageElements', PluginCommAPI.insertPageElements([el], sel.page, sel.layer));
    onStage({from: mid, to, label});
    await call('deleteLassoElements', PluginCommAPI.deleteLassoElements());
  }
  await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, sel.pageSize)));
}

/** Rotate the lassoed picture(s) a quarter turn, in place. */
export async function rotateLassoPicture(
  render: RenderFn,
  rotation: 90 | 270,
  onStage: OnStage = noStage,
): Promise<string> {
  const label = 'Rotating the image…';
  onStage({from: 0, to: 0.25, label});
  const sel = await readLassoPicture();
  const rect = rotatedRect(sel.rect, sel.pageSize);
  const dir = await originalsDir();
  const tag = decodeTag(sel.userData);
  if (tag && (await FileUtils.exists(`${dir}/${tag.o}`))) {
    // Turn the kept original too, so the crop and the corners stay editable.
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
    const name = `orig-${Date.now()}.${ext}`;
    if (!(await FileUtils.copyFile(turned.path, `${dir}/${name}`))) {
      throw new Error(`could not keep the turned original (${name})`);
    }
    await pruneOriginals(dir);
    const e = toEdges(rotatedRegion(tag.e, size, rotation));
    const b = tag.b ? toEdges(rotatedRegion(tag.b, size, rotation)) : undefined;
    const corners: Corners = tag.r ?? 'none';
    onStage({from: 0.32, to: 0.4, label});
    const out = await render({
      path: `${dir}/${name}`,
      size: turned.size,
      rotation: 0,
      crop: {x: e.left, y: e.top, width: e.right - e.left, height: e.bottom - e.top},
      maxSide: Math.max(e.right - e.left, e.bottom - e.top),
      cornerRadius: cornerShare(corners, sizeOf(rect), PixelRatio.get()),
    });
    const newTag = encodeTag({o: name, w: turned.size.width, h: turned.size.height, b, e, r: tag.r});
    await replaceLassoPicture(sel, out.path, rect, newTag, onStage, label, [0.4, 1]);
    return `${rotation === 90 ? 'right' : 'left'} (with original): ${out.size.width}×${out.size.height} at ${fmt(rect)}`;
  }

  onStage({from: 0.25, to: 0.4, label});
  const out = await render({
    path: sel.sourcePath,
    size: sel.sourceSize,
    rotation,
    crop: rotatedRegion(sel.inner, sel.sourceSize, rotation), // drops the lasso margin
    maxSide: Math.max(sel.sourceSize.width, sel.sourceSize.height), // page resolution: 1:1
  });
  // No original to turn: this starts a fresh picture without crop history.
  await replaceLassoPicture(sel, out.path, rect, '', onStage, label, [0.4, 1]);
  return `${rotation === 90 ? 'right' : 'left'}: ${out.size.width}×${out.size.height} at ${fmt(rect)}`;
}

/** Everything the crop screen needs, plus how to put the result back. */
export interface CropJob {
  sel: LassoPicture;
  /** Image shown in the crop screen: the stored original if we have one, else the selection render. */
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
  const dir = await originalsDir();
  const tag: PictureTag | null = decodeTag(sel.userData);
  if (tag && (await FileUtils.exists(`${dir}/${tag.o}`))) {
    log(`crop: re-crop from original ${tag.o} (${tag.w}×${tag.h}), edges ${fmt(tag.e)}`);
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
  if (tag) {
    log(`crop: tag found but original ${tag.o} is missing; starting from the picture as shown`);
  }
  // First crop: keep the selection render as the original.
  const name = `orig-${Date.now()}.png`; // host renders are png
  if (!(await FileUtils.copyFile(sel.sourcePath, `${dir}/${name}`))) {
    throw new Error(`could not keep the original (${name})`);
  }
  await pruneOriginals(dir);
  return {
    sel,
    sourcePath: `${dir}/${name}`,
    sourceSize: sel.sourceSize,
    bounds: sel.inner,
    initialCorners: 'none',
    fullPlacement: sel.previewRect,
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
  const width = edges.right - edges.left;
  const height = edges.bottom - edges.top;
  const rect = croppedPlacement(job.fullPlacement, job.sourceSize, edges);
  const out = await render({
    path: job.sourcePath,
    size: job.sourceSize,
    rotation: 0,
    crop: {x: edges.left, y: edges.top, width, height},
    maxSide: Math.max(width, height), // the original is at page resolution: 1:1
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
  return `cropped to ${Math.round(width)}×${Math.round(height)} at ${fmt(rect)}`;
}
