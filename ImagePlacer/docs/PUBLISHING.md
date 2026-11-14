# Publishing Image Placer

A step-by-step path from "works on my Nomad" to "other people can install it". Do the steps in order.

---

## 1. Decide who it's "by"

**You can use your business name. You don't need your personal name.** Nothing in Supernote's plugin format or the community channels requires a legal name. The `author` field in `PluginConfig.json` is free text, and Supernote shows it in the plugin's details.

Pick one name and use it everywhere, so people can recognise it:

| Where | What to put |
|---|---|
| `PluginConfig.json` → `author` | `82deg` |
| `LICENSE` copyright line | `82deg` |
| GitHub | The business account: everything lives in **`github.com/82deg/supernote-plugins`**, one folder per plugin |
| Reddit post | Posting from your personal account is normal. Say in the post that it's from your business |

> Decided: **82deg everywhere** (plugin author, licence, commits via GitHub's no-reply address), matching the community norm of handles rather than real names. If the business isn't a registered company, the copyright is still legally yours as the person trading as 82deg.

## 2. How people give feedback

Use **GitHub Issues** as the main channel, because it's public, searchable and free. Back it up with the Reddit thread.

- **Don't put your personal email** in the plugin, the README or the Reddit post. Public repos get scraped by spammers.
- If you want an email option, create an **alias** such as `plugins@yourdomain` (or `imageplacer@…`) that forwards to you. You can turn it off later.
- Leave the plugin's own `desc` free of contact details; Supernote shows `desc` as the product description. Contact details go in the README and the Reddit post.

Use this in the README and the Reddit post:

> **Feedback & bugs:** open an issue at github.com/82deg/supernote-plugins/issues (choose "Image Placer"), or reply in the Reddit thread. Please include your device, firmware version, and what you tapped.

## 3. Title and description

**Title (`name`):** `Image Placer`. It's short, says what it does, and doesn't clash with the existing "Image Inserter" or "Embed PNG" plugins. Supernote shows this under Settings → Apps → Plugins.

**Description (`desc`):** plain language, what it does and what it doesn't. This is a draft of about 300 characters:

> Add pictures from your files or SD card to any note. The picture lands selected, ready to move or resize. Crop it (free or 1:1, 4:3, 16:9…) and rotate it from the lasso menu. Works fully offline: no internet access, and it never changes your files.

Keep the "no internet / never changes your files" line. Supernote's reviewers check the description against what the plugin actually does, and this line tells them, and users, exactly that.

**Version:** set `versionName` to `1.0.0` for the first public release. Keep increasing `versionCode` by one for every build you share (`tools/bump.sh ImagePlacer 1.0.0`). **Never change `pluginID`**, or Supernote will treat it as a different plugin.

## 4. Release checklist (in the code)

- [x] **Originals cleanup:** the newest 50 uncropped originals are kept (`src/note/housekeeping.ts`), and temporary renders are cleared at the start of each edit.
- [x] `PluginConfig.json`: name, author (82deg), final `desc`, `versionName` 1.0.0. `uses-permissions` is exactly FILE:READ and FILE:WRITE.
- [x] Bump the version, then build: `tools/bump.sh ImagePlacer 1.0.0` then `tools/build.sh ImagePlacer`. Check the printed config (name, version, permissions, and `reactPackages` = the view-shot package).
- [ ] **Clean-install test on the Nomad:** remove the old plugin first, then use Add Plugin. Go through insert, move/resize, crop (each ratio), re-crop, rotate both ways, and deny the permission once to see the message. Close and reopen the note, then re-crop.
- [x] Self-review against Supernote's criteria (see `../CLAUDE.md`):
  - the permissions declared match the ones used;
  - nothing deletes or overwrites user files;
  - zero network calls;
  - no hardcoded hosts;
  - the description matches what the plugin does.
- [ ] Commit, then tag the release in the shared repo: `git tag image-placer-v1.0.0` (the plugin prefix keeps releases of different plugins apart).

Ready-to-paste texts for the release, Reddit and the list maintainer are in [LAUNCH.md](LAUNCH.md).

## 5. Screenshots and a short demo

1. On the Nomad, take screenshots of these: the picker, a picture just inserted (selected), the crop screen with a ratio chip on, and the More menu showing Crop / Rotate.
2. They're saved in the **SCREENSHOT** folder. Copy them to the Mac with OpenMTP.
3. Optional but very effective: a 10–20 s phone video of insert, crop and rotate. E-ink is hard to screenshot "in motion", so a filmed demo sells it.
4. Put them in `docs/screenshots/` and reference them from the README.

## 6. GitHub release

1. The repo is `82deg/supernote-plugins` (created **private**). On launch day, make it public: Settings → General → Danger Zone → Change visibility. Unfinished plugins should live on branches until they're ready, because the whole repo becomes visible.
2. Push `main` and the `image-placer-v1.0.0` tag.
3. Create a Release from the tag, titled **"Image Placer 1.0.0"**. Attach `ImagePlacer/build/outputs/ImagePlacer.snplg`, renamed to `ImagePlacer-1.0.0.snplg`. Paste the changelog into the release notes. Link to it from the plugin table in the root README.
4. README must-haves (most are already there):
   - what it does, with screenshots;
   - install steps (MyStyle, then Settings → Apps → Plugins → Add Plugin);
   - requirements (Chauvet 3.30.45 or later, Manta/Nomad);
   - permissions and privacy;
   - feedback (section 2);
   - licence (MIT);
   - credits: icons from **Lucide** (ISC licence).

Publishing the source isn't required by Supernote, but it builds trust with users and speeds up any review.

## 7. Community launch (works today)

1. **Post on r/Supernote_dev.** Use a title like `[Plugin] Image Placer — add, crop & rotate pictures in your notes`. Include:
   - 2–3 screenshots or the video;
   - what it does, in 3 bullets;
   - a link to the GitHub release (and to the `ImagePlacer/` folder for the README);
   - the install steps;
   - permissions and privacy ("offline, never changes your files");
   - the tested firmware;
   - where to give feedback.
2. **Ask to be added to the plugin list:** comment on, or message the maintainer of, the "List of ALL Available Plugins" post (u/theBlackOddity). Give them the name, a one-line description, the repo link (`github.com/82deg/supernote-plugins/tree/main/ImagePlacer`), the version, and "permissions-compatible: yes".
3. Optionally cross-post a short version to r/Supernote, for users rather than developers.
4. Answer early feedback quickly. The first few days set the plugin's reputation.

## 8. InkHub (official store), when it opens to plugins

As of October 2026, InkHub lists plugins, but there's **no public submission process** for third-party plugins yet. Supernote says plugin support in InkHub is being expanded gradually. Their published review steps are: Submit → Basic inspection → Function verification → Security review → Publish.

What to do now:
- Have everything from steps 3–6 ready: name, description, icon, screenshots, privacy statement, and the source link. Those are what a store listing will ask for.
- Ask Supernote directly, using Settings → Feedback on the device or support.supernote.com: "How can a developer submit a plugin to InkHub?"
- Watch r/Supernote_dev for the announcement.

## 9. After launch: updates

- Every update gets a higher `versionCode`, a new `versionName` (1.0.1, 1.1.0…), a CHANGELOG entry, a GitHub Release with the `.snplg` attached, and a short comment in the Reddit thread.
- Tell users to update with **Add Plugin → pick the new file**. Reinstalling the existing entry reruns the old copy.
- Re-test after each Supernote firmware update; new firmware has broken older plugin SDKs before.
