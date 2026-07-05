# CLAUDE.md

Living status doc for the Browser-Only Collaborative Visual IDE. This file is updated automatically after every command/change in this project — no need to ask for it. For stable product requirements, see [PRD.md](./PRD.md).

# Project Goal

Build a production-level Browser-Only Collaborative Visual IDE similar to Figma / Excalidraw / VS Code Web.

This is a learning project. The objective is NOT just to finish the project — it is to understand the architecture while building it.

The project is intended to be completely frontend, no traditional backend. The app is now backend-free by default (see "Known Deviations" #1 — resolved); an optional local signaling server remains available opt-in for same-machine testing convenience.

Stack: Nuxt 4 · Vue 3 · TypeScript · Pinia · IndexedDB · Web Workers · CRDT (Yjs) · WebRTC · Service Workers · OffscreenCanvas

---

# Development Rules

Always follow these rules.

1. Never rewrite unrelated files.
2. Do not change architecture.
3. Use existing folder structure.
4. Whenever modifying a file always specify CREATE FILE / REPLACE COMPLETE FILE / UPDATE PART OF FILE. Prefer REPLACE COMPLETE FILE.
5. Always provide COMPLETE files. Never give incomplete snippets.
6. Never use `require()`. Always use ES imports.
7. Keep TypeScript strict-safe. The project must always pass `npx nuxi typecheck`.
8. Never install `@types/node` to solve frontend issues. Use browser-compatible imports.
9. Maintain production-level architecture.

---

# Filesystem note

This project's filesystem is case-insensitive (macOS default). `CLAUDE.md` and `claude.md`/`Claude.md` are the SAME file on disk — never create a second file with different casing of this name, and never `rm` a "duplicate" by name without first diffing paths for identical inode/content. (A prior session mistakenly deleted this file's content this way; it was reconstructed from context.)

---

# Actual Architecture (verified on disk, 2026-07-05)

Real implementations live at the paths below. Several originally-planned skeleton files under `src/{plugins,collaboration/crdt,collaboration/presence,workers/*-worker,service-worker,state-manager,storage/version-control,services/*}` are **empty 0-byte stub files** — do not assume code lives there just because the folder exists. The real code for those areas was implemented one level up or under `src/priority2/`.

```
src/
  ai/                     rule-based NL → operation parser. Legacy pipeline (untouched): OperationGenerator, InstructionParser, OperationExecutor, AIWorkflowService.
                          New pipeline (2026-07-05, now the default UI path): planTypes.ts, AIContextBuilder, AIReferenceResolver, AIPromptParser,
                          AIPlanBuilder, AIPlanValidator, AIOperationExecutor, providers/{AIProvider,RuleBasedAIProvider}, workers/AIWorkerClient
  collaboration/          CRDTService.ts, document.ts, Awareness.ts, SceneSync.ts (real Yjs code — NOT in collaboration/crdt or /presence, those are stubs)
    webrtc/               WebRTCManager, SignalingClient, PeerConnectionManager, DataChannelManager, CRDTSyncBridge, PresenceManager, MessageProtocol
  commands/               CommandRegistry, fuzzySearch, builtInCommands
  engine/
    history/              HistoryManager (in-memory)
    layers/                LayerManager (z-index reorder, now sibling-scoped by parentId — see src/layers/ below for hierarchy/grouping/align/drag-drop)
    performance/           culling.ts, PerformanceMonitor.ts, bounds.ts, viewport.ts (viewport culling only — no LRU cache / object pooling yet)
    rendering/             Camera, Renderer, CanvasController, RenderLoop, GridRenderer, ShapeRenderer, SnapGuides, coordinates
    scene-graph/           createSceneObject, hitTest (hierarchy-aware: leaf-only hits, outermost-group selection + drill-in), SelectionManager, types (SceneObject now carries parentId/expanded/blendMode; 'group'/'folder' added to SceneObjectType)
  layers/                 Layer Management (2026-07-05): types.ts (BlendMode), LayerTreeService (tree/paint-order/effective visibility-locked-opacity-blendMode), LayerHierarchyService (reparent/folders/rename), LayerGroupingService (group/ungroup/cascade-delete), LayerAlignmentService (align×6/distribute×2), LayerDragDropService (drop-target resolution), layerValidation (circular-guard), layerMigration (normalizeHierarchy — flat-project + corruption repair), LayerExportUtils (flatten for visual exporters)
  export/                 ExporterRegistry, exporters/{PNG,SVG,JSON}Exporter
  monitoring/             MonitoringService, FPSMonitor, MemoryMonitor, types
  offline/                CRDTUpdateQueue, OfflineQueue, SyncManager, NetworkStatusService
  plugins/                PluginRegistry, PluginContext, demoPlugin, types
  storage/
    local/                 IndexedDBService, ProjectFileSystem
    binary/                AssetProcessor
  version-control/        VersionControlService, DiffEngine, SnapshotManager
  workers/
    asset-worker/          asset.worker.ts (real)
  priority2/              additive enhancement layer, see below
    collaboration/         ManualCollaborationSession, ManualSignalingToken (backend-free SDP-token signaling)
    export/                Priority2Exporters, PDFBuilder, ZipWriter, SceneExportUtils (PDF/HTML/ZIP)
    history/               PersistentHistoryService (IndexedDB-backed transactions/batching)
    state/                 ReactiveStateManager, Priority2RuntimeState (selectors, transactions, time-travel)
    storage/               BinaryBlockStore, Priority2Database (content-addressed chunked blocks)
    version-control/       PersistentVersionControl (IndexedDB persistence + 3-way merge/conflict resolution)
    workers/               Priority2WorkerPool + render/compression/ai/history/export/crdt worker wrappers

app/
  components/{ai,canvas,collaboration,command-palette,editor,history,layers,monitoring,panels,settings,version-control}/
                          layers/ (2026-07-05): LayerTree.vue, LayerTreeNode.vue (recursive, drag-drop), LayerToolbar.vue
                          app-shell/ (2026-07-05, UI redesign): AppShell.vue (root layout — sidebar + `.app-content`), AppSidebar.vue (persistent nav rail,
                          collapsible, off-canvas drawer <860px), NavigationItem.vue, ThemeToggle.vue, PageHeader.vue (shared header for every dedicated screen)
                          history/HistoryScreen.vue and settings/SettingsScreen.vue (2026-07-05, new — no prior UI existed for either)
  composables/            useAutosave, useHistoryShortcuts, useLayerShortcuts (Ctrl/Cmd+G, +Shift+G, +A), useMonitoring, useOffline, usePlugins, ...
                          useTheme.ts (2026-07-05 — applies data-theme/data-reduced-motion to <html>, one-shot at app root, like every other lifecycle composable)
                          useHistoryEntries.ts (2026-07-05 — polls PersistentHistoryService.historyEntries via the window.__COLLAB_PRIORITY2__ bridge for HistoryScreen)
  stores/                 18 Pinia stores: pwa, selection (multi-select: selectedIds[] alongside back-compat selectedId), plugins, history, export, editor, commandPalette,
                          offline, aiWorkflow, monitoring, project, versionControl, asset, scene (folder/group/align/distribute/reparent/blend-mode actions),
                          navigation, uiPreferences, collaborationUI, pluginUI (all 4 added 2026-07-05, UI redesign — see below)
  plugins/                pwa.client.ts, priority2.client.ts (registers Priority 2 exporters/workers at runtime)

server/routes/collab-signal.ts   Nitro WebSocket signaling relay — opt-in only, see Known Deviations #1
scripts/signaling-server.mjs     standalone Node signaling server, launched only by `npm run dev:with-signaling` (NOT the default `npm run dev`)

tests/unit/        36 real test files (Layer Management: LayerHierarchyService, LayerGroupingService, LayerAlignmentService, LayerDragDropService, LayerTreeService, layerMigration, SelectionMultiSelect;
                    AI Workflow: AIPromptParser, AIReferenceResolver, AIPlanBuilder, AIPlanValidator, AIOperationExecutor, AIWorkerClient;
                    UI redesign 2026-07-05: navigation.store, uiPreferences.store)
tests/integration/ 5 real test files (AIWorkflow — legacy pipeline, unmodified; AIWorkflowPlan — new plan pipeline, 2026-07-05; CommandRegistry, ExporterRegistry, VersionControl)
tests/component/   3 real test files (2026-07-05, first Vue component tests in this repo): NavigationItem, ThemeToggle, PageHeader — kept to dependency-free
                    app-shell primitives; AppShell/AppSidebar/EditorShell are exercised by manual Playwright passes instead (they pull in canvas/CRDT/worker singletons)
tests/e2e/         empty (.gitkeep only) — not started
```

