# Codex `$imagegen` and GPT Image 2.5 — issue #4

Researched 2026-09-10. Scope: reuse the existing OMP `openai-codex`/ChatGPT subscription only; allowed image models remain Flare and Sunburst; no API-key Images route, new login, or provider fallback. These are project constraints, not claims about OpenAI's entire platform. Only this findings file is changed.

## One-paragraph answer

**The locked-model backend premise is contradicted by the observed subscription configuration: GPT Image 2.5 selection is NOT proven.** Public OpenAI documentation supports both `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` in **`tools[].model`**, with a separate mainline model in top-level Responses `model`, and documents the full generation/edit surface below; the repo's `withImageModel` does put the requested identifier in that correct public-API field. However, the one authorized existing-subscription probe sent Sunburst + `quality:"low"` + `size:"1024x1024"` and received HTTP 200 with image-generation completion events but **returned `response.tools` pinned to `gpt-image-2-codex`, `quality:"auto"`, and `size:"auto"`**. On this observed Codex path, the model/quality/size overrides were not honored in the backend-reported configuration; HTTP acceptance is not model selection. The previously recorded Flare smoke likewise proves a generated WebP, not Flare identity. Native Codex `$imagegen` is also not a full-parameter 2.5 backend: current first-party source exposes only `prompt`, up to five referenced local paths, or the last one-to-five conversation images, and internally hardcodes `gpt-image-2` plus automatic size/quality/background. Therefore the schema inventory is a **documented target**, not an assertion that this subscription transport implements it; do not ship either backend as satisfying the standing Flare/Sunburst lock or silently substitute the returned legacy model. [S1], [S2], [S3], [S7], [S10], [S11], [P1]

## 1. Three different contracts, not one `$imagegen` API

| Surface | What first-party evidence actually establishes |
| --- | --- |
| Codex `$imagegen` skill | A workflow preferring built-in `image_gen`, without `OPENAI_API_KEY`; CLI/API fallback is explicit, not automatic. Many assets use separate built-in calls. Prompt structure is guidance, not a closed function schema. [S6] |
| Current Codex built-in `image_gen.imagegen` | Native `ImagegenArgs` rejects unknown fields and has only `prompt`, `referenced_image_paths`, and `num_last_images_to_include`. Its backend uses active provider/auth through `ImagesClient`; this is distinct from the public API-key CLI and distinct from OMP's hosted Responses implementation. [S7], [S8], [S9] |
| Public Responses `image_generation` tool | Tool configuration includes model/action/quality/size/masks/output settings; prompts and reference images are Responses input items, not `tools[].prompt`. Public API support alone does not guarantee that the subscription gateway honors each field. [S1], [S4], [S5], [P1] |

Current Codex built-in details, from the source rather than assumptions about the skill:

- `prompt: string`; `referenced_image_paths?: absolute_path[]` with maximum 5; `num_last_images_to_include?: integer` from 1 to 5. The two reference mechanisms are mutually exclusive. Neither present means generation; references present mean editing. Recent-history selection is explicitly best-effort and can include unrelated newer images. [S7]
- Built-in generation and editing set `model = "gpt-image-2"`, `quality = "auto"`, `size = "auto"`, `background = "auto"`, and omit `n`. There is no built-in model/quality/size/count/mask/output-format argument to forward. [S7]
- The native Images request types have `prompt`, `background`, `model`, `n`, `quality`, `size`; edits additionally have `images: [{image_url}]`. Their quality enum stops at `high` plus `auto`; the native response types expose created/data/background/quality/size and per-image `generation_id`, **not an image-model identity**. [S9]
- Built-in source now accepts local paths directly and instructs inspection with `view_image` first. The installed/skill prose saying not to promise arbitrary filesystem-path editing is a narrower workflow description; use current code for the actual tool shape. [S6], [S7], [S8]

## 2. Flare versus Sunburst: supported differences only

