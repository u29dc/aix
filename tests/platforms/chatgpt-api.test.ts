import { describe, expect, test } from "bun:test";

import { getRequestUrl } from "@tests/helpers";

import { ChatGPTApiUnavailableError, extractChatGPTConversationFromApi, type ChatGPTTurnShell } from "@/platforms/chatgpt-api";

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function createFetcher(handler: (input: string, init: RequestInit | undefined) => Response | Promise<Response>): typeof fetch {
	return (async (input: RequestInfo | URL, init?: RequestInit) => handler(getRequestUrl(input), init)) as typeof fetch;
}

const shells: ChatGPTTurnShell[] = [
	{ id: "user-1", role: "user" },
	{ id: "assistant-1", role: "assistant" },
	{ id: "context-1", role: "assistant" },
	{ id: "code-1", role: "assistant" },
	{ id: "tool-1", role: "assistant" },
];

function conversationFixture(): Record<string, unknown> {
	const mapping: Record<string, unknown> = {};
	const addNode = (id: string, parent: string | null, role: string, content: Record<string, unknown>, metadata: Record<string, unknown> = {}): void => {
		mapping[id] = {
			id,
			parent,
			message: { id, author: { role }, content, metadata },
		};
	};

	addNode(
		"user-1",
		null,
		"user",
		{
			content_type: "multimodal_text",
			parts: [{ content_type: "audio_transcription", text: "# Literal *prompt*" }],
		},
		{ attachments: [{ name: "brief.md", mime_type: "text/markdown" }] },
	);
	addNode("assistant-1", "user-1", "assistant", {
		content_type: "text",
		parts: ["## Answer\n\n- one"],
	});
	addNode("context-1", "assistant-1", "system", { content_type: "text", parts: [""] });
	addNode("context-hidden", "context-1", "assistant", {
		content_type: "model_editable_context",
		model_set_context: "internal-model-context",
	});
	addNode("context-final", "context-hidden", "assistant", {
		content_type: "text",
		parts: ["Context **note**"],
	});
	addNode("code-1", "context-final", "assistant", {
		content_type: "code",
		language: "type<script>",
		text: "const ok = true;",
	});
	addNode("tool-1", "code-1", "tool", {
		content_type: "tether_browsing_display",
		summary: "",
		result: "",
	});
	addNode("tool-noise", "tool-1", "tool", {
		content_type: "text",
		parts: ["private tool output"],
	});
	addNode("tool-final", "tool-noise", "assistant", {
		content_type: "tether_browsing_display",
		summary: "Research summary",
		result: "Raw result",
	});

	return {
		current_node: "tool-final",
		mapping,
	};
}

