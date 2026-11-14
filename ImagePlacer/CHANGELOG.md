# Changelog: Image Placer

## 1.0.0 (2026-11)

First public release.

- **Insert Image:** opens Supernote's file picker. The picture lands at 90% of the page width, selected with the lasso.
- **Crop** from the lasso menu:
  - edge bars, corner marks, and drag-to-move;
  - ratio presets: Free, Original, 1:1, 4:3, 3:4, 16:9, 9:16;
  - the kept part stays in place;
  - non-destructive re-crop (originals kept for the 50 most recent crops).
- **Rotate left / right** from the lasso menu, in place.
- Large photos are scaled down to their displayed size before going into the note.
- Fully offline: only `FILE:READ` and `FILE:WRITE`, no network access.
