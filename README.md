# plugins

Junjie Zhou's Claude Code plugins and skills.

## Install

Add the marketplace once, then install what you want:

```bash
claude plugin marketplace add junjiezhou1122/plugins
claude plugin install model-search@plugins
```

To remove it again:

```bash
claude plugin marketplace remove plugins
```

## What is here

| Plugin | What it does |
| --- | --- |
| [model-search](model-search/) | A searchable model palette on `/ms`, for when the model list is too long to scroll. Leaves `/model` alone. |

Each plugin has its own README with the detail. This one only covers the
marketplace itself.

## Adding a plugin

Put the plugin in its own folder at the repo root, with
`.claude-plugin/plugin.json` inside it, then add an entry to
`.claude-plugin/marketplace.json`:

```json
{
  "name": "plugins",
  "owner": { "name": "Junjie Zhou" },
  "description": "Junjie Zhou's Claude Code plugins and skills.",
  "plugins": [
    { "name": "model-search", "source": "./model-search", "description": "..." },
    { "name": "your-plugin", "source": "./your-plugin", "description": "..." }
  ]
}
```

`source` is a path relative to the repository root. Then check it before
pushing:

```bash
claude plugin validate .claude-plugin/marketplace.json
claude plugin validate your-plugin
claude plugin test your-plugin
```

`tsc -p your-plugin` type-checks it too, once the plugin has been loaded once
so the engine has written `your-plugin/.claude-plugin/types/`.

Two files under a plugin are written by the engine and should not be
committed. Each plugin's `.gitignore` already excludes them:

- `.claude-plugin/types/`
- `tsconfig.json`
