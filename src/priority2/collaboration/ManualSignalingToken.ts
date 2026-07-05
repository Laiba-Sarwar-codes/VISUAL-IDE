export type ManualSignalType = 'offer' | 'answer'

export interface ManualSignalToken {
  version: 1
  type: ManualSignalType
  sessionId: string
  peerId: string
  description: RTCSessionDescriptionInit
  createdAt: number
}

export function encodeManualSignal(token: ManualSignalToken): string {
  const json = JSON.stringify(token)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return base64Encode(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function decodeManualSignal(encoded: string): ManualSignalToken {
  const normalized = encoded.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const binary = base64Decode(normalized + padding)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown

  if (!isManualSignalToken(parsed)) {
    throw new Error('The collaboration token is invalid or unsupported.')
  }
  return parsed
}

function isManualSignalToken(value: unknown): value is ManualSignalToken {
  if (typeof value !== 'object' || value === null) return false
  const token = value as Record<string, unknown>
  if (token.version !== 1) return false
  if (token.type !== 'offer' && token.type !== 'answer') return false
  if (typeof token.sessionId !== 'string' || !token.sessionId) return false
  if (typeof token.peerId !== 'string' || !token.peerId) return false
  if (typeof token.createdAt !== 'number') return false
  if (typeof token.description !== 'object' || token.description === null) return false
  const description = token.description as Record<string, unknown>
  return (
    (description.type === 'offer' || description.type === 'answer') &&
    typeof description.sdp === 'string'
  )
}

function base64Encode(value: string): string {
  if (typeof btoa === 'function') return btoa(value)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index)
    const second = index + 1 < value.length ? value.charCodeAt(index + 1) : Number.NaN
    const third = index + 2 < value.length ? value.charCodeAt(index + 2) : Number.NaN
    const combined = (first << 16) | ((Number.isNaN(second) ? 0 : second) << 8) | (Number.isNaN(third) ? 0 : third)
    output += alphabet[(combined >> 18) & 63]
    output += alphabet[(combined >> 12) & 63]
    output += Number.isNaN(second) ? '=' : alphabet[(combined >> 6) & 63]
    output += Number.isNaN(third) ? '=' : alphabet[combined & 63]
  }
  return output
}

function base64Decode(value: string): string {
  if (typeof atob === 'function') return atob(value)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  let buffer = 0
  let bits = 0
  for (const char of value.replace(/=/g, '')) {
    const index = alphabet.indexOf(char)
    if (index < 0) throw new Error('Invalid base64 collaboration token.')
    buffer = (buffer << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output += String.fromCharCode((buffer >> bits) & 255)
    }
  }
  return output
}
