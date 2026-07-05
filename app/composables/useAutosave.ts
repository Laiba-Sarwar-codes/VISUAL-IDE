// app/composables/useAutosave.ts
// V1: Autosave uses real camera state from editor store (x, y, zoom)

import { watch } from 'vue'
import { useSceneStore } from '~/stores/scene'
import { useProjectStore } from '~/stores/project'
import { useEditorStore } from '~/stores/editor'

export function useAutosave() {
  const scene = useSceneStore()
  const project = useProjectStore()
  const editor = useEditorStore()

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    () => scene.objects,
    () => {
      if (!project.activeProjectId) return
      project.markUnsaved()

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        // V1: save actual camera x, y, zoom — not hardcoded zeros
        await project.saveProject(
          scene.objects,
          { x: editor.cameraX, y: editor.cameraY, zoom: editor.zoom },
          editor.activeTool
        )
      }, 2000)
    },
    { deep: true }
  )
}
