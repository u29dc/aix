import { describe, expect, test } from 'bun:test';
import { createElement, createTable, parseHTML } from '@tests/helpers';
import { convertNodeToMarkdown } from '@/parsers/markdown';
import { formatTable } from '@/parsers/table';

describe('formatTable', () => {
	describe('basic tables', () => {
		test('formats table with header and body rows', () => {
			const table = createTable(
				['Name', 'Age'],
				[
					['Alice', '30'],
					['Bob', '25'],
				],
			);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toBe('| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |\n\n');
		});

		test('formats single column table', () => {
			const table = createTable(['Header'], [['Row 1'], ['Row 2']]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| Header |');
			expect(result).toContain('| --- |');
			expect(result).toContain('| Row 1 |');
			expect(result).toContain('| Row 2 |');
		});

		test('formats single row table', () => {
			const table = createTable(['A', 'B', 'C'], [['1', '2', '3']]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| A | B | C |');
			expect(result).toContain('| --- | --- | --- |');
			expect(result).toContain('| 1 | 2 | 3 |');
		});

		test('generates separator row with dashes', () => {
			const table = createTable(['Col'], [['Val']]);
			const result = formatTable(table, convertNodeToMarkdown);
			const lines = result.split('\n');
			expect(lines[1]).toBe('| --- |');
		});
	});

	describe('empty and edge cases', () => {
		test('returns empty string for table with no rows', () => {
			const table = createElement('table');
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toBe('');
		});

		test('returns empty string for table with no header cells', () => {
			const table = createElement('table', undefined, [createElement('tr')]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toBe('');
		});

		test('handles empty cells', () => {
			const table = createTable(
				['A', 'B'],
				[
					['', 'Value'],
					['Data', ''],
				],
			);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('|  | Value |');
			expect(result).toContain('| Data |  |');
		});

		test('pads rows with fewer cells than headers', () => {
			const doc = parseHTML(`
				<table>
					<tr><th>A</th><th>B</th><th>C</th></tr>
					<tr><td>1</td></tr>
					<tr><td>2</td><td>3</td></tr>
				</table>
			`);
			const table = doc.querySelector('table');
			if (!table) throw new Error('Element not found');
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| 1 |  |  |');
			expect(result).toContain('| 2 | 3 |  |');
		});
	});

	describe('inline formatting in cells', () => {
		test('handles bold text in cells', () => {
			const headerRow = createElement('tr', undefined, [createElement('th', undefined, ['Feature']), createElement('th', undefined, ['Status'])]);
			const bodyRow = createElement('tr', undefined, [createElement('td', undefined, [createElement('strong', undefined, ['Important'])]), createElement('td', undefined, ['Done'])]);
			const table = createElement('table', undefined, [headerRow, bodyRow]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| **Important** | Done |');
		});

		test('handles italic text in cells', () => {
			const headerRow = createElement('tr', undefined, [createElement('th', undefined, ['Note'])]);
			const bodyRow = createElement('tr', undefined, [createElement('td', undefined, [createElement('em', undefined, ['emphasis'])])]);
			const table = createElement('table', undefined, [headerRow, bodyRow]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| *emphasis* |');
		});

		test('handles inline code in cells', () => {
			const headerRow = createElement('tr', undefined, [createElement('th', undefined, ['Command'])]);
			const bodyRow = createElement('tr', undefined, [createElement('td', undefined, [createElement('code', undefined, ['npm install'])])]);
			const table = createElement('table', undefined, [headerRow, bodyRow]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| `npm install` |');
		});

		test('handles links in cells', () => {
			const headerRow = createElement('tr', undefined, [createElement('th', undefined, ['Resource'])]);
			const bodyRow = createElement('tr', undefined, [createElement('td', undefined, [createElement('a', { href: 'https://example.com' }, ['Link'])])]);
			const table = createElement('table', undefined, [headerRow, bodyRow]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| [Link](https://example.com) |');
		});
	});

	describe('whitespace handling', () => {
		test('trims cell content', () => {
			const headerRow = createElement('tr', undefined, [createElement('th', undefined, ['  Header  '])]);
			const bodyRow = createElement('tr', undefined, [createElement('td', undefined, ['  Value  '])]);
			const table = createElement('table', undefined, [headerRow, bodyRow]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| Header |');
			expect(result).toContain('| Value |');
		});

		test('uses single space for empty header cells', () => {
			const headerRow = createElement('tr', undefined, [createElement('th', undefined, ['']), createElement('th', undefined, ['Data'])]);
			const bodyRow = createElement('tr', undefined, [createElement('td', undefined, ['A']), createElement('td', undefined, ['B'])]);
			const table = createElement('table', undefined, [headerRow, bodyRow]);
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('|   | Data |');
		});
	});

	describe('fixture-based tests', () => {
		test('parses table from complex fixture', () => {
			const doc = parseHTML(`
				<table>
					<tr>
						<th>Feature</th>
						<th>Description</th>
						<th>Status</th>
					</tr>
					<tr>
						<td><strong>Parsing</strong></td>
						<td>Convert <em>DOM</em> to <code>markdown</code></td>
						<td>Done</td>
					</tr>
				</table>
			`);
			const table = doc.querySelector('table');
			if (!table) throw new Error('Element not found');
			const result = formatTable(table, convertNodeToMarkdown);
			expect(result).toContain('| Feature | Description | Status |');
			expect(result).toContain('| **Parsing** | Convert *DOM* to `markdown` | Done |');
		});
	});
});
