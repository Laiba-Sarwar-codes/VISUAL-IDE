# Version 1.1 — UI and Canvas Stabilization

## Problem

The editor was rendered as vertically stacked, mostly unstyled HTML and the canvas did not occupy the available workspace. The main cause was a production service worker being registered during Nuxt development and caching `/_nuxt/` development resources with a cache-first strategy. Nuxt/Vite development CSS and JavaScript URLs are mutable virtual resources, so stale cached responses could prevent component styles from loading correctly.

The original editor layout also depended heavily on component-scoped flex rules. When those styles were stale or unavailable, the editor collapsed into normal document flow and the canvas received an unreliable size.

## Fixes

### Service worker

- Service-worker registration is now production-only.
- Development startup unregisters service workers on the current origin and deletes only caches beginning with `collab-ide-`.
- The production service worker uses a versioned `collab-ide-v2` cache.
- Nuxt/Vite development resources, HMR streams, virtual modules and source maps are never intercepted.
- Navigation uses network-first behavior.
- Production `/_nuxt/` assets use cache-first behavior with destination/content-type validation.
- Stale application caches are deleted during activation.
- Registration update timers and listeners are cleaned up.

### Application layout

- Replaced the editor shell with a strict full-screen CSS Grid:
  - fixed toolbar
  - left layers/assets sidebar
  - `minmax(0, 1fr)` canvas workspace
  - right inspector
  - fixed status bar
- Added global minimum-size safeguards so the canvas cannot collapse.
- Added independent sidebar scrolling and responsive side-panel overlays.
- Added panel toggle controls in the toolbar.

### Canvas

- Added reliable deferred canvas sizing with `nextTick`, `requestAnimationFrame` retries and `ResizeObserver`.
- Prevented zero-width and zero-height resize writes.
- Synchronized project/command camera state back into the real camera instance.
- Added a clear infinite-canvas badge, an empty-canvas guide and a more visible dark grid.
- Restricted the stress-test overlay to development builds.

### Visual system

- Added a centralized dark design-token system in `app/assets/css/main.css`.
- Rebuilt the toolbar, layers panel, asset panel, inspector and status bar with consistent spacing, borders, states, focus styles and responsive behavior.
- Added accessible names to icon-only controls.
- Added global modal backdrop and shadow polish.
- Added reduced-motion handling and custom scrollbars.

## Main files changed

- `app/assets/css/main.css`
- `app/plugins/pwa.client.ts`
- `public/sw.js`
- `app/components/editor/EditorShell.vue`
- `app/components/editor/Toolbar.vue`
- `app/components/canvas/CanvasWorkspace.vue`
- `app/components/panels/LayerPanel.vue`
- `app/components/panels/AssetPanel.vue`
- `app/components/editor/InspectorPanel.vue`
- `app/components/editor/StatusBar.vue`
- `src/engine/rendering/GridRenderer.ts`

## Verification

The following commands pass:

```bash
npx nuxi typecheck
npm test -- --run
npm run build
```

Test result: 17 test files and 248 tests passed.

The Nuxt development HTML was also checked and confirmed to include the new global stylesheet and all component styles. The production build generated the updated consolidated CSS bundle successfully.

## One-time browser cleanup

A browser that previously opened the broken localhost version may still have the old service worker. On the first run of Version 1.1:

1. Open Chrome DevTools.
2. Go to **Application → Service Workers**.
3. Click **Unregister** for localhost.
4. Go to **Application → Storage** and click **Clear site data**.
5. Stop the old development server.
6. Delete `.nuxt` and `.output`.
7. Start the updated project and hard-refresh.

After this one-time cleanup, the new development plugin prevents the stale-service-worker issue from returning.

## Remaining limitations

- The editor is desktop-first. Sidebars switch to overlay behavior on small screens, but this is not a separate mobile editor.
- The development stress test is still available in development mode by design.
- This release stabilizes and redesigns the existing UI; it does not implement the later Priority 2 PDF requirements.
