import { describe, expect, test } from 'bun:test';
import { createElement } from '@tests/helpers';
import { DEFAULT_REMOVE_SELECTORS, isEmptyElement, normalizeWhitespace, sanitizeElement } from '@/parsers/sanitizer';

describe('sanitizeElement', () => {
	test('removes script elements', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content']), createElement('script', undefined, ['alert("test")'])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('script')).toBeNull();
		expect(result.textContent).toContain('Content');
	});

	test('removes style elements', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content']), createElement('style', undefined, ['.test { color: red; }'])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('style')).toBeNull();
	});

	test('removes svg elements', () => {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content'])]);
		container.appendChild(svg);

		const result = sanitizeElement(container);
		expect(result.querySelector('svg')).toBeNull();
	});

	test('removes button elements', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content']), createElement('button', undefined, ['Click me'])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('button')).toBeNull();
	});

	test('removes input elements', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content']), createElement('input', { type: 'text' })]);

		const result = sanitizeElement(container);
		expect(result.querySelector('input')).toBeNull();
	});

	test('removes elements with aria-hidden', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Visible']), createElement('span', { 'aria-hidden': 'true' }, ['Hidden'])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('[aria-hidden="true"]')).toBeNull();
		expect(result.textContent).toContain('Visible');
		expect(result.textContent).not.toContain('Hidden');
	});

	test('removes copy button elements', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content']), createElement('button', { class: 'copy-button' }, ['Copy'])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('.copy-button')).toBeNull();
	});

	test('removes elements with testid containing copy', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content']), createElement('button', { 'data-testid': 'action-bar-copy' }, ['Copy'])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('[data-testid*="copy"]')).toBeNull();
	});

	test('removes sr-only elements', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Visible']), createElement('span', { class: 'sr-only' }, ['Screen reader only'])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('.sr-only')).toBeNull();
	});

	test('preserves text content', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Important text']), createElement('button', undefined, ['Remove me'])]);

		const result = sanitizeElement(container);
		expect(result.textContent).toContain('Important text');
	});

	test('preserves markdown-relevant elements', () => {
		const container = createElement('div', undefined, [
			createElement('p', undefined, ['Paragraph']),
			createElement('strong', undefined, ['Bold']),
			createElement('em', undefined, ['Italic']),
			createElement('code', undefined, ['Code']),
		]);

		const result = sanitizeElement(container);
		expect(result.querySelector('p')).not.toBeNull();
		expect(result.querySelector('strong')).not.toBeNull();
		expect(result.querySelector('em')).not.toBeNull();
		expect(result.querySelector('code')).not.toBeNull();
	});

	test('does not modify original element', () => {
		const container = createElement('div', undefined, [createElement('p', undefined, ['Content']), createElement('button', undefined, ['Button'])]);

		sanitizeElement(container);
		expect(container.querySelector('button')).not.toBeNull();
	});

	test('accepts custom remove selectors', () => {
		const container = createElement('div', undefined, [createElement('p', { class: 'keep' }, ['Keep']), createElement('p', { class: 'remove-me' }, ['Remove'])]);

		const result = sanitizeElement(container, { removeSelectors: ['.remove-me'] });
		expect(result.querySelector('.keep')).not.toBeNull();
		expect(result.querySelector('.remove-me')).toBeNull();
	});

	test('removes nested unwanted elements', () => {
		const container = createElement('div', undefined, [createElement('div', undefined, [createElement('button', undefined, ['Nested button'])])]);

		const result = sanitizeElement(container);
		expect(result.querySelector('button')).toBeNull();
	});
});

describe('normalizeWhitespace', () => {
	test('trims leading and trailing whitespace', () => {
		expect(normalizeWhitespace('  text  ')).toBe('text');
	});

	test('collapses multiple spaces to single space', () => {
		expect(normalizeWhitespace('hello    world')).toBe('hello world');
	});

	test('normalizes line endings', () => {
		expect(normalizeWhitespace('line1\r\nline2\rline3')).toBe('line1\nline2\nline3');
	});

	test('removes trailing whitespace from lines', () => {
		expect(normalizeWhitespace('line1   \nline2  ')).toBe('line1\nline2');
	});

	test('removes leading whitespace from lines', () => {
		expect(normalizeWhitespace('line1\n   line2')).toBe('line1\nline2');
	});

	test('preserves single spaces between words', () => {
		expect(normalizeWhitespace('hello world')).toBe('hello world');
	});

	test('handles empty string', () => {
		expect(normalizeWhitespace('')).toBe('');
	});

	test('handles whitespace-only string', () => {
		expect(normalizeWhitespace('   \n\t  ')).toBe('');
	});
});

describe('isEmptyElement', () => {
	test('returns true for element with no content', () => {
		const el = createElement('div');
		expect(isEmptyElement(el)).toBe(true);
	});

	test('returns true for element with only whitespace', () => {
		const el = createElement('div', undefined, ['   \n\t  ']);
		expect(isEmptyElement(el)).toBe(true);
	});

	test('returns false for element with text content', () => {
		const el = createElement('div', undefined, ['content']);
		expect(isEmptyElement(el)).toBe(false);
	});

	test('returns false for element with image', () => {
		const el = createElement('div', undefined, [createElement('img', { src: 'test.png' })]);
		expect(isEmptyElement(el)).toBe(false);
	});

	test('returns false for element with nested text', () => {
		const el = createElement('div', undefined, [createElement('span', undefined, ['nested text'])]);
		expect(isEmptyElement(el)).toBe(false);
	});
});

describe('DEFAULT_REMOVE_SELECTORS', () => {
	test('includes expected selectors', () => {
		expect(DEFAULT_REMOVE_SELECTORS).toContain('script');
		expect(DEFAULT_REMOVE_SELECTORS).toContain('style');
		expect(DEFAULT_REMOVE_SELECTORS).toContain('svg');
		expect(DEFAULT_REMOVE_SELECTORS).toContain('button');
		expect(DEFAULT_REMOVE_SELECTORS).toContain('[aria-hidden="true"]');
		expect(DEFAULT_REMOVE_SELECTORS).toContain('.sr-only');
	});

	test('is immutable array', () => {
		expect(Object.isFrozen(DEFAULT_REMOVE_SELECTORS)).toBe(false);
		expect(Array.isArray(DEFAULT_REMOVE_SELECTORS)).toBe(true);
	});
});
