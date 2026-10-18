// Insert a picture from the user's files into the current page, selected with
// the lasso so it can be moved, resized, cropped or rotated straight away.
import {Image} from 'react-native';
import {PluginCommAPI, PluginFileAPI, PluginManager, RattaFileSelector} from 'sn-plugin-lib';
import {call, FILE_READ, FILE_WRITE} from '../sdk';
import {log, fmt} from '../log';
import {centeredRect, padRect, type Size} from './geometry';
import {fullCrop} from '../image/transform';
import type {RenderFn} from '../image/RenderStage';
import type {OnStage} from '../ui/Progress';

const PICTURE = 200; // Element.TYPE_PICTURE
const IMAGE_SUFFIXES = ['png', 'jpg', 'jpeg'];
/** Placed width as a share of the page width (height is capped at 90% of the page). */
const PLACED_WIDTH = 0.9;
/** Keep some extra pixels so a later enlargement with the lasso stays sharp. */
const HEADROOM = 1.25;

export class PermissionError extends Error {}

/** Ask for file access every time: "allow once" expires when the plugin closes. */
export async function ensureFileAccess(): Promise<void> {
  for (const permission of [FILE_READ, FILE_WRITE]) {
    if ((await PluginManager.hasPermission(permission)) === 1) {
      continue;
    }
    const answer = await PluginManager.requestPermission(
      permission,
      'Image Placer needs access to your files to add pictures to your notes.',
    );
    log(`requestPermission(${permission}) → ${answer}`);
    if (answer !== 1 && answer !== 2) {
      throw new PermissionError(
        'Image Placer needs access to your files. You can allow it in Settings → Apps → Plugins → Image Placer.',
      );
    }
  }
}

/** Open Supernote's own picker. Resolves to null if the user backs out. */
export async function pickImage(): Promise<string | null> {
  const picked = await RattaFileSelector.selectFile({
    selectType: 1,
    suffixList: IMAGE_SUFFIXES,
    maxNum: 1,
    title: 'Choose an image',
    rightButtonText: 'Add',
  });
  log(`selectFile → ${fmt(picked)}`);
  return picked && picked.length > 0 ? picked[0] : null;
}

function imageSize(path: string): Promise<Size> {
  return new Promise((resolve, reject) =>
    Image.getSize(`file://${path}`, (width, height) => resolve({width, height}), reject),
  );
}

export async function insertPicture(path: string, render: RenderFn, onStage: OnStage): Promise<string> {
  const label = 'Adding the image…';
  onStage({from: 0, to: 0.15, label});
  const size = await imageSize(path);
  const notePath = await call<string>('getCurrentFilePath', PluginCommAPI.getCurrentFilePath());
  const page = await call<number>('getCurrentPageNum', PluginCommAPI.getCurrentPageNum());
  const pageSize = await call<Size>('getPageSize', PluginFileAPI.getPageSize(notePath, page));
  const rect = centeredRect(pageSize, size, PLACED_WIDTH);

  // Big photos make the note slow: hand the note only the pixels it can show.
  let picturePath = path;
  // Never more than a full page's worth of pixels: anything beyond is invisible and slows the note.
  const maxSide = Math.round(
    Math.min(Math.max(rect.right - rect.left, rect.bottom - rect.top) * HEADROOM, Math.max(pageSize.width, pageSize.height)),
  );
  if (Math.max(size.width, size.height) > maxSide) {
    onStage({from: 0.15, to: 0.35, label});
    const jpeg = /\.jpe?g$/i.test(path);
    const out = await render({
      path,
      size,
      rotation: 0,
      crop: fullCrop(size, 0),
      maxSide,
      format: jpeg ? 'jpg' : 'png', // png keeps transparency and line art crisp
      quality: 0.9,
    });
    log(`downscaled ${size.width}×${size.height} → ${out.size.width}×${out.size.height}`);
    picturePath = out.path;
  }

  onStage({from: 0.35, to: 0.9, label});
  const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
  el.pageNum = page;
  el.layerNum = 0;
  el.picture = {picturePath, rect};
  await call('insertPageElements', PluginCommAPI.insertPageElements([el], page, null));
  onStage({from: 0.9, to: 1, label});
  // Leave it selected: the user can move/resize it, or use Crop / Rotate.
  await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, pageSize)));
  return `inserted ${size.width}×${size.height} at ${fmt(rect)}`;
}
