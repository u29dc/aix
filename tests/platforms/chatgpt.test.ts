import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from '@tests/helpers';
import {
	deriveChatGPTTitle,
	extractChatGPTConversation,
	isEligibleChatGPTConversation,
} from '@/platforms/chatgpt';

function createStandardTurn(
	index: number,
	role: 'user' | 'assistant',
	children: Element[],
): HTMLElement {
	return createElement('article', { 'data-testid': `conversation-turn-${index}` }, [
		createElement('div', { 'data-message-author-role': role }, children),
	]);
}

function createFallbackTurn(
	index: number,
	role: 'user' | 'assistant',
	children: Element[],
): HTMLElement {
	return createElement(
		'article',
		{ 'data-testid': `conversation-turn-${index}`, 'data-turn': role },
		children,
	);
}

describe('isEligibleChatGPTConversation', () => {
	const originalLocation = window.location;

	function setLocation(hostname: string, pathname: string): void {
		Object.defineProperty(window, 'location', {
			value: { ...originalLocation, hostname, pathname },
			writable: true,
		});
	}

	beforeEach(() => {
		setLocation('chatgpt.com', '/');
		document.body.innerHTML = '';
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			value: originalLocation,
			writable: true,
		});
		document.body.innerHTML = '';
	});

	test('returns true when a conversation turn is present on chatgpt.com', () => {
		document.body.appendChild(createElement('article', { 'data-testid': 'conversation-turn-0' }));
		expect(isEligibleChatGPTConversation()).toBe(true);
	});

	test('returns true for legacy chat.openai.com conversation routes without mounted turns', () => {
		setLocation('chat.openai.com', '/c/example-thread');
		expect(isEligibleChatGPTConversation()).toBe(true);
	});

	test('returns true for shared g routes without mounted turns', () => {
		setLocation('chatgpt.com', '/g/example');
		expect(isEligibleChatGPTConversation()).toBe(true);
	});

	test('returns false for non-ChatGPT hosts', () => {
		setLocation('example.com', '/c/example-thread');
		expect(isEligibleChatGPTConversation()).toBe(false);
	});
});

describe('deriveChatGPTTitle', () => {
	let originalTitle = '';

	beforeEach(() => {
		originalTitle = document.title;
	});

	afterEach(() => {
		document.title = originalTitle;
	});

	test('removes the ChatGPT prefix from document.title', () => {
		document.title = 'ChatGPT - Travel Planner';
		expect(deriveChatGPTTitle()).toBe('Travel Planner');
	});

	test('supports pipe-delimited titles', () => {
		document.title = 'ChatGPT | Sanitized Fixture Review';
		expect(deriveChatGPTTitle()).toBe('Sanitized Fixture Review');
	});

	test('returns an empty string when title is blank', () => {
		document.title = '';
		expect(deriveChatGPTTitle()).toBe('');
	});
});

describe('extractChatGPTConversation', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createElement('main');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('extracts user and assistant turns in order', () => {
		container.appendChild(
			createStandardTurn(0, 'user', [
				createElement('div', { class: 'whitespace-pre-wrap' }, ['First prompt']),
			]),
		);
		container.appendChild(
			createStandardTurn(1, 'assistant', [
				createElement('div', { class: 'markdown' }, [
					createElement('p', undefined, ['First answer']),
				]),
			]),
		);

		const messages = extractChatGPTConversation();
		expect(messages).toHaveLength(2);
		expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
		expect(messages[0]?.markdown).toContain('First prompt');
		expect(messages[1]?.markdown).toContain('First answer');
	});

	test('falls back to data-turn when author-role wrappers are absent', () => {
		container.appendChild(
			createFallbackTurn(0, 'user', [
				createElement('div', { class: 'whitespace-pre-wrap' }, ['Fallback prompt']),
			]),
		);
		container.appendChild(
			createFallbackTurn(1, 'assistant', [
				createElement('div', { class: 'prose' }, [
					createElement('p', undefined, [
						'Fallback ',
						createElement('strong', undefined, ['answer']),
					]),
				]),
			]),
		);

		const messages = extractChatGPTConversation();
		expect(messages).toHaveLength(2);
		expect(messages[0]?.role).toBe('user');
		expect(messages[1]?.role).toBe('assistant');
		expect(messages[1]?.markdown).toContain('**answer**');
	});

	test('deduplicates nested assistant markdown blocks', () => {
		const nestedMarkdown = createElement('div', { class: 'markdown' }, [
			createElement('p', undefined, ['Only once']),
		]);
		const duplicateMarkdown = createElement('div', { class: 'markdown' }, [
			createElement('p', undefined, ['Only once']),
		]);

		container.appendChild(
			createStandardTurn(0, 'assistant', [
				createElement('div', { class: 'prose' }, [nestedMarkdown]),
				duplicateMarkdown,
			]),
		);

		const messages = extractChatGPTConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toBe('Only once');
	});

	test('keeps markdown prose blocks that are themselves markdown roots', () => {
		container.appendChild(
			createFallbackTurn(0, 'assistant', [
				createElement('div', { 'data-message-author-role': 'assistant' }, [
					createElement('div', { class: 'markdown prose' }, [
						createElement('p', undefined, ['Planning chunk']),
					]),
				]),
				createElement('div', { 'data-message-author-role': 'assistant' }, [
					createElement('div', { class: 'markdown prose' }, [
						createElement('p', undefined, ['Final answer chunk']),
					]),
				]),
			]),
		);

		const messages = extractChatGPTConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('Planning chunk');
		expect(messages[0]?.markdown).toContain('Final answer chunk');
		expect(messages[0]?.markdown.indexOf('Planning chunk')).toBeLessThan(
			messages[0]?.markdown.indexOf('Final answer chunk') ?? -1,
		);
	});

	test('formats user attachments and assistant artifacts as markdown sections', () => {
		const userTurn = createStandardTurn(0, 'user', [
			createElement('div', { class: 'whitespace-pre-wrap' }, ['Please review the files.']),
			createElement('a', { target: '_blank', href: '/files/spec' }, [
				createElement('span', { class: 'truncate font-semibold' }, ['spec.md']),
				createElement('span', { class: 'text-token-text-secondary truncate' }, ['Markdown']),
			]),
		]);

		const assistantTurn = createStandardTurn(1, 'assistant', [
			createElement('div', { class: 'markdown' }, [
				createElement('p', undefined, ['Looks consistent.']),
			]),
			createElement('a', { target: '_blank', href: '/files/review' }, [
				createElement('span', { class: 'truncate font-semibold' }, ['review.pdf']),
				createElement('span', { class: 'text-token-text-secondary truncate' }, ['PDF']),
			]),
		]);

		container.appendChild(userTurn);
		container.appendChild(assistantTurn);

		const messages = extractChatGPTConversation();
		expect(messages).toHaveLength(2);
		expect(messages[0]?.markdown).toContain('**Attachments:**');
		expect(messages[0]?.markdown).toContain('spec.md');
		expect(messages[1]?.markdown).toContain('**Artifacts:**');
		expect(messages[1]?.markdown).toContain('review.pdf');
	});

	test('extracts markdown-only assistant blocks when no turns exist', () => {
		container.remove();
		document.body.appendChild(
			createElement('div', { class: 'markdown' }, [
				createElement('p', undefined, ['Standalone markdown block']),
			]),
		);

		const messages = extractChatGPTConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.role).toBe('assistant');
		expect(messages[0]?.markdown).toContain('Standalone markdown block');
	});
});
