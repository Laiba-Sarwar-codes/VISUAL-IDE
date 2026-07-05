# Priority 2 Usage

The existing Version 1.1 interface is unchanged. Priority 2 features are exposed through the existing command palette so no toolbar, panel, component or CSS file needed modification.

Open the command palette with the existing shortcut and search for the commands below.

## Cross-device collaboration

1. On device A, run **Collaboration: Create Cross-Device Offer**.
2. Send the copied offer token to device B.
3. On device B, run **Collaboration: Accept Cross-Device Offer** and paste the offer.
4. Send the copied answer token back to device A.
5. On device A, run **Collaboration: Apply Cross-Device Answer**.
6. Wait for the status message to report `connected`.

This is a backend-free, non-trickle WebRTC handshake. STUN is configured. Restrictive networks may still need TURN, which is intentionally not bundled because TURN credentials require a deployment service.

## Persistent history

The existing toolbar Undo and Redo controls are connected at runtime to the new persistent history service. History is stored per project, batches rapid drag changes and survives browser refreshes.

## Binary block storage

Scene snapshots are automatically stored in content-addressed 64 KiB blocks. Only blocks with new hashes are written. Run **Storage: Save Deduplicated Binary Snapshot** to force a save.

## Version-control merge

1. Create commits and branches using the existing Version History panel.
2. Switch to the branch that should receive the merge.
3. Run **Version Control: Merge Branch into Current**.
4. Enter the exact source branch name.

The merge engine uses a three-way object merge. Conflicts are detected and currently resolved using the current branch (`ours`) while conflict metadata is retained in persistent storage.

## Export formats

Open the existing Export dialog. It now receives three dynamically registered exporters without any UI-file changes:

- PDF
- HTML
- ZIP

ZIP contains `project.json`, `scene.svg`, `index.html`, `README.txt` and available project assets.

## Worker health check

Run **System: Run Priority 2 Worker Health Check** to exercise the dedicated history, AI and export workers. Dedicated render, CRDT and compression workers are also available through:

```js
window.__COLLAB_PRIORITY2__.workers
```

The runtime API also exposes the binary store, persistent history, manual collaboration session, custom state manager and persistent version-control adapter.
