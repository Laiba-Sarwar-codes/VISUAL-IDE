// tests/unit/SceneObjectFactory.test.ts
import { describe, it, expect } from 'vitest'
import { createSceneObject } from '../../src/engine/scene-graph/createSceneObject'

describe('createSceneObject', () => {
  it('creates a rectangle with correct defaults', () => {
    const obj = createSceneObject({ type: 'rectangle' }, 0)
    expect(obj.type).toBe('rectangle')
    expect(obj.width).toBe(120)
    expect(obj.height).toBe(80)
    expect(obj.fill).toBe('#3b82f6')
    expect(obj.visible).toBe(true)
    expect(obj.locked).toBe(false)
    expect(obj.opacity).toBe(1)
    expect(obj.rotation).toBe(0)
  })

  it('creates an ellipse with green fill', () => {
    const obj = createSceneObject({ type: 'ellipse' }, 0)
    expect(obj.type).toBe('ellipse')
    expect(obj.fill).toBe('#22c55e')
  })

  it('creates text with transparent fill and text field', () => {
    const obj = createSceneObject({ type: 'text' }, 0)
    expect(obj.type).toBe('text')
    expect(obj.fill).toBe('transparent')
    expect(obj.text).toBe('Text')
  })

  it('creates image with assetId when provided', () => {
    const obj = createSceneObject({ type: 'image', assetId: 'asset-123' }, 0)
    expect(obj.type).toBe('image')
    expect(obj.assetId).toBe('asset-123')
  })

  it('respects custom position overrides', () => {
    const obj = createSceneObject({ type: 'rectangle', x: 200, y: 150 }, 0)
    expect(obj.x).toBe(200)
    expect(obj.y).toBe(150)
  })

  it('respects custom size overrides', () => {
    const obj = createSceneObject({ type: 'rectangle', width: 300, height: 200 }, 0)
    expect(obj.width).toBe(300)
    expect(obj.height).toBe(200)
  })

  it('respects custom fill override', () => {
    const obj = createSceneObject({ type: 'rectangle', fill: '#ff0000' }, 0)
    expect(obj.fill).toBe('#ff0000')
  })

  it('assigns zIndex from nextZIndex parameter', () => {
    const obj = createSceneObject({ type: 'rectangle' }, 5)
    expect(obj.zIndex).toBe(5)
  })

  it('generates a unique id', () => {
    const a = createSceneObject({ type: 'rectangle' }, 0)
    const b = createSceneObject({ type: 'rectangle' }, 0)
    expect(a.id).not.toBe(b.id)
  })

  it('generates a name from type and index', () => {
    const obj = createSceneObject({ type: 'rectangle' }, 3)
    expect(obj.name).toContain('Rectangle')
  })

  it('text field is undefined for non-text objects', () => {
    const obj = createSceneObject({ type: 'rectangle' }, 0)
    expect(obj.text).toBeUndefined()
  })

  it('assetId is undefined for non-image objects', () => {
    const obj = createSceneObject({ type: 'rectangle' }, 0)
    expect(obj.assetId).toBeUndefined()
  })
})