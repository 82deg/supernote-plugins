# Supernote plugin workspace

The plugins here are for the Supernote Nomad (firmware Chauvet 3.30.45+). Each plugin is a **standalone React Native project and its own git repo** in a subfolder. This folder holds the shared conventions (this file), the scripts in `tools/` and the starter code in `_template/`.

## Layout
- `tools/`: run these from anywhere. They set Node 22, JDK 21 and the Android SDK paths themselves.
  - `new-plugin.sh <Name>`: scaffold a new plugin with all the fixes below already applied.
  - `build.sh <Plugin>`: tsc, jest, version check, then `buildPlugin.sh`. Prints the `.snplg` path.
  - `bump.sh <Plugin>`: increments `versionCode` in both `PluginConfig.json` and `src/version.ts`.
  - `deploy.sh <Plugin>`: `adb push` to `MyStyle/` if ADB is connected; otherwise prints the OpenMTP steps.
  - `logs.sh`: filtered logcat. The Nomad doesn't expose ADB so far, so use `mtp.sh` instead.
  - `mtp.sh detect | push <Plugin> | log <Plugin>`: USB/MTP via libmtp. **Quit OpenMTP first.**
    - `push` uploads `MyStyle/<Plugin>-b<code>.snplg` (versioned, so the device picker can tell builds apart).
    - `log` pulls the newest `EXPORT/<Plugin>/log-YYYYMMDD-HHMMSS.txt` (one per plugin session) to `<Plugin>/device-logs/`.
    - Plugins must never rename/delete in shared folders without `FILE:DELETE` (it fails silently). MTP also caches file sizes, so write a fresh file per session instead of rotating.
- `tools/render-icons.mjs <outDir> <lucide-name>=<file.png> …`: button icons from **Lucide** (lucide.dev, ISC licence), rendered to 48 px PNGs with stroke 1.75. Supernote needs image files for buttons, so nothing is added to the plugin. Run `npm install` once in the workspace (dev tools only).
- `_template/`: files copied into every new plugin (logging, SDK helpers, pending-button, version, geometry, e-ink shell UI).
- `<Plugin>/`: one folder per plugin, e.g. `ImagePlacer/`.

## Hard rules
- **Live docs first:** check API signatures against the `supernote-docs` MCP (user scope) or `node_modules/sn-plugin-lib/src`. Don't trust memory or old blog posts.
- **Pinned versions:** `react-native` **0.79.2** (the host runtime requires it). `react`, `react-test-renderer` and `@types/react` at exactly **19.0.0**; a mismatch crashes silently on the device. `sn-plugin-lib` pinned exactly; current version is 0.2.3.
- **Init order:** call `PluginManager.init()` before any other SDK call. Register button listeners in `index.js` (pending-button pattern in `src/pendingButton.ts`), not in `App`.
- **Coordinates:** Android pixels for `sn-plugin-lib` > 0.1.65. Get the page size with `PluginFileAPI.getPageSize(getCurrentFilePath(), getCurrentPageNum())`; `getPageDisplaySize` is deprecated.
- **Permissions:**
  - Declare each one in `PluginConfig.json` under `uses-permissions`.
  - Call `hasPermission`, then `requestPermission`, **every time** the plugin opens. "Allow once" expires when the plugin exits.
  - Least privilege: never declare a permission the code doesn't use. Avoid `INTERNET` unless the feature needs it, and disclose it if so.
- **Files:** prefer the SDK's `FileUtils` (list, copy, SD card via `getExternalDirPath`, `getImageList`) and `RattaFileSelector` (the native Supernote picker) over third-party fs libraries.
- **Native modules:** `@react-native-community/*` modules are NOT provided by the host. Our patched `buildPlugin.sh` makes them trigger the native build. Upstream ignores every `@react-native*` package, and the plugin then ships without the module. After a build, check that `reactPackages` in the packaged `PluginConfig.json` lists your modules.
- **Release builds:** plugins ship the **release** APK with R8 shrinking and `-dontobfuscate` (`new-plugin.sh` sets this up). For every native module you add, add `-keep class <its package>.** { *; }` to `android/app/proguard-rules.pro`, then check that its class shows up in the packaged `reactPackages`.
- **Logging:** keep one log line that isn't gated behind `__DEV__` at startup (`<Name> v<versionName> (<code>) starting`). Builds always use `--dev false`.
- **Versions:** bump `versionCode` for every build that goes to the device. Install with **Add Plugin → pick the file**; "reinstall" reruns the host's old managed copy in `MyStyle/Plugins/`. **Never change `pluginID`.**
- **E-ink UI:** black on white, no animations, touch targets of 48dp or more, paging instead of long scrolls, inverted selected state.
- **Write calls:** every `APIResponse` gets checked (`src/sdk.ts` `call()` unwraps and throws `SdkError`). Show failures on screen; never fail silently.

## Publishing checklist (Supernote review: Submit → Basic inspection → Function verification → Security review → Publish)
1. The permissions declared match the call sites exactly.
2. No delete or overwrite of user files, except through an explicit user action.
3. List every network call and disclose any user data it sends. Prefer none.
4. No hardcoded hosts or IPs.
5. `desc` and `name` in `PluginConfig.json` are accurate and friendly (not the npm slug).
6. Do an end-to-end install on the device.
7. Public GitHub repo (MIT) with a README covering permissions and privacy; a release built from a tag with `.snplg` attached; a post in r/Supernote_dev. Check the InkHub submission route at the time, since it isn't documented publicly yet.

## Dev environment
- Node 22 comes from Homebrew `node@22` (keg-only; the tools add it to `PATH`). JDK 21 comes from Homebrew `openjdk@21`. The Android SDK is in `~/Library/Android/sdk` (platform 35, build-tools 35.0.0, NDK 27.0.12077973).
- On macOS, the Nomad connects over MTP: use OpenMTP. Firmware updates go into `EXPORT` as a zip that hasn't been unzipped.
