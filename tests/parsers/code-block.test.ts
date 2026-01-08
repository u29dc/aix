import { describe, expect, test } from 'bun:test';
import { createCodeBlock, createElement } from '@tests/helpers';
import { formatCodeBlock } from '@/parsers/code-block';
import { detectLanguage, pickFence } from '@/utils/markdown';

describe('code block formatting', () => {
	test('pickFence returns backticks for normal code', () => {
		const code = 'function hello() { return "world"; }';
		expect(pickFence(code)).toBe('```');
	});

	test('pickFence returns tildes when code contains backticks', () => {
		const code = 'Use ``` to create code blocks';
		expect(pickFence(code)).toBe('~~~');
	});

	test('pickFence returns backticks when both are present', () => {
		const code = 'Both ``` and ~~~ are used';
		expect(pickFence(code)).toBe('```');
	});

	test('pickFence handles empty string', () => {
		expect(pickFence('')).toBe('```');
	});

	test('pickFence handles multiline code', () => {
		const code = `line 1
line 2
line 3`;
		expect(pickFence(code)).toBe('```');
	});
});

describe('detectLanguage', () => {
	test('extracts language from class="language-*"', () => {
		const code = createElement('code', { class: 'language-typescript' });
		expect(detectLanguage(code)).toBe('typescript');
	});

	test('extracts language from class="language-*" with other classes', () => {
		const code = createElement('code', { class: 'hljs language-javascript foo' });
		expect(detectLanguage(code)).toBe('javascript');
	});

	test('extracts language from data-language attribute', () => {
		const code = createElement('code', { 'data-language': 'python' });
		expect(detectLanguage(code)).toBe('python');
	});

	test('prefers data-language over class', () => {
		const code = createElement('code', { class: 'language-rust', 'data-language': 'go' });
		expect(detectLanguage(code)).toBe('go');
	});

	test('returns empty string when no language found', () => {
		const code = createElement('code', { class: 'highlight' });
		expect(detectLanguage(code)).toBe('');
	});

	test('returns empty string for null element', () => {
		expect(detectLanguage(null)).toBe('');
	});

	test('handles language with plus sign', () => {
		const code = createElement('code', { class: 'language-c++' });
		expect(detectLanguage(code)).toBe('c++');
	});

	test('handles language with hash', () => {
		const code = createElement('code', { class: 'language-c#' });
		expect(detectLanguage(code)).toBe('c#');
	});
});

describe('formatCodeBlock', () => {
	test('formats code block with language', () => {
		const pre = createCodeBlock('const x = 1;', 'javascript');
		const result = formatCodeBlock(pre);
		expect(result).toBe('```javascript\nconst x = 1;\n```\n\n');
	});

	test('formats code block without language', () => {
		const pre = createCodeBlock('plain code');
		const result = formatCodeBlock(pre);
		expect(result).toBe('```\nplain code\n```\n\n');
	});

	test('uses tildes when code contains backticks', () => {
		const pre = createCodeBlock('Use ``` for code blocks', 'markdown');
		const result = formatCodeBlock(pre);
		expect(result).toContain('~~~markdown');
		expect(result).toContain('Use ``` for code blocks');
		expect(result.trim().endsWith('~~~')).toBe(true);
	});

	test('preserves indentation within code', () => {
		const code = `function test() {
  if (true) {
    return 1;
  }
}`;
		const pre = createCodeBlock(code, 'javascript');
		const result = formatCodeBlock(pre);
		expect(result).toContain('  if (true) {');
		expect(result).toContain('    return 1;');
	});

	test('preserves empty lines within code', () => {
		const code = `line 1

line 3`;
		const pre = createCodeBlock(code);
		const result = formatCodeBlock(pre);
		expect(result).toContain('line 1\n\nline 3');
	});

	test('trims trailing newline from code content', () => {
		const pre = createCodeBlock('code\n', 'text');
		const result = formatCodeBlock(pre);
		expect(result).toBe('```text\ncode\n```\n\n');
	});

	test('handles empty code block', () => {
		const pre = createCodeBlock('');
		const result = formatCodeBlock(pre);
		expect(result).toBe('```\n\n```\n\n');
	});

	test('handles pre element without code child', () => {
		const pre = createElement('pre', undefined, ['direct text content']);
		const result = formatCodeBlock(pre);
		expect(result).toContain('direct text content');
	});

	test('extracts language from nested code element', () => {
		const code = createElement('code', { class: 'language-python' }, ['print("hello")']);
		const pre = createElement('pre', undefined, [code]);
		const result = formatCodeBlock(pre);
		expect(result).toBe('```python\nprint("hello")\n```\n\n');
	});
});
