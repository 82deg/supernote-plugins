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
import RNFS from 'react-native-fs';
import {Image} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginManager} from 'sn-plugin-lib';
import {call} from '../sdk';
import {log, fmt} from '../log';
import {padRect, rotatedRect, type Rect, type Size} from './geometry';
import {decodeTag, encodeTag, type PictureTag} from './pictureTag';
import {croppedPlacement, originalPlacement, type Edges} from '../image/crop';
import {rotatedRegion} from '../image/transform';
import type {RenderFn} from '../image/RenderStage';
import type {OnStage} from '../ui/Progress';

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
}

export class SelectionError extends Error {}

async function pluginDir(sub: string): Promise<string> {
  const dir = `${(await PluginManager.getPluginDirPath()) ?? ''}/${sub}`;
  await RNFS.mkdir(dir);
  return dir;
}

export const outDir = () => pluginDir('out');
const originalsDir = () => pluginDir('originals');

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
  };
}

/**
 * Put `picturePath` at `rect` and remove the current lasso selection, then
 * select the new picture. Insert happens first so a failure never loses the
 * original. Progress keeps the caller's label: users don't need the steps.
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
  const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
  el.pageNum = sel.page;
  el.layerNum = sel.layer;
  el.userData = userData;
  el.picture = {picturePath, rect};
  await call('insertPageElements', PluginCommAPI.insertPageElements([el], sel.page, sel.layer));
  onStage({from: mid, to, label});
  await call('deleteLassoElements', PluginCommAPI.deleteLassoElements());
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
  onStage({from: 0.25, to: 0.4, label});
  const out = await render({
    path: sel.sourcePath,
    size: sel.sourceSize,
    rotation,
    crop: rotatedRegion(sel.inner, sel.sourceSize, rotation), // drops the lasso margin
    maxSide: Math.max(sel.sourceSize.width, sel.sourceSize.height), // page resolution: 1:1
  });
  const rect = rotatedRect(sel.rect, sel.pageSize);
  // Rotation starts a fresh picture: any crop history (tag) is dropped.
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
  /** Where the full source image sits on the page. */
  fullPlacement: Rect;
  originalName: string;
}

export async function startCropJob(onStage: OnStage = noStage): Promise<CropJob> {
  onStage({from: 0, to: 0.9, label: 'Opening the image…'});
  const sel = await readLassoPicture();
  const dir = await originalsDir();
  const tag: PictureTag | null = decodeTag(sel.userData);
  if (tag && (await RNFS.exists(`${dir}/${tag.o}`))) {
    log(`crop: re-crop from original ${tag.o} (${tag.w}×${tag.h}), edges ${fmt(tag.e)}`);
    const size = {width: tag.w, height: tag.h};
    return {
      sel,
      sourcePath: `${dir}/${tag.o}`,
      sourceSize: size,
      bounds: tag.b ?? {left: 0, top: 0, right: tag.w, bottom: tag.h},
      initialEdges: tag.e,
      fullPlacement: originalPlacement(sel.rect, size, tag.e),
      originalName: tag.o,
    };
  }
  if (tag) {
    log(`crop: tag found but original ${tag.o} is missing; starting from the picture as shown`);
  }
  // First crop: keep the selection render as the original.
  const name = `orig-${Date.now()}.png`;
  await RNFS.copyFile(sel.sourcePath, `${dir}/${name}`);
  return {
    sel,
    sourcePath: `${dir}/${name}`,
    sourceSize: sel.sourceSize,
    bounds: sel.inner,
    fullPlacement: sel.previewRect,
    originalName: name,
  };
}

export async function finishCropJob(
  job: CropJob,
  edges: Edges,
  render: RenderFn,
  onStage: OnStage = noStage,
): Promise<string> {
  const label = 'Cropping the image…';
  onStage({from: 0, to: 0.2, label});
  const width = edges.right - edges.left;
  const height = edges.bottom - edges.top;
  const out = await render({
    path: job.sourcePath,
    size: job.sourceSize,
    rotation: 0,
    crop: {x: edges.left, y: edges.top, width, height},
    maxSide: Math.max(width, height), // the original is at page resolution: 1:1
  });
  const rect = croppedPlacement(job.fullPlacement, job.sourceSize, edges);
  const tag = encodeTag({
    o: job.originalName,
    w: job.sourceSize.width,
    h: job.sourceSize.height,
    b: job.bounds,
    e: edges,
  });
  log(`crop: edges ${fmt(edges)} → ${out.size.width}×${out.size.height} at ${fmt(rect)}`);
  await replaceLassoPicture(job.sel, out.path, rect, tag, onStage, label, [0.2, 1]);
  return `cropped to ${Math.round(width)}×${Math.round(height)} at ${fmt(rect)}`;
}
