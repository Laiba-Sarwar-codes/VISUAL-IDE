const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function optionalTurnServer(): RTCIceServer | null {
  const urls = import.meta.env.VITE_TURN_URLS
    ?.split(',')
    .map((value: string) => value.trim())
    .filter(Boolean)

  const username = import.meta.env.VITE_TURN_USERNAME?.trim()
  const credential = import.meta.env.VITE_TURN_CREDENTIAL?.trim()

  if (!urls?.length || !username || !credential) return null
  return { urls, username, credential }
}

/**
 * Shared WebRTC configuration for both manual-token and room collaboration.
 * STUN is enough on many networks. A TURN relay can be injected at build time
 * for reliable connectivity through restrictive NATs and firewalls.
 */
export function createRTCConfiguration(): RTCConfiguration {
  const turn = optionalTurnServer()
  return {
    iceServers: turn
      ? [...DEFAULT_STUN_SERVERS, turn]
      : [...DEFAULT_STUN_SERVERS],
  }
}
