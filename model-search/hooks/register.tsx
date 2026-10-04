import { update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { ModelSearchOption, ModelSearchState } from '../types'

const PANE = 'model-search'
const PICKER = { plugin: 'model-search', key: 'picker' } as const
const MAX_CHOICES = 8

/** Claude Code's own model names, which the picker offers ahead of anything a gateway adds. */
const ALIAS_LABELS: Record<string, string> = {
  default: 'Default (recommended)',
  sonnet: 'Sonnet',
  opus: 'Opus',
  haiku: 'Haiku',
  fable: 'Fable',
  best: 'Best',
  opusplan: 'Opus plan',
  'sonnet[1m]': 'Sonnet (1M context)',
  'opus[1m]': 'Opus (1M context)',
  'fable[1m]': 'Fable (1M context)',
}

function configuredModels(value: unknown): ModelSearchOption[] | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object' || !('options' in value) || !Array.isArray(value.options)) {
    throw new Error('The modelPicker setting has no options list.')
  }
  const models: ModelSearchOption[] = []
  const seen = new Set<string>()
  const options: unknown[] = value.options
  for (const row of options) {
    if (row === null || typeof row !== 'object' || !('model' in row) || typeof row.model !== 'string' || !row.model.trim()) {
      throw new Error('A modelPicker option has no model ID.')
    }
    if (seen.has(row.model)) continue
    seen.add(row.model)
    models.push({
      model: row.model,
      label: 'label' in row && typeof row.label === 'string' ? row.label : row.model,
      description: 'description' in row && typeof row.description === 'string' ? row.description : '',
    })
  }
  return models
}

function matches(models: ModelSearchOption[], query: string): ModelSearchOption[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return models.filter(row => {
    const text = `${row.model} ${row.label} ${row.description}`.toLowerCase()
    return words.every(word => text.includes(word))
  })
}

function paletteProps(state: Extract<ModelSearchState, { kind: 'ready' }>) {
  const filtered = matches(state.models, state.query)
  return {
    query: state.query,
    count: filtered.length,
    choices: filtered.slice(0, MAX_CHOICES).map(row => {
      const [provider, ...parts] = row.model.split('/')
      const shortId = parts.join('/') || provider || row.model
      const name = row.label !== row.model ? row.label : shortId
      return { model: row.model, name, provider: parts.length ? provider ?? '' : '', current: row.model === state.current }
    }),
  }
}

async function openPicker($: EngineInterface, query: string): Promise<void> {
  await $.state.set(PICKER, { kind: 'loading', query })
  await $.ui.open({ id: PANE, title: 'Switch model', focus: true, closeOnEscape: true, rows: 14, columns: 58 })
  try {
    const settings = await $.settings.read()
    const models = configuredModels(settings.modelPicker) ?? []
    const row = (await $.config.list()).find(row => row.key === 'model' && row.provider.plugin === 'engine')
    const aliases: ModelSearchOption[] = []
    for (const model of row?.options ?? []) {
      if (models.some(row => row.model === model)) continue
      aliases.push({ model, label: ALIAS_LABELS[model] ?? model, description: '', alias: true })
    }
    if (!aliases.some(row => row.model === 'default')) {
      aliases.unshift({ model: 'default', label: ALIAS_LABELS['default'] ?? 'default', description: '', alias: true })
    }
    const current = await $.session.model()
    if (!models.some(row => row.model === current) && !aliases.some(row => row.model === current)) {
      aliases.push({ model: current, label: current, description: '', alias: true })
    }
    // Claude Code's own names first, then the current model, then the gateway's list.
    models.unshift(...aliases)
    models.sort((a, b) => Number(b.model === current) - Number(a.model === current) || Number(b.alias ?? false) - Number(a.alias ?? false))
    await update($, PICKER, (state): ModelSearchState => state?.kind === 'loading' ? { kind: 'ready', query: state.query, current, models } : state ?? { kind: 'closed' })
    await $.ui.focus({ requestId: PANE, key: 'query' })
  } catch (error) {
    await update($, PICKER, (state): ModelSearchState => state?.kind === 'loading' ? {
      kind: 'error', query: state.query, message: error instanceof Error ? error.message : 'Could not load the model list.',
    } : state ?? { kind: 'closed' })
  }
}

