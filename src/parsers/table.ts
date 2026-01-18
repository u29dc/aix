import type { ConvertNodeFn } from '@/parsers/markdown';

/**
 * Format a table element as markdown
 */
export function formatTable(tableElement: Element, convertNode: ConvertNodeFn): string {
	const rows = Array.from(tableElement.querySelectorAll('tr'));
	if (!rows.length) return '';

	const headerRow = rows.shift();
	if (!headerRow) return '';

	const headerCells = Array.from((headerRow as HTMLTableRowElement).cells);
	if (!headerCells.length) return '';

	const headers = headerCells.map((cell) => escapeTableCell(convertNode(cell)) || ' ');
	const divider = headers.map(() => '---');
	const bodyRows = rows.map((row) => {
		const cells = Array.from((row as HTMLTableRowElement).cells);
		return cells.map((cell) => escapeTableCell(convertNode(cell)));
	});

	const lines: string[] = [];
	lines.push(`| ${headers.join(' | ')} |`);
	lines.push(`| ${divider.join(' | ')} |`);

	for (const cells of bodyRows) {
		const padded = [...cells];
		while (padded.length < headers.length) padded.push('');
		lines.push(`| ${padded.join(' | ')} |`);
	}

	return `${lines.join('\n')}\n\n`;
}

function escapeTableCell(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	return trimmed.replace(/\|/g, '\\|').replace(/\r?\n+/g, '<br>');
}