| Property | Flare | Sunburst |
| --- | --- | --- |
| Public model ID | `gpt-image-2.5-flare` | `gpt-image-2.5-sunburst` |
| Official positioning | Fast, high-quality everyday generation | Most capable image generation/editing; editing precision |
| Default snapshot listed | `gpt-image-2.5-flare-2026-09-08` | `gpt-image-2.5-sunburst-2026-09-08` |
| Modalities/features | Text/image input, image output, generation/editing/inpainting | Same |
| Quality | `auto`, `low`, `medium`, `high`, `xhigh`, `max` | Same |
| Custom dimensions/transparency | Shared constraints below | Same |

Every row above is documented in the model pages and shared guide. No source found here establishes different parameter ranges, a benchmarked speed ratio, or a guaranteed superior result for every prompt; do not invent those differences. Both have the same published API token rates, but the guide explicitly says equal token rates do not mean equal per-image cost. API pricing is not a subscription-quota guarantee. [S1], [S2], [S3]

The model pages say direct `/v1/responses` model support is absent while also saying they can be selected as the Responses image tool's model. Those statements are consistent: **do not put an image model in the mainline Responses `model` field**. The standing two-model allowlist should stay explicit; neither bare `gpt-image-2.5` nor an auto-changing `chatgpt-image-latest` alias satisfies that lock. [S1], [S2], [S3], [S4]

## 3. Full parameter inventory for the intended tool schema

This is the union of the relevant documented Responses capabilities and local controls needed to expose them. **D** = documented public Responses/GPT Image contract; **N** = current native Codex behavior; **O** = directly observed subscription behavior; **U** = unprobed on this subscription. A field listed as D/U is not a promise that the subscription accepts or honors it. Field names on the left are proposed interface names where the existing tool lacks the concept. [S4], [S5], [S7], [P1]

