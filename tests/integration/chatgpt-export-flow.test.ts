import { describe, expect, test } from 'bun:test';
import { loadFixture } from '@tests/helpers';
import { extractChatGPTConversation } from '@/platforms/chatgpt';

function mountFixture(name: string): HTMLElement {
	const container = document.createElement('div');
	container.innerHTML = loadFixture(name);
	document.body.appendChild(container);
	return container;
}

describe('ChatGPT Export Flow Integration', () => {
	const fixtures = ['chatgpt2.html', 'chatgpt3.html', 'chatgpt4.html', 'chatgpt5.html'];

	for (const fixture of fixtures) {
		test(`extracts messages from ${fixture}`, () => {
			const container = mountFixture(fixture);
			try {
				const messages = extractChatGPTConversation();
				expect(messages.length).toBeGreaterThan(0);
				expect(messages.some((m) => m.role === 'user')).toBe(true);
				expect(messages.some((m) => m.role === 'assistant')).toBe(true);
			} finally {
				container.remove();
			}
		});
	}

	test('extracts markdown-only fixture as assistant message', () => {
		const container = mountFixture('chatgpt1.html');
		try {
			const messages = extractChatGPTConversation();
			expect(messages.length).toBeGreaterThan(0);
			expect(messages[0]?.role).toBe('assistant');
			expect(messages[0]?.markdown).toContain('Markdown Export Fixture');
		} finally {
			container.remove();
		}
	});

	test('captures user attachments', () => {
		const container = mountFixture('chatgpt4.html');
		try {
			const messages = extractChatGPTConversation();
			const withAttachments = messages.find((m) => m.role === 'user' && m.markdown.includes('Attachments'));
			expect(withAttachments?.markdown).toContain('AGENTS.md');
			expect(withAttachments?.markdown).toContain('let.config.toml');
		} finally {
			container.remove();
		}
	});

	test('preserves markdown edge cases in ChatGPT fixtures', () => {
		const container = mountFixture('chatgpt1.html');
		try {
			const messages = extractChatGPTConversation();
			const markdown = messages[0]?.markdown ?? '';
			expect(markdown).toContain('~~strikethrough~~');
			expect(markdown).toContain('underline via HTML');
			expect(markdown).toContain('- [x]');
		} finally {
			container.remove();
		}
	});
});
