// Phase 2 spike: each check answers one open question on the real device.
// Results go to the log (logcat tag ReactNativeJS + on-screen panel).
import {Image} from 'react-native';
import {
  PluginManager,
  PluginCommAPI,
  PluginFileAPI,
  PluginNoteAPI,
  FileUtils,
  RattaFileSelector,
} from 'sn-plugin-lib';
import {log, fmt, enableFileLog, flushLog} from '../log';
import RNFS from 'react-native-fs';
import {call, FILE_READ, FILE_WRITE} from '../sdk';
import {centeredRect, padRect, roundRect, type Rect, type Size} from '../note/geometry';
import {fullCrop, rotatedSize} from '../image/transform';
import type {RenderFn} from '../image/RenderStage';

const PICTURE = 200; // Element.TYPE_PICTURE
const DOCUMENT_DIR = '/storage/emulated/0/Document';
const IMAGE_SUFFIXES = ['png', 'jpg', 'jpeg'];
export const LOG_DIR = `${RNFS.ExternalStorageDirectoryPath}/EXPORT/ImagePlacer`;

export interface SpikeContext {
  pluginDir?: string;
  notePath?: string;
  page?: number;
  pageSize?: Size;
  imagePath?: string; // picked by the user
  imageSize?: Size;
  workPath?: string; // our copy in the plugin dir
  target?: Rect;
  previewPath?: string;
  sdDirs?: string[];
  render?: RenderFn; // provided by the screen's RenderStage
}

async function insertPicture(ctx: SpikeContext, picturePath: string, rect: Rect): Promise<void> {
  const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
  el.pageNum = need(ctx.page, '2');
  el.layerNum = 0;
  el.picture = {picturePath, rect};
  await call<boolean>('insertPageElements', PluginCommAPI.insertPageElements([el], ctx.page!, null));
}

export interface Check {
  id: string;
  label: string;
  run: (ctx: SpikeContext) => Promise<string>;
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`run "${what}" first`);
  }
  return value;
}

function imageSize(path: string): Promise<Size> {
  return new Promise((resolve, reject) =>
    Image.getSize(`file://${path}`, (width, height) => resolve({width, height}), reject),
  );
}

function extOf(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : 'png';
}

async function ensurePermission(permission: string): Promise<string> {
  const has = await PluginManager.hasPermission(permission);
  log(`hasPermission(${permission}) → ${has}`);
  if (has === 1) {
    return 'granted';
  }
  const res = await PluginManager.requestPermission(permission, 'Image Placer needs this to show and insert your images.');
  log(`requestPermission(${permission}) → ${res}`);
  return ({1: 'allowed once', 2: 'always allowed', 0: 'DENIED', [-1]: 'dismissed'} as Record<number, string>)[res] ?? `?${res}`;
}

