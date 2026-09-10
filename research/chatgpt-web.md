# ChatGPT web image generation behavior and session approach

Research for issue #3, part of #1. Investigated 2026-09-10. Scope: the existing oh-my-pi `openai-codex` subscription session, GPT Image 2.5 Flare/Sunburst only; no new login, API-key Images route, or other providers.

## Answer and routing verdict

`leeguooooo/chatgpt-imagegen` has two different OpenAI transports, and its **web** transport is browser automation, not a reusable image-generation HTTP client: it opens an already-authenticated Chrome profile through `chrome-use`, uploads reference files, types a natural-language request into ChatGPT, waits for a fresh stable generated-image element, and downloads its bytes inside the authenticated page. Size is text appended to the prompt, edits are reference attachments plus instructions, and its model switch selects the **chat composer tier** (`Instant,Auto` by default), not Flare or Sunburst. Its explicit web HTTP calls manage projects, session information, conversation visibility, and asset download; it does not construct the generation/upload wire payload. [W1][W2][W3][W4] Current OpenAI documentation says ChatGPT Images 2.5 supports generation, reference-led edits, arbitrary aspect-ratio requests, and transparent-background requests, but does **not establish explicit Flare/Sunburst selection on the web**; the announcement introduces those names as API models. [O1][O2] **Session-reuse verdict: not a drop-in reuse of oh-my-pi's existing OAuth credential.** OMP supplies an OAuth bearer and identity metadata, whereas this web implementation requires a separately usable ChatGPT browser session; no OAuth-to-browser-cookie bridge exists in the inspected implementations. Consequently this web route is **not eligible as an automatic fallback under the standing OAuth-only/session and explicit-model constraints**. That is an implementation/eligibility conclusion, not proof that an undiscovered server-side exchange can never exist. [H1][H2][H3][W1][W5] No live image generation or edit was performed: existing-browser access checks failed, and the parent explicitly stopped further access attempts. All image capability rows below therefore remain **code-/doc-derived, not live-verified**. [E1]

## Evidence classes and scope of verification

- **CODE**: directly inspected the upstream executable pinned to commit `da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d`, not merely its README. Sources link to that immutable revision. **CODE-RUN** additionally means the isolated pure prompt functions were executed locally; it does not mean ChatGPT accepted or honored the request. [W0][E2]
- **DOC**: current first-party OpenAI pages retrieved directly on the investigation date. The Help Center's Images page identifies 2.5, and the September 8 release notes say existing image-generation limits are unchanged. These are product claims, not observations of this account's rollout. [O1][O3]
- **LIVE-ACCESS**: non-generating local/browser readiness checks only. **LIVE-GENERATION: none; LIVE-EDIT: none.** No row below earns live capability verification from an access failure. [E1]
- **INFERENCE / ROUTING DECISION**: a conservative conclusion from named sources, not an observed service contract. Unknown capability rows must return to research/fog rather than become supported/unsupported service facts. [E1]

## 1. Session/authentication mechanism

### What the upstream web implementation actually reuses

1. `run_web` obtains `chrome-use` (also accepts older binary names), chooses a relay or Chrome profile, opens `https://chatgpt.com/`, and checks for `#prompt-textarea`. It does not call its Codex `_load_auth` or OAuth refresh path. The web profile detector checks **host and expiry metadata** for `__Secure-next-auth.session-token%` in Chrome's cookie databases; it does not decrypt/read the encrypted cookie value or determine which account owns the profile. Automatically choosing the freshest profile therefore does not prove it is the subscription identity selected in OMP. [W1][W5]
2. The browser's cookies authorize in-page `fetch(..., {credentials: 'include'})`. For project/deletion calls, `/api/auth/session` supplies a web `accessToken`, used as `Authorization: Bearer ...` **inside the page**. The returned data to the CLI are operation results, project/conversation IDs, or image bytes—not that token. [W3][W6]
3. `--session` is a `chrome-use` browser/tab-group session name, not an OMP credential/session identifier. At the default concurrency of one, executable behavior reuses the stable browser session name `imagegen`; when the cap is lifted it uses a process-specific name. The CLI help still describes a process-specific default, so use executable behavior rather than that help sentence. [W1][W7]
4. The repository explains its real-browser choice in terms of Cloudflare/Turnstile and sentinel checks, including `/backend-api/sentinel/chat-requirements` and an in-page `sentinel/sdk.js`. Treat its claims about single-use Turnstile and headless limitations as **upstream implementation observations**, not a freshly tested or official OpenAI protocol guarantee. This investigation did not generate, acquire, replay, or bypass challenge tokens. [W8][E1]

