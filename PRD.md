# PRD — Browser-Only Collaborative Visual IDE

Product requirements document. This file describes WHAT the product must do and WHY.
For current build status, module-by-module completion, and file-level architecture, see [CLAUDE.md](./CLAUDE.md) — that file is the living status doc and gets updated after every change. This PRD stays stable and is only revised when requirements themselves change.

## 1. Vision

Develop a modern, browser-native collaborative visual IDE inspired by Canva, VS Code, and Excalidraw. The entire application must execute on the client without relying on a traditional backend or database. User projects, assets, history, and collaboration data are managed within browser capabilities (IndexedDB, Web Workers, WebRTC) while maintaining excellent responsiveness and scalability.

This is a learning project: the goal is not just to ship it, but to understand the architecture (CRDTs, custom rendering engines, worker-based multi-threading, state management) by building it from scratch.

## 2. Constraints

- **No traditional backend or database.** All persistence is client-side (IndexedDB, in-memory). All networking for collaboration is peer-to-peer (WebRTC).
- **Nuxt 4, Vue 3, TypeScript, Pinia** as the core framework/state stack.
- **TypeScript strict mode** must always pass (`npx nuxi typecheck`).
- **Browser-compatible only** — no Node-only APIs, no `@types/node` used to patch frontend type errors.
- Production-level architecture and code quality, even though this is a learning project.

> Known deviation: the current build introduces a Nitro WebSocket route (`server/routes/collab-signal.ts`) and a standalone Node signaling server (`scripts/signaling-server.mjs`) for WebRTC signaling. This contradicts the "no backend" constraint above and is tracked as an open architectural decision in CLAUDE.md rather than resolved silently.

## 3. Technology Stack

Nuxt 4 · Vue 3 · TypeScript · Pinia · IndexedDB · Web Workers · CRDT (Yjs) · WebRTC · Service Workers · OffscreenCanvas

## 4. Functional Requirements by Module

### 1. Infinite Canvas
Smooth pan/zoom, object virtualization, dirty-region rendering, high-DPI display support, snapping guides, rulers, minimap, sustained 60 FPS.

### 2. Layer Management
Hierarchical layers, folders, locking, visibility, opacity, blend modes, z-index ordering, grouping, alignment tools, multi-selection.

### 3. Browser File System
Virtual project explorer stored in IndexedDB with folders, metadata, drag-and-drop organization, import/export, autosave.

### 4. History Engine
Persistent, unlimited undo/redo using operation logs, transactions, batching, and recovery after refresh.

### 5. Collaboration Engine
Custom CRDT supporting concurrent editing, conflict resolution, presence indicators, and peer synchronization.

### 6. WebRTC Networking
Real-time collaboration across browsers using WebRTC data channels with lightweight signaling.

### 7. Offline-first Architecture
Editing, saving, and exporting remain functional without internet access; changes merge automatically after reconnect.

### 8. Asset Processing
Process images, videos, and SVGs using Web Workers. Generate thumbnails, metadata, previews, and cache assets efficiently.

### 9. Rendering Engine
Custom scene graph, diff engine, and canvas renderer that redraws only modified regions.

### 10. Plugin SDK
Third-party runtime plugins can register tools, panels, exporters, commands, and keyboard shortcuts.

### 11. Command Palette
VS Code-like fuzzy-search command launcher with categories and keyboard navigation.

### 12. AI Workflow
Convert natural-language instructions into structured editor operations, integrated with the history engine.

### 13. Version Control
Local commits, branches, merge, restore points, and visual diff — without Git.

### 14. Binary Storage
Store only changed binary blocks to minimize storage writes and improve save performance.

### 15. Performance
Optimize memory with LRU caches, object pooling, lazy loading, and virtualization for millions of objects.

### 16. Service Workers
Cache the application shell and project data for reliable offline startup (PWA).

### 17. Multi-threading
Separate UI, rendering, compression, AI, history, and asset processing into dedicated Web Workers.

### 18. Custom State Manager
Reactive architecture with computed values, selectors, persistence, transactions, undo, and time-travel debugging.

### 19. Monitoring Dashboard
Live FPS, memory usage, CPU utilization, render timings, worker timings, and object statistics.

### 20. Export System
Export projects as PNG, SVG, JSON, PDF, HTML, and ZIP, with configurable quality and metadata.

## 5. Non-Functional Requirements

- Sustained 60 FPS on the canvas under normal editing load.
- Scales to large scenes (target: millions of objects) via virtualization/culling.
- Fully usable offline; no feature (besides live peer collaboration itself) should require network access.
- Strict TypeScript with no `any`-driven type holes introduced to work around framework gaps.

## 6. Expected Deliverables

A production-ready Progressive Web App with:
- Offline capabilities
- Peer-to-peer collaboration
- Extensible plugin architecture
- Efficient custom rendering engine
- Robust client-side persistence layer
- Comprehensive documentation
- Automated testing (unit, integration, e2e)

## 7. Out of Scope

- Any server-persisted user data or accounts.
- Real LLM-backed AI (the AI Workflow module is rule-based NL→operation parsing, not a hosted model integration).
- Native mobile apps (browser-only, responsive web is the target).

## 8. Source

Requirements distilled from `Browser_Only_Collaborative_Visual_IDE_Challenge_Detailed.pdf` (project brief), supplemented by the pre-existing CLAUDE.md module framing that added Monitoring Dashboard (already module 19 in the brief, tracked separately here) and versioned enhancement rounds (see CLAUDE.md → "Priority 2 Layer").