| Tool schema concept | Values / semantics and public wire mapping | Subscription/native status and implementation consequence |
| --- | --- | --- |
| `prompt` | Required free text; map to `input[].content[{type:"input_text",text}]`. Generation instructions, exact lettering, negative constraints, style, composition and preservation instructions fit here. Public Responses revises the prompt and can return `revised_prompt`. [S1], [S5], [S6] | N: required string. O: text prompt accepted and generation-completion events emitted. Existing `subject`, descriptive `action`, `scene`, `composition`, `lighting`, `style`, `text`, `changes` are local prompt assembly, not independent OpenAI image parameters. In particular existing `action` means what the subject is doing, not generate/edit mode. [S7], [S11], [P1] |
| `image_model` | Exactly `gpt-image-2.5-flare` or `gpt-image-2.5-sunburst`; map to `tools[image_generation].model`, never top-level `model`. [S1], [S2], [S3], [S4] | **O: Sunburst rewritten by server-reported tool config to `gpt-image-2-codex`. N: hardcoded `gpt-image-2`. Requested model must be distinguished from returned tool model and unknown actual snapshot. No silent downgrade.** [S7], [P1] |
| `operation` (wire `action`) | `auto` / `generate` / `edit`, public default `auto`. `generate` may use reference images without meaning "edit this target"; `edit` requires an image in context. [S1], [S4], [S5], [S6] | N: inferred solely from presence of refs. O: sent `generate` was absent in returned tool config, so explicit override fidelity is not established. Current OMP unconditionally makes any input image an edit. Do not reuse its descriptive `action` without an explicit cutover. [S7], [S11], [P1] |
| Ordered `input_images` | Multiple edit targets/references/compositing inputs; each can be a local path or base64+MIME normalized into a data URL. Public Responses also accepts fully qualified image URL or existing `file_id`. `input_image` is inside the input message, not tool configuration. Preserve order and describe roles in prompt. [S1], [S5], [S6] | N: up to five absolute local paths OR last 1–5 conversation images, mutually exclusive. U: new probe was generation only. Reusing local/base64 bytes avoids requiring a new Files API auth path; support for subscription file IDs must not be inferred from public Files examples. [S7], [P1] |
| Input selection / continuation | Expose a stable existing-image reference or local artifact re-input for iterative edits. Public Responses supports `previous_response_id`, prior image-generation output/image IDs, or explicit image input. These are conversation inputs/state, not image-tool scalar parameters. [S1], [S5] | N: paths or bounded recent history. OMP currently uses `store:false`; public stored-response-ID examples do not prove subscription persistence. Preferred subscription-safe design is explicit selected image bytes/paths plus edit prompt unless stateful continuation is independently established. This preference is a design inference, not a server limitation claim. [S7], [S11] |
| `input_images[].detail` | Mainline image-input processing detail `auto` / `low` / `high` / `original`, subject to the chosen mainline model. Distinct from output quality and `input_fidelity`. [S5] | U: no image inputs in probe. Current OMP sends `detail:"auto"`. Do not pretend this is a backend-image fidelity control. [S11], [P1] |
| `mask` | Inpainting mask; normalize local/base64 input to `tools[].input_image_mask.image_url`, or public existing `file_id`. Applied to first input image. Alpha-zero areas indicate edits; mask is guidance, not guaranteed pixel-exact confinement. [S1], [S4], [S12] | U: subscription mask behavior not exercised; N: no mask arg. Keep in parity inventory, but not advertised as verified. Match input dimensions and alpha; see conflicting published size limits below. [S7], [P1] |
| `size` | `auto` or explicit `WIDTHxHEIGHT`; recommended `1024x1024`, `1536x1024`, `1024x1536`. Width/height divisible by 16; aspect 1:3 through 3:1; each edge ≤3840; total pixels 655,360–8,294,400; above `2560x1440` experimental. Both 2.5 models share these constraints. [S1], [S4] | **O: requested `1024x1024` returned as `auto`; exact resolution override not honored in returned config.** N: automatic. Existing three-value OMP enum is insufficient for public parity. [S7], [S11], [P1] |
| Optional `aspect_ratio` helper | Not a separate documented public image-generation tool field. Derive one valid explicit size, or use prompt framing with `size:auto`; canonicalize the result to `size` rather than send conflicting fields. [S4] | Current OMP collapses `16:9`/`4:3` to `1536x1024`, and `9:16`/`3:4` to `1024x1536`; those are not the requested ratios. A custom-size surface is necessary for exact public parity, but not sufficient to overcome the observed backend normalization. [S11], [P1] |
| `quality` | `auto` / `low` / `medium` / `high` / `xhigh` / `max`; default `auto`; `xhigh` and `max` are specifically 2.5 additions. [S1], [S2], [S3], [S4] | **O: requested `low` returned as `auto`; override not honored in returned config.** N: automatic, native request enum has no `xhigh`/`max`. These cannot be promised from the subscription path. [S7], [S9], [P1] |
| `background` | `auto` / `opaque` / `transparent`; default `auto`. Both 2.5 models support transparency; require PNG or WebP, not JPEG. [S1], [S4] | U: transparency not tested; O: unspecified request returned `auto`. N: always sends `auto`, skill requests transparency in prompt. [S6], [S7], [P1] |
| `output_format` | `png` / `jpeg` / `webp`; default `png`. The result is base64 image bytes, not a DALL·E-style expiring URL choice. [S1], [S4], [S12] | O: requested `webp` is preserved in returned config; this probe did not retain decoded output bytes. Historical repo smoke records an actual WebP. Current OMP hardcodes WebP; expose output format for public parity, but do not label the other encodings subscription-verified. [S10], [S11], [P1] |
| `output_compression` | Integer 0–100, JPEG/WebP only; documented default 100. [S1], [S4] | U: override not exercised; O: server supplied 100. N: not tool-exposed. [S7], [P1] |
| `moderation` | `auto` / `low`, default `auto`; both remain subject to OpenAI policy filtering. [S1], [S4] | U: override not exercised; O: server supplied `auto`. N: not tool-exposed. [S7], [P1] |
| `partial_images` | Integer 0–3, default 0; partial previews can be fewer than requested if the final finishes first. Separate from requested number of final outputs. Top-level `stream:true` enables event transport. [S1], [S4] | U: partial-preview behavior not exercised. O: stream and final image-generation completion event observed; no partials requested. OMP already uses SSE for Codex, so transport streaming is internal, while partial preview count is a user-relevant advanced control. [S11], [P1] |
| `count` / `n` | Desired final images/variants, distinct from a list of distinct prompts. Public **Images API** documents `n:1..10`, but the current public **Responses image tool schema has no `n` field**. For exact-count parity over Responses, orchestrate separate requested outputs and account for them; do not forward Images-only `n` based on a guide's mixed-API sentence. [S4], [S6], [S12] | O: server inserted `n:1` into returned tool config although absent from request; that does **not** prove writable `n` or an accepted range. N: one built-in call per asset, `n` omitted. Any bounded local `count` is an orchestration contract, not a proven subscription native batch size. [S6], [S7], [P1] |
| `input_fidelity` (conditional) | Public schema contains `high` / `low`; generic SDK wording says `gpt-image-1`, `gpt-image-1.5` and later, default low. Current guide specifically says **older `gpt-image-2`** must omit it because high fidelity is automatic. No equally specific 2.5 subscription statement was established. [S1], [S4] | U: do not silently inherit GPT Image 2's rule as a 2.5 fact, nor claim a working knob from broad SDK wording. Retain this explicitly conditional capability in the inventory; omit by default and do not advertise low/high subscription control without capability evidence. N: no field. [S7], [S9], [P1] |
| Local output destination / naming | Filesystem delivery, not a Responses image parameter. Built-in saves a generated artifact and the skill directs moving/copying final project assets into the requested workspace location. [S6], [S7] | Required only as a local tool UX choice; do not fake it as `tools[].output_path`. Current OMP temp-image paths are unrelated to backend model selection. [S11] |

