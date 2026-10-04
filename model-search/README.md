# model-search

A searchable model picker for setups where `/model` lists more models than a
menu can usefully show.

Type `/model` (or `/ms`) and a palette opens with the query already focused.
Results appear as you type, so there is no Tab to press and no dropdown to
expand. The first match is highlighted, Enter selects it, and every visible row
is clickable. Esc closes without changing anything.

## Install

```bash
claude plugin marketplace add junjiezhou1122/plugins
claude plugin install model-search@plugins
```

## Who this is for

The palette reads the model list from the `modelPicker` setting in your Claude
Code settings. On a stock install that setting is absent, and the palette falls
back to Claude Code's own aliases (`default`, `sonnet`, `opus`, `haiku`,
`fable`, `best`, and the `[1m]` variants).

That fallback is about nine entries, which the built-in `/model` menu already
handles well. **This plugin is worth installing when something writes a long
`modelPicker` list for you**, which is the case when you sit behind a gateway
such as [magpie](https://github.com/yetone/magpie) that aggregates many
providers. If you do not have such a list, the built-in menu is the better
choice.

## It replaces the built-in `/model`

Installing this plugin intercepts the built-in `model` command. Bare `/model`
opens this palette instead of the native menu. `/model <id>` is untouched and
still reaches the native switcher, so scripted switches and pasted model IDs
keep working.

To go back to the stock picker:

```bash
claude plugin disable model-search@plugins
```

## What it does not do

It makes no network calls of its own. It reads the model list already in your
settings, and selecting a model runs Claude Code's own `/model <id>` so the
switch goes through the normal path and is saved the normal way.

## Development

```bash
claude plugin validate model-search
claude plugin test model-search
```

`.claude-plugin/types/` and `tsconfig.json` are written by the engine when the
plugin loads. They are gitignored.