### Why OMP OAuth is not equivalent

The installed `@oh-my-pi/pi-ai` is 18.1.16. Its credential shape contains `access`, `refresh`, `expires`, and identity/account/organization metadata. The Codex OAuth exchange maps token response fields into those values; its auth configuration uses the published Codex OAuth client and `auth.openai.com/oauth/token`. `AuthStorage.getOAuthAccess` returns a raw `accessToken` and identity metadata, not a browser cookie jar or a logged-in browser context. [H0][H1][H2][H3][H4]

**INFERENCE:** having used the same OpenAI account for an OAuth login does not supply the cookie-backed Chrome session this repo expects. A previously logged-in browser might avoid another human login, but using it would still add a second credential/session source and require matching the account/workspace to OMP. The standing decision permits only reuse of the existing OMP subscription session, so that separate-browser design is not an authorized shortcut. Neither inspected code path establishes an OAuth-to-web-session exchange. The absence of that bridge is verified in code, not by a live rejected OAuth request to ChatGPT's private generation endpoint. [H1][H2][H3][W1][W5]

**Required condition for a future eligible web route:** independently demonstrate a supported/reproducible way to drive the ChatGPT web surface from the existing OMP session without new authentication, plus explicit Flare/Sunburst selection/confirmation. Do not implement cookie extraction, a new login, a new token store, or silent model fallback to satisfy those missing conditions. This is the routing consequence of the standing constraints, not a recommendation to relax them. [H1][H3][W1][W2][O2]

## 2. Endpoints and request shape

These are the web calls actually present in the pinned executable. They are internal product endpoints, not a documented image API. No generation request schema was inferred from an API-key Images or Codex Responses request. [W3][W4][W6]

| Operation | Shape implemented by the repository | Evidence |
|---|---|---|
| Open ordinary chat | Navigate to `https://chatgpt.com/`; optional project page `https://chatgpt.com/g/{gizmo_id}/project` | CODE, not live. [W1][W9] |
| Obtain browser-session access token | `GET /api/auth/session`, `credentials: 'include'`; read JSON `accessToken` in-page | CODE, not live. [W3][W6] |
| Find a project | `GET /backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0`, cookies plus bearer; inspect `items[].gizmo.gizmo.display.name` and `id` | CODE, not live. [W3] |
| Create project if missing | `POST /backend-api/projects`, cookies plus bearer and JSON content type; body `{"name": "imagegen", "instructions": ""}` by default | CODE, not live. [W3][W9] |
| Attach input images | `chrome-use upload` to `#upload-files`, then `form input[type=file]`, then `input[accept="image/*"]` as compatibility candidates; the ChatGPT frontend owns the upload request | CODE, not live. No upload endpoint/body reconstructed. [W10] |
| Submit generation/edit | Click `#prompt-textarea`, `keyboard type` the built prompt, Enter/send button; check that the composer empties | CODE/CODE-RUN, not live. No `POST /backend-api/conversation` generation body implemented by this repo. [W4][E2] |
| Observe completion | Poll every two seconds for streaming to stop and a new `main img` URL to be identical across two reads; exclude pre-existing assets and user-upload images | CODE, not live. Not an SSE generation contract. [W4][W11] |
| Download output | In-page `fetch(assetSrc, {credentials:'include'})`; asset URL recognized by `estuary/content`, `files/download`, or `oaiusercontent`; return actual content type and base64 bytes | CODE, not live. [W6][W11] |
| Hide/delete generated conversation | `PATCH /backend-api/conversation/{id}`, cookies plus bearer; JSON `{"is_visible": false}` | CODE, not live. Enabled by default unless `--keep-conversation` or `--keep-tab`; this is not a no-retention guarantee. [W1][W12] |

