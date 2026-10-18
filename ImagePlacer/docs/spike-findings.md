# Spike findings (Phase 2)

Device: Supernote Nomad, firmware Chauvet 3.30.45 · sn-plugin-lib 0.2.3 · RN 0.79.2

## Found while setting up (desk research, before device)

- **The SDK has Supernote's own file picker**: `RattaFileSelector.selectFile({selectType, suffixList, maxNum, title, rightButtonText, needSelectFolder, limitPath})` and `selectImage()`. If it works on the device, it gives us the real Files-app look for free and could replace most of the custom browser in Phase 3.
- **`FileUtils` (SDK)** covers what we planned to use `react-native-fs` for: `getExternalDirPath()` (SD card), `listFiles`, `getImageList()` (all images on the device), `copyFile`, `makeDir`, `deleteFile`. We dropped `react-native-fs`.
- **`getPageDisplaySize` is deprecated** in 0.2.3. Use `PluginFileAPI.getPageSize(getCurrentFilePath(), getCurrentPageNum())` instead. That needs `FILE:READ`, which we declare anyway.
- **`insertPageElements(elements, page, layer|null)`** works on the *current* file with a target layer, and is the best candidate for exact placement. `Picture = {picturePath, rect}` uses Android pixels.
- **Build script gotcha**: the template's `buildPlugin.sh` treats every `@react-native*` package as host-provided and skips the native build. That would silently ship without `@react-native-community/image-editor`. We patched `is_ignored_module_name` so community native modules count and only the CLI packages are skipped.

## On-device results: builds 1–2 (18 Oct 2026)

| # | Check | Result |
|---|---|---|
| 1 | Permissions read + write | ✓ |
| 2 | Context + page size | ✓ |
| 3 (b1) | All storage calls in one check | ✗ plugin closed (native crash), so split up in build 2 |
| 3a | `FileUtils.getExternalDirPath` | ✗ (whether ✗ or a crash still to confirm) |
| 3b | `FileUtils.exists` | ✓ |
| 3c | `FileUtils.listFiles(Document)` | ✓ |
| 3e | `FileUtils.getImageList` | ✗ (whether ✗ or a crash still to confirm) |
| 4 | `RattaFileSelector.selectFile` (native picker) | ✓ |
| 4b | `RattaFileSelector.selectImage` | ✗ closes the plugin, so we won't use it (removed in build 3) |
| 5 | `generateNotePng` preview | ✓ |
| 6 | Copy into plugin dir | ✓ |
| 7 | **`insertPageElements` picture at an exact rect** | ✓ but about 10 s (full-resolution source) |
| 8 | `insertElements` (file API) | ✓ about 10 s |
| 9 | `insertImage` | ✓ |
| 10 | Lasso the target rect | ✓ about 10 s |
| 11 | `resizeLassoRect` move | ✓ instant |
| 12 | image-editor `cropImage` (no displaySize) | ✗ hangs for 45 s or more |
| 13 | Delete our copy | ✓ (still to confirm: images persist after reopening?) |
| 14 | `saveCurrentNote` | ✓ (slow) |

**What this decides so far**
- **Exact placement works** with `insertPageElements` and a `Picture.rect`, so we use strategy A.
- **The native picker works**, so it replaces most of the custom browser.
- **Don't use** `selectImage`, `getExternalDirPath` or `getImageList` until we know why they fail.
- **Rotation must be baked into the pixels.** `resizeLassoRect` rotation doesn't apply to pictures. Build 3 tests view-shot for rotate, crop and downscale.
- **Large images:** we suspect the 10 s inserts come from full-resolution sources. Build 3 renders at the placed size and reports the insert time (12b/12c vs 7).

## On-device results: build 3