export const CHECKS: Check[] = [
  {
    id: 'perm',
    label: '1. Permissions (read + write)',
    run: async () => {
      const r = await ensurePermission(FILE_READ);
      const w = await ensurePermission(FILE_WRITE);
      const logFile = await enableFileLog(LOG_DIR);
      return `read: ${r}, write: ${w}, log file: ${logFile ?? 'unavailable'}`;
    },
  },
  {
    id: 'context',
    label: '2. Note context + page size',
    run: async ctx => {
      const device = await PluginManager.getDeviceType(); // 4 = Nomad
      ctx.pluginDir = (await PluginManager.getPluginDirPath()) ?? undefined;
      ctx.notePath = await call<string>('getCurrentFilePath', PluginCommAPI.getCurrentFilePath());
      ctx.page = await call<number>('getCurrentPageNum', PluginCommAPI.getCurrentPageNum());
      ctx.pageSize = await call<Size>('getPageSize', PluginFileAPI.getPageSize(ctx.notePath, ctx.page));
      return `device=${device} page=${ctx.page} size=${fmt(ctx.pageSize)} dir=${ctx.pluginDir}`;
    },
  },
  // Build 1: a single "storage" check closed the plugin (native crash), so
  // each FileUtils call is its own button to find the culprit.
  {
    id: 'sdPath',
    label: '3a. SD card path (getExternalDirPath)',
    run: async ctx => {
      log('calling FileUtils.getExternalDirPath()…');
      await flushLog();
      const ext = await FileUtils.getExternalDirPath();
      ctx.sdDirs = ext ?? [];
      return `sd=${fmt(ext)}`;
    },
  },
  {
    id: 'sdPathRnfs',
    label: '3f. SD card path via RNFS (replacement for 3a)',
    run: async ctx => {
      // Build 4 log: FileUtils.getExternalDirPath() kills the plugin natively.
      const appDirs = await RNFS.getAllExternalFilesDirs();
      log(`getAllExternalFilesDirs → ${fmt(appDirs)}`);
      // Volume roots are the part before /Android/data/...
      const roots = appDirs
        .map(d => d.split('/Android/')[0])
        .filter(r => r && !r.startsWith('/storage/emulated'));
      log(`SD roots → ${fmt(roots)}`);
      await flushLog();
      const storage = await RNFS.readDir('/storage').catch(e => {
        log(`readDir(/storage) failed: ${e}`);
        return [];
      });
      log(`/storage → ${fmt(storage.map(i => i.path))}`);
      ctx.sdDirs = roots;
      if (roots.length === 0) {
        return 'no SD volume found';
      }
      await flushLog();
      const top = await RNFS.readDir(roots[0]);
      return `sd=${roots[0]}: ${top.length} entries: ${fmt(top.slice(0, 6).map(i => i.name))}`;
    },
  },
  {
    id: 'exists',
    label: '3b. Document folder exists (exists)',
    run: async () => `exists=${await FileUtils.exists(DOCUMENT_DIR)}`,
  },
  {
    id: 'listDocs',
    label: '3c. List Document folder (listFiles)',
    run: async () => {
      const docs = (await FileUtils.listFiles(DOCUMENT_DIR)) ?? [];
      return `${docs.length} entries: ${fmt(docs.slice(0, 5))}`;
    },
  },
  {
    id: 'listSd',
    label: '3d. List SD card root (listFiles)',
    run: async ctx => {
      const dirs = need(ctx.sdDirs, '3a');
      if (dirs.length === 0) {
        return 'no SD card reported';
      }
      const l = (await FileUtils.listFiles(dirs[0])) ?? [];
      return `${dirs[0]}: ${l.length} entries: ${fmt(l.slice(0, 5))}`;
    },
  },
  {
    id: 'imageList',
    label: '3e. All images index (getImageList)',
    run: async () => {
      const images = (await FileUtils.getImageList()) ?? [];
      return `${images.length} images: ${fmt(images.slice(0, 5))}`;
    },
  },
  {
    id: 'pick',
    label: '4. Pick image (native Supernote picker)',
    run: async ctx => {
      const picked = await RattaFileSelector.selectFile({
        selectType: 1,
        suffixList: IMAGE_SUFFIXES,
        maxNum: 1,
        title: 'Choose an image',
        rightButtonText: 'Select',
      });
      log(`selectFile → ${fmt(picked)}`);
      if (!picked || picked.length === 0) {
        return 'nothing picked';
      }
      ctx.imagePath = picked[0];
      ctx.imageSize = await imageSize(ctx.imagePath);
      return `${ctx.imagePath} ${ctx.imageSize.width}×${ctx.imageSize.height}`;
    },
  },
  {
    id: 'preview',
    label: '5. Render page preview',
    run: async ctx => {
      const dir = need(ctx.pluginDir, '2');
      const pngPath = `${dir}/preview.png`;
      await call('generateNotePng', PluginFileAPI.generateNotePng({
        notePath: need(ctx.notePath, '2'),
        page: need(ctx.page, '2'),
        times: 1,
        pngPath,
        type: 1,
      }));
      ctx.previewPath = pngPath;
      return pngPath;
    },
  },
  {
    id: 'copy',
    label: '6. Copy image into plugin dir',
    run: async ctx => {
      const dir = need(ctx.pluginDir, '2');
      const src = need(ctx.imagePath, '4');
      await FileUtils.makeDir(`${dir}/out`);
      const dest = `${dir}/out/spike-${Date.now()}.${extOf(src)}`;
      const ok = await FileUtils.copyFile(src, dest);
      ctx.workPath = dest;
      ctx.target = centeredRect(need(ctx.pageSize, '2'), need(ctx.imageSize, '4'));
      return `copy ${ok ? 'ok' : 'FAILED'} → ${dest}; target ${fmt(ctx.target)}`;
    },
  },
  {
    id: 'insertA',
    label: '7. Insert A: picture element via insertPageElements',
    run: async ctx => {
      const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
      el.pageNum = need(ctx.page, '2');
      el.layerNum = 0;
      el.picture = {picturePath: need(ctx.workPath, '6'), rect: need(ctx.target, '6')};
      const ok = await call<boolean>('insertPageElements', PluginCommAPI.insertPageElements([el], ctx.page!, null));
      return `result=${ok} — is the image centred at 50% width?`;
    },
  },
  {
    id: 'insertA2',
    label: '8. Insert A′: picture element via insertElements (file API)',
    run: async ctx => {
      const t = need(ctx.target, '6');
      const shift = Math.round((t.bottom - t.top) / 3);
      const rect = {...t, top: t.top + shift, bottom: t.bottom + shift};
      const el = await call<any>('createElement', PluginCommAPI.createElement(PICTURE));
      el.pageNum = need(ctx.page, '2');
      el.layerNum = 0;
      el.picture = {picturePath: need(ctx.workPath, '6'), rect};
      const ok = await call<boolean>('insertElements', PluginFileAPI.insertElements(need(ctx.notePath, '2'), ctx.page!, [el]));
      return `result=${ok} (shifted down ${shift}px) — visible without reload?`;
    },
  },
  {
    id: 'insertB',
    label: '9. Insert B: insertImage (default position)',
    run: async ctx => {
      const ok = await call<boolean>('insertImage', PluginNoteAPI.insertImage(need(ctx.workPath, '6')));
      return `result=${ok} — note where it landed and its size`;
    },
  },
  {
    id: 'lasso',
    label: '10. Lasso the target rect',
    run: async ctx => {
      const rect = padRect(need(ctx.target, '6'), 4, need(ctx.pageSize, '2'));
      await call('lassoElements', PluginCommAPI.lassoElements(rect));
      const got = await call('getLassoRect', PluginCommAPI.getLassoRect());
      const counts = await call('getLassoElementTypeCounts', PluginCommAPI.getLassoElementTypeCounts());
      return `lasso=${fmt(got)} counts=${fmt(counts)}`;
    },
  },
  {
    id: 'move',
    label: '11. Move lasso 150px down (resizeLassoRect)',
    run: async () => {
      const cur = await call<Rect>('getLassoRect', PluginCommAPI.getLassoRect());
      const moved = {...cur, top: cur.top + 150, bottom: cur.bottom + 150};
      await call('resizeLassoRect', PluginCommAPI.resizeLassoRect(moved));
      return `moved to ${fmt(moved)} — did the image move?`;
    },
  },
  {
    id: 'rotate',
    label: '12b. view-shot: rotate 90°, render at placed size (png), insert',
    run: async ctx => {
      const src = need(ctx.imageSize, '4');
      const page = need(ctx.pageSize, '2');
      // Render only as many pixels as the placed rect covers (large-image fix).
      const rect = centeredRect(page, rotatedSize(src, 90), 0.4);
      const out = await need(ctx.render, 'screen')({
        path: need(ctx.imagePath, '4'),
        size: src,
        rotation: 90,
        crop: fullCrop(src, 90),
        maxSide: Math.max(rect.right - rect.left, rect.bottom - rect.top),
      });
      log(`render → ${fmt(out)}`);
      const t0 = Date.now();
      await insertPicture(ctx, out.path, rect);
      return `${out.size.width}×${out.size.height} png; insert took ${Date.now() - t0}ms (compare with 7) — rotated?`;
    },
  },
  {
    id: 'cropShot',
    label: '12c. view-shot: crop centre half, placed size (jpg 85%), insert',
    run: async ctx => {
      const src = need(ctx.imageSize, '4');
      const page = need(ctx.pageSize, '2');
      const out = await need(ctx.render, 'screen')({
        path: need(ctx.imagePath, '4'),
        size: src,
        rotation: 0,
        crop: {x: src.width / 4, y: src.height / 4, width: src.width / 2, height: src.height / 2},
        maxSide: Math.round(page.width * 0.3),
        format: 'jpg',
        quality: 0.85,
      });
      log(`render → ${fmt(out)}`);
      const t0 = Date.now();
      const r = centeredRect(page, out.size, 0.3);
      await insertPicture(ctx, out.path, {...r, top: r.top + 300, bottom: r.bottom + 300});
      return `${out.size.width}×${out.size.height} jpg; insert took ${Date.now() - t0}ms — cropped? looks ok as jpg?`;
    },
  },
  {
    id: 'insertImageHandles',
    label: '16. insertImage + lasso it (compare handles with a 7-inserted picture)',
    run: async ctx => {
      const notePath = need(ctx.notePath, '2');
      const page = need(ctx.page, '2');
      await call('insertImage', PluginNoteAPI.insertImage(need(ctx.workPath, '6')));
      // insertImage doesn't say where it put the picture: find the newest one.
      const els = await call<any[]>('getElements', PluginFileAPI.getElements(page, notePath));
      const pics = els.filter(e => e.type === PICTURE && e.picture);
      log(`page has ${pics.length} pictures; last: ${fmt(pics[pics.length - 1]?.picture)}`);
      const newest = pics[pics.length - 1];
      if (!newest) {
        return 'inserted, but no picture found on the page';
      }
      const rect = newest.picture.rect as Rect;
      await call('lassoElements', PluginCommAPI.lassoElements(padRect(rect, 4, need(ctx.pageSize, '2'))));
      return `lassoed at ${fmt(rect)} — close the plugin: corner-only handles, or side (stretch) handles too?`;
    },
  },
  {
    id: 'deleteCopy',
    label: '13. Delete our copy (embedded vs referenced test)',
    run: async ctx => {
      const ok = await FileUtils.deleteFile(need(ctx.workPath, '6'));
      return `deleted=${ok} — now close + reopen the note: are the images still there?`;
    },
  },
  {
    id: 'save',
    label: '14. Save current note',
    run: async () => {
      const r = await call('saveCurrentNote', PluginNoteAPI.saveCurrentNote());
      return fmt(r);
    },
  },
];