The generation **wire fields, anti-abuse headers, multipart upload payload, and actual served image-model identifier remain unknown here**. Browser-owned submission is precisely why this repository cannot be cited as an implemented JSON schema for those things. Inspecting a successful authorized browser generation's request/response would be needed to verify them; no such browser session was reachable in this run. [W4][W10][E1]

The upstream default creates/uses an `imagegen` project and deletes the generated conversation after retrieving the image. Project errors warn and fall back to a plain chat; deletion errors warn and leave history behind. Those are upstream side effects, not behavior to adopt automatically in OMP. OpenAI says removing an image from My images requires deleting its conversation. [W1][W3][W12][O1]

## 3. Web capability/limit rows for the routing table

**Every row is explicitly unverified against live image generation.** CODE means the adapter has that behavior; DOC means OpenAI describes the product capability. These labels must not be collapsed into “live supported.” The last column gives the missing verification condition, not approval to obtain a new login. [E1]

| Capability | Source-grounded web behavior / limit | Verification status | Exact missing prerequisite before locking a web support row |
|---|---|---|---|
| Text-to-image prompt | Types natural language asking the built-in generator to create an image. Current ChatGPT Images documentation supports it. [W2][W4][O1] | CODE-RUN + DOC; **not live** | Eligible authenticated web path; one completed generation with inspected output and served model. |
| Explicit Flare vs Sunburst | No `gpt-image-2.5-*`, Flare, or Sunburst selection in the executable. `--web-model` selects chat-tier labels, default `Instant,Auto`; selection is best-effort and may leave the old tier selected. `--model` is not consumed by `run_web`. OpenAI introduces Flare/Sunburst as API model names; that is not a web selector contract. [W0][W1][W13][O2] | CODE + DOC; **web model identity unknown** | Observe a web selector/request field for the required exact ID and authoritative returned model identity; never equate Instant with Flare or Thinking/Pro with Sunburst. |
| Arbitrary aspect ratio | Officially promptable or selected through the web editor's aspect-ratio picker. Repo appends `Aspect ratio / size: {size}.` unless `auto`. [W2][O1] | CODE-RUN + DOC; **not live** | Eligible web generation and measured output dimensions for the requested ratio. |
| Exact pixel size / smallest generation | CLI accepts a free-form size string (`auto` or e.g. `1024x1024`, `1536x1024`, `1024x1536`); web converts it to prose, not a structured size field. No guaranteed exact pixel dimensions or smallest billable size established by the inspected web sources. [W2][W14][O1] | CODE-RUN; **not live / no hard size guarantee** | Capture accepted web size controls and inspect actual image dimensions; cannot assume a `256x256` prompt produces a tiny-cost image. |
| Existing-image edit / reference-led generation | Repeatable `--ref` attaches local files or downloaded HTTP(S) references; edit text asks preservation of the canonical subject. Style/composition references are distinguished by prose and image order. [W2][W10][W15][O1][O4] | CODE-RUN + DOC; **not live** | Eligible authenticated upload path; confirmed attached files and an actual edited output, not merely a text acknowledgment. |
| Multiple input images | Adapter uploads a list. First-party guidance recommends a small set and identifying each image's role/order. ChatGPT publishes no fixed maximum count here; it depends on size and accompanying text. [W10][O4][O5] | CODE + DOC; **not live** | Successful multi-image attachment/edit for the proposed route limits. Do not copy another transport's image-count maximum. |
| Input formats and limits | Adapter sniffing accepts PNG/JPEG/WebP and caps downloaded reference URLs at 25 MiB; web upload path does not use its Codex 5 MiB-base64 resize budget. Official ChatGPT image-input FAQ lists PNG/JPEG/non-animated GIF and 20 MB/image. PNG/JPEG are the documented intersection; WebP and GIF differ between code and docs. [W15][W16][O5] | CODE + DOC; **not live; mismatch explicit** | Upload probes for format-specific rows and boundary behavior. Do not advertise 25 MiB as an OpenAI limit or GIF as supported by this adapter. |
| Region selection / mask-based edit | ChatGPT's editor has a visual selection tool; highlights can be imprecise and edits can extend beyond them. The repository implements neither selection-tool interaction nor an explicit mask argument/payload. Location can be described in the prompt. [W0][W2][W4][O1] | CODE + DOC; **no adapter mask contract, not live** | Capture the web editor's selection representation and successfully exercise a region edit before claiming a routable mask contract. |
| Multi-turn refinement | ChatGPT product supports iterative editing in the same conversation. This CLI opens a new chat on each call and deletes it by default; stable browser `--session` does not mean continuation of the image conversation. Reattaching the previous output is a new reference edit. [W1][O2] | CODE + DOC; **not live** | Explicit continuation design plus retained conversation/image identity and a successful follow-up edit. |
| Transparent background / remove background | Current official docs describe requesting transparent backgrounds; the adapter can carry that prompt. It has no web `background=transparent` control or alpha validation. [W2][W4][O1][O2] | CODE + DOC; **not live** | Inspect a generated/edited file's real alpha channel; a checkerboard-looking image is insufficient. |
| Quality, compression, output format | No web quality/compression control is implemented. Although the CLI parses `--format`, the web prompt deliberately omits it and the browser result carries actual MIME type, not a guaranteed requested format. [W2][W4][W14] | CODE; **not live / no structured control** | Capture any real web parameter and verify resulting bytes; do not advertise public Images API knobs on this route. |
| Multiple generated outputs / `n` | Adapter selects the last fresh image element and returns one image's bytes. It does not expose a count parameter or preserve every generated image as an output collection. [W4][W11] | CODE; **not live** | Observe multi-image output and implement collection/identity semantics before claiming batch support. |
| Partial images / progress / cancellation | Adapter polls UI streaming state and waits for a stable final asset; it is not an SSE partial-image client. The inspected web routine has no explicit server-side generation cancellation request. Closing a tab cannot be represented as confirmed cancellation. [W1][W4][W11] | CODE; **not live** | Capture and exercise actual partial-result/cancellation semantics; verify server completion/cancellation state rather than tab state. |
| Account/workspace eligibility | OpenAI says Images is available across all tiers; image availability and limits depend on plan/workspace settings, and linked teen account controls can prevent creation/editing. Profile detection cannot identify the account. [O1][O4][W5] | DOC + CODE; **not live for this account** | Eligible existing session with matching account/workspace identity and applicable permissions. |
| Thinking / Pro | Current Help Center says images with thinking is available on Plus/Pro/Business and coming to Enterprise/Edu. Upstream code comments say Pro lacks an image generator and force Instant/Auto. These describe different/stale tier semantics; neither proves a current Pro selection fails nor maps to Sunburst. [O1][W9][W13] | DOC/CODE **conflict; not live** | Inspect this account's current model picker and complete an image using the exact relevant mode. |
| Quotas and rate limits | Repo treats browser generation as ChatGPT-chat usage rather than Codex usage. Official docs distinguish web plan/workspace limits and included Codex image usage; Free has separate image-tool limits. Numeric image quota, reset window, and a universal safe rate are not established here. [W8][O3][O4][O6] | DOC + upstream observations; **not live / no numeric quota verified** | Observe this account's quota/limit metadata or in-product notices; do not exhaust quota to test it. |
| Concurrency / timeouts / retries | Upstream serializes web calls to **one** by default; this is a client safety default, not a provider maximum. Default total timeout is 300 seconds. It recognizes “Too many requests” UI dialogs and does not silently retry a post-submit rate-limit failure on Codex. [W4][W7][W16] | CODE; **not live** | Account-specific operational evidence; keep concurrency conservative and distinguish failure before vs after possible submission. |
| Temporary Chat | Pinned upstream code deliberately avoids it, asserting image generation is disabled there. That assertion was not retested against current ChatGPT and is not an independently established current service limitation. [W9] | Upstream comment + CODE; **not live** | Authorized observation in Temporary Chat before stating a present-day platform restriction; unnecessary for current ineligible route. |