| # | Check | Result |
|---|---|---|
| 3a | `getExternalDirPath` | ✗ still (build 4 logs to a file to find out why) |
| 12a | image-editor `cropImage` with displaySize | ✗ timed out after 25 s, so **image-editor dropped** |
| 12b | view-shot rotate 90° at placed size (png) + insert | ✓ |
| 12c | view-shot crop at placed size (jpg 85%) + insert | ✓ |
| 13 | Delete our copy | ✓ |
| 14 | `saveCurrentNote` | ✓ |

**Decision:** one image pipeline, **view-shot**, for rotate, crop and render at the placed size, as png or jpg. Rotation is baked into the pixels.

**Tooling:**
- The Nomad advertises MTP+ADB over USB (VID 2207, PID 0017), but `adb devices` shows nothing so far.
- Build 4 mirrors the log to `EXPORT/ImagePlacer/log.txt`, flushed before every check, so it survives a crash.
- `tools/mtp.sh log ImagePlacer` pulls that file, and `tools/mtp.sh push ImagePlacer` deploys builds. Both need OpenMTP to be quit.

## On-device results: build 4

- **3a root cause:** the file log ends at `calling FileUtils.getExternalDirPath()…` with no result line, so the **SDK call crashes the plugin natively**. This is a Supernote SDK bug and worth reporting via the docs MCP `submit_feedback`. Avoid this call; build 5 tries `RNFS.getAllExternalFilesDirs()` (3f).
- **SD card:** MTP shows a second storage named `disk` (Music, Movies, Pictures, Android), which is the SD card.
- **Tooling:** `tools/mtp.sh push` / `log` work. One `.snplg` in `MyStyle` (id 42, parent 17).

## On-device results: builds 5–6

- **3f ✓:** `RNFS.getAllExternalFilesDirs()` gives the SD volume root **`/storage/XXXX-XXXX`**. Its top level holds Music, Movies, Pictures and Android. It took 140 ms, so this is the SD discovery path, not `FileUtils.getExternalDirPath`.
- **File log bug:** builds 5–6 rotated `log.txt` (unlink + rename) on start. Without `FILE:DELETE` that fails, and the file log silently disabled itself. Build 7 writes a new `log-YYYYMMDD-HHMMSS.txt` per session, with no delete or rename.
- **MTP caches object sizes** for files apps modify, and `RNFS.scanFile` didn't help. Fresh files per session avoid the problem.

## On-device results: template

Run the spike screen (toolbar → Insert Image) in a test note, and fill in each row:

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Permissions dialog for read + write | | |
| 2 | Context: device type, page, page size, plugin dir | | |
| 3 | SD path, listFiles, getImageList count | | |
| 4 | Native picker `selectFile`: look and feel, SD card visible? | | |
| 4b | `selectImage` variant | | |
| 5 | `generateNotePng` preview renders | | |
| 6 | Copy into plugin dir | | |
| 7 | **Insert A**: `insertPageElements` at exact rect | | |
| 8 | Insert A′: `insertElements` (file API): visible without reload? | | |
| 9 | Insert B: `insertImage`: where does it land, and at what size? | | |
| 10 | Lasso target: selects the image? | | |
| 11 | `resizeLassoRect` moves the image? | | |
| 12 | Image editor native module loads, crop works | | |
| 13 | After deleting our copy + reopening the note: images still there (embedded)? | | |
| 14 | `saveCurrentNote` | | |
| – | Pen works normally after Close? | | |

## Decisions (fill in after the run)

- Insert strategy:
- Picker: native `RattaFileSelector`, custom browser, or both (native picker + our search):
- Temp-file policy:

## On-device results: build 7

- **The file log works end to end.** `tools/mtp.sh log ImagePlacer` pulled the session log.
- **SD card (confirmed in the log):** `getAllExternalFilesDirs` gives `/storage/XXXX-XXXX/Android/data/com.ratta.supernote.pluginhost/files`, so the root is `/storage/XXXX-XXXX`. `readDir('/storage')` fails ("length of null array"), so we discover volumes only through `getAllExternalFilesDirs`.
- **Native rotation of pictures doesn't work:** the lasso's rotate handle is inert for images, which matches the docs (`resizeLassoRect` rotation covers only strokes, shapes and stars). Rotation has to happen in the plugin by re-rendering the pixels (view-shot, proven in 12b).

