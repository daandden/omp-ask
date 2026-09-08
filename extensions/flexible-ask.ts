// @ts-nocheck — runs inside omp; install @oh-my-pi/pi-coding-agent for types.
// Flexible Ask: shadow the built-in `ask` tool with a description that has
// no fixed 2-5 option cap, then delegate execution to the native tool.
//
// Why shadow (not fork): last-extension-wins replaces the model-facing
// description while `ctx.invokeTool` runs the real AskTool (UI picker,
// timeout, tree re-answer, approval tier). No reimplementation to drift.
//
// Contract: keep the params shape identical to the native tool
// (questions[].options[] + header/preview/multi/recommended) so calls the
// model already makes still validate. Only the prose changes.
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function flexibleAsk(pi: ExtensionAPI) {
	const z = pi.zod;

	pi.registerTool({
		name: "ask",
		label: "Ask",
		description: [
			"Ask user for clarification/input during task execution.",
			"",
			"Provide as many concise, distinct options as there are materially different tradeoffs — no fixed count. 1 option for a confirm, 2+ otherwise. Each option must change what you do next; drop filler.",
			"Short option labels; explanatory tradeoffs in `description`, not labels.",
			"Use `questions` for related questions, not one at a time. Set `multi: true` to allow multiple selections. `recommended: <index>` marks the default (0-indexed); ' (Recommended)' is added automatically.",
			"Default to action. Resolve ambiguity via repo conventions, existing patterns, reasonable defaults. Exhaust existing sources before asking. Ask only when options have materially different tradeoffs the user must decide.",
			'Do NOT include "Other"; UI automatically adds "Other (type your own)" to every question.',
		].join("\n"),
		parameters: z.object({
			questions: z
				.array(
					z.object({
						id: z.string(),
						question: z.string(),
						header: z.string().optional(),
						options: z.array(
							z.object({
								label: z.string(),
								description: z.string().optional(),
								preview: z.string().optional(),
							}),
						),
						multi: z.boolean().optional(),
						recommended: z.number().optional(),
					}),
				)
				.min(1),
		}),
		// Native ask is read-tier; omitted defaults to exec and would
		// re-prompt/deny differently. Keep the tier.
		approval: "read",
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			if (!ctx.invokeTool) throw new Error("Native ask tool unavailable for delegation");
			return ctx.invokeTool(params, { signal, onUpdate });
		},
	});
}