async function selectModel($: EngineInterface, query: string, selected: number): Promise<void> {
  const { value: state, version } = await $.state.get(PICKER)
  if (state?.kind !== 'ready') return
  const row = matches(state.models, query).slice(0, MAX_CHOICES)[selected]
  if (!row) return
  const claimed = await $.state.set(PICKER, { kind: 'switching', model: row.model }, { ifVersion: version })
  if (!claimed.isSet) return
  try {
    await $.command.run({ command: 'model', args: row.model })
    await $.ui.close({ id: PANE })
    await $.state.set(PICKER, { kind: 'closed' })
  } catch (error) {
    await $.state.set(PICKER, { kind: 'error', query, message: error instanceof Error ? error.message : 'The model command failed.' })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const name of ['model-search', 'ms']) await $.command.register({ name, description: 'Search and switch models by name or provider', argumentHint: '[search words]' })
    return next(e)
  })

  on('command.run', { command: ['model-search', 'ms'] }, async ($, e) => {
    await openPicker($, e.args)
    return {}
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    await $.state.set(PICKER, { kind: 'closed' })
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { value = { kind: 'closed' } } = await $.state.get(PICKER)
    const state: ModelSearchState = value
    const cancel = <Button key="cancel" label="Close" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
    if (state.kind === 'closed') return <Box>{cancel}</Box>
    if (state.kind === 'loading') return <Box flexDirection="column"><Text dimColor>Loading models…</Text>{cancel}</Box>
    if (state.kind === 'switching') return <Box flexDirection="column"><Text dimColor>Switching…</Text></Box>
    if (state.kind === 'error') return <Box flexDirection="column">
      <Text>{state.message}</Text>
      <Button key="retry" label="Retry" onPress={() => openPicker($, state.query)} />
      {cancel}
    </Box>
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return <Box flexDirection="column"><Text>Use /ms in the terminal to search models. /model still opens Claude Code's own list.</Text>{cancel}</Box>
    const { Input } = $.ui.resolve(e)
    const palette = paletteProps(state)
    const width = Math.max(20, e.props.bodyColumns - 22)
    const compact = (text: string) => Array.from(text).length > width ? Array.from(text).slice(0, width - 1).join('') + '…' : text
    return <Box flexDirection="column">
      <Text bold>Switch model</Text>
      <Input key="query" label="Search" placeholder="Name, provider or ID" value={state.query} autoFocus submitLabel="select first"
        onInput={query => update($, PICKER, (state): ModelSearchState => state?.kind === 'ready' ? { ...state, query } : state ?? { kind: 'closed' })}
        onSubmit={query => selectModel($, query, 0)} />
      <Text dimColor>{palette.count} match{palette.count === 1 ? '' : 'es'}{palette.count > MAX_CHOICES ? ' · type more to narrow down' : ''}</Text>
      {palette.choices.length === 0 ? <Text dimColor>No models match</Text> : palette.choices.map((row, index) => <Box key={`row-${index}`} flexDirection="row">
        <Text inverse={index === 0} bold={index === 0}>{index === 0 ? '› ' : '  '}</Text>
        <Button key={`model-${index}`} plain={index === 0 ? undefined : true} variant={index === 0 ? 'primary' : 'secondary'} label={compact(row.name + (row.current ? ' · current' : ''))}
          onPress={() => selectModel($, state.query, index)} />
        <Text dimColor wrap="truncate">{row.provider ? `  ${row.provider}` : ''}</Text>
      </Box>)}
      {palette.choices[0] ? <Text dimColor wrap="truncate">{palette.choices[0].model}</Text> : null}
      <Text dimColor>Enter selects the first · click to choose · Esc closes</Text>
      {cancel}
    </Box>
  })
}
