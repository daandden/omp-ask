# OMP host image/auth/registration findings

Research ticket: [#2](https://github.com/daandden/omp-tools/issues/2), part of [#1](https://github.com/daandden/omp-tools/issues/1). Investigated 2026-09-10. Scope: existing `openai-codex`/ChatGPT subscription only; no new login, API-key Images route, or other-provider implementation. Other providers appear below only to explain a native fallback hazard.

## Answer

**OMP can host a standalone, drop-in `generate_image` replacement with the bundled image tool disabled; a distinct tool identity is not required.** The local `omp.tools` entry already owns that name by loading a custom factory after the bundled image custom tool, and the SDK bridges custom tools into the same extension registry used by `registerTool`. The bundle's `generate_image.enabled` gate does not gate plugin discovery; neither the schema nor result is reserved to OMP's implementation. [R1][R2][R3][R4][P1] Both custom-tool and extension contexts expose the existing session's `modelRegistry`, whose `authStorage` owns OAuth selection, refresh, and credential backoff; an OAuth-only accessor/helper is available, so no independent login or credential store is needed. [A1][A2][A3][A4] The native implementation supplies structured prompting, reference-image loading, hosted Codex Responses transport, SSE decoding, temporary image files and image details, but it has a narrow fixed wire configuration and no native image-model argument. [N1][N2][N3][N4] Crucially, native `provider: "openai-codex"` is a **priority hint, not an exclusivity guarantee**: typed HTTP failures can fall through to other credentialed providers, and general API-key resolution can return overrides/static credentials. Therefore a subscription-only replacement must enforce OAuth-only credentials and Codex-only routing before dispatch rather than retaining the native fallback loop. [F1][F2][A2][P2]

## Evidence scope

- The repository pins `pi-agent-core`, `pi-ai`, and `pi-coding-agent` to **18.1.16**; installed `pi-ai`, `pi-coding-agent`, and `pi-catalog` metadata also report 18.1.16. Runtime exports and `omp --version` were checked, the latter returning `omp/18.1.16`. Findings concern these pinned sources, not an assumed latest upstream implementation. [L1][V1][P1]
- Local source, tests and README were read before SDK source. The wrapper tests use a loopback echo server and synthetic authorization values: they prove request rewriting and isolation, not provider capability, subscription entitlement or refresh behavior. README's earlier Flare HTTP-200/WebP smoke is historical evidence; its own warning says `details.model` does not establish backend image-model identity. This investigation did **zero live generation or quota calls**. [L2][L3][L4][P2]
- Context7's upstream extension documentation was consulted for discovery; pinned source is authoritative for collision precedence, auth and transport here. No tracker, branch, implementation or map writes were performed. [D1]

## 1. Native surface and current wrapper

| Surface | Observed contract |
| --- | --- |
| Export and execution | Host exports `imageGenTool` and `imageGenSchema`. Tool name `generate_image`, label `GenerateImage`, `strict: false`, `approval: "write"`. Custom execute signature is `(toolCallId, params, onUpdate, ctx, signal)`, whereas extension definitions use `(toolCallId, params, signal, onUpdate, ctx)`. The SDK adapts the order. [N7][R3][R10][P1] |
| Required input | Only `subject: string` is required. Optional string fields: `action`, `scene`, `composition`, `lighting`, `style`, `text`; `changes?: string[]`; `input?: {path?, data?, mime_type?}[]`; `aspect_ratio`, `image_size`, `provider`. `action` is prose describing the subject, **not** the wire generate/edit selector. [N1][N2] |
| Size and ratio | Schema ratios: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `3:2`, `2:3`; explicit sizes: `1024x1024`, `1536x1024`, `1024x1536`. Codex/OpenAI only accept the first five through this implementation; the two extra ratios are xAI-specific and skipped/rejected on Codex. For hosted OpenAI requests explicit `image_size` wins; portrait ratios map to `1024x1536`, landscape to `1536x1024`, square to `1024x1024`. This is the native adapter's mapping, not proof of exact arbitrary-aspect backend support. [N1][N3][F2] |
| Reference inputs | Local files or inline base64/data URLs, not a dedicated remote URL field. A local file is read relative to session cwd, sniffed for image MIME, and capped at 35 MiB. Raw base64 requires `mime_type`; a data URL can supply it. The 35 MiB check is on the **path** branch, not an equivalent bound on inline data. Inputs become `input_image` data URLs with `detail: "auto"`. [N3][N5] |
| Native request controls | Presence of input images selects `action: "edit"`, otherwise `"generate"`; output is fixed to **WebP**. Forces `tool_choice: {type:"image_generation"}`, `store:false`; Codex sets `stream:true` and image instructions. Native schema/wire expose no quality, compression, background, mask, output format, image count, image-model selector, or previous-response/conversation editing identifier. Absence is an OMP limitation, not a claim about the remote backend. [N1][N3] |
| Current model override | Wrapper merges optional `image_model` restricted to `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst`, defaults Flare, removes the extra parameter before native execution and injects a call-local fetch. It rewrites the first `image_generation` tool's `model` in string-JSON requests whose pathname ends in `/responses`; it does not change the top-level chat model, impose a hostname restriction, or stop fallback. [L2][L3] |
| Orchestrating model | Native uses a qualifying active `openai`/`openai-codex` GPT/o3 Responses model; for subscription generation without active Codex it chooses the first available in `gpt-5.5`, `gpt-5.4`, `gpt-5.1`, `gpt-5`, `gpt-5-codex`, then another qualifying Codex model. This priority selects the **orchestrator**, not Flare/Sunburst. [N6] |
| Lifetime/progress | One three-minute combined cancellation signal covers the native provider loop and auth attempts. `_onUpdate` is unused. SSE consumption accepts final output-item events and completed/done response events, not incremental image-preview callbacks. [N1][N4][F2] |

### Native result and the replacement's contract

Native returns text summary content plus `details` containing `provider`, **orchestrator** `model`, `imageCount`, `imagePaths`, inline `images: {data,mimeType}[]`, and optional response text/revised prompt/token usage. Images are saved under OS temp as `omp-image-<id>.<ext>`; the model-facing summary includes those paths. The collector does not preserve a returned image-backend model identity. A zero-image result, including refusal text, returns normally with empty image arrays rather than setting an error flag. [N4][N5][N7][P2]

A replacement may own its schema, execute function, result details and optional renderers; the custom-tool-to-extension bridge forwards its result rather than applying an image-specific result conversion. For drop-in display compatibility, preserve the useful image/file fields: the TUI reads `content` image blocks and `details.images` (also `details.xdev.inner.images`) **by shape**, not only by the `generate_image` name. Putting inline images in details preserves display without putting the base64 payload in text content. Ordinary approval and large-output artifact handling still apply. This is a compatibility recommendation, not a requirement to retain the misleading orchestrator-only `details.model` convention. [R3][R6][R8][R10][P1]

## 2. Existing subscription authentication and refresh

1. **Reuse the executing context, not a new login.** Both entry types receive `ctx.modelRegistry`; its `authStorage` is the instance shared by session/SDK. The factory additionally receives injected coding-agent exports as `api.pi`. Standalone execution does not need `ctx.invokeTool`. `discoverAuthStorage()` is a SDK entry point for an external probe: it discovers a configured broker or the existing local SQLite store, not an interactive login. A configured broker replaces the local store and is not silently bypassed on failure. A plugin already inside OMP should use the host instance rather than rediscovering it. [A1][A5][R4][R5]
2. **Stored credential shape.** Codex uses OAuth access and refresh tokens plus expiry; the profile hook enriches account/workspace id, email and organization/plan labels. The declarative Codex grant requests `openid profile email offline_access api.connectors.read api.connectors.invoke`; refresh is sent to `https://auth.openai.com/oauth/token`. These are bearer credentials, not exported ChatGPT browser cookies. No cookie/session-token conversion is provided by the inspected Codex mapping or native image transport. Do not infer browser-web API access from possession of this OAuth token. [A6][A7][A12][N8]
3. **Actual hosted image HTTP authentication.** Default URL is `https://chatgpt.com/backend-api/codex/responses`. Native sets bearer authorization, `chatgpt-account-id` from the JWT when present, token-derived residency, `OpenAI-Beta: responses=experimental`, `originator: omp`, user agent and session/conversation headers. It removes `x-api-key`. Native also honors the selected model's `baseUrl` and headers, so official Codex origin is a default, not an unconditional routing restriction. [N8][N9]
4. **Refresh belongs to OMP.** `ModelRegistry.resolver(model, sessionId)` derives provider/base URL/model scope; `getApiKey`/provider resolution delegates to auth storage. Stored OAuth is automatically refreshed when needed (60-second freshness skew); refreshes share in-flight work per credential and use durable leases where supported. Override/store refresh hooks take precedence over local provider refresh, preserving broker ownership. Keep that pipeline instead of caching an access token or independently exchanging the refresh token. [A3][A8][A9]
5. **Generic “API key” resolution is not an OAuth-only guarantee.** Its precedence is runtime override → configured provider key → stored OAuth → login API key → environment key → other stored API key → fallback resolver; model-registry command/config handling can also deliberately override the provider. `authStorage.getOAuthAccess("openai-codex", sessionId, options)` uses the same OAuth refresh pipeline but returns bearer plus identity, and returns undefined if OAuth is unavailable or runtime/config overrides replace it. This is the useful no-API-key seam. [A2][A3]
6. **OAuth-only retry helper exists.** `@oh-my-pi/pi-ai` exports `withOAuthAccess`, accepting the host auth-storage-shaped object, provider id, callback receiving `{accessToken, credentialId, accountId, ...}`, session id and abort signal. It has no login path or API-key fallback; ordinary `withAuth(modelRegistry.resolver(...), ...)` is the native implementation's less restrictive helper. [A4][A10][P1]
7. **Do not assume the custom context injects HTTP transport.** Although `CustomToolContext` declares optional `fetch` and `settings`, the normal SDK bridge constructs its custom context without either; the current wrapper explicitly supplies its own fetch closure before calling native. An extension has the registry/session seam, not a documented automatically injected HTTP client. [A1][L2][R13]
8. **Refresh is not necessarily account pinning.** Native helpers can rotate to another *already stored* credential. `withOAuthAccess` refreshes the current account on 401, then can rotate a sibling; 403/usage-limit failures skip refresh and rotate directly. If “the existing subscription session” is later specified to mean one exact workspace/credential, that requires an explicit no-sibling policy rather than assuming the default helper pins it. No new authentication should be initiated when existing access cannot be recovered. [A4][A10]

## 3. Quota, errors and routing facts later tickets depend on

### Mandatory no-fallback boundary

The native order builder appends, with duplicates removed:

1. Explicit per-call provider when not `auto`.
2. Configured `providers.imageOrder` entries.
3. Active model's image provider (`openai-codex` maps to the `openai` active-model lookup).
4. Built-in order: `openai`, `openai-codex`, `antigravity`, `xai`, `openrouter`, `gemini`, `deepinfra`. [F1][F3]

Credentialless candidates are skipped. The `openai` lookup can in fact return the active Codex hosted model; `openai-codex` lookup avoids duplicating that active-model case. A caught `ProviderHttpError` is recorded and advances to the next candidate unless cancellation fired; this includes request rejection as well as throttling. Exhausting credentialed candidates throws `AggregateError` with inner HTTP errors and a generic provider-list summary. In particular, **setting provider priority alone cannot satisfy subscription-only routing**. [N6][F2][P2]

**Enforcement recommendation:** perform OAuth-only availability/identity selection and select only the official Codex transport before dispatch. Do not call stock `imageGenTool.execute` as the standalone routing implementation unless its provider-search behavior is replaced: its entire native loop is behind that call, and the current fetch model override does not constrain it. Do not let a missing OAuth grant become a request using an API key or another image provider. [L2][A2][F1][F2]

### Error and retry boundaries

| Condition | What the pinned host actually does |
| --- | --- |
| Ordinary HTTP 401/auth failure | With a resolver, `withAuth` tries refresh-current then at most one normal sibling switch; repeated bearer/cycle checks and a 64 total-attempt ceiling bound the helper. Static string keys get one attempt. [A10] |
| HTTP 403, account-policy denial, quota exhaustion | Normally rotates existing sibling credentials directly without force-refresh. Transient concurrency-cap 403 is excluded. Distinct account/quota rotations may continue within the same total-attempt bound. This is not a generic backoff/replay loop. [A10][E1] |
| HTTP 429 | Classification distinguishes recognizable account quota from transient “Too many requests”/per-minute throttling. Bare/opaque usage-limit statuses have a conservative quota rule. Do not interpret every 429 as subscription exhaustion or promise the same retry behavior. [E1][E2] |
| Usage-limited stored credential | Host records temporary backoff, default 60 seconds when it lacks timing, potentially extended by a usage report's exhausted-window reset. Selection reranks around blocked credentials; no-sibling usage rotation stops resolution rather than immediately selecting the blocked fallback again. This is credential selection/backoff, **not an automatic sleep-and-retry guarantee for an image tool call**. [A3][A11][A13] |
| HTTP transport error envelope | Native image code preserves numeric status and response headers in `ProviderHttpError`, but reduces the JSON body to `error.message`/raw text and does **not** pass `error.code`/`error.type` into the available `code` property. Code-only quota/policy detail can be lost. The final `AggregateError` can further hide detail from a caller that only prints its message. [N4][E3][F2][P2] |
| `Retry-After` | Native HTTP error carries headers, but the image path has no generic delayed HTTP retry loop. Model-registry rotation explicitly does not honor Retry-After as a wait; auth storage's usage rotation extracts hints from the error message and consults usage reports. A replacement must not claim that preserving headers automatically makes its requests wait/retry correctly. [A3][A14][N4][P2] |
| SSE `error` / `response.failed` | Throws a plain `Error` containing the message, without HTTP status or structured code. Text-based auth classification can still act on recognizable messages; otherwise it propagates immediately, rather than entering the HTTP-error provider fallback branch. [N4][E1][F2][P2] |
| Empty/refusal output | Normal tool result with imageCount 0 and response text, not an explicit error result; callers must distinguish no-image from success. [N4][N7][P2] |
| Cancellation / local-input failure | Aborts and non-HTTP failures propagate; local input loading happens before the provider try/catch. The three-minute deadline covers the overall native attempt sequence. [N5][F2] |

### Quota visibility is not an image allowance contract

OMP's Codex usage provider reads OAuth-authenticated `GET /backend-api/wham/usage` on the canonical ChatGPT origin. It parses plan type, primary/secondary percentage/window/reset information, allowed/limit-reached flags and generic additional metered-feature windows; it can also expose reset-credit information. Unsuccessful usage HTTP/parse paths can yield no report, so an unavailable report is **unknown**, not evidence of unlimited quota. [Q1][Q2]

Its ranking strategy explicitly gates regular requests on normal chat windows and Spark requests on Spark windows; additional non-Spark meters are not used as the normal request's gating set. The native image request passes the orchestrator model id to this credential machinery and returns token `usage`, not an image-specific remaining-count/reset contract. There is **no source-grounded fixed number of Flare/Sunburst images, per-image credit debit, equality with ChatGPT web image limits, or reliable image-generation quota preflight** in the inspected host. Do not hard-code any of those in downstream tickets. Percentage/reset fields describe the report's windows; they are not proof of backend image allowance. [Q1][Q3][N4][F2]

## 4. Drop-in versus distinct identity verdict

**Verdict: keep `generate_image` if the intended product is a replacement; distinct identity is optional UX, not a host requirement.**

- The existing manifest has `omp.extensions: ["./extensions/flexible-ask.ts"]` and `omp.tools: "./tools/image-gen.ts"`. These are different authoring entry points, not different tool-name namespaces. `omp.tools` may return a standalone `CustomTool` instead of spreading the native tool; `omp.extensions` may call `api.registerTool` with its own schema/result. [L1][R1][R3][R5]
- Why today's custom name does not conflict: `builtInToolNames` is captured before bundled image tools are appended. The true built-in factory map does not contain `generate_image`; bundled image-gen is a custom tool. The custom loader rejects duplicates against true built-ins and earlier discovered custom tools, but not the separately appended bundled image. The SDK then registers bundle followed by plugin; same-extension `Map.set(name, ...)` keeps the last registration. Across extensions, effective lookup is also last-extension-wins. [R2][R4][R7][R11][R12][P1]
- `generate_image.enabled: false` skips only adding the bundled image entry. Plugin custom-tool loading continues and can register `generate_image`; an extension with that name can also stand alone. Conversely, with native enabled, a custom-tools bridge appended after ordinary extensions can overwrite an earlier extension's same-name registration; disabling the bundle and removing the old wrapper avoids reliance on incidental precedence. Restricted sessions / explicit custom-tool policies remain separate restrictions and must not be bypassed. [R2][R4][R8]
- `ctx.invokeTool` is for same-name **native built-in** delegation, resolved from the native registry captured before extension overrides. Image-gen is on the custom-tool bridge path, not that built-in map; when the bundle is disabled there is certainly no native image implementation to delegate to. Standalone means implementing execution rather than requiring this delegation hook. The current wrapper calls the injected `pi.imageGenTool.execute` directly, explaining why its availability is independent of the bundle's switch. [R8][R9][L2]
- Name ownership does not provide new image backend capabilities, guarantee native schema compatibility after rework, or prove Flare/Sunburst acceptance remotely. Those are separate transport/contract decisions. Drop-in *registration* and result ownership are established here. [N1][R3][P1]

## 5. Scoped executed evidence

No project test suite, formatter, linter, full-session UI launch, credential-store inspection or live image generation was performed. Two one-off `bun -e` probes exercised the pinned code with synthetic contexts/HTTP responses and no additional files; these are protocol/registration-boundary experiments, not backend acceptance tests. The PATH Bun is x86_64 and failed loading the installed arm64 native addon; the successful probes used the already-installed `/Users/vanguyen/.local/share/mise/installs/bun/latest/bin/bun` (arm64 1.3.14). [P1][P2]

### P1 — exports and registration boundary

Executed real `loadCustomTools` on the existing wrapper with `Object.keys(BUILTIN_TOOLS)`, then real `loadExtensionFromFactory` / `registerTool` / `customToolToDefinition` with the bundled registration either omitted or supplied first. Also registered and executed a synthetic standalone same-name custom tool and asserted result object identity.

```json
{"exports":{"name":"generate_image","schema":true},"customToolLoadErrors":[],"registrationCases":[{"nativeEnabled":false,"effectiveName":"generate_image","registrations":1,"wrapperWins":true},{"nativeEnabled":true,"effectiveName":"generate_image","registrations":1,"wrapperWins":true}],"standaloneSameNameResultPreserved":true,"networkRequests":0}
```

Here `nativeEnabled` denotes inclusion/omission of native registration in the probe; it is not a claim that a complete SDK session was launched with those settings. The settings-to-registration branch is established by source [R2]. AuthStorage, SqliteAuthCredentialStore and `withOAuthAccess` exports were also successfully imported from the pinned packages.

### P2 — native error/fallback boundary

Executed actual `imageGenTool.execute` with synthetic registry credentials and an injected fetch returning local `Response` objects. No response contained image bytes, so no output images were saved. Assertions covered explicit Codex preference falling through after a synthetic HTTP 429, single-provider aggregate details, a non-auth SSE failure stopping fallback, and a refusal returning zero images normally.

```json
{"explicitCodexHttp429":{"calls":["chatgpt.com","generativelanguage.googleapis.com"],"resultProvider":"gemini"},"codexOnlyHttp429":{"aggregate":true,"status":429,"retryAfter":"120","machineCodePreserved":false},"sseFailure":{"errorType":"Error","fallbackCalls":0},"refusal":{"imageCount":0,"isErrorSet":false,"model":"gpt-5.5"},"liveNetworkRequests":0}
```

The Gemini branch was a synthetic negative-routing fixture, not an actual request to another provider. No actual quota amount or provider success is inferred from this experiment.

## Primary sources

All relative SDK links below target the installed **18.1.16** source. Upstream repository identity comes from package metadata, not a secondary write-up. Line anchors identify the inspected ranges. `[P1]` and `[P2]` refer to the executed observations immediately above.

[L1]: ../package.json#L12-L24
[L2]: ../tools/image-gen.ts#L9-L55
[L3]: ../tools/image-gen.test.ts#L5-L68
[L4]: ../README.md#L99-L109
[V1]: ../node_modules/@oh-my-pi/pi-coding-agent/package.json#L1-L16
[D1]: https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md
[N1]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L70-L105
[N2]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L113-L142
[N3]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L883-L945
[N4]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L953-L1107
[N5]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L787-L864
[N6]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L669-L721
[N7]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L1224-L1344
[N8]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L996-L1038
[N9]: ../node_modules/@oh-my-pi/pi-catalog/src/wire/codex.ts#L1-L126
[F1]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L724-L785
[F2]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-gen.ts#L1224-L1776
[F3]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/image-providers.ts#L9-L21
[A1]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/custom-tools/types.ts#L57-L105
[A2]: ../node_modules/@oh-my-pi/pi-ai/src/auth-storage.ts#L5928-L6044
[A3]: ../node_modules/@oh-my-pi/pi-coding-agent/src/config/api-key-resolver.ts#L44-L87
[A4]: ../node_modules/@oh-my-pi/pi-ai/src/auth-retry.ts#L276-L435
[A5]: ../node_modules/@oh-my-pi/pi-coding-agent/src/session/auth-broker-config.ts#L1-L106
[A6]: ../node_modules/@oh-my-pi/pi-ai/src/registry/oauth/types.ts#L4-L31
[A7]: ../node_modules/@oh-my-pi/pi-catalog/src/compat/rules/auth/openai-codex.kdl#L1-L37
[A8]: ../node_modules/@oh-my-pi/pi-coding-agent/src/config/model-registry.ts#L2428-L2506
[A9]: ../node_modules/@oh-my-pi/pi-ai/src/auth-storage.ts#L5483-L5620
[A10]: ../node_modules/@oh-my-pi/pi-ai/src/auth-retry.ts#L86-L270
[A11]: ../node_modules/@oh-my-pi/pi-ai/src/auth-storage.ts#L4770-L4877
[A12]: ../node_modules/@oh-my-pi/pi-ai/src/registry/oauth/openai-codex.ts#L89-L111
[A13]: ../node_modules/@oh-my-pi/pi-ai/src/auth-storage.ts#L1342-L1343
[A14]: ../node_modules/@oh-my-pi/pi-ai/src/auth-storage.ts#L6827-L6881
[E1]: ../node_modules/@oh-my-pi/pi-ai/src/error/auth-classify.ts#L29-L56
[E2]: ../node_modules/@oh-my-pi/pi-ai/src/error/rate-limit.ts#L309-L357
[E3]: ../node_modules/@oh-my-pi/pi-ai/src/error/classes.ts#L7-L29
[Q1]: ../node_modules/@oh-my-pi/pi-ai/src/usage/openai-codex.ts#L396-L561
[Q2]: ../node_modules/@oh-my-pi/pi-ai/src/usage/openai-codex-base-url.ts#L1-L35
[Q3]: ../node_modules/@oh-my-pi/pi-ai/src/usage/openai-codex.ts#L564-L612
[R1]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/plugins/loader.ts#L420-L469
[R2]: ../node_modules/@oh-my-pi/pi-coding-agent/src/sdk.ts#L2085-L2136
[R3]: ../node_modules/@oh-my-pi/pi-coding-agent/src/sdk.ts#L1014-L1058
[R4]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/loader.ts#L154-L187
[R5]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/types.ts#L458-L532
[R6]: ../node_modules/@oh-my-pi/pi-coding-agent/src/modes/components/tool-execution.ts#L539-L581
[R7]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/custom-tools/loader.ts#L126-L190
[R8]: ../node_modules/@oh-my-pi/pi-coding-agent/src/sdk.ts#L2840-L2908
[R9]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/runner.ts#L540-L590
[R10]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/custom-tools/types.ts#L210-L265
[R11]: ../node_modules/@oh-my-pi/pi-coding-agent/src/tools/index.ts#L461-L497
[R12]: ../node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/extensions/runner.ts#L889-L906
[R13]: ../node_modules/@oh-my-pi/pi-coding-agent/src/sdk.ts#L963-L972
[P1]: #p1--exports-and-registration-boundary
[P2]: #p2--native-errorfallback-boundary
