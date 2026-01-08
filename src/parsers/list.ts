import type { ConvertNodeFn } from '@/parsers/markdown';
import type { ConversionContext } from '@/types';

/**
 * Format a list element (ul/ol) as markdown
 */
export function formatList(listElement: Element, context: ConversionContext, ordered: boolean, convertNode: ConvertNodeFn): string {
	const depth = context.listDepth;
	const indent = '  '.repeat(depth);
	const items: string[] = [];
	let index = ordered ? Number(listElement.getAttribute('start') ?? 1) : 0;
	const nextContext: ConversionContext = { ...context, listDepth: depth + 1 };

	for (const child of Array.from(listElement.children)) {
		if (child.tagName?.toLowerCase() === 'li') {
			const value = ordered ? `${index}. ` : '- ';
			const content = convertNode(child, nextContext).trim();
			const lines = content.split('\n');
			const firstLine = `${indent}${value}${lines.shift() ?? ''}`;
			const extraLines = lines.map((line) => `${indent}${ordered ? '   ' : '  '}${line}`);
			items.push([firstLine, ...extraLines].join('\n'));
			if (ordered) index += 1;
		}
	}

	if (!items.length) return '';
	return `${items.join('\n')}\n\n`;
}
