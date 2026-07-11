import { describe, expect, test } from 'bun:test';
import { loadFixture } from '@tests/helpers';
import { prepareChatGPTConversationForExport } from '@/platforms/chatgpt';

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('ChatGPT API export flow', () => {
	test('exports virtualized shells without scrolling', async () => {
		const container = document.createElement('div');
		container.innerHTML = loadFixture('chatgpt-thread-virtualized.html');
		document.body.appendChild(container);

		const originalLocation = window.location;
		Object.defineProperty(window, 'location', {
			value: {
				...originalLocation,
				href: 'https://chatgpt.com/c/synthetic',
				pathname: '/c/synthetic',
			},
			writable: true,
		});

		const turns = Array.from(
			container.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn-"]'),
		);
		for (const turn of turns) {
			turn.scrollIntoView = () => {
				throw new Error('API-first export must not scroll');
			};
		}

		let requestCount = 0;
		const fetcher = (async (input: RequestInfo | URL) => {
			requestCount += 1;
			if (String(input) === '/api/auth/session') {
				return jsonResponse({
					accessToken: 'synthetic-token',
					account: { id: 'synthetic-account' },
				});
			}

			const mapping: Record<string, unknown> = {};
			let parent: string | null = null;
			let currentNode = '';
			for (const [index, turn] of turns.entries()) {
				const id = turn.getAttribute('data-turn-id') ?? '';
				const role = turn.getAttribute('data-turn');
				mapping[id] = {
					id,
					parent,
					message: {
						id,
						author: { role },
						content: {
							content_type: 'multimodal_text',
							parts: [
								{
									content_type: 'audio_transcription',
									text: `Synthetic ${role === 'user' ? 'prompt' : 'answer'} ${Math.floor(index / 2) + 1}`,
								},
							],
						},
					},
				};
				parent = id;
				currentNode = id;
			}
			return jsonResponse({ current_node: currentNode, mapping });
		}) as typeof fetch;

		try {
			const messages = await prepareChatGPTConversationForExport({ fetcher });
			expect(requestCount).toBe(2);
			expect(messages.map((message) => message.markdown)).toEqual([
				'Synthetic prompt 1',
				'Synthetic answer 1',
				'Synthetic prompt 2',
				'Synthetic answer 2',
				'Synthetic prompt 3',
				'Synthetic answer 3',
			]);
		} finally {
			Object.defineProperty(window, 'location', {
				value: originalLocation,
				writable: true,
			});
			container.remove();
		}
	});
});