## 4. ChatGPT UI chrome is not a generation transport capability

Distinguish **not implemented by this adapter**, **UI interaction rather than a model parameter**, and **unavailable on the web**. A browser session can ordinarily interact with web UI; it is therefore incorrect to label every ChatGPT feature “impossible through a web session.” What this repository actually drives is the composer, chat-tier picker, attachments, project organization, completion detection, and asset retrieval. [W1][W3][W4][W10][W13]

| UI feature | Correct routing treatment and evidence | Verification / prerequisite |
|---|---|---|
| Images home/library, browsing, Copy/Save/Share, image deletion | ChatGPT product UI, not generation model capabilities. Repo downloads bytes and optionally hides its own chat; it does not implement browsing the image library, clipboard/OS-share integrations, or general library management. [O1][W4][W12] | DOC/CODE, **not live**. Separate authorized UI automation/host handling would be needed, not another image model flag. |
| Templates browser, categories, customization and follow-up option cards | Documented ChatGPT UI flow; not yet available in Work mode. Repo styles are its own prompt/reference assets, **not ChatGPT Templates**. Template browsing/cards are not implemented in `run_web`. [O1][O3][W1][W14] | DOC/CODE, **not live**. Need actual surfaced template workflow before automating; ordinary text prompting is not template-UI parity. |
| Selection brush, highlight overlay, brush size, Undo/Redo/Cancel, aspect-ratio picker | Interactive editor state; underlying edit/aspect-ratio intent can be expressed by text, but that does not drive the selection UI or preserve mask/selection semantics. [O1][W2][W4] | DOC/CODE, **not live**. Requires separate editor interaction and verified submitted selection representation. |
| Sketch drawing canvas, mobile image comments/Resize/Remove, mobile Prompt template → Copy link | Current Help Center instructions specifically describe these as **mobile-app** workflows. A ChatGPT **web** session must not be promised control of native mobile gestures, drawing controls, share sheets or app integrations. The announcement's broader `@Sketch`/web link means universal web absence is **not proved**; investigate any web rollout separately. Uploading an externally drawn sketch is reference-image input, not operating the Sketch canvas. [O1][O2][O3] | DOC, **not live**. Requires the applicable actual surface and an authorized UI driver; native mobile controls cannot be executed as web generation parameters. |
| Focused view / Canvas view / multi-select image comments | First-party image-generation documentation places these instructions in the **app** surface section, while its web section only documents asking/attaching images. Do not transfer app-only instructions into a guaranteed ChatGPT web contract. [O4] | DOC, **not live**. Web availability and UI interactions must be observed independently. |
| Animated loading dots / Snake waiting game | Release notes describe rollout/platform-dependent loading chrome; Snake is not available in Work mode. Neither is an output-image capability, request parameter, generation-progress contract, or required OMP feature. [O3] | DOC, **not live**. No image-routing support flag; optional host UX is a separate concern. |

