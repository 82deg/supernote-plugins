# Image Placer for Supernote

Add pictures to your **regular notes** on a Supernote Manta or Nomad. Pick an image with Supernote's own file picker and it lands on the page already selected, so you can move or resize it straight away. Crop it, round its corners, or rotate it from the lasso's **More** menu.

<!-- Screenshots: docs/screenshots/ (picker, inserted picture, crop screen, More menu) -->

## What it does

- **Insert Image** (note toolbar): opens Supernote's file picker. The picture appears at almost full page width, selected with the lasso.
- **Crop** (lasso → More): drag the edges, the corners, or the whole frame. Ratio presets: Free, Original, 1:1, 4:3, 3:4, 16:9, 9:16. The kept part stays exactly where it was on the page.
- **Rounded corners** (in Crop): None, Small, Medium, Large or Circle, previewed live. Circle picks a square crop; choose another ratio for a pill shape. You can change or remove the corners later.
- **Settings:** choose the corners new pictures get (Settings → Apps → Plugins → Image Placer → settings button).
- **Re-crop:** crop the same picture again later and the full original comes back, so you can widen the crop, reset it or change the corners. Rotating keeps this too. The plugin remembers originals for your 50 most recent crops.
- **Rotate left / Rotate right** (lasso → More): turns the picture in place.
- **Large photos are handled:** they're scaled down to the size they're shown at, so your notes stay quick.

## Requirements

- Supernote **Manta or Nomad**, firmware **Chauvet 3.30.45** or later (the first stable release with plugins)
- Images in **PNG, JPG or JPEG**

## Install

1. Download `ImagePlacer-<version>.snplg` from the [latest Image Placer release](https://github.com/82deg/supernote-plugins/releases).
2. Connect your Supernote to your computer and copy the file into the **MyStyle** folder. On a Mac, use [OpenMTP](https://openmtp.ganeshrvel.com/) or Android File Transfer.
3. On the Supernote, go to **Settings → Apps → Plugins → Add Plugin** and pick the file.
4. Open a note. The **Insert Image** button is in the toolbar. Crop and Rotate are in the lasso's **More** menu when a picture is selected.

**Updating:** install the new file with **Add Plugin** in the same way. Don't use "reinstall" on the existing entry, because that reuses the old copy.

## Good to know

- Supernote shows side handles on the selection frame of plugin pictures, which can stretch them. That's Supernote's own frame, and plugins can't change it. Use the corner handles to keep the proportions.
- Supernote's **Undo** doesn't cover Crop and Rotate (the button greys out after them). To go back, rotate the other way, or open Crop again and tap Reset or pick Corners: None. Crop always reopens the full original.
- Crop, Rotate and Insert each take a few seconds. Most of that is Supernote saving the picture into the note. A progress bar shows while it works.

## Permissions and privacy

| Permission | Why |
|---|---|
| `FILE:READ` | Show and read your images (Document, EXPORT, INBOX, MyStyle, Note, SCREENSHOT and the SD card). |
| `FILE:WRITE` | Put the picture into the note you have open. |

Image Placer works **fully offline**: it makes **no network requests**, collects nothing, and **never changes or deletes your files**. Crop and Rotate replace only the picture you selected, and only when you tap them. The plugin keeps the uncropped originals, temporary renders and its one setting in its own private folder, and cleans them up itself.

## Feedback

Found a bug or have an idea? [Open an issue](https://github.com/82deg/supernote-plugins/issues/new/choose) and choose **Image Placer**. Please include your device, firmware version, and what you tapped.

## Development

From the workspace root (see [`../CLAUDE.md`](../CLAUDE.md) for conventions):

```bash
tools/bump.sh ImagePlacer      # versionCode +1 for every build you install
tools/build.sh ImagePlacer     # tsc + jest + package → ImagePlacer/build/outputs/ImagePlacer.snplg
tools/mtp.sh push ImagePlacer  # copy to the Nomad over USB (quit OpenMTP first)
```

Pinned on purpose: `react-native` 0.79.2 and `react` 19.0.0, because the Supernote plugin host requires them, plus `sn-plugin-lib` 0.2.3. Release builds are shrunk with R8 (`android/app/proguard-rules.pro`). Research notes from development are in [docs/spike-findings.md](docs/spike-findings.md).

## Credits & licence

- Icons: [Lucide](https://lucide.dev) (ISC licence).
- Image Placer: [MIT](LICENSE) © 82deg.
