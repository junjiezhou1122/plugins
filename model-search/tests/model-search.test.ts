import { test, expect } from 'claude-code/testing'
import type { ConfigRow, On, RenderPropsOf } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'model-search'
const ID = 'group/auto-gpt-6-1-sol:high[1m]'
const PANE: RenderPropsOf['Pane'] = {
  title: 'Switch model', isFocused: true, bodyColumns: 58, placement: 'inline',
  scroll: { offset: 0, bodyRows: 24 }, view: {},
}

function engine(on: On, picker: unknown, current = ID) {
  let pickerValue = picker
  let value: unknown
  let version = 0
  const switched: string[] = []
  const opened: unknown[] = []
  const focused: string[] = []
  const closed: string[] = []
  on('state.get', () => ({ value: { value, version } }))
  on('state.set', ($, e) => {
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false, version } }
    value = e.value
    version += 1
    return { value: { isSet: true, version } }
  })
  on('settings.read', () => ({ value: { modelPicker: pickerValue } }))
  on('config.list', () => ({ value: [{
    key: 'model', label: 'Model', kind: 'choice', value: current,
    options: ['default', 'sonnet', 'opus', 'haiku', 'fable', 'best', 'opusplan', 'sonnet[1m]', 'opus[1m]', 'fable[1m]'],
    provider: { plugin: 'engine', tier: 'core' }, isLocked: false,
  } satisfies ConfigRow] }))
  on('session.model', () => ({ value: current }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.open', ($, e) => { opened.push(e); return { value: { isPlaced: true } } })
  on('ui.close', ($, e) => { closed.push(e.id); return { value: undefined } })
  on('ui.focus', ($, e) => { if (e.element !== undefined) focused.push(e.element); return {} })
  on('command.run', { command: 'model' }, ($, e) => {
    if (e.args === '') return { text: 'Select model' }
    switched.push(e.args)
    return { text: `Set model to ${e.args}` }
  })
  return {
    switched, opened, focused, closed,
    setPicker: (picker: unknown) => { pickerValue = picker },
    setState: (state: unknown) => { value = state; version += 1 },
  }
}

async function open($: Engine, args = '', command = 'ms') {
  await $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface} /ms displays results immediately and input Enter switches without Tab or Select`, async ($, on) => {
    const models = Array.from({ length: 1200 }, (_, i) => ({ model: `vendor/model-${i}`, label: `Model ${i}`, description: 'General model' }))
    models.push({ model: ID, label: 'Orchid reasoning', description: 'Deep planning engine' })
    models.push({ model: ID, label: 'Duplicate alias', description: 'Duplicate must not render' })
    const state = engine(on, { options: models })
    await open($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PLUGIN, props: PANE })
    // 1200 vendor rows + the one deduplicated ID, plus Claude Code's 10 aliases.
    const total = 1201 + 10
    expect(await ui.find({ type: 'Select' })).toBeUndefined()
    expect(await ui.find({ type: 'Client' })).toBeUndefined()
    expect((await ui.find({ key: 'query' }))?.props.autoFocus).toBe(true)
    expect((await ui.find({ key: 'model-0' }))?.props.label).toBe('Orchid reasoning · current')
    expect((await ui.find({ key: 'model-0' }))?.props.variant).toBe('primary')
    expect((await ui.find({ type: 'Text', text: String(total) }))?.text).toContain(String(total))
    for (const text of ['O', 'OR', 'ORCHID', 'ORCHID planning']) {
      await ui.input({ key: 'query', text, kind: 'change' })
      await ui.redraw()
    }
    expect((await ui.find({ type: 'Text', text: '1 match' }))?.text).toBe('1 match')
    expect((await ui.find({ key: 'model-0' }))?.props.label).toBe('Orchid reasoning · current')
    expect(await ui.find({ key: 'model-1' })).toBeUndefined()
    expect(state.switched).toEqual([])
    await ui.input({ key: 'query', text: 'ORCHID planning', kind: 'submit' })
    expect(state.switched).toEqual([ID])
    expect(state.closed).toEqual([PLUGIN])
    await ui.unmount()
  })

  test(`${surface} backspace-style input edits restore matches and any visible row is clickable`, async ($, on) => {
    const alpha = 'vendor/alpha:high[1m]'
    const beta = 'vendor/beta:low'
    const state = engine(on, { options: [
      { model: alpha, label: 'Orchid Alpha', description: 'Planning' },
      { model: beta, label: 'Orchid Beta', description: 'Planning' },
    ] }, 'sonnet')
    await open($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PLUGIN, props: PANE })
    await ui.input({ key: 'query', text: 'orchidx', kind: 'change' })
    await ui.redraw()
    expect((await ui.find({ type: 'Text', text: 'No models match' }))?.text).toBe('No models match')
    await ui.input({ key: 'query', text: 'orchidx', kind: 'submit' })
    expect(state.switched).toEqual([])
    await ui.input({ key: 'query', text: 'orchid', kind: 'change' })
    await ui.redraw()
    expect((await ui.find({ key: 'model-0' }))?.props.label).toBe('Orchid Alpha')
    expect((await ui.find({ key: 'model-1' }))?.props.label).toBe('Orchid Beta')
    await ui.press({ key: 'model-1' })
    expect(state.switched).toEqual([beta])
    expect(state.closed).toEqual([PLUGIN])
    await ui.unmount()
  })

  test(`${surface} empty matches and cancellation never switch`, async ($, on) => {
    const state = engine(on, { options: [{ model: ID, label: 'Orchid', description: 'Planning' }] })
    await open($, 'not-found', 'ms')
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PLUGIN, props: PANE })
    expect((await ui.find({ type: 'Text', text: 'No models match' }))?.text).toBe('No models match')
    await ui.input({ key: 'query', text: 'not-found', kind: 'submit' })
    expect(state.switched).toEqual([])
    await ui.press({ key: 'cancel' })
    expect(state.closed).toEqual([PLUGIN])
    expect(state.switched).toEqual([])
    expect(state.opened).toEqual([expect.objectContaining({ focus: true, closeOnEscape: true })])
    await ui.unmount()
  })
}

test('the built-in /model is left entirely alone, with and without arguments', async ($, on) => {
  const state = engine(on, { options: [{ model: ID, label: 'Orchid', description: '' }] })
  const results = await Promise.all([
    $.command.run({ command: 'model', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } }),
    $.command.run({ command: 'model', args: `${ID} s`, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } }),
  ])
  expect(state.opened).toEqual([])
  expect(state.switched).toEqual([`${ID} s`])
  for (const result of results) expect(result).toHaveProperty('text')
})

test('no curated picker falls back to documented engine aliases', async ($, on) => {
  const state = engine(on, undefined, 'sonnet')
  await open($, 'default', 'ms')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: PANE })
  await ui.input({ key: 'query', text: 'default', kind: 'submit' })
  expect(state.switched).toEqual(['default'])
  await ui.unmount()
})

test("Claude Code's own aliases outrank the gateway's models for the same word", async ($, on) => {
  const state = engine(on, { options: [
    { model: 'cliproxy/opus-4-6', label: 'Claude Opus 4.6', description: '' },
    { model: 'vendor/opus-4-6', label: 'Claude Opus 4.6', description: '' },
  ] }, 'sonnet')
  await open($, 'opus')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: PANE })
  await ui.input({ key: 'query', text: 'opus', kind: 'change' })
  await ui.redraw()
  expect((await ui.find({ key: 'model-0' }))?.props.label).toBe('Opus')
  await ui.input({ key: 'query', text: 'opus', kind: 'submit' })
  expect(state.switched).toEqual(['opus'])
  await ui.unmount()
})

test('malformed catalog reports an error and retry recovers to an editable picker', async ($, on) => {
  const state = engine(on, { options: [{ label: 'Missing ID' }] })
  await open($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: PANE })
  expect((await ui.find({ type: 'Text', text: 'no model ID' }))?.text).toBe('A modelPicker option has no model ID.')
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  expect(state.switched).toEqual([])
  state.setPicker({ options: [{ model: ID, label: 'Recovered', description: '' }] })
  await ui.press({ key: 'retry' })
  await ui.redraw()
  expect((await ui.find({ key: 'model-0' }))?.props.label).toBe('Recovered · current')
  await ui.input({ key: 'query', text: 'Recovered', kind: 'submit' })
  expect(state.switched).toEqual([ID])
  await ui.unmount()
})

test('loading has cancellation and no selectable model', async ($, on) => {
  const state = engine(on, { options: [] })
  state.setState({ kind: 'loading', query: '' })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: PANE })
  expect((await ui.find({ type: 'Text', text: 'Loading models' }))?.text).toBe('Loading models…')
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  await ui.press({ key: 'cancel' })
  expect(state.closed).toEqual([PLUGIN])
  expect(state.switched).toEqual([])
  await ui.unmount()
})

test('the exact current ID is injected even when absent from the catalog', async ($, on) => {
  const state = engine(on, { options: [{ model: 'vendor/other[1m]', label: 'Other', description: '' }] })
  await open($, 'gpt-6-1 high', 'model-search')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PLUGIN, props: PANE })
  await ui.input({ key: 'query', text: 'gpt-6-1 high', kind: 'submit' })
  expect(state.switched).toEqual([ID])
  await ui.unmount()
})
