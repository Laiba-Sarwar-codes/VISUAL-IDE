// src/collaboration/Awareness.ts
// Module 14 — fixed: color lookup returns fallback if undefined

import { nanoid } from 'nanoid'
import type { CollabUser } from './types'

const USER_COLORS: string[] = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
]

const FALLBACK_COLOR = '#3b82f6'

// Fixed: returns fallback if array lookup is undefined
function pickColor(): string {
  const index = Math.floor(Math.random() * USER_COLORS.length)
  return USER_COLORS[index] ?? FALLBACK_COLOR
}

export class Awareness {
  readonly localUser: CollabUser
  private remoteUsers: Map<string, CollabUser> = new Map()
  private onChange?: (users: CollabUser[]) => void

  constructor(name?: string) {
    this.localUser = {
      id:         nanoid(),
      name:       name ?? `User ${Math.floor(Math.random() * 1000)}`,
      color:      pickColor(),
      cursorX:    0,
      cursorY:    0,
      selectedId: null,
    }
  }

  updateCursor(x: number, y: number): void {
    this.localUser.cursorX = x
    this.localUser.cursorY = y
    this.notifyChange()
  }

  updateSelection(selectedId: string | null): void {
    this.localUser.selectedId = selectedId
    this.notifyChange()
  }

  setRemoteUser(user: CollabUser): void {
    this.remoteUsers.set(user.id, user)
    this.notifyChange()
  }

  removeRemoteUser(id: string): void {
    this.remoteUsers.delete(id)
    this.notifyChange()
  }

  getAllUsers(): CollabUser[] {
    return [this.localUser, ...Array.from(this.remoteUsers.values())]
  }

  onUsersChange(cb: (users: CollabUser[]) => void): void {
    this.onChange = cb
  }

  private notifyChange(): void {
    this.onChange?.(this.getAllUsers())
  }
}

export const awareness = new Awareness()