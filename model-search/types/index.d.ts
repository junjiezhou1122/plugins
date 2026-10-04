export type ModelSearchOption = {
  model: string
  label: string
  description: string
  alias?: boolean
}

export type ModelSearchState =
  | { kind: 'closed' }
  | { kind: 'loading'; query: string }
  | { kind: 'ready'; query: string; current: string; models: ModelSearchOption[] }
  | { kind: 'switching'; model: string }
  | { kind: 'error'; query: string; message: string }

declare module 'claude-code' {
  interface PluginState {
    'model-search': {
      picker: ModelSearchState
    }
  }
}
