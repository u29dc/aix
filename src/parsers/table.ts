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

	const headers = headerCells.map((cell) => convertNode(cell).trim() || ' ');
	const divider = headers.map(() => '---');
	const bodyRows = rows.map((row) => {
		const cells = Array.from((row as HTMLTableRowElement).cells);
		return cells.map((cell) => convertNode(cell).trim());
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