**Bottom line:** core creative intents (text, references, changes, aspect ratio, transparency) are documented on ChatGPT, but UI chrome is not transported merely by holding a web session token. Preserve the distinction between prompting an intent and driving its particular editor/mobile UI. Do not claim parity or absolute impossibility where only the adapter's absence or a platform-specific documentation example is known. [O1][O2][O4][W1][W2][W4]

## 5. Local verification and unresolved prerequisites

### E1 — access checks, not generation tests

Executed during this investigation:

- `browser.open(name='chatweb-research-readonly', app={relay: true, target: 'chatgpt.com'})` failed with **“Browser open timed out after 30000ms”**. No managed ChatGPT tab was created; cleanup subsequently reported no tab with that name.
- `command -v chrome-use agent-browser agent-browser-stealth abs` returned exit code 1 with no output: the upstream browser-control binaries were not on PATH.
- Inspected local listening endpoints. The available Chrome CDP endpoint identified itself as **HeadlessChrome** and had **no ChatGPT target**. The OMP relay discovery endpoint returned HTTP 503. No unrelated tab was navigated or modified.
- The standard Chrome profile's `DevToolsActivePort` file was absent. A **read-only aggregate query** against the discovered `Default/Cookies` database for host `%chatgpt.com%` and cookie name `__Secure-next-auth.session-token%` returned **0 matching rows**. No cookie value was selected/decrypted. This is evidence only about that discovered profile, not proof that the user has no authenticated browser anywhere.
- Parent directed stopping access attempts and preserving unverified rows. **Generations: 0. Edits: 0. New logins: 0. Credential material copied or saved: 0. Tracker operations: 0.**

