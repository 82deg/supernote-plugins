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
import {padRect, type Rect, type Size} from './geometry';

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
}

export class SelectionError extends Error {}

export async function outDir(): Promise<string> {
  const dir = `${(await PluginManager.getPluginDirPath()) ?? ''}/out`;
  await RNFS.mkdir(dir);
  return dir;
}

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
  log(`lasso picture: ${pics.length} picture(s), preview ${sourceSize.width}×${sourceSize.height} at ${fmt(preview.rect)}`);
  return {
    sourcePath: preview.imagePath,
    sourceSize,
    rect: preview.rect,
    layer: pics[0].layerNum ?? 0,
    page,
    pageSize,
    pictureCount: pics.length,
  };
}

/**
 * Put `picturePath` at `rect` and remove the current lasso selection, then
 * select the new picture. Insert happens first so a failure never loses the
 * original.
 */
export async function replaceLassoPicture(sel: LassoPicture, picturePath: string, rect: Rect): Promise<void> {
  const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
  el.pageNum = sel.page;
  el.layerNum = sel.layer;
  el.picture = {picturePath, rect};
  await call('insertPageElements', PluginCommAPI.insertPageElements([el], sel.page, sel.layer));
  await call('deleteLassoElements', PluginCommAPI.deleteLassoElements());
  await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, sel.pageSize)));
}
