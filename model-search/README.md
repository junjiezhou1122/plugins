# model-search

A searchable model picker, for setups where the model list is longer than a menu
can usefully show.

Type `/ms` and a palette opens with the query already focused. Results appear as
you type, so there is no Tab to press and no dropdown to expand. The first match
is highlighted, Enter selects it, and every visible row is clickable. Esc closes
without changing anything.

`/model` is left exactly as Claude Code ships it. This plugin adds a second way
in rather than replacing the first.

## Install

```bash
claude plugin marketplace add junjiezhou1122/plugins
claude plugin install model-search@plugins
```

## Why you would reach for it

Claude Code's `/model` menu lists every model and asks you to scroll. Behind a
gateway such as [magpie](https://github.com/yetone/magpie) that list runs past a
thousand entries, and the menu has no way to type into it. `/ms` searches
model names, labels and provider IDs as you type.

The palette reads its list from the `modelPicker` setting in your Claude Code
settings, which is what a gateway writes. Without one there is nothing long to
search, and `/model` is the better tool.

## Claude Code's own models come first

The palette lists Claude Code's own names (`Default`, `Sonnet`, `Opus`, `Haiku`,
`Fable`, `Best`, and the 1M-context variants) ahead of anything a gateway adds,
so typing `opus` offers Claude Code's `Opus` first rather than burying it under
every provider's Opus clone. Your current model is highlighted above both.

## `/model` still works

The plugin does not hook the built-in `model` command at all. `/model` opens
Claude Code's own menu, `/model <id>` still switches directly, and the native
menu's session-only option is untouched.

To turn this plugin off entirely:

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
