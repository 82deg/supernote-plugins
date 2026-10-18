# Spec: Journal Index (Auto Index + Migration)

Status: draft · Plugin folder (when created): `JournalIndex/` · Target: Nomad, Chauvet 3.30.45, sn-plugin-lib 0.2.3

## Problem
A bullet journal lives or dies by two chores: keeping the **Index** page current, and the monthly **Migration** of open tasks. On paper both are manual. On the Supernote, titles, stars and keywords already hold the structure, but nothing turns them into a navigable index page, or helps carry tasks forward.

## Goals
1. **Index:** one tap builds or refreshes an Index page at the front of the current notebook. It lists every title, starred item and keyword, each as a tappable link to its page.
2. **Migration:** review the open tasks from a page range, then migrate, schedule, complete or drop each one. Migrated tasks are copied in your own handwriting to the destination, and the original gets a `>` mark and a link to where it went.

Non-goals (v1): cross-notebook index, calendar sync, automatic detection of handwritten bullet glyphs (v2), DOC files.

## How it works (native features used)

### Index
| Source | API | Index entry |
|---|---|---|
| Titles (your existing headings, also used by the sidebar contents) | `PluginFileAPI.getTitles(note, pages)` → stroke numbers, then `getElements` + `PluginCommAPI.recognizeElements` | Recognised heading text, then the page number |
| Five-stars | `PluginFileAPI.searchFiveStars(note)` | "★ p.12" under **Starred** |
| Keywords | `PluginFileAPI.getKeyWords(note, pages)` | Grouped under each keyword |

- Each entry is a **text link** (`PluginNoteAPI.insertTextLink`, `linkType 0` = jump to note page, `destPath` = this note, `destPage` = the target page). Tapping an entry jumps to that page natively.
- **Layout:** two columns, sorted by page. Sections: Contents (titles) · Starred · Keywords. If it overflows, the plugin adds more index pages with `insertNotePage`.
- **Refresh without clobbering:**
  - The plugin remembers which elements it created (index page and element numbers) in its private folder, keyed by note path.
  - On refresh, it deletes **only those elements** (`deleteElements`) and re-inserts them. Anything you hand-wrote on the index page stays.
  - If the stored location no longer matches (pages were moved), it asks before rebuilding.
- If recognition returns nothing, the entry falls back to "Untitled · p.N".

### Migration
1. **Mark tasks (v1, explicit and reliable):**
   - Lasso a task line and tap **Task** on the lasso toolbar. This is a lasso button: `registerButton(2, ['NOTE'], {editDataTypes: [0]})`.
   - The plugin records the task's page and box, plus a small preview from `generateLassoPreview`, in its own task list for that note.
2. **Review:**
   - The toolbar button opens **Migrate**. Pick a range: this month, since the last migration, or custom pages.
   - It shows open tasks as handwriting thumbnails. Each has four actions: **Migrate** (to the next page or a chosen page), **Schedule** (to a Future Log page), **Done**, **Drop**.
3. **Copy in your own handwriting:**
   - `lassoElements(task box)` → `saveStickerByLasso` → `jumpToPage(dest)` → `insertSticker` at the next free row.
   - Stickers are Supernote's native copy-and-paste, so strokes keep their pen, thickness and shape.
4. **Mark the original:**
   - Draw a `>` stroke over the bullet area (`insertGeometry` or a stroke element).
   - Add a small text link "→ p.N" next to it.
   - Done tasks get an ✕; dropped tasks get a strike line.

## UX (e-ink)
- One toolbar button opens a screen with two tabs, **Index** and **Migrate**. The lasso toolbar has a separate **Task** button.
- **Index tab:**
  - Checkboxes for the sources (titles, stars, keywords).
  - A position choice: page 1, or a new page at the front.
  - **Build / Refresh** button, then a preview list of the entries and a "Go to index" button.
- **Migrate tab:**
  - A range picker and a paged task list (no scrolling), with 4 large buttons per task. **Apply** runs everything in one go and shows a summary.
- Every write is undoable by hand, and the summary lists every page that was touched.

## Data, permissions and privacy
- **Permissions:** `FILE:READ` and `FILE:WRITE`, for the current note only. No `INTERNET`.
- **Plugin storage:** `getPluginDirPath()/state/<hash of note path>.json` holds index element numbers, the task list, the last migration date and the settings.
- **User data:** never deleted, except for the plugin's own index elements on refresh.

## Phasing
- **v0.1 Index:** titles + stars, a single index page, refresh.
- **v0.2 Index:** keywords, multi-page overflow, a "Go to index" button.
- **v0.3 Migration:** lasso Task button, review screen, migrate by sticker + `>` mark + back link.
- **v0.4:**
  - Automatic detection of BuJo bullets (`•` open, `✕` done, `>` migrated, `<` scheduled), using stroke geometry and recognition, so no lasso step is needed.
  - Future Log / monthly spread generator.

## Open questions (spike first, like ImagePlacer)
1. Does `recognizeElements` give usable text for title strokes? How fast is it on a 100-page notebook?
2. Does `insertTextLink` return element numbers we can store and later pass to `deleteElements`? Do text links render inside a custom template's margins?
3. Do sticker save and insert work across pages in one session? Does `insertSticker` place at a given point or at a default spot? If at a default spot, do a lasso and `resizeLassoRect` afterwards, the same pattern as ImagePlacer.
4. Do the stored positions survive page inserts and deletes? If not, re-find tasks by preview match or element uuid. Are uuids stable across sessions?
5. Performance: is `getTitles`/`getKeyWords` over all pages fast enough to refresh on demand, or do we need to cache per page?

## Acceptance criteria (v0.1)
- On a 50-page test notebook with 10 titles and 5 stars, **Build** creates page 1 "Index" with 15 entries. Tapping each entry jumps to the right page.
- Adding a title on page 30 and tapping **Refresh** adds exactly one entry. Hand-written notes on the index page are untouched.
- No permission prompts beyond read and write. Nothing is written outside the current note and the plugin folder.
