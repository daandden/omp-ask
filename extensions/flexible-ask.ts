// @ts-nocheck — runs inside omp; install @oh-my-pi/pi-coding-agent for types.
// Flexible Ask: shadow the built-in `ask` tool, changing ONLY the option-count
// guidance, then delegate execution to the native tool.
//
// Minimal-diff contract: description below mirrors
// `packages/coding-agent/src/prompts/tools/ask.md` verbatim except the single
// `<caution>` line (2-5 cap -> no fixed count). Keep it that way; any other
// prose drift is a bug.
//
// Why shadow (not fork): last-extension-wins replaces the model-facing
// description while `ctx.invokeTool` runs the real AskTool (UI picker,
// timeout, tree re-answer, approval tier). No reimplementation to drift.
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function flexibleAsk(pi: ExtensionAPI) {
	const z = pi.zod;

	pi.registerTool({
		name: "ask",
		label: "Ask",
		description: [
			"Ask user for clarification/input during task execution.",
			"",
			"<conditions>",
			"- Multiple approaches with significantly different tradeoffs user should weigh.",
			"</conditions>",
			"",
			"<instruction>",
			'- `recommended: <index>` marks default (0-indexed); " (Recommended)" added automatically.',
			"- Use `questions` for related questions, not one at a time.",
			"- Set `multi: true` on a question to allow multiple selections.",
			"- Short option labels; explanatory tradeoffs in `description`, not labels.",
			"</instruction>",
			"",
			"<caution>",
			"- Provide as many concise, distinct options as there are materially different tradeoffs — no fixed count (1 for a confirm, 2+ otherwise).",
			"</caution>",
			"",
			"<critical>",
			"- Default to action. Resolve ambiguity via repo conventions, existing patterns, reasonable defaults. Exhaust existing sources (code, configs, docs, history) before asking. Ask only when options have materially different tradeoffs the user must decide.",
			"- If multiple choices acceptable: pick most conservative/standard option; proceed; state choice.",
			'- Do NOT include "Other"; UI automatically adds "Other (type your own)" to every question.',
			"</critical>",
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
