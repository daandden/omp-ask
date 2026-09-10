// Flexible Ask: shadow the built-in `ask` tool, changing ONLY the option-count
// guidance, then delegate execution to the native tool.
//
// Minimal-diff contract: ./flexible-ask.md mirrors
// `packages/coding-agent/src/prompts/tools/ask.md` verbatim except the single
// `<caution>` line (2-5 cap -> no fixed count). Keep it that way; any other
// prose drift is a bug. Prompt lives in a static .md, never built in code.
//
// Why shadow (not fork): last-extension-wins replaces the model-facing
// description while `ctx.invokeTool` runs the real AskTool (UI picker,
// timeout, tree re-answer, approval tier). No reimplementation to drift.
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import flexibleAskDescription from "./flexible-ask.md" with { type: "text" };

export default function flexibleAsk(pi: ExtensionAPI) {
	const type = pi.arktype;
	const parameters = type({
		questions: type({
			id: "string",
			question: "string",
			"header?": "string",
			options: type({
				label: "string",
				"description?": "string",
				"preview?": "string",
			}).array(),
			"multi?": "boolean",
			"recommended?": "number",
		})
			.array()
			.atLeastLength(1),
	});

	pi.registerTool<typeof parameters>({
		name: "ask",
		label: "Ask",
		description: flexibleAskDescription.trimEnd(),
		parameters,
		// Native ask is read-tier; omitted defaults to exec and would
		// re-prompt/deny differently. Keep the tier.
		approval: "read",
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			if (!ctx.invokeTool) throw new Error("Native ask tool unavailable for delegation");
			return ctx.invokeTool(params, { signal, onUpdate });
		},
	});
}
