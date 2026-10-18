# Image Placer for Supernote

A Supernote plugin that adds pictures to your **regular notes**. Pick an image with Supernote's own file picker; it lands on the page already selected, so you can move or resize it straight away. Crop it (free, original shape, 1:1, 4:3, 3:4, 16:9, 9:16) or rotate it from the lasso's More menu.

> Status: **pre-release.** Research notes from the on-device spike are in [docs/spike-findings.md](docs/spike-findings.md); the test bench itself is kept at the `spike-final` git tag.

## Requirements

- Supernote Manta or Nomad on firmware **Chauvet 3.30.45** or later (the first stable release with plugins)
- Image formats: PNG, JPG, JPEG

## Install

1. Download `ImagePlacer.snplg` from Releases.
2. Copy it to the `MyStyle` folder on your Supernote.
3. On the device, go to **Settings → Apps → Plugins → Add Plugin** and pick the file.
4. Open a note. The **Insert Image** button appears in the toolbar.

## Permissions and privacy

| Permission | Why |
|---|---|
| `FILE:READ` | List and read images in Document, EXPORT, INBOX, MyStyle, Note, SCREENSHOT and the SD card. |
| `FILE:WRITE` | Insert the chosen image into the open note. |

Image Placer makes **no network requests** and never deletes or modifies your files. Its only cleanup is temporary copies inside its own plugin folder.

## Development

Requirements: Node 22 (`.nvmrc`), JDK 21, and Android SDK 35 with Build-Tools 35.0.0 and NDK 27.0.12077973. Set `JAVA_HOME` and `ANDROID_HOME`.

```bash
npm install
npx tsc --noEmit && npx jest
./buildPlugin.sh            # → build/outputs/ImagePlacer.snplg
```

Pinned on purpose: `react-native` 0.79.2 and `react` 19.0.0, because the host runtime requires them; `sn-plugin-lib` 0.2.3.

**Iterating on the device:** bump `versionCode` in both `PluginConfig.json` and `src/version.ts` for every build you install. Use **Add Plugin** and pick the new file; "reinstall" on the existing entry reuses the old copy. Logs:

```bash
adb logcat -c && adb logcat -s ReactNativeJS:V PluginHost:V SNPlugin:V
```

`buildPlugin.sh` is patched so `@react-native-community/*` native modules trigger the native build. Upstream skips them.

## License

MIT
