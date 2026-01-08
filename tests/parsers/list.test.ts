import { describe, expect, test } from 'bun:test';
import { createElement, createList, parseHTML } from '@tests/helpers';
import { formatList } from '@/parsers/list';
import { convertNodeToMarkdown } from '@/parsers/markdown';

describe('formatList', () => {
	const defaultContext = { listDepth: 0 };

	describe('unordered lists', () => {
		test('formats basic unordered list with dash prefix', () => {
			const el = createList(['Apple', 'Banana', 'Cherry']);
			const result = formatList(el, defaultContext, false, convertNodeToMarkdown);
			expect(result).toBe('- Apple\n- Banana\n- Cherry\n\n');
		});

		test('handles single item list', () => {
			const el = createList(['Only item']);
			const result = formatList(el, defaultContext, false, convertNodeToMarkdown);
			expect(result).toBe('- Only item\n\n');
		});

		test('handles empty list', () => {
			const el = createElement('ul');
			const result = formatList(el, defaultContext, false, convertNodeToMarkdown);
			expect(result).toBe('');
		});

		test('handles list item with whitespace', () => {
			const el = createList(['  trimmed  ']);
			const result = formatList(el, defaultContext, false, convertNodeToMarkdown);
			expect(result).toBe('- trimmed\n\n');
		});
	});

	describe('ordered lists', () => {
		test('formats basic ordered list with numbered prefix', () => {
			const el = createList(['First', 'Second', 'Third'], true);
			const result = formatList(el, defaultContext, true, convertNodeToMarkdown);
			expect(result).toBe('1. First\n2. Second\n3. Third\n\n');
		});

		test('respects start attribute', () => {
			const el = createList(['Item A', 'Item B'], true, 10);
			const result = formatList(el, defaultContext, true, convertNodeToMarkdown);
			expect(result).toBe('10. Item A\n11. Item B\n\n');
		});

		test('handles single item ordered list', () => {
			const el = createList(['Solo'], true);
			const result = formatList(el, defaultContext, true, convertNodeToMarkdown);
			expect(result).toBe('1. Solo\n\n');
		});
	});

	describe('nested lists', () => {
		test('indents nested unordered list with 2 spaces', () => {
			const el = createList([{ text: 'Parent', children: [{ text: 'Child 1' }, { text: 'Child 2' }] }]);
			const result = formatList(el, defaultContext, false, convertNodeToMarkdown);
			expect(result).toContain('- Parent');
			expect(result).toContain('  - Child 1');
			expect(result).toContain('  - Child 2');
		});

		test('handles 3 levels of nesting', () => {
			const el = createList([
				{
					text: 'Level 1',
					children: [
						{
							text: 'Level 2',
							children: [{ text: 'Level 3' }],
						},
					],
				},
			]);
			const result = formatList(el, defaultContext, false, convertNodeToMarkdown);
			expect(result).toContain('- Level 1');
			expect(result).toContain('  - Level 2');
			expect(result).toContain('    - Level 3');
		});

		test('handles mixed ul/ol nesting', () => {
			const el = createList([
				{
					text: 'Unordered parent',
					children: [{ text: 'Ordered child 1' }, { text: 'Ordered child 2' }],
					ordered: true,
				},
			]);
			const result = formatList(el, defaultContext, false, convertNodeToMarkdown);
			expect(result).toContain('- Unordered parent');
			expect(result).toContain('  1. Ordered child 1');
			expect(result).toContain('  2. Ordered child 2');
		});
	});

	describe('list items with complex content', () => {
		test('handles list item with inline formatting', () => {
			const li = createElement('li', undefined, ['Text with ', createElement('strong', undefined, ['bold']), ' and ', createElement('em', undefined, ['italic'])]);
			const ul = createElement('ul', undefined, [li]);
			const result = formatList(ul, defaultContext, false, convertNodeToMarkdown);
			expect(result).toContain('- Text with **bold** and *italic*');
		});

		test('handles list item with inline code', () => {
			const li = createElement('li', undefined, ['Use ', createElement('code', undefined, ['npm install'])]);
			const ul = createElement('ul', undefined, [li]);
			const result = formatList(ul, defaultContext, false, convertNodeToMarkdown);
			expect(result).toContain('- Use `npm install`');
		});

		test('handles list item with link', () => {
			const li = createElement('li', undefined, ['Visit ', createElement('a', { href: 'https://example.com' }, ['Example'])]);
			const ul = createElement('ul', undefined, [li]);
			const result = formatList(ul, defaultContext, false, convertNodeToMarkdown);
			expect(result).toContain('- Visit [Example](https://example.com)');
		});
	});

	describe('edge cases', () => {
		test('ignores non-li children', () => {
			const ul = createElement('ul', undefined, [createElement('div', undefined, ['Not a list item']), createElement('li', undefined, ['Real item'])]);
			const result = formatList(ul, defaultContext, false, convertNodeToMarkdown);
			expect(result).toBe('- Real item\n\n');
		});

		test('handles list from HTML fixture', () => {
			const doc = parseHTML(`
				<ul class="list-disc">
					<li>First</li>
					<li>Second</li>
					<li>Third</li>
				</ul>
			`);
			const ul = doc.querySelector('ul');
			if (!ul) throw new Error('Element not found');
			const result = formatList(ul, defaultContext, false, convertNodeToMarkdown);
			expect(result).toContain('- First');
			expect(result).toContain('- Second');
			expect(result).toContain('- Third');
		});
	});
});
