# Frameflow

A browser-based editor for composing scenes from images, video and text into
slideshows and presentations. Projects and media are stored locally in
IndexedDB — nothing leaves the browser.

## Getting started

```bash
npm install
npm run dev       # starts the Vite dev server (http://localhost:5173)
npm run test      # runs the Vitest unit suite
npm run lint      # eslint across the project
npm run build     # type-checks (tsc -b) and produces a production build
```

## Deployment

`server.js` is a zero-dependency Node static server for the `dist/` build —
serve it however you like (PM2, systemd, a container). For PM2, copy
`ecosystem.config.example.cjs` → `ecosystem.config.cjs` and set your port.
Both `ecosystem.config.cjs` and any local `deploy.sh` are gitignored since
they contain server-specific values.

## Architecture

- **`src/lib`** — framework-agnostic domain types (`types.ts`), Zod schema
  validation (`schema.ts`), geometry/crop math (`geometry.ts`), and timeline
  math (`time.ts`).
- **`src/state/editorStore.ts`** — the single Zustand store for the
  currently-open project. All project mutations go through `applyEdit`
  (pushes one history entry) or the `beginTransaction`/`updateElementLive`/
  `commitTransaction` trio (coalesces continuous drag/resize gestures into a
  single undo step).
- **`src/storage`** — Dexie (IndexedDB) repositories for project documents
  and media blobs, with reference counting for blob URLs.
- **`src/features`** — one folder per feature area: `projects` (launcher,
  import/export), `media` (library panel, asset import), `canvas` (Konva
  stage, element rendering, crop/text editing), `inspector` (property
  panels), `editor` (toolbar), `timeline` (scene strip).
- **`src/components/ui`** — design-system primitives (Button, IconButton,
  Dropdown, Slider, Tabs, Toast, Tooltip, etc.) built on Radix UI + Tailwind.

## Implemented so far

- Project launcher: create, open, delete, duplicate-free listing, and
  **import/export project JSON** (media bytes are intentionally excluded
  from the JSON — re-import media after loading a shared project file).
- Media library: drag-and-drop or file-picker import for images/video/audio,
  thumbnailing, IndexedDB blob storage, drag-onto-canvas placement.
- Canvas editing: select, multi-select, drag, resize/rotate via transform
  handles, flip horizontal/vertical, lock/hide, z-order controls, duplicate,
  delete.
- Media crop modes: fill (cover), fit (contain), and free (manual zoom +
  pan) with a dedicated crop-editing mode that drags the image under a fixed
  frame.
- Text elements: double-click-to-edit overlay, font/size/weight/colour/
  alignment/line-height/letter-spacing controls.
- Scenes: add, duplicate, rename, delete (minimum of one scene is enforced),
  per-scene background colour and duration.
- Undo/redo history with transaction coalescing so a single drag or resize
  gesture is one undo step, not one per animation frame.
- Autosave to IndexedDB with a visible save-status indicator.
- Unit tests for crop/geometry math, timeline boundary math, and store
  behaviour (undo/redo, transaction coalescing, element/scene CRUD).

## Known limitations

- **No rendering/export pipeline yet.** "Export", "Preview" and "Present"
  in the toolbar are intentionally disabled with a tooltip explaining they
  land in a later milestone — there is no video/PDF export engine in this
  build.
- **Transform tool is single-selection only.** Multi-select supports batch
  lock/hide/duplicate/delete, but dragging or resizing while multiple
  elements are selected only affects the grabbed element, not the whole
  group.
- **Text overlay ignores rotation.** The HTML `<textarea>` used for inline
  text editing is positioned using the element's unrotated bounding box, so
  editing a rotated text element will show the editor slightly offset from
  the rendered text until you commit.
- **Imported project JSON has no media.** Per the data model, project JSON
  never embeds media bytes; importing a project whose assets were never
  re-imported into the new project will show elements referencing missing
  media.
- Scene `startMs`/`durationMs` timing fields are editable in the inspector
  but are not yet consumed by any playback/export engine.

