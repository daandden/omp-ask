import type { AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import type { FetchImpl } from "@oh-my-pi/pi-ai";
import type { CustomToolAPI, CustomToolContext } from "@oh-my-pi/pi-coding-agent/extensibility/custom-tools/types";

interface ImageRequest {
	tools?: Array<{ type: string; model?: string }>;
}

/** Scope the wire-model override to this call; never replace global fetch. */
export function withImageModel(fetchImpl: FetchImpl, model: string): FetchImpl {
	return (input, init) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (!new URL(url).pathname.endsWith("/responses") || typeof init?.body !== "string") {
			return fetchImpl(input, init);
		}

		// The native image tool constructs this JSON, not an untrusted caller.
		const body = JSON.parse(init.body) as ImageRequest;
		const imageTool = body.tools?.find(tool => tool.type === "image_generation");
		if (!imageTool) return fetchImpl(input, init);

		imageTool.model = model;
		return fetchImpl(input, { ...init, body: JSON.stringify(body) });
	};
}

export default function imageGeneration({ pi, arktype }: CustomToolAPI) {
	const native = pi.imageGenTool;
	const parameters = pi.imageGenSchema.merge({
		"image_model?": arktype
			.enumerated("gpt-image-2.5-flare", "gpt-image-2.5-sunburst")
			.describe("OpenAI image model; default: gpt-image-2.5-flare. Other image providers are unchanged."),
	});

	return {
		...native,
		parameters,
		async execute(
			toolCallId: string,
			params: typeof parameters.infer,
			onUpdate: AgentToolUpdateCallback<unknown, typeof parameters> | undefined,
			ctx: CustomToolContext,
			signal?: AbortSignal,
		) {
			const { image_model = "gpt-image-2.5-flare", ...nativeParams } = params;
			return native.execute(
				toolCallId,
				nativeParams,
				onUpdate,
				{ ...ctx, fetch: withImageModel(ctx.fetch ?? globalThis.fetch, image_model) },
				signal,
			);
		},
	};
}