### Bounds and absent fields: avoid importing the wrong API's limits

- Public Images edits explicitly allow up to 16 PNG/WebP/JPG images, each under 50 MB, and a 32,000-character prompt. These are **Images API** limits; current native Codex caps selected refs at five, and the Responses input schema does not itself establish the Images API's 16-image cap. Do not conflate the three. [S5], [S7], [S12]
- The current guide's mask section says same format/dimensions and under 50 MB, whereas the Images SDK's mask field still says PNG under 4 MB. That is a source discrepancy, not a license to guess subscription limits. A same-dimension alpha PNG under 4 MB is a conservative portable input policy if a supported mask transport is later established; it is a recommendation, not a measured subscription maximum. [S1], [S12]
- Public image-generation tool configuration has exactly `type`, `action`, `background`, `input_fidelity`, `input_image_mask`, `model`, `moderation`, `output_compression`, `output_format`, `partial_images`, `quality`, `size`. Input content and continuation are outside that object. `type:"image_generation"`, top-level `tool_choice:{type:"image_generation"}`, mainline `model`, auth, and streaming are transport configuration, not new user-selectable image models. [S4], [S5]
- `seed`, diffusion steps/CFG, a dedicated `negative_prompt`, DALL·E `style:vivid|natural`, and `response_format:url|b64_json` are not additions to make for this tool's locked GPT Image/Responses scope. Free-form negative/style instructions belong in the prompt; GPT Image returns base64. This is a schema comparison, not a claim about undisclosed service internals. [S4], [S6], [S12]

## 4. What the repo currently selects and reports

`tools/image-gen.ts` merges only `image_model` into the native schema, defaults it to Flare, finds the first `type:"image_generation"` entry in JSON requests whose URL path ends in `/responses`, replaces that entry's `model`, then calls the request-scoped fetch. It neither changes top-level Responses `model` nor checks the backend's returned tool configuration. [S11]

OMP 18.1.16 supplies top-level `model:model.id`, image inputs as `input_image` data URLs, `action` inferred from input presence, fixed `output_format:"webp"`, and size resolved from its three-size enum/aspect mapping. It does **not** supply output `quality`. On Codex it uses the existing OAuth bearer/account/residency/session headers, `/backend-api/codex/responses`, `store:false`, and `stream:true`. Thus adding a local schema field without request forwarding does nothing, and correct forwarding still does not defeat the demonstrated server normalization. [S11], [P1]

The native collector reads image `result`, revised prompt, text/refusal and usage, but does not capture `response.tools` as effective image configuration. Returned `details.model` and summary `Model:` come from the **mainline/orchestration** model, not the backend image model. Public SDK output item types likewise do not guarantee a dedicated image-model field: the current image item declares id/result/status/type/quality/size; the guide additionally documents `revised_prompt`. [S1], [S11], [S13]