describe("extractChatGPTConversationFromApi", () => {
	test("uses ordered shell IDs and keeps credentials out of exported messages", async () => {
		const secretToken = "token-that-must-never-leak";
		const calls: Array<{ input: string; init: RequestInit | undefined }> = [];
		const fetcher = createFetcher((input, init) => {
			calls.push({ input, init });
			if (input === "/api/auth/session") {
				return jsonResponse({ accessToken: secretToken, account: { id: "account-1" } });
			}
			return jsonResponse(conversationFixture());
		});

		const messages = await extractChatGPTConversationFromApi({
			conversationId: "conversation/id",
			shells,
			fetcher,
		});

		expect(calls.map((call) => call.input)).toEqual(["/api/auth/session", "/backend-api/conversation/conversation%2Fid"]);
		const conversationHeaders = new Headers(calls[1]?.init?.headers);
		expect(conversationHeaders.get("Authorization")).toBe(`Bearer ${secretToken}`);
		expect(conversationHeaders.get("ChatGPT-Account-ID")).toBe("account-1");
		expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "assistant", "assistant", "assistant"]);
		expect(messages[0]?.markdown).toContain("\\# Literal \\*prompt\\*");
		expect(messages[0]?.markdown).toContain("brief.md (text/markdown)");
		expect(messages[1]?.markdown).toBe("## Answer\n\n- one");
		expect(messages[2]?.markdown).toBe("Context **note**");
		expect(messages[3]?.markdown).toBe("```typescript\nconst ok = true;\n```");
		expect(messages[4]?.markdown).toBe("Research summary");
		expect(JSON.stringify(messages)).not.toContain(secretToken);
		expect(JSON.stringify(messages)).not.toContain("internal-model-context");
		expect(JSON.stringify(messages)).not.toContain("private tool output");
	});

	test("does not expose credentials in request failures", async () => {
		const secretToken = "another-secret-token";
		const fetcher = createFetcher((input) => {
			if (input === "/api/auth/session") {
				return jsonResponse({ accessToken: secretToken, account: { id: "account-1" } });
			}
			return jsonResponse({ detail: "upstream failure" }, 503);
		});

		try {
			await extractChatGPTConversationFromApi({
				conversationId: "conversation-1",
				shells: [{ id: "user-1", role: "user" }],
				fetcher,
			});
			throw new Error("Expected API extraction to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ChatGPTApiUnavailableError);
			expect(String(error)).toContain("HTTP 503");
			expect(String(error)).not.toContain(secretToken);
		}
	});

	test("rejects unsupported visible content instead of producing a partial export", async () => {
		const fetcher = createFetcher((input) => {
			if (input === "/api/auth/session") {
				return jsonResponse({ accessToken: "token", account: { id: "account-1" } });
			}
			return jsonResponse({
				current_node: "image-1",
				mapping: {
					"image-1": {
						id: "image-1",
						parent: null,
						message: {
							id: "image-1",
							author: { role: "user" },
							content: {
								content_type: "multimodal_text",
								parts: [{ content_type: "image_asset_pointer", asset_pointer: "private-pointer" }],
							},
						},
					},
				},
			});
		});

		await expect(
			extractChatGPTConversationFromApi({
				conversationId: "conversation-1",
				shells: [{ id: "image-1", role: "user" }],
				fetcher,
			}),
		).rejects.toThrow("unsupported visible turn");
	});

	test("replaces file citation markers using safe display metadata", async () => {
		const marker = "fileciteturn0file0L1-L2";
		const text = `Result ${marker}.`;
		const fetcher = createFetcher((input) => {
			if (input === "/api/auth/session") {
				return jsonResponse({ accessToken: "token", account: { id: "account-1" } });
			}
			return jsonResponse({
				current_node: "assistant-1",
				mapping: {
					"assistant-1": {
						id: "assistant-1",
						parent: null,
						message: {
							id: "assistant-1",
							author: { role: "assistant" },
							content: { content_type: "text", parts: [text] },
							metadata: {
								citations: [
									{
										start_ix: "Result ".length,
										end_ix: "Result ".length + marker.length,
										metadata: { name: "brief.pdf" },
									},
								],
							},
						},
					},
				},
			});
		});

		const messages = await extractChatGPTConversationFromApi({
			conversationId: "conversation-1",
			shells: [{ id: "assistant-1", role: "assistant" }],
			fetcher,
		});
		expect(messages[0]?.markdown).toBe("Result [Source: brief.pdf].");
	});

	test("rejects unresolved citation markers so rendered DOM can resolve them", async () => {
		const fetcher = createFetcher((input) => {
			if (input === "/api/auth/session") {
				return jsonResponse({ accessToken: "token", account: { id: "account-1" } });
			}
			return jsonResponse({
				current_node: "assistant-1",
				mapping: {
					"assistant-1": {
						id: "assistant-1",
						parent: null,
						message: {
							id: "assistant-1",
							author: { role: "assistant" },
							content: {
								content_type: "multimodal_text",
								parts: [{ content_type: "text", text: "Answer citesource" }],
							},
						},
					},
				},
			});
		});

		await expect(
			extractChatGPTConversationFromApi({
				conversationId: "conversation-1",
				shells: [{ id: "assistant-1", role: "assistant" }],
				fetcher,
			}),
		).rejects.toThrow("unsupported visible turn");
	});

	test("rejects missing and duplicate visible turn identifiers", async () => {
		const fetcher = createFetcher(() => {
			throw new Error("fetch should not run for duplicate IDs");
		});

		await expect(
			extractChatGPTConversationFromApi({
				conversationId: "conversation-1",
				shells: [
					{ id: "duplicate", role: "user" },
					{ id: "duplicate", role: "assistant" },
				],
				fetcher,
			}),
		).rejects.toThrow("identifiers were not unique");
	});
});
