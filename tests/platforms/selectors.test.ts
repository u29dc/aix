import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from '@tests/helpers';
import type { SelectorConfig } from '@/platforms/selectors';
import { buildCombinedSelector, CLAUDE_SELECTORS, querySelector, querySelectorAll } from '@/platforms/selectors';

describe('querySelector', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	test('finds element with primary selector', () => {
		const config: SelectorConfig = {
			primary: '.primary-class',
			fallbacks: ['.fallback-class'],
		};
		const target = createElement('div', { class: 'primary-class' });
		container.appendChild(target);

		expect(querySelector(container, config)).toBe(target);
	});

	test('falls back when primary not found', () => {
		const config: SelectorConfig = {
			primary: '.primary-class',
			fallbacks: ['.fallback-class'],
		};
		const target = createElement('div', { class: 'fallback-class' });
		container.appendChild(target);

		expect(querySelector(container, config)).toBe(target);
	});

	test('tries fallbacks in order', () => {
		const config: SelectorConfig = {
			primary: '.primary',
			fallbacks: ['.first-fallback', '.second-fallback'],
		};
		const first = createElement('div', { class: 'first-fallback' });
		const second = createElement('div', { class: 'second-fallback' });
		container.appendChild(second);
		container.appendChild(first);

		expect(querySelector(container, config)).toBe(first);
	});

	test('returns null when no selector matches', () => {
		const config: SelectorConfig = {
			primary: '.not-found',
			fallbacks: ['.also-not-found'],
		};

		expect(querySelector(container, config)).toBeNull();
	});

	test('prefers primary over fallbacks', () => {
		const config: SelectorConfig = {
			primary: '.primary',
			fallbacks: ['.fallback'],
		};
		const primary = createElement('div', { class: 'primary' });
		const fallback = createElement('div', { class: 'fallback' });
		container.appendChild(fallback);
		container.appendChild(primary);

		expect(querySelector(container, config)).toBe(primary);
	});
});

describe('querySelectorAll', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	test('finds all elements with primary selector', () => {
		const config: SelectorConfig = {
			primary: '.target',
			fallbacks: ['.fallback'],
		};
		container.appendChild(createElement('div', { class: 'target' }));
		container.appendChild(createElement('div', { class: 'target' }));
		container.appendChild(createElement('div', { class: 'other' }));

		const results = querySelectorAll(container, config);
		expect(results).toHaveLength(2);
	});

	test('falls back when primary returns empty', () => {
		const config: SelectorConfig = {
			primary: '.not-found',
			fallbacks: ['.fallback'],
		};
		container.appendChild(createElement('div', { class: 'fallback' }));
		container.appendChild(createElement('div', { class: 'fallback' }));

		const results = querySelectorAll(container, config);
		expect(results).toHaveLength(2);
	});

	test('returns empty array when nothing found', () => {
		const config: SelectorConfig = {
			primary: '.not-found',
			fallbacks: ['.also-not-found'],
		};

		expect(querySelectorAll(container, config)).toHaveLength(0);
	});

	test('does not combine primary and fallback results', () => {
		const config: SelectorConfig = {
			primary: '.primary',
			fallbacks: ['.fallback'],
		};
		container.appendChild(createElement('div', { class: 'primary' }));
		container.appendChild(createElement('div', { class: 'fallback' }));

		const results = querySelectorAll(container, config);
		expect(results).toHaveLength(1);
		expect(results[0]?.classList.contains('primary')).toBe(true);
	});
});

describe('buildCombinedSelector', () => {
	test('combines primary and fallbacks with comma', () => {
		const config: SelectorConfig = {
			primary: '.primary',
			fallbacks: ['.fallback1', '.fallback2'],
		};

		expect(buildCombinedSelector(config)).toBe('.primary, .fallback1, .fallback2');
	});

	test('handles single fallback', () => {
		const config: SelectorConfig = {
			primary: '.primary',
			fallbacks: ['.fallback'],
		};

		expect(buildCombinedSelector(config)).toBe('.primary, .fallback');
	});

	test('handles empty fallbacks', () => {
		const config: SelectorConfig = {
			primary: '.primary',
			fallbacks: [],
		};

		expect(buildCombinedSelector(config)).toBe('.primary');
	});
});

describe('CLAUDE_SELECTORS', () => {
	test('userMessage has primary and fallbacks', () => {
		expect(CLAUDE_SELECTORS.userMessage.primary).toBe('[data-testid="user-message"]');
		expect(CLAUDE_SELECTORS.userMessage.fallbacks.length).toBeGreaterThan(0);
	});

	test('assistantMessage has primary and fallbacks', () => {
		expect(CLAUDE_SELECTORS.assistantMessage.primary).toBe('div[data-is-streaming]');
		expect(CLAUDE_SELECTORS.assistantMessage.fallbacks.length).toBeGreaterThan(0);
	});

	test('messageContent has primary and fallbacks', () => {
		expect(CLAUDE_SELECTORS.messageContent.primary).toContain('standard-markdown');
		expect(CLAUDE_SELECTORS.messageContent.fallbacks.length).toBeGreaterThan(0);
	});

	test('chatContainer has primary and fallbacks', () => {
		expect(CLAUDE_SELECTORS.chatContainer.primary).toBe('main');
		expect(CLAUDE_SELECTORS.chatContainer.fallbacks.length).toBeGreaterThan(0);
	});

	test('chatActions has primary and fallbacks', () => {
		expect(CLAUDE_SELECTORS.chatActions.primary).toContain('chat-actions');
		expect(CLAUDE_SELECTORS.chatActions.fallbacks.length).toBeGreaterThan(0);
	});

	test('chatTitle has primary and fallbacks', () => {
		expect(CLAUDE_SELECTORS.chatTitle.primary).toContain('chat-title');
		expect(CLAUDE_SELECTORS.chatTitle.fallbacks.length).toBeGreaterThan(0);
	});
});