**Required provenance distinction (design conclusion):** keep `requested_image_model`, `response_tool_model` when reported, and `response_model` separate. Never rename the top-level response model or the user's requested string to "actual image model". Exact physical snapshot is unknown unless the service explicitly identifies it. In this probe, the useful identity evidence was `response.tools[].model`, and it contradicted the requested variant. [S13], [P1]

## 5. The single authorized subscription probe

### Method and limits

One live POST was sent through the existing OMP-discovered OAuth session, using the official Codex URL, OMP's existing headers and request shape, and the actual repo `withImageModel` override. No new login, API key, Images endpoint, provider fallback, retry, second generation, or project test suite was used. A preliminary Eval import failed before authentication/request execution; the successful probe ran with the installed arm64 Bun runtime. Only sanitized request/response fields were printed; no credentials, account IDs, raw image bytes or generated files were retained. [P1]

The repo already records a same-day Flare request returning HTTP 200 and a generated WebP, explicitly without separate image-model identity. That is treated as existing evidence, not repeated for confirmation. It does not establish that the requested image model was honored. [S10]

### Requested versus returned configuration

| Field | Sent in `tools[0]` | Returned in `response.tools[0]` | Verdict |
| --- | --- | --- | --- |
| `model` | `gpt-image-2.5-sunburst` | `gpt-image-2-codex` | Requested 2.5 selection not honored in reported configuration |
| `quality` | `low` | `auto` | Explicit quality normalized away |
| `size` | `1024x1024` | `auto` | Explicit size normalized away |
| `action` | `generate` | Absent | Explicit action preservation not established |
| `output_format` | `webp` | `webp` | Preserved in returned configuration |
| `n` | Absent | `1` | Server default, not proof of user count control |
| `background` | Absent | `auto` | Server default |
| `moderation` | Absent | `auto` | Server default |
| `output_compression` | Absent | `100` | Server default |

All cells above are from the same captured request/response pair. **This is a locked-model backend in the observed response; GPT Image 2.5 selection is NOT proven.** The data is stronger than mere lack of an identity field: the backend returned a different identifier and normalized the requested size/quality. It does not prove which physical weights back the internal `gpt-image-2-codex` alias, nor universal behavior for every account or a different endpoint. [P1]

### Image-delivery evidence: neither fabricate success nor diagnose a failure

HTTP status was 200; `response.status` was `completed`; SSE included `response.image_generation_call.in_progress`, `.generating`, `.completed`, and `response.output_item.done`. The probe's summary reported `images:[]`: it inspected the completed response output and did not retain the output-item event bodies for alternate image extraction. Therefore **no decoded image bytes or dimensions were verified by this probe**, and the empty summary is a capture/parse limitation, not evidence that image generation failed. The model/size/quality normalization finding depends on separately captured `response.tools`, so it is unaffected by that image capture limitation. No second call was made to fill the gap. [P1]

### Verbatim sanitized capture [P1]

The following is the probe's emitted JSON, without edits to requested/returned values:

