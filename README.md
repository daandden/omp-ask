# omp-ask

OMP extension: flexible option counts for the built-in `ask` tool.

It shadows `ask` with a description that has **no fixed 2–5 cap** (“as many
concise, distinct options as there are materially different tradeoffs — 1 for
a confirm, 2+ otherwise”), then delegates execution to the native tool via
`ctx.invokeTool`, so the picker UI, `ask.timeout`, approval tier, and `/tree`
re-answer behavior stay stock. Last-extension-wins applies.

## Layout

- `extensions/flexible-ask.ts` — the extension (declared in `package.json#omp.extensions`)
- `extensions/flexible-ask.test.ts` — contract: shadows `ask` at `read` tier, no `2-5` in prose, params pass through to native

## Try it (no install)

```bash
omp --extension ./extensions/flexible-ask.ts
```

## Install permanently

```bash
# symlink as an installed plugin (same surface marketplace installs use)
omp plugin link "$PWD"
# or copy the single file into user extensions:
cp extensions/flexible-ask.ts ~/.omp/agent/extensions/
```

Restart the session after install — newly installed extension modules load at startup.

## Verify

```bash
bun test
```
