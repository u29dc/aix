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
	test('extracts ordered user and assistant turns from a synthetic thread', () => {
		const container = mountFixture('chatgpt-thread-basic.html');
		try {
			const messages = extractChatGPTConversation();
			expect(messages).toHaveLength(4);
			expect(messages.map((message) => message.role)).toEqual([
				'user',
				'assistant',
				'user',
				'assistant',
			]);
			expect(messages[0]?.markdown).toContain('Plan a weekend trip to York');
			expect(messages[1]?.markdown).toContain('## York Weekend Plan');
			expect(messages[3]?.markdown).toContain('Sunday morning');
		} finally {
			container.remove();
		}
	});

	test('extracts markdown-only fixture as assistant message', () => {
		const container = mountFixture('chatgpt-markdown-only.html');
		try {
			const messages = extractChatGPTConversation();
			expect(messages).toHaveLength(1);
			expect(messages[0]?.role).toBe('assistant');
			expect(messages[0]?.markdown).toContain('Markdown Export Fixture');
		} finally {
			container.remove();
		}
	});

	test('captures user attachments and assistant artifacts', () => {
		const container = mountFixture('chatgpt-thread-attachments.html');
		try {
			const messages = extractChatGPTConversation();
			const withAttachments = messages.find(
				(message) => message.role === 'user' && message.markdown.includes('Attachments'),
			);
			expect(withAttachments?.markdown).toContain('brief.md');
			expect(withAttachments?.markdown).toContain('wireframe.png');

			const withArtifacts = messages.find(
				(message) => message.role === 'assistant' && message.markdown.includes('Artifacts'),
			);
			expect(withArtifacts?.markdown).toContain('launch\\-plan.pdf');
		} finally {
			container.remove();
		}
	});

	test('falls back to data-turn role detection for synthetic thread fixtures', () => {
		const container = mountFixture('chatgpt-thread-fallback.html');
		try {
			const messages = extractChatGPTConversation();
			expect(messages).toHaveLength(2);
			expect(messages[0]?.role).toBe('user');
			expect(messages[0]?.markdown).toContain('Fallback user message');
			expect(messages[1]?.role).toBe('assistant');
			expect(messages[1]?.markdown).toContain('**formatted**');
		} finally {
			container.remove();
		}
	});

	test('preserves markdown edge cases in ChatGPT fixtures', () => {
		const container = mountFixture('chatgpt-markdown-only.html');
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
