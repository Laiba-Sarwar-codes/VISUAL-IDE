export interface ZipEntryInput {
  name: string
  data: string | Uint8Array | ArrayBuffer | Blob
  modifiedAt?: Date
}

interface PreparedEntry {
  nameBytes: Uint8Array
  data: Uint8Array
  crc: number
  modifiedAt: Date
  localOffset: number
}

/** Builds a standards-compliant, uncompressed ZIP file entirely in-browser. */
export async function createZip(entries: ZipEntryInput[]): Promise<Blob> {
  const prepared: PreparedEntry[] = []
  for (const entry of entries) {
    prepared.push({
      nameBytes: new TextEncoder().encode(normalizeName(entry.name)),
      data: await toBytes(entry.data),
      crc: 0,
      modifiedAt: entry.modifiedAt ?? new Date(),
      localOffset: 0,
    })
    prepared[prepared.length - 1]!.crc = crc32(prepared[prepared.length - 1]!.data)
  }

  const localParts: Uint8Array[] = []
  let offset = 0
  for (const entry of prepared) {
    entry.localOffset = offset
    const [dosTime, dosDate] = toDosDateTime(entry.modifiedAt)
    const header = concat(
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(entry.crc),
      u32(entry.data.byteLength),
      u32(entry.data.byteLength),
      u16(entry.nameBytes.byteLength),
      u16(0),
      entry.nameBytes,
    )
    localParts.push(header, entry.data)
    offset += header.byteLength + entry.data.byteLength
  }

  const centralOffset = offset
  const centralParts: Uint8Array[] = []
  for (const entry of prepared) {
    const [dosTime, dosDate] = toDosDateTime(entry.modifiedAt)
    const header = concat(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(entry.crc),
      u32(entry.data.byteLength),
      u32(entry.data.byteLength),
      u16(entry.nameBytes.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.localOffset),
      entry.nameBytes,
    )
    centralParts.push(header)
    offset += header.byteLength
  }

  const centralSize = offset - centralOffset
  const end = concat(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(prepared.length),
    u16(prepared.length),
    u32(centralSize),
    u32(centralOffset),
    u16(0),
  )

  const blobParts: BlobPart[] = [...localParts, ...centralParts, end].map((part) =>
    part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer
  )
  return new Blob(blobParts, { type: 'application/zip' })
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

async function toBytes(value: ZipEntryInput['data']): Promise<Uint8Array> {
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return new Uint8Array(await value.arrayBuffer())
}

function normalizeName(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+/, '')
}

function toDosDateTime(date: Date): [number, number] {
  const year = Math.max(1980, date.getFullYear())
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return [dosTime, dosDate]
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function u32(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ])
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}
