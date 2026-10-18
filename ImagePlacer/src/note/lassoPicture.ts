// Edit pictures that are already on the page, via the current lasso selection.
//
// Spike findings (builds 9–10): a placed picture's `picturePath` is never
// readable by the plugin, so the source image comes from the host rendering
// the selection (`generateLassoPreview`), at page resolution. And
// `deleteLassoElements` removes EVERYTHING selected, so we only operate on
// pictures-only selections, and always insert the replacement before deleting.
import RNFS from 'react-native-fs';
import {Image} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginManager} from 'sn-plugin-lib';
import {call} from '../sdk';
import {log, fmt} from '../log';
import {padRect, rotatedRect, type Rect, type Size} from './geometry';
import {decodeTag, encodeTag, type PictureTag} from './pictureTag';
import {croppedPlacement, originalPlacement, type Edges} from '../image/crop';
import {fullCrop} from '../image/transform';
import type {RenderFn} from '../image/RenderStage';
import type {OnStage} from '../ui/Progress';

const noStage: OnStage = () => {};

const PICTURE = 200; // Element.TYPE_PICTURE

export interface LassoPicture {
  /** Rendered selection, readable by the plugin. */
  sourcePath: string;
  sourceSize: Size;
  /** Where the selection sits on the page (Android px). */
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

export async function readLassoPicture(): Promise<LassoPicture> {
  const els = await call<any[]>('getLassoElements', PluginCommAPI.getLassoElements());
  const pics = els.filter(e => e.type === PICTURE && e.picture);
  if (pics.length === 0) {
    throw new SelectionError('Lasso a picture first.');
  }
  if (pics.length !== els.length) {
    throw new SelectionError('The selection also contains handwriting or text. Lasso only the picture.');
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
  const userData = pics.length === 1 ? pics[0].userData : undefined;
  log(
    `lasso picture: ${pics.length} picture(s), preview ${sourceSize.width}×${sourceSize.height} at ` +
      `${fmt(preview.rect)}, userData=${fmt(userData)}`,
  );
  return {
    sourcePath: preview.imagePath,
    sourceSize,
    rect: preview.rect,
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
 * original.
 */
export async function replaceLassoPicture(
  sel: LassoPicture,
  picturePath: string,
  rect: Rect,
  userData = '',
  onStage: OnStage = noStage,
  span: [number, number] = [0, 1],
): Promise<void> {
  const [from, to] = span;
  const mid = from + (to - from) * 0.8; // the insert is most of the wait
  onStage({from, to: mid, label: 'Placing on page…'});
  const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
  el.pageNum = sel.page;
  el.layerNum = sel.layer;
  el.userData = userData;
  el.picture = {picturePath, rect};
  await call('insertPageElements', PluginCommAPI.insertPageElements([el], sel.page, sel.layer));
  onStage({from: mid, to, label: 'Finishing…'});
  await call('deleteLassoElements', PluginCommAPI.deleteLassoElements());
  await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, sel.pageSize)));
  if (userData) {
    // Spike: does the host keep userData on pictures? Read it straight back.
    const back = await call<any[]>('getLassoElements', PluginCommAPI.getLassoElements());
    log(`userData read back: ${fmt(back.map(e => e.userData))}`);
  }
}

/** Rotate the lassoed picture(s) a quarter turn, in place. */
export async function rotateLassoPicture(
  render: RenderFn,
  rotation: 90 | 270,
  onStage: OnStage = noStage,
): Promise<string> {
  onStage({from: 0, to: 0.2, label: 'Reading picture…'});
  const sel = await readLassoPicture();
  onStage({from: 0.2, to: 0.35, label: rotation === 90 ? 'Rotating right…' : 'Rotating left…'});
  const out = await render({
    path: sel.sourcePath,
    size: sel.sourceSize,
    rotation,
    crop: fullCrop(sel.sourceSize, rotation),
    maxSide: Math.max(sel.sourceSize.width, sel.sourceSize.height), // page resolution: 1:1
  });
  const kept = `${await outDir()}/rot-${Date.now()}.png`;
  await RNFS.copyFile(out.path, kept);
  const rect = rotatedRect(sel.rect, sel.pageSize);
  // Rotation starts a fresh picture: any crop history (tag) is dropped.
  await replaceLassoPicture(sel, kept, rect, '', onStage, [0.35, 1]);
  return `${rotation === 90 ? 'right' : 'left'}: ${sel.sourceSize.width}×${sel.sourceSize.height} → ${out.size.width}×${out.size.height} at ${fmt(rect)}`;
}

/** Everything the crop screen needs, plus how to put the result back. */
export interface CropJob {
  sel: LassoPicture;
  /** Image shown in the crop screen: the stored original if we have one, else the selection. */
  sourcePath: string;
  sourceSize: Size;
  initialEdges?: Edges;
  /** Where the full (uncropped) source sits on the page. */
  fullPlacement: Rect;
  originalName: string;
}

export async function startCropJob(onStage: OnStage = noStage): Promise<CropJob> {
  onStage({from: 0, to: 0.9, label: 'Opening picture…'});
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
      initialEdges: tag.e,
      fullPlacement: originalPlacement(sel.rect, size, tag.e),
      originalName: tag.o,
    };
  }
  if (tag) {
    log(`crop: tag found but original ${tag.o} is missing; starting from the picture as shown`);
  }
  // First crop: keep the selection as the original.
  const name = `orig-${Date.now()}.png`;
  await RNFS.copyFile(sel.sourcePath, `${dir}/${name}`);
  return {sel, sourcePath: `${dir}/${name}`, sourceSize: sel.sourceSize, fullPlacement: sel.rect, originalName: name};
}

export async function finishCropJob(
  job: CropJob,
  edges: Edges,
  render: RenderFn,
  onStage: OnStage = noStage,
): Promise<string> {
  onStage({from: 0, to: 0.2, label: 'Cropping…'});
  const width = edges.right - edges.left;
  const height = edges.bottom - edges.top;
  const out = await render({
    path: job.sourcePath,
    size: job.sourceSize,
    rotation: 0,
    crop: {x: edges.left, y: edges.top, width, height},
    maxSide: Math.max(width, height), // the original is at page resolution: 1:1
  });
  const kept = `${await outDir()}/crop-${Date.now()}.png`;
  await RNFS.copyFile(out.path, kept);
  const rect = croppedPlacement(job.fullPlacement, job.sourceSize, edges);
  const tag = encodeTag({o: job.originalName, w: job.sourceSize.width, h: job.sourceSize.height, e: edges});
  log(`crop: edges ${fmt(edges)} → ${out.size.width}×${out.size.height} at ${fmt(rect)}`);
  await replaceLassoPicture(job.sel, kept, rect, tag, onStage, [0.2, 1]);
  return `cropped to ${Math.round(width)}×${Math.round(height)} at ${fmt(rect)}`;
}