**Exact remaining prerequisite:** an already-authenticated, controllable, permitted ChatGPT web path derived from the existing OMP session is not available/established. Independently, explicit Flare/Sunburst web selection is not established. Without those, generation/edit probes cannot decide live capability rows without violating the session/model constraints. These are unresolved conditions for routing, not evidence that documented creative capabilities fail. [H1][H3][W1][W13]

### E2 — executed code-only prompt experiment

Executed only `_composition_clause` and `_build_web_text` from the pinned upstream source in memory; no repository code was installed/executed as a CLI and no network generation occurred. [W2]

| Inputs | Actual function output |
|---|---|
| prompt `one black dot on white`, size `auto` | `Create an image with your built-in image generator: one black dot on white.` |
| same prompt, size `256x256` | `Create an image with your built-in image generator: one black dot on white. Aspect ratio / size: 256x256.` |
| prompt `change the dot to blue`, one character/reference image, size `1:1` | `Edit the attached image directly with your built-in image generator: change the dot to blue. Keep the reference as the canonical subject — reproduce its pattern, colours, and texture faithfully. Aspect ratio / size: 1:1.` |

This proves prompt construction and the **absence of a structured web size field in that function**, not output dimensions, generation quality, edit fidelity, or model choice. Literal source search also found no `gpt-image-2.5`, standalone `flare`, `sunburst`, `--quality`, or `--mask` option in the executable. [W0][W2]

## Sources

Upstream repository sources are primary evidence of **its own implementation**, not official OpenAI API promises. OMP local source links refer to the installed 18.1.16 dependency snapshot inspected for this research. OpenAI sources are current product documentation/announcements and may change. [W0][H0][O1][O2]

[W0]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen
[W1]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1653-L1788
[W2]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L563-L627
[W3]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1303-L1417
[W4]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1870-L2019
[W5]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1034-L1094
[W6]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1287-L1341
[W7]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1563-L1651
[W8]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/docs/how-it-works.md#web-backend-default
[W9]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L151-L187
[W10]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1820-L1897
[W11]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1242-L1301
[W12]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1418-L1459
[W13]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1460-L1552
[W14]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L4826-L5014
[W15]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L1790-L1818
[W16]: https://github.com/leeguooooo/chatgpt-imagegen/blob/da18b2fd18dc733a4a056528cecc5a4ddc5a3c5d/chatgpt-imagegen#L102-L139

[H0]: ../node_modules/@oh-my-pi/pi-ai/package.json
[H1]: ../node_modules/@oh-my-pi/pi-ai/src/registry/oauth/types.ts
[H2]: ../node_modules/@oh-my-pi/pi-ai/src/registry/oauth/openai-codex.ts
[H3]: ../node_modules/@oh-my-pi/pi-ai/src/auth-storage.ts
[H4]: ../node_modules/@oh-my-pi/pi-catalog/src/compat/rules/auth/openai-codex.kdl

[O1]: https://help.openai.com/en/articles/11084440-im
[O2]: https://openai.com/index/introducing-chatgpt-images-2-5/
[O3]: https://help.openai.com/en/articles/6825453
[O4]: https://learn.chatgpt.com/docs/image-generation
[O5]: https://help.openai.com/en/articles/8400551-chatgpt-image-inputs-faq
[O6]: https://help.openai.com/en/articles/9275245-using-chatgpts-free-tier-faq
[E1]: #e1--access-checks-not-generation-tests
[E2]: #e2--executed-code-only-prompt-experiment