```json
{
  "date": "2026-09-10T10:02:42.222Z",
  "requestCount": 1,
  "request": {
    "url": "https://chatgpt.com/backend-api/codex/responses",
    "body": {
      "model": "gpt-6-astra",
      "input": [
        {
          "role": "user",
          "content": [
            {
              "type": "input_text",
              "text": "Generate one minimal image of a small solid blue circle centered on a plain white background. No text."
            }
          ]
        }
      ],
      "tools": [
        {
          "type": "image_generation",
          "action": "generate",
          "size": "1024x1024",
          "quality": "low",
          "output_format": "webp",
          "model": "gpt-image-2.5-sunburst"
        }
      ],
      "tool_choice": {
        "type": "image_generation"
      },
      "store": false,
      "stream": true,
      "instructions": "You are an AI image generator. Generate images based on user descriptions. Focus on creating high-quality, visually appealing images that match the user request."
    }
  },
  "httpStatus": 200,
  "contentType": null,
  "requestId": null,
  "elapsedMs": 33154,
  "eventTypes": [
    "response.created",
    "response.in_progress",
    "response.output_item.added",
    "response.image_generation_call.in_progress",
    "response.image_generation_call.generating",
    "response.image_generation_call.completed",
    "response.output_item.done",
    "response.content_part.added",
    "response.output_text.done",
    "response.content_part.done",
    "response.completed"
  ],
  "responseFields": [
    "id",
    "object",
    "created_at",
    "status",
    "background",
    "completed_at",
    "error",
    "frequency_penalty",
    "incomplete_details",
    "instructions",
    "max_output_tokens",
    "max_tool_calls",
    "model",
    "moderation",
    "output",
    "parallel_tool_calls",
    "presence_penalty",
    "previous_response_id",
    "prompt_cache_key",
    "prompt_cache_retention",
    "reasoning",
    "safety_identifier",
    "service_tier",
    "store",
    "temperature",
    "text",
    "tool_choice",
    "tool_usage",
    "tools",
    "top_logprobs",
    "top_p",
    "truncation",
    "usage",
    "user",
    "metadata"
  ],
  "responseModel": "gpt-6-astra",
  "responseStatus": "completed",
  "echoedTools": [
    {
      "type": "image_generation",
      "background": "auto",
      "model": "gpt-image-2-codex",
      "moderation": "auto",
      "n": 1,
      "output_compression": 100,
      "output_format": "webp",
      "quality": "auto",
      "size": "auto"
    }
  ],
  "usage": {
    "input_tokens": 2372,
    "input_tokens_details": {
      "cache_write_tokens": 0,
      "cached_tokens": 0
    },
    "output_tokens": 89,
    "output_tokens_details": {
      "reasoning_tokens": 0
    },
    "total_tokens": 2461
  },
  "images": [],
  "failure": null
}
```

## 6. Remaining discriminator (not run)

A paired Flare request with otherwise identical settings remains an open discriminator: compare returned tool configuration first, then verifiable image output and latency. If Flare also returns `gpt-image-2-codex`/`auto`/`auto`, that would extend the normalization evidence to both shipped choices; if it returns different configuration, preserve that distinction rather than generalizing the Sunburst result. Output/latency comparison is supporting evidence, not model authentication. This is a proposed future experiment, not an observed finding. It was not run because the assigned one-generation-per-agent cap was exhausted.

## 7. Resolution recommendation

**Resolve the research question with a negative capability finding, not a backend endorsement.** The full public GPT Image 2.5 parameter surface is identifiable, but the existing Codex Responses gateway normalizes away the critical model/size/quality choices in the tested request. Current native Codex code also hardcodes an earlier model and a smaller tool surface. Consequently neither merely expanding the wrapper schema nor replacing it with the stock `$imagegen` tool can currently be represented as fulfilling the project's Flare/Sunburst-only contract. Record the matrix of documented versus observed capability, preserve the standing model/auth constraints, and make any later backend choice depend on evidence of actual locked-model selection—not HTTP 200 alone. No tracker or map changes were made by this worker. [S4], [S7], [S10], [S11], [P1]

## Sources

All external sources are first-party OpenAI docs/source; repo/installed OMP source is primary evidence for this implementation. Docs were fetched directly on 2026-09-10 because Context7's indexed image snippets still described older model surfaces. Code references use the inspected revision where available.

