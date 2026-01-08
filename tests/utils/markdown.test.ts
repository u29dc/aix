import { describe, expect, test } from 'bun:test';

import { detectLanguage, escapeMarkdown, normalizeSpacing, pickFence, wrapMarkdown } from '@/utils/markdown';

describe('escapeMarkdown', () => {
	test('returns empty string for empty input', () => {
		expect(escapeMarkdown('')).toBe('');
	});

	test('escapes backslashes', () => {
		expect(escapeMarkdown('path\\to\\file')).toBe('path\\\\to\\\\file');
	});

	test('escapes asterisks', () => {
		expect(escapeMarkdown('*bold*')).toBe('\\*bold\\*');
	});

	test('escapes backticks', () => {
		expect(escapeMarkdown('`code`')).toBe('\\`code\\`');
	});

	test('escapes brackets', () => {
		expect(escapeMarkdown('[link](url)')).toBe('\\[link\\]\\(url\\)');
	});

	test('escapes hash symbols', () => {
		expect(escapeMarkdown('# heading')).toBe('\\# heading');
	});

	test('replaces non-breaking spaces', () => {
		expect(escapeMarkdown('hello\u00a0world')).toBe('hello world');
	});

	test('escapes multiple special characters', () => {
		expect(escapeMarkdown('**bold** and `code`')).toBe('\\*\\*bold\\*\\* and \\`code\\`');
	});
});

describe('wrapMarkdown', () => {
	test('wraps text with delimiter', () => {
		expect(wrapMarkdown('**', 'bold')).toBe('**bold**');
	});

	test('wraps with single character', () => {
		expect(wrapMarkdown('*', 'italic')).toBe('*italic*');
	});

	test('wraps with backtick', () => {
		expect(wrapMarkdown('`', 'code')).toBe('`code`');
	});

	test('returns empty string for empty value', () => {
		expect(wrapMarkdown('**', '')).toBe('');
	});

	test('returns empty string for whitespace-only value', () => {
		expect(wrapMarkdown('**', '   ')).toBe('');
	});

	test('trims whitespace from value', () => {
		expect(wrapMarkdown('**', '  bold  ')).toBe('**bold**');
	});
});

describe('normalizeSpacing', () => {
	test('removes trailing spaces on lines', () => {
		expect(normalizeSpacing('hello   \nworld')).toBe('hello\nworld');
	});

	test('removes trailing tabs on lines', () => {
		expect(normalizeSpacing('hello\t\nworld')).toBe('hello\nworld');
	});

	test('collapses multiple newlines to two', () => {
		expect(normalizeSpacing('hello\n\n\n\nworld')).toBe('hello\n\nworld');
	});

	test('preserves double newlines', () => {
		expect(normalizeSpacing('hello\n\nworld')).toBe('hello\n\nworld');
	});

	test('handles mixed trailing whitespace and newlines', () => {
		expect(normalizeSpacing('a  \n\n\n\nb')).toBe('a\n\nb');
	});
});

describe('pickFence', () => {
	test('returns triple backticks by default', () => {
		expect(pickFence('const x = 1;')).toBe('```');
	});

	test('returns tildes when text contains triple backticks', () => {
		expect(pickFence('use ``` for code')).toBe('~~~');
	});

	test('returns backticks when text contains both', () => {
		expect(pickFence('use ``` and ~~~ for code')).toBe('```');
	});
});

describe('detectLanguage', () => {
	test('returns empty string for null element', () => {
		expect(detectLanguage(null)).toBe('');
	});
});
