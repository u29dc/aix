import { describe, expect, test } from 'bun:test';
import { createCodeBlock, createElement, createList, createTable, parseHTML } from '@tests/helpers';
import { convertNodeToMarkdown } from '@/parsers/markdown';

describe('convertNodeToMarkdown', () => {
	describe('text nodes', () => {
		test('converts plain text node', () => {
			const text = document.createTextNode('Hello world');
			expect(convertNodeToMarkdown(text)).toBe('Hello world');
		});

		test('escapes special markdown characters in text', () => {
			const text = document.createTextNode('*asterisk* and `backtick`');
			expect(convertNodeToMarkdown(text)).toBe('\\*asterisk\\* and \\`backtick\\`');
		});

		test('handles empty text node', () => {
			const text = document.createTextNode('');
			expect(convertNodeToMarkdown(text)).toBe('');
		});

		test('handles whitespace-only text node', () => {
			const text = document.createTextNode('   ');
			expect(convertNodeToMarkdown(text)).toBe('   ');
		});
	});

	describe('inline elements', () => {
		test('converts strong to bold markdown', () => {
			const el = createElement('strong', undefined, ['bold text']);
			expect(convertNodeToMarkdown(el)).toBe('**bold text**');
		});

		test('converts b to bold markdown', () => {
			const el = createElement('b', undefined, ['bold text']);
			expect(convertNodeToMarkdown(el)).toBe('**bold text**');
		});

		test('converts em to italic markdown', () => {
			const el = createElement('em', undefined, ['italic text']);
			expect(convertNodeToMarkdown(el)).toBe('*italic text*');
		});

		test('converts i to italic markdown', () => {
			const el = createElement('i', undefined, ['italic text']);
			expect(convertNodeToMarkdown(el)).toBe('*italic text*');
		});

		test('converts del to strikethrough markdown', () => {
			const el = createElement('del', undefined, ['strike']);
			expect(convertNodeToMarkdown(el)).toBe('~~strike~~');
		});

		test('preserves underline with HTML tag', () => {
			const el = createElement('u', undefined, ['underline']);
			expect(convertNodeToMarkdown(el)).toBe('<u>underline</u>');
		});

		test('preserves superscript with HTML tag', () => {
			const el = createElement('sup', undefined, ['1']);
			expect(convertNodeToMarkdown(el)).toBe('<sup>1</sup>');
		});

		test('preserves subscript with HTML tag', () => {
			const el = createElement('sub', undefined, ['2']);
			expect(convertNodeToMarkdown(el)).toBe('<sub>2</sub>');
		});

		test('converts inline code', () => {
			const el = createElement('code', undefined, ['const x = 1']);
			expect(convertNodeToMarkdown(el)).toBe('`const x = 1`');
		});

		test('converts link with text and href', () => {
			const el = createElement('a', { href: 'https://example.com' }, ['Example']);
			expect(convertNodeToMarkdown(el)).toBe('[Example](https://example.com)');
		});

		test('converts link using href as label when text empty', () => {
			const el = createElement('a', { href: 'https://example.com' }, []);
			expect(convertNodeToMarkdown(el)).toBe('[https://example.com](https://example.com)');
		});

		test('handles link with no href', () => {
			const el = createElement('a', {}, ['just text']);
			expect(convertNodeToMarkdown(el)).toBe('just text');
		});

		test('converts nested inline elements', () => {
			const strong = createElement('strong', undefined, ['bold and ']);
			const em = createElement('em', undefined, ['italic']);
			const container = createElement('span', undefined, [strong, em]);
			expect(convertNodeToMarkdown(container)).toBe('**bold and***italic*');
		});

		test('converts checkbox input to task list marker', () => {
			const el = createElement('input', { type: 'checkbox', checked: 'true' }, []);
			expect(convertNodeToMarkdown(el)).toBe('[x] ');
		});

		test('converts unchecked checkbox input to task list marker', () => {
			const el = createElement('input', { type: 'checkbox' }, []);
			expect(convertNodeToMarkdown(el)).toBe('[ ] ');
		});
	});

	describe('block elements', () => {
		test('converts paragraph with trailing newlines', () => {
			const el = createElement('p', undefined, ['Paragraph text']);
			expect(convertNodeToMarkdown(el)).toBe('Paragraph text\n\n');
		});

		test('converts br to soft break', () => {
			const el = createElement('br');
			expect(convertNodeToMarkdown(el)).toBe('  \n');
		});

		test('converts h1 to markdown heading', () => {
			const el = createElement('h1', undefined, ['Title']);
			expect(convertNodeToMarkdown(el)).toBe('# Title\n\n');
		});

		test('converts h2 to markdown heading', () => {
			const el = createElement('h2', undefined, ['Section']);
			expect(convertNodeToMarkdown(el)).toBe('## Section\n\n');
		});

		test('converts h3 to markdown heading', () => {
			const el = createElement('h3', undefined, ['Subsection']);
			expect(convertNodeToMarkdown(el)).toBe('### Subsection\n\n');
		});

		test('converts h4 to markdown heading', () => {
			const el = createElement('h4', undefined, ['Minor']);
			expect(convertNodeToMarkdown(el)).toBe('#### Minor\n\n');
		});

		test('converts h5 to markdown heading', () => {
			const el = createElement('h5', undefined, ['Small']);
			expect(convertNodeToMarkdown(el)).toBe('##### Small\n\n');
		});

		test('converts h6 to markdown heading', () => {
			const el = createElement('h6', undefined, ['Tiny']);
			expect(convertNodeToMarkdown(el)).toBe('###### Tiny\n\n');
		});

		test('converts hr to horizontal rule', () => {
			const el = createElement('hr');
			expect(convertNodeToMarkdown(el)).toBe('\n---\n\n');
		});

		test('converts blockquote with single line', () => {
			const el = createElement('blockquote', undefined, ['Quote text']);
			expect(convertNodeToMarkdown(el)).toBe('> Quote text\n\n');
		});

		test('converts blockquote with multiple lines', () => {
			const p1 = createElement('p', undefined, ['First line']);
			const p2 = createElement('p', undefined, ['Second line']);
			const el = createElement('blockquote', undefined, [p1, p2]);
			const result = convertNodeToMarkdown(el);
			expect(result).toContain('> ');
			expect(result).toContain('First line');
			expect(result).toContain('Second line');
		});
	});

	describe('images', () => {
		test('converts image with alt and src', () => {
			const el = createElement('img', { src: 'https://example.com/img.png', alt: 'My image' });
			expect(convertNodeToMarkdown(el)).toBe('![My image](https://example.com/img.png)');
		});

		test('uses default alt when not provided', () => {
			const el = createElement('img', { src: 'https://example.com/img.png' });
			expect(convertNodeToMarkdown(el)).toBe('![Image](https://example.com/img.png)');
		});

		test('handles image with no src', () => {
			const el = createElement('img', { alt: 'No source' });
			expect(convertNodeToMarkdown(el)).toBe('![No source]');
		});
	});

	describe('code blocks', () => {
		test('converts pre with code to fenced block', () => {
			const el = createCodeBlock('const x = 1;', 'javascript');
			const result = convertNodeToMarkdown(el);
			expect(result).toContain('```javascript');
			expect(result).toContain('const x = 1;');
			expect(result.trim().endsWith('```')).toBe(true);
		});

		test('converts pre without language', () => {
			const el = createCodeBlock('plain code');
			const result = convertNodeToMarkdown(el);
			expect(result).toContain('```');
			expect(result).toContain('plain code');
		});

		test('skips inline code within pre', () => {
			const code = createElement('code', undefined, ['nested code']);
			const pre = createElement('pre', undefined, [code]);
			const result = convertNodeToMarkdown(pre);
			expect(result).toContain('nested code');
			expect(result.match(/`/g)?.length).toBe(6); // only fence backticks
		});
	});

	describe('lists', () => {
		test('converts unordered list', () => {
			const el = createList(['Item 1', 'Item 2', 'Item 3']);
			const result = convertNodeToMarkdown(el);
			expect(result).toContain('- Item 1');
			expect(result).toContain('- Item 2');
			expect(result).toContain('- Item 3');
		});

		test('converts ordered list', () => {
			const el = createList(['First', 'Second', 'Third'], true);
			const result = convertNodeToMarkdown(el);
			expect(result).toContain('1. First');
			expect(result).toContain('2. Second');
			expect(result).toContain('3. Third');
		});

		test('respects ordered list start attribute', () => {
			const el = createList(['Item A', 'Item B'], true, 5);
			const result = convertNodeToMarkdown(el);
			expect(result).toContain('5. Item A');
			expect(result).toContain('6. Item B');
		});
	});

	describe('tables', () => {
		test('converts table with headers and rows', () => {
			const el = createTable(
				['Name', 'Age'],
				[
					['Alice', '30'],
					['Bob', '25'],
				],
			);
			const result = convertNodeToMarkdown(el);
			expect(result).toContain('| Name | Age |');
			expect(result).toContain('| --- | --- |');
			expect(result).toContain('| Alice | 30 |');
			expect(result).toContain('| Bob | 25 |');
		});
	});

	describe('element skipping', () => {
		test('skips elements with display none when connected to DOM', () => {
			const el = createElement('div', { style: 'display: none' }, ['Hidden']);
			document.body.appendChild(el);
			try {
				expect(convertNodeToMarkdown(el)).toBe('');
			} finally {
				el.remove();
			}
		});

		test('skips elements with visibility hidden when connected to DOM', () => {
			const el = createElement('div', { style: 'visibility: hidden' }, ['Invisible']);
			document.body.appendChild(el);
			try {
				expect(convertNodeToMarkdown(el)).toBe('');
			} finally {
				el.remove();
			}
		});

		test('skips elements with contenteditable presentation', () => {
			const el = createElement('div', { contenteditable: 'false', role: 'presentation' }, ['Decorative']);
			expect(convertNodeToMarkdown(el)).toBe('');
		});
	});

	describe('unknown elements', () => {
		test('extracts text from unknown elements', () => {
			const el = createElement('custom-element' as 'div', undefined, ['Custom content']);
			expect(convertNodeToMarkdown(el)).toBe('Custom content');
		});

		test('handles div by extracting children', () => {
			const p = createElement('p', undefined, ['Paragraph in div']);
			const el = createElement('div', undefined, [p]);
			expect(convertNodeToMarkdown(el)).toBe('Paragraph in div\n\n');
		});
	});

	describe('edge cases', () => {
		test('handles null node', () => {
			expect(convertNodeToMarkdown(null as unknown as Node)).toBe('');
		});

		test('handles undefined node', () => {
			expect(convertNodeToMarkdown(undefined as unknown as Node)).toBe('');
		});

		test('handles empty element', () => {
			const el = createElement('div');
			expect(convertNodeToMarkdown(el)).toBe('');
		});

		test('handles deeply nested structure', () => {
			const doc = parseHTML('<div><div><div><div><div><p>Deep</p></div></div></div></div></div>');
			const el = doc.querySelector('div');
			if (!el) throw new Error('Element not found');
			expect(convertNodeToMarkdown(el)).toContain('Deep');
		});

		test('handles non-element non-text nodes gracefully', () => {
			const comment = document.createComment('This is a comment');
			expect(convertNodeToMarkdown(comment)).toBe('');
		});
	});
});
