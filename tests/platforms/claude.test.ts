import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createClaudeAssistantMessage, createClaudeUserMessage, createElement } from '@tests/helpers';
import { deriveClaudeTitle, extractClaudeConversation, isEligibleClaudeConversation } from '@/platforms/claude';

describe('isEligibleClaudeConversation', () => {
	const originalLocation = window.location;

	beforeEach(() => {
		Object.defineProperty(window, 'location', {
			value: { ...originalLocation },
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			value: originalLocation,
			writable: true,
		});
	});

	test('returns true for valid Claude chat URL', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/12345678-1234-1234-1234-123456789abc' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(true);
	});

	test('returns true for UUID with trailing slash', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/12345678-1234-1234-1234-123456789abc/' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(true);
	});

	test('returns false for root path', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for /chat without ID', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for /chat/ without ID', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for invalid UUID format', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/not-a-uuid' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for settings page', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/settings' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});
});

describe('deriveClaudeTitle', () => {
	let originalTitle: string;

	beforeEach(() => {
		originalTitle = document.title;
	});

	afterEach(() => {
		document.title = originalTitle;
		const titleButton = document.querySelector('[data-testid="chat-title-button"]');
		titleButton?.remove();
	});

	test('extracts title from chat-title-button', () => {
		const titleButton = createElement('button', { 'data-testid': 'chat-title-button' }, ['My Conversation']);
		document.body.appendChild(titleButton);
		expect(deriveClaudeTitle()).toBe('My Conversation');
	});

	test('trims whitespace from title button', () => {
		const titleButton = createElement('button', { 'data-testid': 'chat-title-button' }, ['  Spaced Title  ']);
		document.body.appendChild(titleButton);
		expect(deriveClaudeTitle()).toBe('Spaced Title');
	});

	test('falls back to document.title when button not found', () => {
		document.title = 'Chat Title - Claude';
		expect(deriveClaudeTitle()).toBe('Chat Title');
	});

	test('removes suffix after pipe in document.title', () => {
		document.title = 'My Chat | Claude';
		expect(deriveClaudeTitle()).toBe('My Chat');
	});

	test('handles document.title with no suffix', () => {
		document.title = 'Simple Title';
		expect(deriveClaudeTitle()).toBe('Simple Title');
	});

	test('returns empty string when no title available', () => {
		document.title = '';
		expect(deriveClaudeTitle()).toBe('');
	});
});

describe('extractClaudeConversation', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createElement('main');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	test('extracts user message', () => {
		const userMsg = createClaudeUserMessage('Hello Claude!');
		container.appendChild(userMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.role).toBe('user');
		expect(messages[0]?.markdown).toContain('Hello Claude');
	});

	test('extracts assistant message', () => {
		const assistantMsg = createClaudeAssistantMessage('Hello! How can I help?');
		container.appendChild(assistantMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.role).toBe('assistant');
		expect(messages[0]?.markdown).toContain('Hello');
	});

	test('extracts multi-turn conversation in order', () => {
		container.appendChild(createClaudeUserMessage('First question'));
		container.appendChild(createClaudeAssistantMessage('First answer'));
		container.appendChild(createClaudeUserMessage('Second question'));
		container.appendChild(createClaudeAssistantMessage('Second answer'));

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(4);
		expect(messages[0]?.role).toBe('user');
		expect(messages[1]?.role).toBe('assistant');
		expect(messages[2]?.role).toBe('user');
		expect(messages[3]?.role).toBe('assistant');
	});

	test('returns empty array when no messages found', () => {
		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(0);
	});

	test('handles streaming message state', () => {
		const streamingMsg = createClaudeAssistantMessage('', true);
		container.appendChild(streamingMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('streaming');
		expect(messages[0]?.markdown).toContain('skipped');
	});

	test('deduplicates consecutive identical messages', () => {
		const wrapper1 = createElement('div');
		const wrapper2 = createElement('div');

		const user1 = createClaudeUserMessage('Same message');
		const user2 = createClaudeUserMessage('Same message');

		wrapper1.appendChild(user1);
		wrapper2.appendChild(user2);
		container.appendChild(wrapper1);
		container.appendChild(wrapper2);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
	});

	test('extracts message with inline formatting', () => {
		const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [
			createElement('p', undefined, ['Text with ', createElement('strong', undefined, ['bold']), ' and ', createElement('code', undefined, ['code'])]),
		]);
		const assistantMsg = createClaudeAssistantMessage(content);
		container.appendChild(assistantMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('**bold**');
		expect(messages[0]?.markdown).toContain('`code`');
	});

	test('extracts message with code block', () => {
		const codeBlock = createElement('pre', undefined, [createElement('code', { class: 'language-javascript' }, ['const x = 1;'])]);
		const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [codeBlock]);
		const assistantMsg = createClaudeAssistantMessage(content);
		container.appendChild(assistantMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('```javascript');
		expect(messages[0]?.markdown).toContain('const x = 1;');
	});

	test('falls back to chat-main testid when main not found', () => {
		container.remove();
		const altContainer = createElement('div', { 'data-testid': 'chat-main' });
		altContainer.appendChild(createClaudeUserMessage('Test message'));
		document.body.appendChild(altContainer);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);

		altContainer.remove();
	});
});
