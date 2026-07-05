export type ToolId = 'select' | 'pan' | 'rectangle' | 'ellipse' | 'text'

export interface EditorNode {
  id: string
  name: string
  type: 'rectangle' | 'ellipse' | 'text' | 'group'
  visible: boolean
  locked: boolean
}

export interface EditorUIState {
  activeTool: ToolId
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  selectedNodeId: string | null
  zoom: number
  statusMessage: string
}