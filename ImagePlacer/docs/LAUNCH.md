# Image Placer 1.0.0: launch kit

Texts ready to paste. Replace `<…>` placeholders once the release exists.

---

## A. GitHub release

**Tag:** `image-placer-v1.0.0`  **Title:** `Image Placer 1.0.0`  **Attach:** `ImagePlacer-1.0.0.snplg`

```markdown
Add pictures to your regular notes on Supernote Manta / Nomad, then crop them, round their corners and rotate them from the lasso menu.

**Requires** Chauvet 3.30.45 or later.

### Install
1. Download `ImagePlacer-1.0.0.snplg` below.
2. Copy it into the **MyStyle** folder on your Supernote (on a Mac: OpenMTP).
3. Settings → Apps → Plugins → **Add Plugin** → pick the file.
4. In a note, tap **Insert Image** in the toolbar. Crop and Rotate are under the lasso's **More** menu.

### What's in 1.0.0
- Insert Image via Supernote's own file picker. The picture lands selected, centred at half the page width.
- Crop: edges, corners, drag to move. Presets: Free, Original, 1:1, 4:3, 3:4, 16:9, 9:16.
- Rounded corners: None, Small, Medium, Large or Circle, with a live preview. Set a default for new pictures in the plugin's settings.
- Re-crop later from the full original (your 50 most recent crops).
- Rotate left / right, in place.
- Big photos are scaled down to the size they're shown at, so notes stay quick.

### Privacy
Fully offline. It only asks for file read/write, makes no network requests, and never changes or deletes your files.

Feedback: https://github.com/82deg/supernote-plugins/issues/new/choose
```

---

## B. Reddit post: r/Supernote_dev

**Title:** `[Plugin] Image Placer: add, crop & rotate pictures in your notes`

```markdown
I wanted to drop images into my regular notes, so I built **Image Placer**.

**What it does**
- **Insert Image** (toolbar) opens Supernote's own file picker. The picture lands on the page already selected, so you can move/resize it right away.
- **Crop** (lasso → More): drag edges, corners or the whole frame, with presets Free / Original / 1:1 / 4:3 / 3:4 / 16:9 / 9:16. Re-crop later from the full original.
- **Rounded corners** (in Crop): None / Small / Medium / Large / Circle, previewed live. Set a default for new pictures under Settings → Apps → Plugins → Image Placer.
- **Rotate left / right** (lasso → More), in place.
- Large photos are scaled down to their on-page size so notes stay fast.

**Install:** download the `.snplg` from the release, copy it to **MyStyle**, then Settings → Apps → Plugins → Add Plugin.
Release: <link to GitHub release>

**Permissions:** file read/write only. Fully offline, no network access, and it never changes or deletes your files. Source is public (MIT).

**Tested on:** Nomad, Chauvet 3.30.45.

**Known:**
- Supernote's selection frame shows side handles that can stretch plugin pictures. That's the system frame, which plugins can't change, so use the corners to keep proportions.
- Undo doesn't cover Crop and Rotate. Rotate back, or re-crop (it always reopens the full original).

Feedback and bug reports welcome, here or on GitHub: https://github.com/82deg/supernote-plugins/issues
```

Attach 2–3 screenshots (picker → inserted picture → crop screen), or a short phone video.

---

## C. Message to the plugin-list maintainer (u/theBlackOddity)

```text
Hi! Could you add Image Placer to the List of ALL Available Plugins?

- Creator: 82deg (GitHub: 82deg)
- Plugin: Image Placer — add pictures to notes; crop (with ratio presets), round corners and rotate them from the lasso menu
- Repo: https://github.com/82deg/supernote-plugins/tree/main/ImagePlacer
- Download: <link to GitHub release>
- Version: 1.0.0
- Permissions-compatible: yes (FILE:READ + FILE:WRITE only, no network)

Thanks for keeping the list!
```

---

## D. Optional: r/Supernote (users)

Same as B but shorter: what it does, a screenshot, the install steps, and a link to the dev post.
