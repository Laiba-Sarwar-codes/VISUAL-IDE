# Browser-Only Collaborative Visual IDE

> A production-grade, fully client-side collaborative canvas application — no backend required.

[![Built With](https://img.shields.io/badge/Built%20With-Nuxt%204%20%2B%20Vue%203-42b883?style=flat-square&logo=nuxtdotjs)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![CRDT](https://img.shields.io/badge/CRDT-Yjs%2013.6-orange?style=flat-square)](https://yjs.dev)
[![Tests](https://img.shields.io/badge/Tests-462%20passing-brightgreen?style=flat-square)](./tests)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-purple?style=flat-square)](./public/sw.js)

---

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│              BROWSER-ONLY COLLABORATIVE VISUAL IDE                              │
│                                                                                 │
│   Infinite Canvas  ·  Real-Time CRDT  ·  Offline-First  ·  Plugin SDK          │
│   Layer Management  ·  Version Control  ·  AI Workflow  ·  Export System       │
│                                                                                 │
│   [ Logo Placeholder — replace with project logo 192x192 px ]                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Folder Structure](#folder-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Development Mode](#development-mode)
- [Production Build](#production-build)
- [Deployment Guide](#deployment-guide)
- [Environment Variables](#environment-variables)
- [How Collaboration Works](#how-collaboration-works)
- [How History Works](#how-history-works)
- [How Version Control Works](#how-version-control-works)
- [Offline Support](#offline-support)
- [Plugin System](#plugin-system)
- [Performance Optimizations](#performance-optimizations)
- [AI Workflow](#ai-workflow)
- [Export System](#export-system)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Screenshots](#screenshots)
- [Future Improvements](#future-improvements)
- [Testing](#testing)
- [Known Issues](#known-issues)
- [License](#license)
- [Contributors](#contributors)
- [Acknowledgements](#acknowledgements)

---

## Overview

**Browser-Only Collaborative Visual IDE** is a Figma/Excalidraw-inspired, entirely client-side vector canvas application. It demonstrates a complete production-grade frontend architecture incorporating real-time CRDT-backed collaboration, offline-first persistence, Web Workers, a plugin SDK, an AI workflow engine, a version control system, and a full export pipeline — all running entirely in the browser without a traditional backend.

The project is built as a learning vehicle and Final Year Project portfolio piece, with architecture quality and code organisation modelled on professional software-engineering standards.

**Key Design Principle:** No traditional backend. All persistence is IndexedDB; all networking is WebRTC peer-to-peer with manual SDP-token signaling (no server required). An optional local WebSocket signaling server is available for development convenience only.

---

## Technology Stack

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Nuxt | 4.4.8 | Application shell, SSR config, plugin system |
| UI Library | Vue | 3.5 | Reactive component tree |
| Language | TypeScript | strict | Type-safe application code |
| State Management | Pinia | 3.0 | 18 global stores |
| CRDT Engine | Yjs | 13.6 | Conflict-free collaborative data |
| P2P Networking | WebRTC (native) | — | Peer-to-peer data channels |
| Persistence | IndexedDB (native) | — | Offline-first project storage |
| Workers | Web Workers (native) | — | Off-main-thread processing |
| Icons | lucide-vue-next | latest | UI icon system |
| Testing | Vitest | 4.1.9 | Unit and integration tests |
| Component Testing | @vue/test-utils | latest | Vue component tests |
| Test DOM | happy-dom | latest | Browser simulation |
| Build | Nuxt CLI / Nitro | latest | Development and production builds |
| Deployment | Render | — | Cloud hosting (render.yaml present) |

---

## Features

### Core Canvas
- Infinite pan-and-zoom canvas with camera model
- Grid rendering with snap guides
- Minimap for viewport navigation
- Shape creation: Rectangle, Ellipse, Line, Text (planned: in-place text edit)
- Hit testing with hierarchy-aware selection (leaf-only hits, group drill-in)
- Multi-select with Shift-click and Ctrl+A

### Layer Management (Implemented 2026-07-05)
- Hierarchical layer tree: folders + groups, extending `SceneObject` with `parentId`
- Drag-and-drop reorder and reparent (native HTML5 DnD, no additional dependency)
- Group/ungroup with cascade-delete for groups, promote-children for folders
- 12 CSS blend modes: `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`
- Inherited visibility, lock, and opacity via ancestor walk
- Align x6 and distribute x2 (equal-gap, requires 3+ objects)
- Full undo/redo integration — one transaction per multi-object operation

### Collaboration
- Real-time CRDT-backed scene synchronisation via Yjs
- Default path: manual SDP-token signaling — no server required
- Optional: WebSocket signaling relay for local development (`npm run dev:with-signaling`)
- Presence awareness (cursor positions, connected users)
- Offline queue with automatic sync on reconnect

### History Engine
- In-memory undo/redo via `HistoryManager`
- Persistent history via `PersistentHistoryService` (IndexedDB-backed transactions/batching)
- Crash recovery: history survives page reload
- Full History screen UI with real transaction log

### Version Control
- Named snapshots/commits with `SnapshotManager`
- 3-way merge with conflict detection (`ours`/`theirs`) via `PersistentVersionControl`
- `DiffEngine` computes structural diffs between snapshots
- Note: No visual diff UI is currently wired in the panel

### AI Workflow (Implemented 2026-07-05)
- Multi-step natural language operation plans
- Mandatory preview-and-confirm before any canvas mutation
- Deterministic object-reference resolution (selected, named, first/last, all-of-type, viewport)
- Atomic history: a single Cmd+Z reverts an entire AI request
- Rollback on mid-batch failure
- Rule-based engine — no external LLM required; `AIProvider` interface ready for future integration

### Export System
- PNG — canvas rasterisation
- SVG — structural vector export
- JSON — full scene graph with hierarchy
- PDF — Priority 2 builder
- HTML — standalone single-file export
- ZIP — all assets bundled

### Plugin SDK
- `PluginRegistry` and `PluginContext` with lifecycle hooks
- Demo plugin included
- Extensible without modifying core engine

### Command Palette
- Fuzzy search across all registered commands
- Category grouping, keyboard navigation
- `Ctrl/Cmd + Shift + P` shortcut

### Monitoring Dashboard
- FPS monitor and memory monitor
- Real-time performance snapshot
- `Ctrl/Cmd + Shift + M` shortcut

### UI Shell and Theming (Implemented 2026-07-05)
- Persistent sidebar navigation rail — all 13 modules discoverable
- Full light and dark theme system with CSS custom property tokens
- SSR-safe theme persistence (flash-of-wrong-theme prevented)
- Responsive: collapses to hamburger drawer below 860px
- URL never changes — navigation is internal Pinia state (intentional design, see Architecture section)

### Offline / PWA
- Custom `public/sw.js` service worker with network-first caching
- `manifest.webmanifest` for installability
- Note: PWA icon files (`/icon-192.png`, `/icon-512.png`) are currently missing — install icon is broken

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Single Origin)                     │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │  Vue 3 UI    │   │  Pinia       │   │  Canvas Engine       │   │
│  │  Components  │◄──│  18 Stores   │──►│  Renderer + Camera   │   │
│  └──────────────┘   └──────────────┘   └──────────────────────┘   │
│          │                  │                      │                │
│          ▼                  ▼                      ▼                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │  Command     │   │  History     │   │  Scene Graph         │   │
│  │  Palette     │   │  Engine      │   │  (SceneObject tree)  │   │
│  └──────────────┘   └──────────────┘   └──────────────────────┘   │
│          │                  │                      │                │
│          ▼                  ▼                      ▼                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │  Plugin SDK  │   │  IndexedDB   │   │  CRDT Engine (Yjs)   │   │
│  └──────────────┘   │  Storage     │   │  + WebRTC Networking  │   │
│                     └──────────────┘   └──────────────────────┘   │
│                             │                      │                │
│          ┌──────────────────┘                      │                │
│          ▼                                         ▼                │
│  ┌──────────────┐                      ┌──────────────────────┐   │
│  │  Web Workers │                      │  Remote Peers        │   │
│  │  (Priority2) │                      │  (WebRTC P2P)        │   │
│  └──────────────┘                      └──────────────────────┘   │
│          │                                                          │
│          ▼                                                          │
│  ┌──────────────┐                                                  │
│  │  Service     │                                                  │
│  │  Worker/PWA  │                                                  │
│  └──────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

1. **No URL-based routing.** Nuxt page navigation would `v-if`-unmount `CanvasWorkspace`, destroying the shared Yjs document and CRDT lifecycle. Navigation is implemented as a Pinia-derived `activeScreen` getter. The canvas is hidden with `v-show`, never unmounted.

2. **No traditional backend by default.** WebRTC signaling uses manual SDP-token exchange (`ManualCollaborationSession`). Peers share offer/answer tokens out-of-band. The optional Nitro WebSocket relay is opt-in only.

3. **Two implementation layers.** `src/` contains the core architecture. `src/priority2/` is an additive enhancement layer providing persistent history, persistent version control, extended export formats, content-addressed binary storage, and a worker pool — all registered at runtime via `app/plugins/priority2.client.ts`.

4. **CRDT as the source of truth for collaboration.** Scene changes flow: Pinia store → Yjs document → WebRTC data channel → remote Yjs document → remote Pinia store.

---

## Folder Structure

```
VISUAL-IDE/
│
├── app/                          # Nuxt application layer
│   ├── components/               # Vue SFC components (13 feature folders)
│   │   ├── ai/                   # AI Workflow panel
│   │   ├── canvas/               # Canvas workspace, toolbar, status bar
│   │   ├── collaboration/        # Collaboration panel, connected users
│   │   ├── command-palette/      # Command palette UI
│   │   ├── editor/               # Editor shell, inspector, project explorer
│   │   ├── history/              # History screen
│   │   ├── layers/               # Layer tree, layer toolbar
│   │   ├── monitoring/           # Monitoring dashboard, stat cards
│   │   ├── panels/               # Generic panel wrappers
│   │   ├── settings/             # Settings screen
│   │   ├── version-control/      # Version history panel
│   │   └── app-shell/            # AppShell, AppSidebar, NavigationItem,
│   │                             # ThemeToggle, PageHeader
│   ├── composables/              # Vue composables
│   │   ├── useAutosave.ts        # Debounced autosave watcher
│   │   ├── useHistoryShortcuts.ts
│   │   ├── useLayerShortcuts.ts  # Ctrl+G, Ctrl+Shift+G, Ctrl+A
│   │   ├── useTheme.ts           # Applies data-theme to <html>
│   │   ├── useHistoryEntries.ts  # Polls PersistentHistoryService
│   │   └── ...
│   ├── stores/                   # 18 Pinia stores
│   │   ├── scene.ts              # Canvas scene objects
│   │   ├── selection.ts          # Multi-select (selectedIds[])
│   │   ├── history.ts            # In-memory history
│   │   ├── project.ts            # Project CRUD
│   │   ├── navigation.ts         # activeScreen derivation
│   │   ├── uiPreferences.ts      # Theme, sidebar, motion
│   │   ├── collaborationUI.ts    # Collaboration panel open state
│   │   ├── pluginUI.ts           # Plugin panel open state
│   │   ├── aiWorkflow.ts         # AI plan state and metrics
│   │   ├── monitoring.ts         # Performance snapshot store
│   │   └── ...                   # (export, versionControl, asset,
│   │                             #  commandPalette, offline, pwa, plugins)
│   ├── plugins/                  # Nuxt runtime plugins
│   │   ├── pwa.client.ts         # PWA registration
│   │   └── priority2.client.ts   # Priority 2 runtime registration
│   └── app.vue                   # Application root
│
├── src/                          # Core engine and services
│   ├── ai/                       # AI Workflow engine
│   │   ├── planTypes.ts          # AIExecutionPlan, 16 operation variants
│   │   ├── AIContextBuilder.ts   # Read-only scene snapshot
│   │   ├── AIReferenceResolver.ts# Deterministic object reference resolution
│   │   ├── AIPromptParser.ts     # Multi-step NL prompt parser
│   │   ├── AIPlanBuilder.ts      # Operation assembly and temp-ref chaining
│   │   ├── AIPlanValidator.ts    # Plan validation before execution
│   │   ├── AIOperationExecutor.ts# Atomic execution via store actions
│   │   ├── providers/            # AIProvider interface + RuleBasedAIProvider
│   │   └── workers/              # AIWorkerClient
│   ├── collaboration/            # CRDT and WebRTC
│   │   ├── CRDTService.ts        # Yjs document lifecycle
│   │   ├── document.ts           # Yjs document structure
│   │   ├── Awareness.ts          # Presence/cursor awareness
│   │   ├── SceneSync.ts          # Bidirectional scene ↔ Yjs binding
│   │   └── webrtc/               # WebRTCManager, SignalingClient,
│   │                             # PeerConnectionManager, DataChannelManager,
│   │                             # CRDTSyncBridge, PresenceManager
│   ├── commands/                 # Command palette internals
│   │   ├── CommandRegistry.ts
│   │   ├── fuzzySearch.ts
│   │   └── builtInCommands.ts
│   ├── engine/
│   │   ├── history/              # HistoryManager (in-memory)
│   │   ├── layers/               # LayerManager (z-index)
│   │   ├── performance/          # Culling, FPS, bounds, viewport
│   │   ├── rendering/            # Camera, Renderer, CanvasController,
│   │   │                         # RenderLoop, GridRenderer, ShapeRenderer,
│   │   │                         # SnapGuides, coordinates
│   │   └── scene-graph/          # createSceneObject, hitTest,
│   │                             # SelectionManager, types
│   ├── layers/                   # Layer Management module (2026-07-05)
│   │   ├── types.ts              # BlendMode enum
│   │   ├── LayerTreeService.ts   # Tree build, paint order, inheritance
│   │   ├── LayerHierarchyService.ts
│   │   ├── LayerGroupingService.ts
│   │   ├── LayerAlignmentService.ts
│   │   ├── LayerDragDropService.ts
│   │   ├── layerValidation.ts    # Circular-nesting guard
│   │   ├── layerMigration.ts     # normalizeHierarchy
│   │   └── LayerExportUtils.ts   # Flatten for visual exporters
│   ├── export/                   # Export system
│   │   ├── ExporterRegistry.ts
│   │   └── exporters/            # PNGExporter, SVGExporter, JSONExporter
│   ├── monitoring/               # Performance monitoring
│   │   ├── MonitoringService.ts
│   │   ├── FPSMonitor.ts
│   │   ├── MemoryMonitor.ts
│   │   └── types.ts
│   ├── offline/                  # Offline-first queue
│   │   ├── CRDTUpdateQueue.ts
│   │   ├── OfflineQueue.ts
│   │   ├── SyncManager.ts
│   │   └── NetworkStatusService.ts
│   ├── plugins/                  # Plugin SDK
│   │   ├── PluginRegistry.ts
│   │   ├── PluginContext.ts
│   │   ├── demoPlugin.ts
│   │   └── types.ts
│   ├── storage/
│   │   ├── local/                # IndexedDBService, ProjectFileSystem
│   │   └── binary/               # AssetProcessor
│   ├── version-control/          # Version control
│   │   ├── VersionControlService.ts
│   │   ├── DiffEngine.ts
│   │   └── SnapshotManager.ts
│   └── workers/
│       └── asset-worker/         # asset.worker.ts
│
├── src/priority2/                # Additive enhancement layer
│   ├── collaboration/            # ManualCollaborationSession,
│   │                             # ManualSignalingToken
│   ├── export/                   # Priority2Exporters, PDFBuilder,
│   │                             # ZipWriter, SceneExportUtils
│   ├── history/                  # PersistentHistoryService
│   ├── state/                    # ReactiveStateManager,
│   │                             # Priority2RuntimeState
│   ├── storage/                  # BinaryBlockStore, Priority2Database
│   ├── version-control/          # PersistentVersionControl
│   └── workers/                  # Priority2WorkerPool + worker wrappers
│                                 # (render, compression, ai, history,
│                                 #  export, crdt)
│
├── tests/
│   ├── unit/                     # 36 test files
│   ├── integration/              # 5 test files
│   ├── component/                # 3 Vue component test files
│   └── e2e/                      # Empty — not yet started
│
├── public/
│   ├── sw.js                     # Production service worker
│   └── manifest.webmanifest      # PWA manifest
│
├── server/
│   └── routes/collab-signal.ts   # Opt-in Nitro WebSocket signaling relay
│
├── scripts/
│   └── signaling-server.mjs      # Standalone Node signaling server (opt-in)
│
├── nuxt.config.ts                # Nuxt configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vitest.config.ts              # Vitest configuration
├── render.yaml                   # Render.com deployment descriptor
├── PRD.md                        # Product Requirements Document
└── CLAUDE.md                     # Living implementation status document
```

---

## Requirements

| Requirement | Version |
|---|---|
| Node.js | 18.x or later |
| npm | 8.x or later |
| Modern browser | Chrome 108+, Firefox 110+, Edge 108+, Safari 16.4+ |

> **Note:** This application is browser-only. No database server, no API server, and no cloud service are required to run the core application.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/Laiba-Sarwar-codes/VISUAL-IDE.git
cd VISUAL-IDE

# Install dependencies
npm install
```

---

## Running Locally

### Default (no signaling server — recommended)

```bash
npm run dev
```

This starts only the Nuxt development server. Collaboration uses manual SDP-token exchange. No backend process is started.

### With optional local signaling server

```bash
npm run dev:with-signaling
```

This additionally starts `scripts/signaling-server.mjs` on port 4747. Use this only when testing WebRTC on the same machine across multiple browser tabs and you want automatic signaling without copying tokens manually.

Open the application at `http://localhost:3000`.

---

## Development Mode

The development server supports:
- Hot module replacement (HMR) for all Vue components and Pinia stores
- TypeScript type checking: `npx nuxi typecheck`
- Full test suite: `npm run test`
- Single test file: `npx vitest run tests/unit/LayerHierarchyService.test.ts`

**Development rules enforced in this project:**
- No `require()` — always ES imports
- TypeScript strict mode — `npx nuxi typecheck` must pass before any commit
- No `@types/node` in frontend code — use browser-compatible imports
- All files must be complete — no partial snippets or stubs accepted

---

## Production Build

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

The production build produces a static/server-rendered bundle in `.output/`. It is suitable for deployment to any Node.js host or as a static site (if SSR is disabled in `nuxt.config.ts`).

---

## Deployment Guide

### Render.com (configured)

The repository includes `render.yaml`. Connect your GitHub repository to Render and the service will be deployed automatically.

```yaml
# render.yaml is present in the repository root
# Build command: npm run build
# Start command: node .output/server/index.mjs
```

### Manual deployment to any Node host

```bash
# On your server
npm install
npm run build
node .output/server/index.mjs
```

### Static deployment (Vercel, Netlify, Cloudflare Pages)

Set `ssr: false` in `nuxt.config.ts` and deploy the generated `dist/` directory.

---

## Environment Variables

This application requires no environment variables for the core application. All features — persistence, collaboration, export, AI workflow — operate without any API keys or server configuration.

The optional signaling server listens on port 4747 by default. This can be adjusted in `scripts/signaling-server.mjs`.

---

## How Collaboration Works

### Default path: Manual SDP-Token Signaling

No server is involved. The two peers exchange WebRTC SDP tokens manually (copy-paste or any out-of-band channel).

```
Initiator (Host)                    Joiner (Guest)
      │                                   │
      │  1. Generate offer token          │
      │     (SDP offer encoded as text)   │
      │                                   │
      │  2. Send token out-of-band ──────►│
      │     (chat, email, etc.)           │
      │                                   │
      │                   3. Paste offer  │
      │                   4. Generate     │
      │                      answer token │
      │                                   │
      │◄── 5. Send answer token ──────────│
      │                                   │
      │  6. Apply answer token            │
      │                                   │
      │◄══════ WebRTC P2P channel ═══════►│
      │                                   │
      │◄══════ Yjs CRDT sync  ═══════════►│
```

Once connected, all scene mutations flow through Yjs:

1. User edits a shape on their canvas
2. Pinia store updates (`scene.updateObject`)
3. `SceneSync.ts` observes the store change and applies it to the local Yjs document
4. Yjs replicates the update over the WebRTC data channel
5. Remote peer's Yjs document receives and applies the CRDT update
6. Remote `SceneSync.ts` observes the Yjs change and updates the remote Pinia store
7. Remote Vue components re-render

**Conflict resolution:** Yjs CRDT semantics resolve concurrent edits automatically. No manual merge is required for property-level changes.

### Optional path: WebSocket Signaling Relay

When running `npm run dev:with-signaling`, the local Nitro WebSocket route (`server/routes/collab-signal.ts`) acts as a room-based relay. Peers join the same room code and the server forwards their SDP messages. The WebRTC connection itself is still peer-to-peer once established.

---

## How History Works

The project maintains two complementary history systems:

### In-Memory History (`HistoryManager`)

Located at `src/engine/history/HistoryManager.ts`. Operates as a traditional undo stack:
- Each canvas operation takes a `before` snapshot and an `after` snapshot
- Undo restores the `before` snapshot; redo restores the `after` snapshot
- Maximum stack depth is configurable
- Cleared on project close

### Persistent History (`PersistentHistoryService`)

Located at `src/priority2/history/PersistentHistoryService.ts`. Provides crash recovery:
- Transactions are serialised to IndexedDB after every scene change
- Batches rapid edits (debounced) into single named transactions
- On page reload, the history is rehydrated from IndexedDB
- AI Workflow operations are wrapped in a single transaction (one Cmd+Z reverts the entire AI request)
- The `HistoryScreen` UI reads real persisted transaction entries via `useHistoryEntries.ts`

---

## How Version Control Works

```
User Action
    │
    ▼
VersionControlService.createSnapshot(label)
    │
    ├─► SnapshotManager — serialises current scene to a named snapshot
    │
    ├─► DiffEngine — computes structural diff against previous snapshot
    │
    └─► PersistentVersionControl (Priority 2)
            │
            ├─► IndexedDB — stores snapshot + diff
            │
            └─► On restore: 3-way merge with conflict detection
                    ├─► 'ours' — keep local change
                    └─► 'theirs' — keep snapshot version
```

**Current limitations:**
- `DiffEngine` is implemented but its output is not yet visualised in the `VersionHistoryPanel` UI
- Conflict resolution is available in the data layer but has no UI surface

---

## Offline Support

The application is designed to function entirely offline once loaded:

1. **Service Worker** (`public/sw.js`) — caches all static assets and application shell using a network-first strategy with cache fallback.

2. **IndexedDB persistence** — all projects, history, version snapshots, and binary assets are stored locally. No data is lost during an offline session.

3. **CRDT Update Queue** (`CRDTUpdateQueue`) — collaborative edits made while offline are queued locally.

4. **Sync Manager** (`SyncManager`) — on reconnection, queued CRDT updates are replayed against the current document state.

5. **Network Status Service** (`NetworkStatusService`) — monitors connectivity and triggers sync automatically when the connection is restored.

**Known limitation:** The PWA install manifest references `/icon-192.png` and `/icon-512.png` which are currently absent from `public/`. The application installs and operates correctly, but the install prompt displays a broken icon.

---

## Plugin System

Plugins extend the application without modifying core engine files.

```typescript
// Example plugin structure
import type { Plugin } from '@/src/plugins/types'

const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  onLoad(context: PluginContext) {
    // Register commands, shapes, or UI extensions
    context.registerCommand({
      id: 'my-plugin:hello',
      label: 'Hello from My Plugin',
      execute: () => console.log('Plugin command executed')
    })
  },
  onUnload() {
    // Cleanup
  }
}
```

Plugins are registered through `PluginRegistry` and have access to a sandboxed `PluginContext` that provides read/write access to the scene, command palette, and UI extension points.

The demo plugin (`src/plugins/demoPlugin.ts`) serves as a reference implementation.

---

## Performance Optimizations

| Optimization | Status | Location |
|---|---|---|
| Viewport culling (skip off-screen objects) | Implemented | `src/engine/performance/culling.ts` |
| FPS monitoring | Implemented | `src/monitoring/FPSMonitor.ts` |
| Web Worker off-main-thread processing | Implemented | `src/priority2/workers/` |
| Content-addressed binary block storage | Implemented | `src/priority2/storage/BinaryBlockStore.ts` |
| Debounced autosave | Implemented | `app/composables/useAutosave.ts` |
| LRU texture/asset cache | Planned | — |
| Object pooling (hot-path allocations) | Planned | — |
| Verified virtualization for 100k+ objects | Planned | — |

---

## AI Workflow

The AI Workflow engine processes natural language instructions into structured operation plans without any external API or LLM.

### Pipeline

```
User Prompt
    │
    ▼
AIPromptParser — splits multi-step prompts ("create a rect, make it blue and center it")
    │
    ▼
AIContextBuilder — builds a read-only serialisable scene snapshot
    │
    ▼
AIReferenceResolver — resolves object references
    │  selected / named / first / last / all-of-type / largest / viewport
    │
    ▼
AIPlanBuilder — assembles AIExecutionPlan with temp-ref chaining
    │
    ▼
AIPlanValidator — validates before any canvas mutation
    │  (blocks locked objects, unresolvable refs, unsupported ops)
    │
    ▼
[Preview shown to user — confirm or cancel]
    │
    ▼
AIOperationExecutor — executes via existing store actions
    │  Wrapped in single PersistentHistoryService transaction
    │  Rolls back entirely on any mid-batch failure
    │
    ▼
Canvas updated
```

### Supported Reference Types

| Reference | Example prompt |
|---|---|
| Selected | "Make the selected object red" |
| Named | "Move the rectangle named 'hero'" |
| First / Last | "Delete the first circle" |
| All of type | "Scale all ellipses by 1.5x" |
| Largest / Smallest | "Bring the largest shape to front" |
| Viewport | "Group all visible objects" |

---

## Export System

| Format | Implementation | Notes |
|---|---|---|
| PNG | `PNGExporter` — canvas `toDataURL` | Image objects render as grey placeholder |
| SVG | `SVGExporter` — structural serialisation | Blend modes via `mix-blend-mode` |
| JSON | `JSONExporter` — raw scene graph | Full hierarchy preserved |
| PDF | `PDFBuilder` (Priority 2) | Vector-compatible |
| HTML | `SceneExportUtils` (Priority 2) | Standalone single-file |
| ZIP | `ZipWriter` (Priority 2) | All formats + assets bundled |

All exporters are registered in `ExporterRegistry` at startup. Priority 2 exporters are added at runtime via `app/plugins/priority2.client.ts`.

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Command Palette | `Ctrl/Cmd + Shift + P` |
| Monitoring Dashboard | `Ctrl/Cmd + Shift + M` |
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` |
| Group selected | `Ctrl/Cmd + G` |
| Ungroup | `Ctrl/Cmd + Shift + G` |
| Select all | `Ctrl/Cmd + A` |
| Pan canvas | `Space + Drag` |
| Zoom in | `Ctrl/Cmd + =` |
| Zoom out | `Ctrl/Cmd + -` |
| Zoom reset | `Ctrl/Cmd + 0` |

---

## Screenshots

> Screenshot placeholders — replace with actual application screenshots.

```
┌─────────────────────────────────────────────────────┐
│  Figure 1 — Main Canvas with Sidebar Navigation     │
│  [screenshot: canvas-main.png]                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Figure 2 — Layer Tree with Groups and Folders      │
│  [screenshot: layer-tree.png]                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Figure 3 — AI Workflow Preview Panel               │
│  [screenshot: ai-workflow.png]                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Figure 4 — Collaboration: SDP Token Exchange       │
│  [screenshot: collaboration.png]                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Figure 5 — History Screen (Persistent Transactions)│
│  [screenshot: history-screen.png]                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Figure 6 — Light Theme                             │
│  [screenshot: light-theme.png]                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Figure 7 — Demo GIF: Real-Time CRDT Sync           │
│  [demo-gif: crdt-sync.gif]                          │
└─────────────────────────────────────────────────────┘
```

---

## Future Improvements

The following items are planned or partially implemented. They are documented in `CLAUDE.md` under "Remaining Work."

| Item | Priority | Status |
|---|---|---|
| Generate PWA icons (`/public/icon-192.png`, `/icon-512.png`) | High | Planned |
| Delete or fill empty stub files in `src/` | Medium | Planned |
| Fix triple `useCollaboration()` mount (CRDT doc churn) | Medium | Planned |
| Visual diff UI in `VersionHistoryPanel` | Medium | Planned |
| End-to-end tests (`tests/e2e/`) | Medium | Not started |
| Move asset thumbnail generation to worker thread | Medium | Planned |
| LRU cache for decoded assets | Low | Planned |
| Object pooling for renderer hot path | Low | Planned |
| Ruler display on canvas | Low | Planned |
| Resize/transform handles on canvas | Low | Planned |
| In-place text editing on canvas | Low | Planned |
| Project folder hierarchy in Project Explorer | Low | Planned |
| Drag-and-drop file import UI | Low | Planned |
| Conflict resolution UI for version control | Low | Planned |
| Real LLM integration via `AIProvider` interface | Future | Interface ready |
| Swap remaining Unicode glyphs to lucide-vue-next | Low | Planned |

---

## Testing

### Test Summary

| Category | Files | Tests |
|---|---|---|
| Unit tests | 36 | ~400 |
| Integration tests | 5 | ~40 |
| Component tests | 3 | ~22 |
| E2E tests | 0 | 0 (not started) |
| **Total** | **44** | **462** |

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npx vitest run tests/unit/LayerHierarchyService.test.ts

# Run with coverage
npx vitest run --coverage

# Type check
npx nuxi typecheck
```

### Key Test Coverage Areas

- Layer Management: `LayerHierarchyService`, `LayerGroupingService`, `LayerAlignmentService`, `LayerDragDropService`, `LayerTreeService`, `layerMigration`, `SelectionMultiSelect`
- AI Workflow: `AIPromptParser`, `AIReferenceResolver`, `AIPlanBuilder`, `AIPlanValidator`, `AIOperationExecutor`, `AIWorkerClient`
- Integration: `AIWorkflow` (legacy pipeline), `AIWorkflowPlan` (new plan pipeline), `CommandRegistry`, `ExporterRegistry`, `VersionControl`
- Component: `NavigationItem`, `ThemeToggle`, `PageHeader`
- Stores: `navigation.store`, `uiPreferences.store`

---

## Known Issues

| Issue | Severity | Status |
|---|---|---|
| PWA install icon broken (`/icon-192.png` missing) | Medium | Open |
| Canvas grid does not respond to theme toggle | Low | Documented — by design |
| Triple `useCollaboration()` mount causes CRDT doc churn | Medium | Open |
| Empty stub files in `src/` may confuse contributors | Low | Open |
| No E2E test coverage | Medium | Open |
| Version control diff not visualised in UI | Low | Open |
| Asset image export renders as grey placeholder | Low | Open |

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Contributors

| Name | Role |
|---|---|
| Laiba Sarwar | Lead Developer / Architect |

---

## Acknowledgements

- [Yjs](https://yjs.dev) — CRDT framework for collaborative applications
- [Nuxt](https://nuxt.com) — Vue meta-framework
- [Pinia](https://pinia.vuejs.org) — Vue state management
- [Lucide Icons](https://lucide.dev) — Open-source icon set
- [Vitest](https://vitest.dev) — Unit testing framework
- [Excalidraw](https://excalidraw.com) — Architectural inspiration for browser-only collaborative canvas
- [Figma](https://figma.com) — UX and feature-set inspiration

---

*Last updated: 2026-07-06 | Version 1.0.0 | Documentation generated from verified repository state*
