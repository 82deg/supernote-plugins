// Insert a picture from the user's files into the current page, selected with
// the lasso so it can be moved, resized, cropped or rotated straight away.
import {PixelRatio} from 'react-native';
import {FileUtils, PluginCommAPI, PluginManager, RattaFileSelector} from 'sn-plugin-lib';
import {call, FILE_READ, FILE_WRITE} from '../sdk';
import {log, fmt} from '../log';
import {centeredRect, padRect, type Size} from './geometry';
import {fullCrop} from '../image/transform';
import type {RenderFn} from '../image/RenderStage';
import type {OnStage} from '../ui/Progress';
import {cornerShare, type Corners} from '../image/corners';
import {fullEdges} from '../image/crop';
import {encodeTag} from './pictureTag';
import {originalsDir} from './pluginDir';
import {pruneOriginals} from './housekeeping';
import {loadSettings} from '../settings';
import {currentPage, imageSize, PICTURE} from './page';
import {MAIN_LAYER, pictureLayer} from './layers';

const IMAGE_SUFFIXES = ['png', 'jpg', 'jpeg'];
/** Placed width as a share of the page width, centred (height is capped at 90% of the page). */
const PLACED_WIDTH = 0.5;
/** Keep enough pixels to enlarge it to almost full width with the lasso and stay sharp. */
const SHARP_UP_TO_WIDTH = 0.9;
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

export async function insertPicture(path: string, render: RenderFn, onStage: OnStage): Promise<string> {
  const label = 'Adding the image…';
  onStage({from: 0, to: 0.15, label});
  const size = await imageSize(path);
  const cp = await currentPage();
  const {page, pageSize} = cp;
  const {corners, imagesLayer} = await loadSettings();
  const rect = centeredRect(pageSize, size, PLACED_WIDTH);

  // Big photos make the note slow: hand the note only the pixels it can show.
  let picturePath = path;
  let pictureSize = size;
  // Never more than a full page's worth of pixels: anything beyond is invisible and slows the note.
  const roomy = centeredRect(pageSize, size, SHARP_UP_TO_WIDTH);
  const maxSide = Math.round(
    Math.min(
      Math.max(roomy.right - roomy.left, roomy.bottom - roomy.top) * HEADROOM,
      Math.max(pageSize.width, pageSize.height),
    ),
  );
  if (Math.max(size.width, size.height) > maxSide) {
    onStage({from: 0.15, to: 0.3, label});
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
    pictureSize = out.size;
  }

  let userData = '';
  if (corners !== 'none') {
    onStage({from: 0.3, to: 0.4, label});
    userData = await keepOriginal(picturePath, pictureSize, corners);
    const placed = {width: rect.right - rect.left, height: rect.bottom - rect.top};
    const out = await render({
      path: picturePath,
      size: pictureSize,
      rotation: 0,
      crop: fullCrop(pictureSize, 0),
      maxSide: Math.max(pictureSize.width, pictureSize.height),
      cornerRadius: cornerShare(corners, placed, PixelRatio.get()),
    });
    log(`rounded corners (${corners}) → ${out.size.width}×${out.size.height}`);
    picturePath = out.path;
  }

  onStage({from: 0.4, to: 0.9, label});
  const add = async (layer: number) => {
    const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
    el.pageNum = page;
    el.layerNum = layer;
    el.userData = userData;
    el.picture = {picturePath, rect};
    await call('insertPageElements', PluginCommAPI.insertPageElements([el], page, layer));
  };
  let layer = imagesLayer ? await pictureLayer(cp) : MAIN_LAYER;
  try {
    await add(layer);
  } catch (e) {
    if (layer === MAIN_LAYER) {
      throw e;
    }
    log(`insert on layer ${layer} failed (${e}); using the main layer`);
    layer = MAIN_LAYER;
    await add(layer);
  }
  onStage({from: 0.9, to: 1, label});
  // Leave it selected: the user can move/resize it, or use Crop / Rotate.
  await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, pageSize)));
  return `inserted ${size.width}×${size.height} at ${fmt(rect)} on layer ${layer}, corners ${corners}`;
}

/**
 * Keep the square-cornered picture so Crop can change or remove the corners
 * later. Returns the tag for the picture, or '' if it couldn't be kept (the
 * picture is still added, with its corners baked in).
 */
async function keepOriginal(path: string, size: Size, corners: Corners): Promise<string> {
  const dir = await originalsDir();
  const ext = /\.jpe?g$/i.test(path) ? 'jpg' : 'png';
  const name = `orig-${Date.now()}.${ext}`;
  if (!(await FileUtils.copyFile(path, `${dir}/${name}`))) {
    log(`could not keep the original of ${path}; corners will be fixed`);
    return '';
  }
  await pruneOriginals(dir);
  return encodeTag({o: name, w: size.width, h: size.height, e: fullEdges(size), r: corners});
}
