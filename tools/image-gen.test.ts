import { afterAll, expect, test } from "bun:test";
import { withImageModel } from "./image-gen";

const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		return Response.json({
			body: await request.text(),
			authorization: request.headers.get("authorization"),
			account: request.headers.get("chatgpt-account-id"),
		});
	},
});
afterAll(() => server.stop(true));

interface ReceivedRequest {
	body: string;
	authorization: string | null;
	account: string | null;
}

test("concurrent image requests select independent models without changing chat model, edit inputs, or Codex auth", async () => {
	const request = {
		model: "chat-model",
		input: [{ role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,aW1hZ2U=" }] }],
		tools: [{ type: "image_generation", action: "edit", model: "old-image-model", output_format: "webp" }],
		stream: true,
	};
	const init = {
		method: "POST",
		headers: { authorization: "Bearer synthetic-token", "chatgpt-account-id": "synthetic-account" },
		body: JSON.stringify(request),
	};
	const models = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"];
	const received = await Promise.all(
		models.map(async model => {
			const response = await withImageModel(fetch, model)(new URL("/backend-api/codex/responses", server.url), init);
			return (await response.json()) as ReceivedRequest;
		}),
	);
	for (const [index, result] of received.entries()) {
		expect(JSON.parse(result.body)).toEqual({
			...request,
			tools: [{ ...request.tools[0], model: models[index] }],
		});
		expect(result.authorization).toBe("Bearer synthetic-token");
		expect(result.account).toBe("synthetic-account");
	}
	// Reusing the caller's request cannot inherit another call's selected image model.
	expect(JSON.parse(init.body).tools[0].model).toBe("old-image-model");
});

test("non-image Responses calls and other providers retain their original wire bytes", async () => {
	const wrapped = withImageModel(fetch, "gpt-image-2.5-flare");
	const requests = [
		{ path: "/v1/responses", body: '{ "model": "chat-model", "tools": [{"type":"web_search"}] }' },
		{ path: "/v1/images/generations", body: '{ "model": "another-provider-image-model", "prompt": "image" }' },
	];
	for (const request of requests) {
		const response = await wrapped(new URL(request.path, server.url), { method: "POST", body: request.body });
		const received = (await response.json()) as ReceivedRequest;
		expect(received.body).toBe(request.body);
	}
});