## On-device results: build 8

- **The note copies inserted images into its own store:** placed pictures report `picturePath` = `/storage/emulated/0/.data/plugin/<epoch-ms>.png`, converted to PNG. The note doesn't depend on our temp files, so the plugin can clean up its `out/` folder freely.
- **The lasso toolbar button works:** `registerButton(2, ['NOTE'], {editDataTypes:[2]})` appears for pictures and fires id 200. `getLassoElements` returns picture elements with `picture.{picturePath, rect}` and `layerNum`.
- **Double taps:** check 7 tapped twice inserted two stacked pictures (both in the lasso). The UI must ignore taps while busy; build 9 adds that guard.
- **Rect drift (to verify):** inserted 351,425 → 1053,1447, but the lasso reports 439,552 → 1054,1448: same aspect, about 12% smaller, bottom-right fixed. Was it the host or something else?
- **Insert speed:** about 3.5 s for a 1224×1783 jpg, compared with about 10 s earlier with a larger source.
- **Build 9:** check 15 rotates every picture in the lasso, each in place. It refuses mixed selections, because `deleteLassoElements` would also delete strokes.

## On-device results: build 9

- **Native lasso rotate handle:** disabled for pictures. Our Rotate lives in the lasso toolbar's **More** menu and opens the plugin (check 15 auto-runs).
- **`picturePath` of placed pictures is not readable:** `getLassoElements` reports `/storage/emulated/0/.data/plugin/<now-ms>.png` with a new name on every call (the number is the call time), and RNFS gets ENOENT. Build 10 tries a short wait, then `FileUtils.exists/copyFile`, then falls back to `generateLassoPreview` (the host renders the selection) and rotates that.
- The test note now has 4 stacked copies of the same picture (repeated check 7 taps).

## On-device results: build 10

- **Rotating a placed picture works** via the `generateLassoPreview` fallback. The picture's own file never becomes readable: 5 attempts over 2 s, with both RNFS and `FileUtils`. The preview is at page resolution (426×614 for a 426×614 placement), so 90° turns are lossless at display size. Stacked pictures get merged into one.
- **Side "stretch" handles** on lasso-selected plugin pictures come from firmware 3.30.45 ("images added via plugins can be scaled non-proportionally"). Plugins can't change the native lasso UI. Build 11 check 16 tests whether `insertImage` pictures behave differently.
- **Crop on the page frame isn't possible** (native UI). Build 11 adds a lasso **Crop** button that opens an in-plugin crop screen with mid-side bars. It replaces the picture in place, at the same scale (`src/screens/CropScreen.tsx`, `src/image/crop.ts`, `src/note/lassoPicture.ts`).

## On-device results: build 11, and build 12 changes

- **The crop screen works** (mid-side bars, replace in place at the same scale, 6.4 s). Feedback: rounded bars and draggable corner marks; both are in build 12.
- **Rotate failed again after a crop.** The log was truncated by the MTP size cache (a pull happened mid-session), so the cause is unconfirmed. Build 12 rebuilt rotate on the shared helpers (no file polling) and splits it into **Rotate left** (id 400) and **Rotate right** (id 200).
- **The stretch handles are wanted gone.** Not possible from a plugin. The check 16 (insertImage) answer is still pending.
- **Non-destructive crop (build 12):** the first crop keeps the selection as `originals/orig-<ms>.png` and tags the new picture's `userData` with `imageplacer:{o,w,h,e}`. A re-crop opens the original with the previous edges, and "Full image" un-crops. Open question: does the host keep `userData` on pictures? It's logged right after the replace ("userData read back"), and should be re-checked after closing and reopening the note.
- **Log pulls:** pull **once**, after the session. A mid-session pull makes MTP cache the size, which truncates later pulls of the same file.
