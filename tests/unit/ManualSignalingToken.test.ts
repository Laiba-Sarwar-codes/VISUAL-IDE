import { describe, expect, it } from 'vitest'
import { decodeManualSignal, encodeManualSignal } from '../../src/priority2/collaboration/ManualSignalingToken'

describe('Manual WebRTC signaling token', () => {
  it('round-trips an SDP offer', () => {
    const token = {
      version: 1 as const,
      type: 'offer' as const,
      sessionId: 'session',
      peerId: 'peer',
      description: { type: 'offer' as const, sdp: 'v=0\r\n' },
      createdAt: 123,
    }
    expect(decodeManualSignal(encodeManualSignal(token))).toEqual(token)
  })

  it('rejects malformed tokens', () => {
    expect(() => decodeManualSignal('not-a-token')).toThrow()
  })
})
