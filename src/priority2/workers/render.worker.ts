import type { SceneObject } from '../../engine/scene-graph/types'
import { installWorkerHandler } from './workerRuntime'

installWorkerHandler(async (request) => {
  if (request.type !== 'render-preview') throw new Error(`Unknown render worker request: ${request.type}`)
  const payload = request.payload as {
    objects: SceneObject[]
    width: number
    height: number
    background: string
  }
  if (typeof OffscreenCanvas === 'undefined') {
    return { supported: false, blob: null }
  }

  const canvas = new OffscreenCanvas(Math.max(1, payload.width), Math.max(1, payload.height))
  const context = canvas.getContext('2d')
  if (!context) return { supported: false, blob: null }

  context.fillStyle = payload.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (const object of [...payload.objects].sort((left, right) => left.zIndex - right.zIndex)) {
    if (!object.visible) continue
    context.save()
    context.globalAlpha = object.opacity
    context.fillStyle = object.fill === 'transparent' ? '#000000' : object.fill
    if (object.type === 'rectangle' || object.type === 'image') {
      context.fillRect(object.x, object.y, object.width, object.height)
    } else if (object.type === 'ellipse') {
      context.beginPath()
      context.ellipse(
        object.x + object.width / 2,
        object.y + object.height / 2,
        object.width / 2,
        object.height / 2,
        0,
        0,
        Math.PI * 2,
      )
      context.fill()
    } else if (object.type === 'text') {
      context.font = '16px sans-serif'
      context.fillText(object.text ?? 'Text', object.x, object.y + 16)
    }
    context.restore()
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return { supported: true, blob }
})
