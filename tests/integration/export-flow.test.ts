import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createClaudeAssistantMessage, createClaudeUserMessage, createElement, loadFixture, parseHTML } from '@tests/helpers';
import { composeMarkdown } from '@/parsers/markdown';
import { extractClaudeConversation } from '@/platforms/claude';

describe('Claude Export Flow Integration', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createElement('main');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	describe('single message export', () => {
		test('exports single user message', () => {
			container.appendChild(createClaudeUserMessage('Hello Claude!'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test Chat', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('# Test Chat');
			expect(markdown).toContain('**User:**');
			expect(markdown).toContain('Hello Claude');
		});

		test('exports single assistant message', () => {
			container.appendChild(createClaudeAssistantMessage('Hello! How can I help you today?'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('**Assistant:**');
			expect(markdown).toContain('Hello');
		});

		test('exports assistant message with multiple markdown sections', () => {
			const thinking = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [createElement('p', undefined, ['Thinking block text'])]);
			const answer = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [createElement('p', undefined, ['Final response text'])]);
			const content = createElement('div', undefined, [thinking, answer]);

			container.appendChild(createClaudeAssistantMessage(content));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('Thinking block text');
			expect(markdown).toContain('Final response text');
			expect(markdown.indexOf('Thinking block text')).toBeLessThan(markdown.indexOf('Final response text'));
		});
	});

	describe('multi-turn conversation export', () => {
		test('exports conversation with proper message order', () => {
			container.appendChild(createClaudeUserMessage('First question'));
			container.appendChild(createClaudeAssistantMessage('First answer'));
			container.appendChild(createClaudeUserMessage('Second question'));
			container.appendChild(createClaudeAssistantMessage('Second answer'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Multi-turn', 'claude', 'Claude', 'https://claude.ai/chat/123');

			const userMatches = markdown.match(/\*\*User:\*\*/g);
			const assistantMatches = markdown.match(/\*\*Assistant:\*\*/g);

			expect(userMatches).toHaveLength(2);
			expect(assistantMatches).toHaveLength(2);

			expect(markdown.indexOf('First question')).toBeLessThan(markdown.indexOf('First answer'));
			expect(markdown.indexOf('First answer')).toBeLessThan(markdown.indexOf('Second question'));
		});

		test('adds 100-char separator between messages', () => {
			container.appendChild(createClaudeUserMessage('Question'));
			container.appendChild(createClaudeAssistantMessage('Answer'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			const separator = '='.repeat(100);
			expect(markdown).toContain(separator);
		});

		test('does not end with separator', () => {
			container.appendChild(createClaudeUserMessage('Question'));
			container.appendChild(createClaudeAssistantMessage('Answer'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			const separator = '='.repeat(100);
			expect(markdown.trimEnd().endsWith(separator)).toBe(false);
		});
	});

	describe('code block export', () => {
		test('exports message with code block', () => {
			const codeBlock = createElement('pre', undefined, [createElement('code', { class: 'language-typescript' }, ['const greeting = "hello";'])]);
			const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [codeBlock]);
			container.appendChild(createClaudeAssistantMessage(content));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Code Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('```typescript');
			expect(markdown).toContain('const greeting = "hello";');
			expect(markdown).toContain('```');
		});

		test('preserves code indentation', () => {
			const code = `function test() {
  if (true) {
    return 1;
  }
}`;
			const codeBlock = createElement('pre', undefined, [createElement('code', { class: 'language-javascript' }, [code])]);
			const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [codeBlock]);
			container.appendChild(createClaudeAssistantMessage(content));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('  if (true) {');
			expect(markdown).toContain('    return 1;');
		});
	});

	describe('list export', () => {
		test('exports unordered list', () => {
			const list = createElement('ul', undefined, [
				createElement('li', undefined, ['First item']),
				createElement('li', undefined, ['Second item']),
				createElement('li', undefined, ['Third item']),
			]);
			const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [list]);
			container.appendChild(createClaudeAssistantMessage(content));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'List Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('- First item');
			expect(markdown).toContain('- Second item');
			expect(markdown).toContain('- Third item');
		});

		test('exports ordered list', () => {
			const list = createElement('ol', undefined, [createElement('li', undefined, ['Step one']), createElement('li', undefined, ['Step two'])]);
			const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [list]);
			container.appendChild(createClaudeAssistantMessage(content));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('1. Step one');
			expect(markdown).toContain('2. Step two');
		});
	});

	describe('table export', () => {
		test('exports table with headers and rows', () => {
			const table = createElement('table', undefined, [
				createElement('tr', undefined, [createElement('th', undefined, ['Name']), createElement('th', undefined, ['Value'])]),
				createElement('tr', undefined, [createElement('td', undefined, ['Alpha']), createElement('td', undefined, ['100'])]),
				createElement('tr', undefined, [createElement('td', undefined, ['Beta']), createElement('td', undefined, ['200'])]),
			]);
			const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [table]);
			container.appendChild(createClaudeAssistantMessage(content));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Table Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('| Name | Value |');
			expect(markdown).toContain('| --- | --- |');
			expect(markdown).toContain('| Alpha | 100 |');
			expect(markdown).toContain('| Beta | 200 |');
		});
	});

	describe('streaming message handling', () => {
		test('handles streaming message with placeholder', () => {
			const streamingMsg = createClaudeAssistantMessage('', true);
			container.appendChild(streamingMsg);

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Streaming Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('streaming');
			expect(markdown).toContain('skipped');
		});
	});

	describe('markdown output format', () => {
		test('includes title as h1', () => {
			container.appendChild(createClaudeUserMessage('Test'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'My Chat Title', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown.startsWith('# My Chat Title\n')).toBe(true);
		});

		test('includes platform name in metadata', () => {
			container.appendChild(createClaudeUserMessage('Test'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('Exported from Claude');
		});

		test('includes URL in metadata', () => {
			container.appendChild(createClaudeUserMessage('Test'));

			const messages = extractClaudeConversation();
			const url = 'https://claude.ai/chat/abc-123-def';
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', url);

			expect(markdown).toContain(`URL: ${url}`);
		});

		test('includes ISO timestamp', () => {
			container.appendChild(createClaudeUserMessage('Test'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		test('ends with single newline', () => {
			container.appendChild(createClaudeUserMessage('Test'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, 'Test', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown.endsWith('\n')).toBe(true);
			expect(markdown.endsWith('\n\n')).toBe(false);
		});
	});

	describe('error handling', () => {
		test('handles empty conversation gracefully', () => {
			const messages = extractClaudeConversation();
			expect(messages).toHaveLength(0);

			const markdown = composeMarkdown(messages, 'Empty', 'claude', 'Claude', 'https://claude.ai/chat/123');
			expect(markdown).toContain('# Empty');
		});

		test('uses default title when empty', () => {
			container.appendChild(createClaudeUserMessage('Test'));

			const messages = extractClaudeConversation();
			const markdown = composeMarkdown(messages, '', 'claude', 'Claude', 'https://claude.ai/chat/123');

			expect(markdown).toContain('# AI Conversation');
		});
	});

	describe('fixture-based tests', () => {
		test('parses Claude fixture HTML correctly', () => {
			container.remove();

			const fixtureHtml = loadFixture('claude-message.html');
			const doc = parseHTML(fixtureHtml);
			const main = doc.querySelector('main');
			if (!main) throw new Error('Main element not found in fixture');

			document.body.appendChild(main);

			try {
				const messages = extractClaudeConversation();
				expect(messages.length).toBeGreaterThan(0);

				const hasUser = messages.some((m) => m.role === 'user');
				const hasAssistant = messages.some((m) => m.role === 'assistant');

				expect(hasUser).toBe(true);
				expect(hasAssistant).toBe(true);

				expect(messages[0]?.timestamp).toBe('Feb 13');
				expect(messages[1]?.timestamp).toBe('Feb 13');
				expect(messages[2]?.timestamp).toBe('Feb 14');
				expect(messages[3]?.timestamp).toBe('Feb 14');

				const markdown = composeMarkdown(messages, 'Fixture Chat', 'claude', 'Claude', 'https://claude.ai/chat/fixture');
				expect(markdown).toContain('**User (Feb 13):**');
				expect(markdown).toContain('**Assistant (Feb 14):**');
			} finally {
				main.remove();
			}
		});
	});
});
