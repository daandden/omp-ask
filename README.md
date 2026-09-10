# omp-tools

Local OMP wrappers for flexible questions and GPT Image 2.5. Formerly `omp-ask`.

## Tools

### `ask`

Replaces the model-facing option-count guidance with “as many concise, distinct
options as there are materially different tradeoffs — no fixed count.” Execution
still delegates to native `ask`: picker UI, timeout, approval tier, and `/tree`
re-answer behavior are retained.

### `generate_image`

Wraps the image implementation supplied by the running OMP host. It adds an
optional `image_model` argument:

- `gpt-image-2.5-flare` — default; fast everyday image generation.
- `gpt-image-2.5-sunburst` — precision-oriented generation and editing.

All existing arguments remain available. Example tool arguments:

```json
{
  "subject": "A watercolor lighthouse at sunrise",
  "provider": "openai-codex",
  "image_model": "gpt-image-2.5-sunburst",
  "image_size": "1024x1024"
}
```

The wrapper changes only `tools[].model` for an OpenAI/Codex Responses image
request. The top-level GPT chat model stays unchanged. Provider selection,
subscription authentication, credential refresh/retry, image inputs, cancellation,
response decoding, and image-file output remain owned by OMP. The fetch override
is scoped to one execution; it does not replace global `fetch`.

**A connected Codex/ChatGPT subscription remains usable.** A separate OpenAI API
key is not required for that route. The public OpenAI API route still uses its
normal API credentials and billing.

Other providers and OMP's provider-fallback behavior are unchanged. Check the
provider in the result: a fallback to another provider does not use GPT Image 2.5.
Stock OMP reports the orchestrating chat model in `details.model`; this is not a
report of the image backend's model identity.

## Keep the default tools enabled

Do **not** disable the default tools to use these wrappers:

```yaml
ask:
  enabled: true
generate_image:
  enabled: true
```

- `ask.enabled` must stay on: the ask extension needs native `ask` for delegation.
- `generate_image.enabled` can stay on: the custom wrapper is registered after
  OMP's bundled image tool and wins the same-name registration. There is one
  effective `generate_image`, not two. The custom plugin is loaded independently
  of the bundled tool's switch; disable the plugin if you need to unload it.

To prefer subscription image generation, put `openai-codex` first in
`providers.imageOrder`, or pass `provider: "openai-codex"` per request.

## Install

```bash
omp plugin link /Users/vanguyen/work/tries/omp-tools
```

The link uses the working tree directly; edits do not require reinstalling.
Start a **new OMP session** after installation or code changes. Existing sessions
retain their loaded tool definitions.

The renamed plugin replaces the previous `omp-ask` installation. Do not load both
packages or install a second loose copy of the ask extension.

## Development and verification

```bash
bun install --ignore-scripts
bun check
bun test
```

Runtime code uses OMP's injected host API. The pinned OMP packages are development
type dependencies, not a separate image/auth runtime used by the plugin.

- Request tests cover concurrent model isolation, preservation of Codex auth and
  edit inputs, and untouched non-image/provider requests.
- SDK smoke verified both flags enabled, one registration per tool, both wrappers
  selected, and native ask returning the seventh option through a simulated picker.
- Live Codex smoke on 2026-09-10 sent `gpt-image-2.5-flare`, received HTTP 200 and a
  generated WebP, with non-Codex fallbacks blocked in the probe. The response did
  not report a separate image-model identity. Sunburst has not been live-tested.

Tested against OMP 18.1.16. Image API support is documented in the
[OpenAI image-generation guide](https://developers.openai.com/api/docs/guides/image-generation).