- **[S1]** OpenAI [image-generation guide](https://developers.openai.com/api/docs/guides/image-generation), especially Overview, Generate Images, Multi-turn image generation, Streaming, Edit Images, Mask requirements, Customize Image Output, Content Moderation, Cost and latency, and the explicitly older-model input-fidelity section.
- **[S2]** OpenAI [GPT Image 2.5 Flare model page](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).
- **[S3]** OpenAI [GPT Image 2.5 Sunburst model page](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst).
- **[S4]** OpenAI Python SDK [`responses/tool_param.py`, `ImageGeneration`](https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/responses/tool_param.py#L239-L358); corroborated by [`responses/tool.py`](https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/responses/tool.py#L235-L355).
- **[S5]** OpenAI [Responses image-generation tool guide](https://developers.openai.com/api/docs/guides/tools-image-generation), [Responses create reference](https://developers.openai.com/api/reference/resources/responses/methods/create), and SDK [`response_input_image_param.py`](https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/responses/response_input_image_param.py).
- **[S6]** Official Codex [`imagegen/SKILL.md`](https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/skills/src/assets/samples/imagegen/SKILL.md); also read installed `~/.codex/skills/.system/imagegen/SKILL.md` and the [OpenAI skills copy](https://github.com/openai/skills/blob/main/skills/.system/imagegen/SKILL.md). They agree on default built-in/no API key and explicit-only fallback; use [S7] for the current native argument contract where prose lags implementation.
- **[S7]** Official Codex [`ext/image-generation/src/tool.rs`](https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/ext/image-generation/src/tool.rs): `IMAGE_MODEL`, `MAX_EDIT_IMAGES`, `ImagegenArgs`, `request_for_call_args`, result handling and saving.
- **[S8]** Official Codex [`imagegen_description.md`](https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/ext/image-generation/imagegen_description.md), [`backend.rs`](https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/ext/image-generation/src/backend.rs), [`extension.rs`](https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/ext/image-generation/src/extension.rs).
- **[S9]** Official Codex [`codex-api/src/images.rs`](https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/codex-api/src/images.rs) and [`endpoint/images.rs`](https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/codex-api/src/endpoint/images.rs).
- **[S10]** Repo [`README.md`](../README.md), lines 96–98: same-day Flare smoke and explicit identity caveat (historical evidence, not a new probe).
- **[S11]** Repo [`tools/image-gen.ts`](../tools/image-gen.ts), lines 10–24 and 27–52. Installed OMP 18.1.16 [`src/tools/image-gen.ts`](../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts): schema/prompt 78–140; size 895–909; payload 911–945; collector 953–985; Codex URL/headers 996–1038; request 1072–1107; returned summary/details 1259–1336. Also [`pi-catalog/src/wire/codex.ts`](../node_modules/@oh-my-pi/pi-catalog/src/wire/codex.ts), [`auth-broker-config.ts`](../node_modules/@oh-my-pi/pi-coding-agent/src/session/auth-broker-config.ts), and [`pi-ai/src/auth-storage.ts`](../node_modules/@oh-my-pi/pi-ai/src/auth-storage.ts), `getOAuthAccess`.
- **[S12]** OpenAI Python SDK [`image_edit_params.py`](https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/image_edit_params.py): Images-only prompt/image/count/mask limits and base64 semantics.
- **[S13]** OpenAI Python SDK [`response_output_item.py`, `ImageGenerationCall`](https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/responses/response_output_item.py#L109-L135), plus revised-prompt examples in [S1]/[S5].
- **[P1]** First-party subscription API response observed 2026-09-10T10:02:42.222Z, one POST to `https://chatgpt.com/backend-api/codex/responses`; complete sanitized output embedded above. Session tool artifact `artifact://145` contains the same emitted JSON. The transient script was supplied on stdin and no raw credential/image artifact was written.

[S1]: https://developers.openai.com/api/docs/guides/image-generation
[S2]: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
[S3]: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
[S4]: https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/responses/tool_param.py#L239-L358
[S5]: https://developers.openai.com/api/docs/guides/tools-image-generation
[S6]: https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/skills/src/assets/samples/imagegen/SKILL.md
[S7]: https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/ext/image-generation/src/tool.rs
[S8]: https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/ext/image-generation/src/backend.rs
[S9]: https://github.com/openai/codex/blob/5d3fe48b08049165ef8143dca152869c1f18059c/codex-rs/codex-api/src/images.rs
[S10]: ../README.md#development-and-verification
[S11]: ../tools/image-gen.ts
[S12]: https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/image_edit_params.py
[S13]: https://github.com/openai/openai-python/blob/adb212e116323fcec4b4811d20ba9eb78280c24c/src/openai/types/responses/response_output_item.py#L109-L135
[P1]: #5-the-single-authorized-subscription-probe
