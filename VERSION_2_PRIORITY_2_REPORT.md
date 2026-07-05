# Version 2 — Priority 2 Systems

## Preservation guarantee

Priority 2 was added as a new Nuxt client plugin and new `src/priority2` modules. No file from the uploaded Version 1.1 project was modified or removed.

- Original files checked: **181**
- Original files changed: **0**
- Original files missing: **0**
- Verification manifest: `PRIORITY_2_ORIGINAL_FILE_HASHES.txt`

Therefore, the existing Version 1.1 UI, component templates and CSS remain byte-for-byte identical.

## Implemented Priority 2 requirements

### 1. Cross-device WebRTC signaling

Added backend-free manual signaling using copy/paste SDP tokens:

- complete ICE gathering before token generation
- offer token creation
- answer token creation
- answer application
- STUN configuration
- ordered WebRTC data channel
- initial full CRDT synchronization
- ongoing Yjs update synchronization
- remote-update echo prevention
- connection-state reporting

The commands are available in the existing command palette. No collaboration component was changed.

Limitation: highly restrictive NAT/firewall environments may require TURN. TURN credentials cannot be securely embedded in a browser-only repository.

### 2. Persistent operation history

Added per-project persistent history with:

- IndexedDB persistence
- refresh recovery
- unlimited entries at the service level
- complete before/after scene snapshots
- rapid-change batching
- explicit begin/update/commit/cancel transactions
- redo-branch truncation after a new edit
- existing toolbar and keyboard Undo/Redo integration through runtime action adapters

### 3. Custom reactive state manager

Added a framework-independent state manager supporting:

- subscriptions
- selector subscriptions
- computed selection
- partial and functional updates
- nested transactions
- persistence adapters
- undo and redo
- explicit time-travel
- configurable history limits

It manages Priority 2 runtime state instead of replacing the existing Pinia UI stores, which preserves previous behavior.

### 4. Changed-block binary storage

Added content-addressed storage with:

- fixed-size 64 KiB chunks
- SHA-256 block IDs
- cross-document deduplication
- manifest versioning
- changed-block-only writes
- full document reconstruction
- document deletion
- unreferenced-block garbage collection

Scene JSON is saved automatically to this storage and can also be forced through the command palette.

### 5. Dedicated Web Workers

Added real, separately bundled workers for:

- CRDT update merging
- compression and decompression
- AI instruction parsing
- history snapshot comparison
- export serialization
- OffscreenCanvas preview rendering

The production build confirms that all six worker bundles are generated.

### 6. Persistent local version control and merge

Added:

- repository persistence in IndexedDB
- hydration after refresh
- commit/branch/restore persistence adapters
- common-ancestor discovery
- three-way object merge
- independent-change merging
- conflict detection
- configurable `ours`/`theirs` resolution in the merge engine
- retained merge metadata
- command-palette merge workflow

The current command uses the safer `ours` strategy and reports the conflict count.

### 7. PDF, HTML and ZIP export

Added exporters registered dynamically into the existing Export dialog:

- valid PDF 1.4 vector document builder
- self-contained HTML with inline SVG and embedded scene JSON
- standards-compliant ZIP writer with CRC32 and central directory
- complete ZIP project package with JSON, SVG, HTML, README and available assets

No external package was added.

## New integration layer

`app/plugins/priority2.client.ts` is auto-loaded by Nuxt and connects all Priority 2 systems without modifying previous application files. It:

- registers new exporters
- adapts the existing history toolbar to persistent history
- persists existing version-control operations
- adds merge and cross-device commands
- stores deduplicated scene snapshots
- exposes the runtime API as `window.__COLLAB_PRIORITY2__`

## New tests

Six new test files were added for:

- custom state manager
- binary block storage
- persistent history
- merge engine
- PDF/HTML/ZIP builders
- manual signaling tokens

## Verification results

- `npx nuxi typecheck`: passed
- `npm test -- --run`: **23 test files, 272 tests passed**
- `npm run build`: passed
- Production worker bundles generated: CRDT, compression, AI, history, export and render
- Existing-file checksum comparison: **0 changes across 181 original files**

## How to use the new features

See `docs/priority2/USAGE.md`.

## Known limitations

- Manual cross-device WebRTC requires a one-time offer/answer token exchange. This honors the browser-only/no-backend constraint, but TURN is still needed on some restrictive networks.
- Merge conflicts are recorded and reported, but there is no new visual conflict-resolution panel because the requirement was to preserve the existing UI and add no UI-file changes.
- The custom state manager is used by Priority 2 runtime systems rather than replacing Pinia across the whole application. Replacing every existing store would require modifying previous files and risk changing the UI.
- The render worker provides a real OffscreenCanvas rendering path for previews. The main interactive canvas remains on its existing proven renderer because changing it would require modifying the previous canvas files.