---

# Module Status (against the 20-module requirements brief, see PRD.md)

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Infinite Canvas | Implemented | Pan/zoom/camera/grid/snap-guides/minimap present. Missing: rulers, explicit devicePixelRatio high-DPI handling, resize/transform handles, in-place text editing. |
| 2 | Layer Management | **Implemented 2026-07-05** | Hierarchical layer tree (folders + groups, extending `SceneObject` with `parentId`/`blendMode`/`expanded` rather than a second parallel tree — see `src/layers/`), multi-select (`selection.selectedIds[]`, back-compat `selectedId` preserved), grouping/ungrouping (Ctrl/Cmd+G, +Shift+G — group deletion cascades, folder deletion promotes children), drag-and-drop reorder/reparent in the layer panel (native HTML5 DnD, no new dependency), align ×6 + distribute ×2 (equal-gap, ≥3 objects), 12 CSS blend modes with `source-over` fallback, inherited visibility/lock/opacity (ancestor-walk, not mutated on children), all wired through history (single transaction per multi-object op, reusing the existing snapshot-based pattern), persistence (`normalizeHierarchy` migrates flat/corrupt data on every load), CRDT sync (new fields added to `CollabSceneObject`/`SceneSync.ts`), and exports (`LayerExportUtils.flattenForExport` — visual exporters only; JSON/ZIP keep raw hierarchy). Verified via 349/349 unit tests, `npx nuxi typecheck` clean, `npm run build` clean, and a 16-check headless-Chromium Playwright pass (multi-select, group/undo/redo, folder creation, blend mode, align, drag-and-drop, and **persistence across a real save → reload → reopen cycle**). **Known simplifications**: no marquee/rubber-band select (not in spec's canvas bullet list); group blend-mode compositing is applied per-descendant-leaf, not via an isolated offscreen-buffer layer (documented approximation, not pixel-identical to true isolated group compositing); double-click drill-in supports one level of group nesting depth per click (single-click-into-descendant), not unlimited nested double-click chaining. |
| 3 | Browser File System | Partial | Project CRUD + JSON import/export + autosave work. No folder hierarchy for projects, no drag-drop import UI. |
| 4 | History Engine | Implemented, wiring confirmed, had a crash bug (fixed 2026-07-05) | `PersistentHistoryService` IS wired into the live scene watcher in `app/plugins/priority2.client.ts`, but its clone helper crashed on every scene edit once a project was active (see Known Deviations #2) — fixed. Still unverified: real refresh-recovery UX (data is persisted, but no test yet reloads the page and checks undo history survives). |
| 5 | Collaboration Engine / CRDT | Implemented | Real Yjs-backed `CRDTService`/`document.ts`/`Awareness`/`SceneSync`. Manual cross-device SDP-token signaling (`ManualCollaborationSession`) is now the **default** UI path via `CollaborationPanel.vue`'s "Direct Link (No Server)" tab. No conflict-resolution UI. |
| 6 | WebRTC Networking | Implemented | ~1260 lines across WebRTCManager/SignalingClient/PeerConnectionManager/DataChannelManager/PresenceManager. This path ("Local Network Room" tab) is now opt-in and requires `npm run dev:with-signaling`. |
| 7 | Offline-first | Implemented | CRDTUpdateQueue + OfflineQueue + SyncManager + NetworkStatusService, IndexedDB-backed. |
| 8 | Asset Processing | Implemented, with a shortcut | Worker posts a placeholder dataUrl; real thumbnail generation happens on the main thread, not inside the worker. |
| 9 | Rendering Engine / Scene Graph | Implemented (minimal) | ~215 lines — basic scene graph + hit test + selection. No dedicated diff/patch engine beyond what history/CRDT provide. |
| 10 | Plugin SDK | Implemented | Registry, context, lifecycle, demo plugin all real. |
| 11 | Command Palette | Implemented | Fuzzy search, categories, keyboard nav, tested. |
| 12 | AI Workflow | **Implemented 2026-07-05 — full pipeline** | The original simple pipeline (`InstructionParser`/`OperationGenerator`/`OperationExecutor`/`AIWorkflowService`, 5 intents, no preview) is untouched and still fully functional/tested — it's no longer the UI's default path, superseded by a new additive pipeline in `src/ai/` (`planTypes.ts`, `AIContextBuilder`, `AIReferenceResolver`, `AIPromptParser`, `AIPlanBuilder`, `AIPlanValidator`, `AIOperationExecutor`, `providers/{AIProvider,RuleBasedAIProvider}`, `workers/AIWorkerClient`): structured multi-step plans with mandatory preview/confirm, deterministic object-reference resolution (selected/named/first-second-last/largest-smallest/all-of-type/viewport, warns instead of guessing on ambiguity), the real AI worker (`src/priority2/workers/ai.worker.ts`'s new `'build-plan'` branch) actually used by the live workflow (not just the health-check command) with a main-thread fallback, one `PersistentHistoryService` transaction per AI request (verified: a single Cmd+Z reverts an entire 3-operation request), and full rollback on mid-batch failure. Still rule-based, not a hosted LLM — matches PRD "out of scope: real LLM"; `AIProvider` interface supports adding one later without touching call sites, but no `BrowserModelAIProvider`/`RemoteAIProvider` are stubbed in (deliberately — an unused stub is worse than no stub). |
| 13 | Version Control | Implemented, no diff UI | `DiffEngine.ts` exists but `VersionHistoryPanel.vue` has no diff/conflict visualization wired in. Priority 2 adds persistent 3-way merge with conflict detection (`ours`/`theirs`), also without a UI. |
| 14 | Binary Storage | Implemented | `priority2/storage/BinaryBlockStore` — 64 KiB content-addressed chunking, dedup, GC. |
| 15 | Performance | Partial | Only viewport culling + FPS/render-time tracking exist. **No LRU cache, no object pooling, no verified virtualization for millions of objects.** |
| 16 | Service Workers / PWA | Implemented, with a known bug | `public/sw.js` is a real production service worker with a manifest. **`manifest.webmanifest` references `/icon-192.png` and `/icon-512.png`, neither file exists** — PWA install icon is broken. |
| 17 | Multi-threading | Implemented | Real dedicated workers live under `priority2/workers/`, not the original `src/workers/{crdt,export,render}-worker/` skeleton (those are empty stubs — safe to delete or repurpose). |
| 18 | Custom State Manager | Implemented, scoped to Priority 2 | `priority2/state/ReactiveStateManager` provides selectors/transactions/undo/time-travel, but only manages Priority 2 runtime state — it does not replace or wrap the app's 14 Pinia stores. |
| 19 | Monitoring Dashboard | **Complete and integrated** | `app/stores/monitoring.ts`, `useMonitoring.ts` (registers Cmd/Ctrl+Shift+M), `StatCard.vue`, `MonitoringDashboard.vue`, mounted in `app/app.vue`. |
| 20 | Export System | Implemented | PNG/SVG/JSON native + PDF/HTML/ZIP via Priority 2, registered into the same `ExporterRegistry` at runtime. Image objects still export as grey placeholder rectangles (asset rendering limitation, same root cause as #8). |
| 21 | UI Shell, Navigation & Theming *(not in original 20-module brief — added 2026-07-05)* | **Implemented** | Persistent sidebar nav (`AppSidebar.vue`) exposing every module (Canvas, Layers, Project Explorer, Assets, AI Workflow, Collaboration, History, Version Control, Plugins, Monitoring, Export, Command Palette, Settings) as real-icon (`lucide-vue-next`), discoverable buttons — replacing the old status-bar-only entry points for Collaboration/Plugins and the total absence of any History or Settings UI. Full light+dark theme system (`uiPreferences` store, `useTheme.ts`, `:root[data-theme="light\|dark"]` tokens in `main.css`, persisted to `localStorage`, flash-of-wrong-theme prevented by an inline head script in `nuxt.config.ts`). **No client-side routing was added** — URL stays `/`; navigation is a Pinia-derived `activeScreen` getter (`stores/navigation.ts`) over each feature's own existing open/close boolean, and `EditorShell` (canvas/toolbar/status bar) is never unmounted (`v-show`, not `v-if`) so CRDT/autosave/worker lifecycles are never at risk — this was a deliberate, audited decision (real Nuxt page nav would `v-if`-unmount `CanvasWorkspace` and destroy the shared CRDT doc, see Known Deviations #6). AI Workflow/Version History/Monitoring/Export/Collaboration/Plugins panels were restyled from small centered modals into full-screen pages **in place** (same script logic, same store actions — zero business-logic changes) using a shared `PageHeader.vue`; History and Settings are genuinely new screens reading real data (`PersistentHistoryService.historyEntries`, `uiPreferences`) with no fabricated content. Fixed in passing: a duplicate `<ProjectExplorer>` mount (was rendered by both `EditorShell.vue` and the new shell) and a real SSR/Pinia hydration bug (see Known Deviations #8). **Deliberately deferred** (per explicit user scope decision): deeper pre-existing glyph icons — command-palette per-command icon strings (`builtInCommands.ts`/`layerCommands.ts`/`aiCommands.ts`) and `LayerTreeNode.vue`'s per-object-type glyphs — were left as Unicode/emoji, not swapped to `lucide-vue-next`, to keep this pass scoped to new chrome + high-visibility areas. Also out of scope, documented not fixed: the infinite canvas's own grid/background (`GridRenderer.ts`) is drawn via hardcoded hex in the rendering engine and does not respond to the theme toggle (see Known Deviations #8) — touching it would violate the explicit "don't change canvas rendering" boundary for this pass. |

---

# Known Deviations / Risks

1. **Backend constraint violated — RESOLVED 2026-07-05.** `server/routes/collab-signal.ts` (Nitro WebSocket handler) and `scripts/signaling-server.mjs` (standalone Node process) implement a real server-side signaling relay for WebRTC, which contradicted "no traditional backend / completely frontend." Fix applied: manual SDP-token signaling (`priority2/collaboration/ManualCollaborationSession.ts`) is now wired into the main `CollaborationPanel.vue` UI as the default "Direct Link (No Server)" tab (previously only reachable via command palette). `npm run dev` no longer auto-starts the signaling server — `package.json`'s `dev` script is now `nuxt dev` only. The server files are kept, unused by default, behind a new opt-in script `npm run dev:with-signaling`, exposed as a secondary "Local Network Room" tab in the same panel. See "How to verify" below.
2. **Scene-edit crash that silently froze the UI — RESOLVED 2026-07-05.** `structuredClone()` throws on Vue's reactive Proxy-wrapped arrays. `PersistentHistoryService.schedule()` (and 3 copy-pasted `clone()` helpers in `ReactiveStateManager.ts`, `PersistentVersionControl.ts`, `app/plugins/priority2.client.ts`) called `structuredClone(scene.objects)` directly on the live Pinia-store array. The throw happened inside a `watch(() => scene.objects, ...)` callback and escaped far enough to abort Vue's scheduler flush for that tick — so the store's data was correct in memory, but dependent re-renders (layer panel count, canvas) silently never happened. Reproduced with **zero collaboration involved**: new project → draw one shape → shape vanishes from the UI (though it's still in the store). Fixed by wrapping each `structuredClone` call in try/catch with a JSON round-trip fallback (JSON reads through Proxies fine). This was very likely the actual reason "nothing seemed to sync between browsers" — if the local edit doesn't reliably reach the screen, it can look identical to a sync failure. Verified: `npx nuxi typecheck` clean, `npm run test` 272/272, and a two-peer Playwright test where host draws a rectangle and guest draws an ellipse — both peers end up with both shapes, confirmed via screenshot pixel comparison.
3. `docs/architecture/overview.md` and `docs/modules/module-log.md` are empty despite being referenced by the doc folder structure — never written.
4. `tests/e2e/` is empty — no end-to-end tests exist yet.
5. Empty stub files across the tree (`src/plugins/{index,plugin-api}.ts`, `src/collaboration/{crdt,presence}/index.ts`, `src/workers/{crdt,export,render}-worker/worker.ts`, `src/service-worker/sw.ts`, `src/state-manager/*`, `src/services/*`, `src/storage/version-control/index.ts`, plus `.gitkeep` placeholders) — harmless, but should eventually be deleted or filled to avoid confusing future contributors about where real code lives.
6. **`useCollaboration()` is called redundantly in three separate components** (`app.vue`, `CollaborationPanel.vue`, `CanvasWorkspace.vue`), each spinning up its own independent CRDT-doc-lifecycle watcher. Observed effect: creating one project triggers 3 sequential `crdtService.destroy()`/`create()` cycles and leaves 2 stale, never-torn-down `startSceneSync` bindings pointing at destroyed Yjs docs (wasted work, not currently known to corrupt data, but fragile). Not yet fixed — should be refactored to a single shared collaboration-lifecycle owner (e.g. only `app.vue`) with the other two consuming its state instead of calling `useCollaboration()` themselves.
7. **Project save silently failed for every project (not just Layer Management ones) — RESOLVED 2026-07-05.** `IndexedDBService.set()` passed values straight to `IDBObjectStore.put()`, which uses the browser's structured-clone algorithm internally — the same algorithm that throws `DataCloneError` on Vue's reactive Proxy-wrapped objects (the exact class of bug already fixed elsewhere per Known Deviations #2's `clone()` helpers, but never applied here). Since `project.saveProject()` (both the manual "Save Project" command and `useAutosave.ts`'s debounced watcher) always passes the live reactive `scene.objects` array, **every save silently failed** — caught by an empty `catch {}` in `app/stores/project.ts`'s `saveProject()`, so it never surfaced as a console error, just a "Save failed" status message easy to miss. This was discovered while verifying that Layer Management's group/folder hierarchy survives a reload — reload showed 0 objects even after an explicit save. Fixed by adding the same try-structuredClone/catch-JSON-round-trip pattern to `IndexedDBService.ts`'s generic `set()` (as `cloneForStorage()`), applied uniformly to the `projects`/`project-meta`/`assets` stores — safe for asset `Blob` records too, since those are never Proxy-wrapped and always succeed on the first `structuredClone()` attempt. Verified: saved a project with a group + folder, reloaded the page, reopened the project via the Project Explorer — hierarchy intact, 0 console errors.
8. **UI redesign (2026-07-05) surfaced two real bugs, both fixed, plus one documented limitation left alone on purpose:**
   - **Fixed — duplicate `<ProjectExplorer>` mount.** Before the redesign, `EditorShell.vue` rendered its own `<ProjectExplorer />`; the new `AppShell.vue` also needed one at the top level (so it can appear over the sidebar, not just inside the editor viewport). Having both mounted simultaneously meant every open of the project browser rendered two full overlay instances stacked on each other (same shared store, so not a data bug, but wasted DOM/listeners). Fixed by removing `ProjectExplorer` from `EditorShell.vue` — `AppShell.vue` is now its only owner.
   - **Fixed — persisted theme silently reverted to dark on every full page reload.** `uiPreferences` store's `state()` reads `localStorage` to resolve the initial `themeMode`, but Nuxt SSR runs that `state()` server-side (no `localStorage` there), always producing the `'dark'` default; `@pinia/nuxt` then serializes that server state into the payload and the client rehydrates *from the payload*, not by re-running `state()` — so a user's persisted `'light'`/`'system'` choice was silently thrown away on reload even though `localStorage` still had the correct value. Caught by an automated Playwright pass (toggle theme → reload → theme reverted to dark). Fixed with a new client-only `hydrateFromStorage()` store action, called once from `useTheme.ts`'s `onMounted` (which only ever runs in the browser, after hydration) to re-read `localStorage` and correct the state. Covered by a new unit test (`uiPreferences.store.test.ts`) that reproduces the exact SSR-payload scenario.
   - **Not fixed, documented on purpose — the infinite canvas's own background/grid doesn't respond to the theme toggle.** `src/engine/rendering/GridRenderer.ts` hardcodes `BG_COLOR = '#0b0f17'` / `LINE_COLOR = '#1a2231'` and paints them via `ctx.fillRect`/`ctx.strokeStyle` every frame — this is rendering-engine code, explicitly out of scope for a presentation-only pass ("do not change canvas rendering" was a hard constraint for this task). The DOM/CSS layer around the canvas (`--canvas-bg` in `main.css`) *is* theme-aware, so this is purely the `<canvas>` bitmap itself staying a fixed dark neutral regardless of app theme — consistent with how several other pro tools treat their canvas surface, but worth knowing before assuming the whole app is theme-complete. A few other **pre-existing** components from before this redesign (`LayerTreeNode.vue`, `LayerToolbar.vue`, `AssetPanel.vue`, `InspectorPanel.vue`, `CanvasMinimap.vue`, brand-mark gradients in `Toolbar.vue`/`AppSidebar.vue`) also still contain a handful of hardcoded accent-tint hex values from Task 1 (Layer Management) that were out of this redesign's declared scope (`app/components/{ai,version-control,monitoring,editor/ExportDialog,collaboration,editor/PluginPanel,editor/ProjectExplorer}` plus new chrome) — left untouched per "never rewrite unrelated files"; a future chunk could migrate these to the shared token system for full light-theme parity.

---

# Remaining Work — Module-wise, in Small Chunks

Each chunk below is scoped to be completable in one focused session. Do not start a chunk without first inspecting whether it's already partially done (per Development Rule: never recreate existing work).

**Module 2 — Layer Management — DONE 2026-07-05**
- ~~Chunk 2a: Add multi-select to `app/stores/selection.ts`~~ — resolved. `selectedIds[]` added, `selectedId`/`select()`/`clear()`/`deleteSelected()` stay back-compat. Shift-click/Ctrl-click/range-select in the panel, shift-click/Ctrl+A on canvas. No marquee-select (not in spec).
- ~~Chunk 2b: Add grouping~~ — resolved. `LayerGroupingService` + `scene.groupSelected/ungroupSelected`, Ctrl/Cmd+G / +Shift+G, group-drag moves all descendants, cascade-delete for groups.
- ~~Chunk 2c: Add folder hierarchy~~ — resolved. `SceneObject.parentId` + `'folder'`/`'group'` types (not a second parallel tree), `LayerTree.vue`/`LayerTreeNode.vue` replace the flat list, native HTML5 drag-and-drop reorder/reparent.
- ~~Chunk 2d: Add blend modes + alignment tools~~ — resolved. 12 blend modes via `globalCompositeOperation` (fallback `source-over`), align ×6 + distribute ×2 in `LayerToolbar.vue` and the command palette.

**Module 3 — Browser File System**
- Chunk 3a: Add folder hierarchy for projects in `ProjectFileSystem.ts` + `ProjectExplorer.vue`.
- Chunk 3b: Add drag-and-drop import UI (file/asset drop onto explorer).

**Module 4 — History Engine**
- Chunk 4a: Verify/wire `PersistentHistoryService` into the main editor undo/redo path (`app/stores/history.ts`) so refresh-recovery actually applies to normal editing, not just Priority 2's isolated flow.

**Module 5/13 — Collaboration & Version Control UI**
- Chunk 5a: Build a conflict-resolution UI surface for CRDT/merge conflicts (data model already exists in `PersistentVersionControl`).
- Chunk 13a: Wire `DiffEngine.ts` output into `VersionHistoryPanel.vue` as an actual visual diff view.

**Module 8/20 — Asset Rendering**
- Chunk 8a: Move real thumbnail generation into `asset.worker.ts` (currently posts a placeholder and does it on the main thread).
- Chunk 20a: Replace grey placeholder rectangles with actual rendered image content in PNG/SVG/PDF export and thumbnails.

**Module 15 — Performance**
- Chunk 15a: Add an LRU cache for decoded assets/textures.
- Chunk 15b: Add object pooling for hot-path allocations in the renderer.
- Chunk 15c: Load-test and tune virtualization/culling for scenes with 100k+ objects; document actual limits.

**Module 16 — Service Workers / PWA**
- Chunk 16a: Generate and add `/public/icon-192.png` and `/public/icon-512.png` to fix the broken manifest reference.

**Module 17 — Cleanup**
- Chunk 17a: Delete or repurpose the empty stub files listed in Known Deviations #5 so the folder tree matches reality.
- Chunk 17b: Fix the triple `useCollaboration()` mount (Known Deviations #6) — consolidate to one collaboration-lifecycle owner so project switches don't churn the CRDT doc 3x and leak stale `startSceneSync` bindings.

**Documentation**
- Chunk D1: Write `docs/architecture/overview.md` (real architecture, not the planned skeleton).
- Chunk D2: Start `docs/modules/module-log.md` as a running log of module-completion entries going forward.

**Testing**
- Chunk T1: Stand up `tests/e2e/` with at least one smoke test (load app → create shape → undo → reload → verify persistence).

**Architecture decision — DONE 2026-07-05**
- ~~Chunk A1: Resolve the backend-signaling deviation~~ — resolved. Manual signaling is now the default; server signaling is opt-in via `npm run dev:with-signaling`.

**Module 21 — UI Shell & Navigation — DONE 2026-07-05**
- ~~Build persistent sidebar nav + full light/dark theme system + dedicated full-screen presentations for every module~~ — resolved, see Module Status row 21 and "How to Verify the UI & Navigation Redesign" above.
- Follow-up (deliberately deferred, not a bug): swap remaining pre-existing glyph/emoji icons — command-palette per-command icon strings (`builtInCommands.ts`/`layerCommands.ts`/`aiCommands.ts`) and `LayerTreeNode.vue`'s per-object-type glyphs — to `lucide-vue-next`, for full icon-system consistency.
- Follow-up (nice-to-have, not required for theme correctness): migrate the remaining pre-existing hardcoded accent-tint hex values in `LayerTreeNode.vue`/`LayerToolbar.vue`/`AssetPanel.vue`/`InspectorPanel.vue`/`CanvasMinimap.vue` (all from Task 1, before the theme system existed) to the shared CSS variable tokens.

---

# How to Verify the A1 Fix (Backend-Signaling Resolution)

1. `npm run dev` — confirm the terminal output shows only `nuxt dev` starting (no `node scripts/signaling-server.mjs` line, no port-4747 listener).
2. Open the app in a browser, click the **Collaborate** control in the status bar.
3. The panel should open directly on the **"Direct Link (No Server)"** tab (not "Local Network Room").
4. Click **"Start Session (Invite Someone)"** — a non-empty token appears in a textarea under "1. Send this invite to the other device", with a working **"Copy Invite"** button, and the status dot shows "Connecting…".
5. Click the **"Local Network Room"** tab — it should show the hint *"Requires the local signaling server: `npm run dev:with-signaling`"* and the original room-join UI still works if you run that script instead.
6. Open the browser console — no errors during any of the above.
7. `npx nuxi typecheck` and `npm run test` — both must stay clean (272/272 tests, 0 type errors).

This was verified end-to-end with a headless-Chromium Playwright driver against `npm run dev` on 2026-07-05: all 6 checks above passed, 0 console errors, typecheck exit 0, 272/272 tests passing.

# How to Verify Real-Time Scene Sync (Known Deviations #2 fix)

This needs two independent peers — one browser tab can't test it, each tab owns its own session:

1. `npm run dev`, open the app in two separate tabs/windows at the same URL.
2. Connect them via the "Direct Link (No Server)" flow (see above).
3. In tab A, draw a rectangle (click "Rect" in the toolbar, then click anywhere on the canvas).
4. Tab A's own Layers panel count should go to 1 (if it doesn't update even locally, the fix regressed — check the console for a `structuredClone` error).
5. Within ~1–2 seconds, tab B's Layers panel count should also become 1, with the same shape visible on its canvas.
6. Draw a different shape in tab B — it should appear in tab A too (bidirectional).
7. Neither tab's console should show `structuredClone` errors or "Unhandled error during execution of scheduler flush" warnings.

Verified with a two-peer Playwright test (host draws a rectangle, guest draws an ellipse): both peers ended up with both shapes, confirmed by comparing screenshots pixel-for-pixel.

# How to Verify Layer Management (Module 2)

1. `npm run dev`, open the app, create a project via the Project Explorer.
2. Draw 3 rectangles. The Layers panel should show 3 flat rows.
3. Switch to the Select tool, click one rectangle, then shift-click a second — both rows should show as selected in the panel, and both objects show selection outlines on canvas.
4. Press Ctrl/Cmd+G — the two selected objects should collapse into one `⧉` group row containing them as children; the group's row can be expanded/collapsed.
5. Click Undo (toolbar or Ctrl/Cmd+Z) — the group should disappear, back to 3 flat rows. Redo brings it back.
6. Click "New folder" in the Layer Toolbar — a `📁` row appears. Drag a rectangle row onto it — the rectangle should nest under the folder (indented, folder auto-expands).
7. Select the group or a rectangle, open its details (opacity slider appears), and pick a non-"normal" value from the Blend dropdown — the shape's on-canvas rendering should visibly change (e.g. `multiply` darkens overlapping colors).
8. With 2+ objects selected, click any Align button in the toolbar — the objects should snap to the same edge/center. With 3+, Distribute should equalize the gaps between them, leaving the two outermost objects in place.
9. Run the "Save Project" command (Cmd/Ctrl+Shift+P), reload the page, reopen the same project via the Project Explorer — the group and folder must both still be there (this exercises `normalizeHierarchy` + the CRDT/collab field passthrough).
10. Two-tab collaboration: connect two tabs via "Direct Link (No Server)" (see the A1 verification steps above), group two objects in tab A — tab B should receive the same group within ~1-2 seconds.

Verified 2026-07-05 via `npx nuxi typecheck` (clean), `npm run test` (349/349, including 7 new test files and the pre-existing `LayerManager.test.ts` unmodified), `npm run build` (clean), and a 16-check headless-Chromium Playwright pass covering steps 1-9 above (two-tab collaboration in step 10 was validated by design/code-path reasoning — new hierarchy fields flow through the same whole-object CRDT sync `SceneSync.ts` already uses for every other field — but not re-run as a live two-peer Playwright test in this session).

# How to Verify AI Workflow (Module 12)

1. `npm run dev`, open a project, open the AI Assistant (command palette → "Open AI Workflow").
2. Type "Create a rectangle, make it blue and center it" and click Run. A **Preview** panel must appear — summarizing 3 operations, before anything on the canvas changes.
3. Click **Apply** — one rectangle appears, blue, centered. The toolbar's Undo button's tooltip should read `Undo: AI: Create a rectangle, make it blue and center it`.
4. Press Ctrl/Cmd+Z **once** — the rectangle must disappear completely (all 3 operations revert together, not one at a time). Redo restores it.
5. Type "Delete the second circle" with no circles on the canvas — this must show a blocked/error panel (not silently do nothing or crash), and the scene must stay unchanged.
6. Start a new instruction, click Run, then click **Cancel** in the preview — the scene must be unchanged (nothing applied without an explicit Apply).
7. Try a locked object: lock a shape, select it, ask to change its color — the preview must show a warning about the locked target and still require the explicit Apply click.
8. Try a multi-step chained instruction: "Duplicate the selected object and move the copy right" — confirm the *new* duplicate moves, not the original.
9. Open the Monitoring Dashboard (Cmd/Ctrl+Shift+M) after running a few AI requests — the AI metrics should reflect parse/validation/execution durations and counts (added as a new field on the existing snapshot, not a second dashboard).
10. Save the project, reload the page, reopen it via the Project Explorer — AI-created objects must persist exactly like manually-created ones (same store actions, same autosave path, no separate AI database).
11. Confirm the pre-existing simple pipeline still works standalone: `npx vitest run tests/unit/InstructionParser.test.ts tests/integration/AIWorkflow.test.ts` — both untouched, must still pass.

Verified 2026-07-05 via `npx nuxi typecheck` (clean), `npm run test` (435/435 — 349 prior + 86 new AI Workflow tests, with the 2 pre-existing AI test files unmodified and still passing), `npm run build` (clean), and a 15-check headless-Chromium Playwright pass covering steps 1-10 above (worker usage was confirmed via code review + unit tests of `AIWorkerClient`/the new `ai.worker.ts` `'build-plan'` branch rather than instrumenting the live worker thread in the browser pass).

# How to Verify the UI & Navigation Redesign (Module 21)

1. `npm run dev`, open the app. Confirm the URL stays `/` at every step below — this redesign deliberately has no client-side routing.
2. A persistent sidebar should be visible on the left with real icons and labels for: Canvas, Layers, Project Explorer, Assets, AI Workflow, Collaboration, History, Version Control, Plugins, Monitoring, Export, Command Palette, Settings.
3. Click every nav item except Canvas/Layers/Assets/Project Explorer/Command Palette — each should replace the canvas with a full-screen page with a header (icon + title + description) and a "Back to Canvas" button. Clicking Back must always return to a fully intact canvas.
4. Draw a shape, then navigate through every single screen above and back to Canvas — the shape must still be there every time (canvas/editor DOM is never unmounted, only `v-show`-hidden).
5. Click the theme toggle (bottom of the sidebar) — it should cycle Dark → System → Light → Dark. In Light mode, the sidebar/toolbar/status bar/panels/dedicated screens should all switch to the lavender palette. (The infinite canvas's own grid/background will stay dark regardless of theme — this is a known, documented limitation, see Known Deviations #8, not a bug.)
6. Set the theme to Light, then reload the page (full refresh, not SPA navigation) — it must still show Light, not revert to Dark. This exercises the SSR-hydration fix in Known Deviations #8.
7. Open History — it must show real recorded transactions (draw a few shapes first) with working Undo/Redo buttons, no fabricated/mock entries.
8. Open Settings — theme radios, "Collapse sidebar by default", "Reduce motion", and "Reset preferences" must all work and persist across reload.
9. Resize the window down to ~700px and ~400px wide — the sidebar should collapse into a hamburger-triggered off-canvas drawer with no horizontal page overflow at either width.
10. Every existing keyboard shortcut (Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+M monitoring, Cmd/Ctrl+Shift+P command palette, Ctrl/Cmd+G group, etc.) must still work regardless of which screen is currently open.
11. Collaboration and autosave must keep working exactly as before — this pass changed only how these panels are opened/styled, not their internal logic.

Verified 2026-07-05 via `npx nuxi typecheck` (clean), `npm run test` (462/462 — 435 prior + 27 new: 2 new store test files, 3 new component test files), `npm run build` (clean), and a 30-check headless-Chromium Playwright pass covering steps 2-10 above, including a real reload-persistence check that caught and confirmed the fix for the SSR theme-hydration bug (Known Deviations #8). Manual pixel-level inspection (via a correct PNG decode, after an initial visual misread) confirmed the light theme's CSS variables resolve correctly on every DOM surface (sidebar, toolbar, panels) — only the `<canvas>` bitmap itself (rendering-engine-drawn, out of scope) stays dark.

---

# Update Protocol

This file is the single source of truth for project status and is updated automatically, without being asked, after every command that changes the project (code, docs, config, or decisions):
- After completing any chunk above, update its Module Status row and remove/check off the corresponding chunk.
- Before starting new work, re-inspect the actual files (not this doc) if there's any doubt — this doc can drift, the filesystem can't.
- Always run `npx nuxi typecheck` before marking a chunk done.
- New modules/features not covered above should get a new row in the Module Status table and, if incomplete, a new chunk list entry.
- Log every update at the bottom of this section with a one-line dated entry.

## Change Log
- 2026-07-05: Recreated this file after an accidental deletion caused by macOS case-insensitive filesystem treating `Claude.md`/`CLAUDE.md` as the same file. Added the filesystem-note and this change log.
- 2026-07-05: Resolved Chunk A1 (backend-signaling deviation). Wired `ManualCollaborationSession` into `app/components/collaboration/CollaborationPanel.vue` as the default "Direct Link (No Server)" tab; kept the existing room-join UI as a secondary "Local Network Room" tab. Changed `package.json`: `dev` script no longer starts `scripts/signaling-server.mjs`; added `dev:with-signaling` for the opt-in path. Verified via `npx nuxi typecheck` (clean), `npm run test` (272/272 passing), and a headless-Chromium Playwright smoke test of the panel UI (0 console errors).
- 2026-07-05: Fixed a bug in the A1 rollout, caught by manual testing: `RTCPeerConnection.setRemoteDescription` threw `Failed to set remote answer sdp: Called in wrong state: stable` because the "Connect" form stayed visible and clickable after a successful connection, so a second click (or resubmit) re-applied an already-consumed answer token. Fix: (1) `ManualCollaborationSession.applyAnswerToken` (`src/priority2/collaboration/ManualCollaborationSession.ts`) now no-ops if `connection.signalingState === 'stable'` instead of throwing; (2) `CollaborationPanel.vue` now renders a dedicated "connected" success view (with a Disconnect button) once `manualState === 'connected'`, replacing the host/guest forms entirely so the Connect/Generate Answer buttons can no longer be clicked post-connect. Verified with a genuine two-peer Playwright test — two separate browser contexts exchanging real offer/answer tokens end-to-end — both sides reached the "Connected" view with 0 console errors. `npx nuxi typecheck` and `npm run test` (272/272) stay clean.
- 2026-07-05: Fixed the actual "changes in one browser don't reflect in the other" report — two compounding bugs (Known Deviations #2): (1) `CollaborationPanel.vue`'s `ensureCRDT()` created an ad-hoc CRDT doc whenever no project was active, which was never bound to the scene store (`useCollaboration()`'s `activeProjectId` watcher only wires up `startSceneSync` when a project exists) — replaced with `ensureCollabProject()`, which creates a real project first so the standard binding path always runs. (2) A deeper, collaboration-unrelated bug: `structuredClone()` throws on Vue's reactive Proxy arrays, and `PersistentHistoryService.schedule()` called it directly on `scene.objects` inside a `watch()` callback; the uncaught throw aborted Vue's scheduler flush mid-cycle, so the store data was correct but the UI (layer count, canvas) silently never re-rendered — reproduced with zero collaboration involved. Fixed all 4 copy-pasted `clone()`/`cloneScene()` helpers (`PersistentHistoryService.ts`, `ReactiveStateManager.ts`, `PersistentVersionControl.ts`, `priority2.client.ts`) to fall back to a JSON round-trip on failure. Also identified but NOT yet fixed: `useCollaboration()` is mounted redundantly in 3 components, causing 3x CRDT doc churn per project switch (added as Known Deviations #6 / Chunk 17b). Verified with a two-peer Playwright test: host draws a rectangle, guest draws an ellipse, both peers converge to the same 2-object scene, confirmed via screenshot comparison. `npx nuxi typecheck` and `npm run test` (272/272) stay clean.
- 2026-07-05: Implemented Module 2 — Layer Management (Chunks 2a-2d), fully wired end-to-end. Data model: extended `SceneObject` in place with `parentId`/`expanded`/`blendMode` and `'group'`/`'folder'` types (all optional/additive — no separate parallel tree, no schema/DB version bump needed). New `src/layers/` module: `types.ts`, `LayerTreeService` (tree build, paint order, effective visibility/locked/opacity/blend-mode via ancestor walk), `LayerHierarchyService` (reparent/folders/rename), `LayerGroupingService` (group/ungroup, cascade-delete for groups vs promote-children for folders), `LayerAlignmentService` (align ×6, distribute ×2), `LayerDragDropService` (drop-target resolution for native HTML5 DnD), `layerValidation` (circular-nesting guard), `layerMigration` (`normalizeHierarchy` — idempotent flat-project + corruption repair, run on every project load, CRDT remote-replace, and version-control restore), `LayerExportUtils` (flattens to leaf-only/paint-ordered/effective-resolved objects for visual exporters only). Extended (backward-compatibly): `selection.ts` (`selectedIds[]` alongside back-compat `selectedId`), `scene.ts` (new folder/group/align/distribute/reparent/blend-mode actions, all one history transaction via the existing snapshot-before/after pattern), `LayerManager` (sibling-scoped reorder, default behavior unchanged), `hitTest.ts` (leaf-only hits, outermost-group selection + double-click drill-in), `ShapeRenderer`/`Renderer` (hierarchy-aware paint order + multi-select highlight + blend mode), `CanvasWorkspace.vue` (multi-select click rules, group-drag-moves-children, drill-in), `SceneSync.ts`/`collaboration/types.ts` (new fields sync through the existing whole-object Yjs map), `ProjectFileSystem.ts`/`versionControl.ts`/`priority2.client.ts` (normalize on every load/restore/merge), export builders (`SVGExporter`/`PNGExporter`/`SceneExportUtils` — blend mode rendered via `globalCompositeOperation`/`mix-blend-mode`), command palette (`layerCommands.ts`), new UI (`LayerTree.vue`/`LayerTreeNode.vue`/`LayerToolbar.vue` replacing the flat list in `LayerPanel.vue`), new shortcuts (`useLayerShortcuts.ts` — Ctrl/Cmd+G, +Shift+G, +A). While verifying persistence, discovered and fixed a pre-existing, unrelated bug affecting every project save (Known Deviations #7): `IndexedDBService.set()` threw `DataCloneError` on Vue's reactive Proxy-wrapped `scene.objects`, silently swallowed by an empty `catch {}` — fixed with the same structuredClone-then-JSON-round-trip pattern already used elsewhere in this codebase. Verified: `npx nuxi typecheck` clean, `npm run test` 349/349 (272 pre-existing + 77 new, `LayerManager.test.ts` unmodified and still passing), `npm run build` clean, and a 16-check headless-Chromium Playwright pass (see "How to Verify Layer Management" above).
- 2026-07-05: Implemented Module 12 — AI Workflow, full pipeline (structured plans, reference resolution, real worker usage, atomic history). Left the entire pre-existing simple pipeline (`src/ai/{types,InstructionParser,OperationGenerator,OperationExecutor,AIWorkflowService}.ts` and their 2 tests) byte-for-byte untouched — the new pipeline is purely additive, under new type names (`AIPlanOperation` instead of the pre-existing, differently-shaped `AIOperation`) to avoid any collision. New `src/ai/` modules: `planTypes.ts` (BaseAIOperation/16 operation variants/AIExecutionPlan/AIValidationError/AIEditorContext/AIWorkerRequest-Response/AIExecutionResult), `AIContextBuilder` (minimal read-only serializable scene snapshot — never a live store reference), `AIReferenceResolver` (deterministic resolution: selected/named/first-second-last/largest-smallest/all-of-type/visible/unlocked/viewport; ambiguous or unresolved references return a warning, never a silent guess), `AIPromptParser` (modular multi-step parser, splits on comma/"and"/"then", broader vocabulary than the legacy parser), `AIPlanBuilder` (assembles operations + temp-ref chaining for multi-step prompts — e.g. "create a rectangle, make it blue and center it" — via `resultRef`/`target.ref`, plus `it`/`them`/`the copy` pronoun chaining), `AIPlanValidator` (target existence incl. temp refs, numeric ranges, locked-target flags, min-selection-count, unsupported-operation/no-targets-resolved blocking), `AIOperationExecutor` (executes a plan through the *existing* scene/selection store actions only — reuses `scene.addObject/updateObject/groupSelected/alignSelected/...` verbatim, so persistence/CRDT sync are automatically unaffected — wrapped in one `PersistentHistoryService` transaction via `window.__COLLAB_PRIORITY2__` for real one-Cmd+Z-step atomicity, with full snapshot rollback + transaction cancel on any mid-batch failure), `providers/{AIProvider,RuleBasedAIProvider}` (provider abstraction; only the rule-based implementation ships — no unused Remote/BrowserModel stubs), `workers/AIWorkerClient` (real usage of `src/priority2/workers/ai.worker.ts`, previously wired but only ever exercised by a health-check command — added a new `'build-plan'` request branch there, with timeout/AbortSignal/main-thread-fallback in the client). Extended: `aiWorkflow` Pinia store (new `generatePlan/applyPlan/cancelPlan/repeatLast` actions + `planState`/`currentPlan`/`validationErrors`/`metrics`, old `execute()` untouched), `AIWorkflowPanel.vue` (added preview/warnings/apply/cancel UI, loading/parsing/applying states, kept existing design tokens), `src/monitoring/types.ts`+`monitoring.ts` (new `AISnapshot` field, same pull-based-poll pattern as every other metric category — not a second dashboard), command palette (new `src/commands/aiCommands.ts` — `ai:open-workflow` consolidated here from its previous ad-hoc registration in `app.vue`, plus new `ai:apply-plan`/`ai:cancel-plan`/`ai:repeat-last`). Verified: `npx nuxi typecheck` clean, `npm run test` 435/435 (349 prior + 86 new, both pre-existing AI test files unmodified and still passing), `npm run build` clean, and a 15-check headless-Chromium Playwright pass — critically confirming a single Cmd+Z reverts an entire 3-operation AI request (toolbar tooltip read `Undo: AI: Create a rectangle, make it blue and center it`), an unresolvable reference is blocked with a visible error panel instead of silently no-op'ing, cancelling a preview never touches the scene, and AI-created objects persist across save/reload exactly like manual edits.
- 2026-07-05: Implemented Module 21 — UI & Navigation Redesign (new persistent sidebar shell, full light/dark theme system, dedicated full-screen presentations for every module). Audited first and deliberately rejected real Nuxt page routing (`vue-router`/`NuxtPage`) as unsafe, since `useCollaboration()` is already triple-mounted with an `onUnmounted` that destroys the shared CRDT doc (Known Deviations #6) — real page navigation would `v-if`-unmount `CanvasWorkspace` and trigger that teardown. Instead built navigation as a purely internal Pinia-derived `activeScreen` getter (`app/stores/navigation.ts`, derived from each feature store's own existing boolean, not a second independent piece of state) with `EditorShell` kept permanently mounted via `v-show`. New: `app/stores/{navigation,uiPreferences,collaborationUI,pluginUI}.ts`, `app/composables/{useTheme,useHistoryEntries}.ts`, `app/components/app-shell/{AppShell,AppSidebar,NavigationItem,ThemeToggle,PageHeader}.vue`, `app/components/history/HistoryScreen.vue` + `app/components/settings/SettingsScreen.vue` (both genuinely new, no prior UI existed), one additive `historyEntries` getter on `PersistentHistoryService`. Added `lucide-vue-next` and used it in all new chrome plus `Toolbar.vue`/`StatusBar.vue`/`ProjectExplorer.vue`/`CommandPalette.vue` (per explicit user scope decision: "new chrome + high-visibility areas", not a full icon-system sweep). Restyled `AIWorkflowPanel`/`VersionHistoryPanel`/`MonitoringDashboard`/`ExportDialog`/`CollaborationPanel`/`PluginPanel` from centered modals into full-screen pages **in place** (dropped `MonitoringDashboard`'s old draggable-floating-card behavior — doesn't apply full-screen; kept its exact polling logic unchanged) — zero changes to any of their business logic, store actions, or existing tests. `CollaborationPanel.vue`/`PluginPanel.vue` converted from a local `ref(false)` + `defineExpose` pattern to the two new tiny UI stores so the sidebar can open them too; `StatusBar.vue` updated to call the stores directly instead of holding template refs to two now-shared component instances. Migrated every hardcoded hex color in the converted panels (plus `ConnectedUsers.vue`, `CommandPalette.vue`, `ProjectExplorer.vue`) to the existing CSS variable token system, added a `:root[data-theme="light"]` palette to `main.css` (existing dark values kept byte-for-byte), plus new `--nav-rail-width`/`--success-soft`/`--warning-soft`/`--danger-soft` tokens and an explicit `[data-reduced-motion="true"]` rule for the new Settings toggle (previously only the OS-level `prefers-reduced-motion` media query existed). Fixed two real bugs found during manual verification (see Known Deviations #8): a duplicate `<ProjectExplorer>` mount, and a genuine SSR/Pinia-hydration bug where a persisted light/system theme choice silently reverted to dark on every full page reload (fixed with a client-only `hydrateFromStorage()` action called from `useTheme.ts`'s `onMounted`). Documented, left unfixed on purpose: the infinite canvas's own grid/background is drawn via hardcoded hex directly in `src/engine/rendering/GridRenderer.ts` and does not respond to the theme toggle — out of scope for a presentation-only pass. Added `tests/unit/{navigation,uiPreferences}.store.test.ts` and `tests/component/{NavigationItem,ThemeToggle,PageHeader}.test.ts` (first Vue component tests in this repo; added `@vitejs/plugin-vue` + a `~/components` alias to `vitest.config.ts` to support them). Verified via `npx nuxi typecheck` (clean), `npm run test` (462/462 — 435 prior + 27 new, zero regressions), `npm run build` (clean), and a 30-check headless-Chromium Playwright pass covering theme persistence across reload, every nav screen opening real content with a working Back button, canvas/editor state surviving navigation through all 9 screens, existing keyboard shortcuts still working, and no horizontal overflow at 700px/400px — see "How to Verify the UI & Navigation Redesign" above.
