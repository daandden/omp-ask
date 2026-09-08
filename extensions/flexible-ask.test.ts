import { describe, expect, test } from "bun:test";
import flexibleAsk from "./flexible-ask";

// Minimal zod stub: every builder returns a chainable that absorbs anything.
// We assert this repo's contract (name/tier/description/delegation), not the
// host's schema engine.
function chain(): any {
	const fn: any = (..._args: any[]) => fn;
	return new Proxy(fn, {
		get: (_t, prop) => {
			if (prop === Symbol.toPrimitive) return () => 0;
			return (..._args: any[]) => fn;
		},
		apply: () => fn,
	});
}

function mockPi() {
	let def: any;
	return {
		captured: () => def,
		pi: {
			zod: new Proxy(
				{},
				{
					get: () => (..._args: any[]) => chain(),
				},
			),
			registerTool: (d: any) => {
				def = d;
			},
		},
	};
}

// Stock lines from packages/coding-agent/src/prompts/tools/ask.md that must
// survive verbatim — the ONLY allowed prose change is the <caution> line.
const PRESERVED = [
	"Multiple approaches with significantly different tradeoffs user should weigh.",
	"Use `questions` for related questions, not one at a time.",
	"Set `multi: true` on a question to allow multiple selections.",
	"Short option labels; explanatory tradeoffs in `description`, not labels.",
	"If multiple choices acceptable: pick most conservative/standard option; proceed; state choice.",
	'Do NOT include "Other"; UI automatically adds "Other (type your own)" to every question.',
];

describe("flexible-ask", () => {
	test("shadows ask at read tier with no fixed option cap", () => {
		const { pi, captured } = mockPi();
		flexibleAsk(pi as any);
		const def = captured();
		expect(def.name).toBe("ask");
		expect(def.approval).toBe("read");
		expect(def.description).not.toContain("2-5");
		expect(def.description).toMatch(/no fixed count/i);
	});

	test("description is the static .md, preserving all stock lines", async () => {
		const { pi, captured } = mockPi();
		flexibleAsk(pi as any);
		const def = captured();
		const md = await Bun.file(new URL("./flexible-ask.md", import.meta.url)).text();
		expect(def.description).toBe(md.trimEnd());
		for (const line of PRESERVED) expect(def.description).toContain(line);
	});

	test("delegates execution to the native tool with params intact", async () => {
		const { pi, captured } = mockPi();
		flexibleAsk(pi as any);
		const def = captured();
		const params = { questions: [{ id: "q", question: "Go?", options: [{ label: "Yes" }] }] };
		const sentinel = { content: [{ type: "text", text: "ok" }] };
		let seen: any;
		const ctx: any = {
			invokeTool: async (p: any, _opts: any) => {
				seen = p;
				return sentinel;
			},
		};
		const result = await def.execute("call-1", params, undefined, undefined, ctx);
		expect(result).toBe(sentinel);
		expect(seen).toBe(params);
	});
});
