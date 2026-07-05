// tests/unit/AIWorkerClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestPlanFromWorker, wasLastRequestServedByWorker } from '../../src/ai/workers/AIWorkerClient'
import type { AIEditorContext, AIExecutionPlan } from '../../src/ai/planTypes'

const mockBuildAIPlan = vi.fn()
let mockAvailable = true

vi.mock('../../src/priority2/workers/Priority2WorkerPool', () => {
  return {
    // Must be a regular function (not an arrow function) so `new Priority2WorkerPool()`
    // works — a constructor function that explicitly returns an object uses that
    // object as the `new` result, which arrow functions cannot do at all.
    Priority2WorkerPool: vi.fn().mockImplementation(function Priority2WorkerPoolMock() {
      return {
        get available() { return mockAvailable },
        buildAIPlan: mockBuildAIPlan,
      }
    }),
  }
})

function makeContext(): AIEditorContext {
  return {
    objects: [],
    selectedObjectIds: [],
    viewport: { left: -800, top: -450, right: 800, bottom: 450 },
    supportedObjectTypes: ['rectangle', 'ellipse', 'text', 'image', 'group', 'folder'],
    supportedBlendModes: ['normal'],
    supportedOperationTypes: [],
  }
}

const fakePlan: AIExecutionPlan = {
  id: 'plan-1', originalPrompt: 'x', summary: 'x',
  operations: [], warnings: [], requiresConfirmation: false, createdAt: Date.now(),
}

beforeEach(() => {
  mockAvailable = true
  mockBuildAIPlan.mockReset()
})

describe('requestPlanFromWorker', () => {
  it('returns the worker-built plan on success', async () => {
    mockBuildAIPlan.mockResolvedValue(fakePlan)
    const result = await requestPlanFromWorker('create a rectangle', makeContext())
    expect(result).toEqual(fakePlan)
    expect(wasLastRequestServedByWorker()).toBe(true)
  })

  it('returns null when the worker pool is unavailable', async () => {
    mockAvailable = false
    const result = await requestPlanFromWorker('create a rectangle', makeContext())
    expect(result).toBeNull()
    expect(wasLastRequestServedByWorker()).toBe(false)
  })

  it('returns null when the request times out', async () => {
    mockBuildAIPlan.mockReturnValue(new Promise(resolve => setTimeout(() => resolve(fakePlan), 200)))
    const result = await requestPlanFromWorker('create a rectangle', makeContext(), undefined, 20)
    expect(result).toBeNull()
    expect(wasLastRequestServedByWorker()).toBe(false)
  })

  it('returns null immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await requestPlanFromWorker('create a rectangle', makeContext(), controller.signal)
    expect(result).toBeNull()
  })

  it('returns null when the signal aborts mid-request', async () => {
    mockBuildAIPlan.mockReturnValue(new Promise(resolve => setTimeout(() => resolve(fakePlan), 200)))
    const controller = new AbortController()
    const promise = requestPlanFromWorker('create a rectangle', makeContext(), controller.signal)
    controller.abort()
    const result = await promise
    expect(result).toBeNull()
  })

  it('returns null (for the caller to fall back) when the worker request rejects', async () => {
    mockBuildAIPlan.mockRejectedValue(new Error('worker crashed'))
    const result = await requestPlanFromWorker('create a rectangle', makeContext())
    expect(result).toBeNull()
    expect(wasLastRequestServedByWorker()).toBe(false)
  })
})
