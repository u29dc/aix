import { describe, expect, test } from 'bun:test';
import { loadFixture } from '@tests/helpers';
import { prepareChatGPTConversationForExport } from '@/platforms/chatgpt';

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('ChatGPT virtualized export flow', () => {
	test('hydrates turn shells before returning an ordered snapshot', async () => {
		const container = document.createElement('div');
		container.innerHTML = loadFixture('chatgpt-thread-virtualized.html');
		document.body.appendChild(container);
		const originalLocation = window.location;
		Object.defineProperty(window, 'location', {
			value: {
				...originalLocation,
				href: 'https://chatgpt.com/c/synthetic-fallback',
				pathname: '/c/synthetic-fallback',
			},
			writable: true,
		});

		const scrollRoot = container.querySelector('.synthetic-scroll-root');
		const turns = Array.from(
			container.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn-"]'),
		);
		if (!(scrollRoot instanceof HTMLElement)) throw new Error('Synthetic scroll root missing');

		let syntheticScrollHeight = 600;
		Object.defineProperties(scrollRoot, {
			clientHeight: { configurable: true, value: 100 },
			scrollHeight: { configurable: true, get: () => syntheticScrollHeight },
		});
		scrollRoot.scrollTop = 500;

		const hydratePair = (startIndex: number): void => {
			for (const turn of turns) turn.replaceChildren();

			for (const index of [startIndex, startIndex + 1]) {
				const turn = turns[index];
				if (!turn) continue;
				const role = turn.getAttribute('data-turn') as 'user' | 'assistant';
				const content = document.createElement('div');
				content.className = role === 'user' ? 'whitespace-pre-wrap' : 'markdown';
				content.textContent = `Synthetic ${role === 'user' ? 'prompt' : 'answer'} ${Math.floor(index / 2) + 1}`;
				const message = document.createElement('div');
				message.setAttribute('data-message-author-role', role);
				message.appendChild(content);
				turn.appendChild(message);
			}
		};

		for (const [index, turn] of turns.entries()) {
			turn.scrollIntoView = () => {
				syntheticScrollHeight = 900;
				scrollRoot.scrollTop = index * 100;
				hydratePair(index - (index % 2));
			};
		}
		let apiRequestCount = 0;
		const unavailableFetcher = (async () => {
			apiRequestCount += 1;
			return jsonResponse({ detail: 'unavailable' }, 503);
		}) as unknown as typeof fetch;

		try {
			// The fixture starts with only the final pair hydrated, matching a chat
			// opened at the bottom of a progressively loaded conversation. A failed
			// API request proves the compatibility fallback still completes locally.
			const messages = await prepareChatGPTConversationForExport({
				hydrationTimeoutMs: 100,
				pollIntervalMs: 1,
				fetcher: unavailableFetcher,
			});

			expect(apiRequestCount).toBe(1);
			expect(messages.map((message) => message.role)).toEqual([
				'user',
				'assistant',
				'user',
				'assistant',
				'user',
				'assistant',
			]);
			expect(messages.map((message) => message.markdown)).toEqual([
				'Synthetic prompt 1',
				'Synthetic answer 1',
				'Synthetic prompt 2',
				'Synthetic answer 2',
				'Synthetic prompt 3',
				'Synthetic answer 3',
			]);
			expect(scrollRoot.scrollTop).toBe(800);
		} finally {
			Object.defineProperty(window, 'location', {
				value: originalLocation,
				writable: true,
			});
			container.remove();
		}
	});
});
