import { formatCodeBlock } from '@/parsers/code-block';
import { formatList } from '@/parsers/list';
import { formatTable } from '@/parsers/table';
import type { ConversionContext, Message, Platform } from '@/types';
import { shouldSkipElement } from '@/utils/dom';
import { escapeMarkdown, normalizeSpacing, wrapMarkdown } from '@/utils/markdown';

export type ConvertNodeFn = (node: Node, context?: ConversionContext) => string;

const DEFAULT_CONTEXT: ConversionContext = { listDepth: 0 };

/**
 * Convert a DOM node to markdown
 */
export function convertNodeToMarkdown(node: Node, context: ConversionContext = DEFAULT_CONTEXT): string {
	if (!node) return '';

	if (node.nodeType === Node.TEXT_NODE) {
		return escapeMarkdown(node.nodeValue ?? '');
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return '';
	}

	const element = node as Element;
	if (shouldSkipElement(element)) return '';

	const tag = element.tagName.toLowerCase();

	switch (tag) {
		case 'p':
			return `${collectChildrenMarkdown(element, context).trim()}\n\n`;

		case 'br':
			return '  \n';

		case 'strong':
		case 'b':
			return wrapMarkdown('**', collectChildrenMarkdown(element, context));

		case 'em':
		case 'i':
			return wrapMarkdown('*', collectChildrenMarkdown(element, context));

		case 'code': {
			if (element.parentElement?.tagName.toLowerCase() === 'pre') {
				return '';
			}
			return wrapMarkdown('`', element.textContent ?? '');
		}

		case 'pre':
			return formatCodeBlock(element);

		case 'ul':
			return formatList(element, context, false, convertNodeToMarkdown);

		case 'ol':
			return formatList(element, context, true, convertNodeToMarkdown);

		case 'li':
			return collectChildrenMarkdown(element, context).trim();

		case 'blockquote': {
			const inner = collectChildrenMarkdown(element, context).trim();
			if (!inner) return '';
			return `${inner
				.split('\n')
				.map((line) => `> ${line}`)
				.join('\n')}\n\n`;
		}

		case 'a': {
			const href = element.getAttribute('href') ?? '';
			const label = collectChildrenMarkdown(element, context).trim() || href;
			if (!href) return label;
			return `[${label}](${href})`;
		}

		case 'img': {
			const alt = element.getAttribute('alt') ?? 'Image';
			const src = element.getAttribute('src') ?? '';
			return src ? `![${alt}](${src})` : `![${alt}]`;
		}

		case 'hr':
			return '\n---\n\n';

		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6': {
			const level = Number(tag[1]);
			const hashes = '#'.repeat(Math.min(Math.max(level, 1), 6));
			return `${hashes} ${collectChildrenMarkdown(element, context).trim()}\n\n`;
		}

		case 'table':
			return formatTable(element, convertNodeToMarkdown);

		default:
			return collectChildrenMarkdown(element, context);
	}
}

/**
 * Collect markdown from all child nodes
 */
export function collectChildrenMarkdown(element: Element, context: ConversionContext): string {
	let output = '';
	for (const child of Array.from(element.childNodes)) {
		output += convertNodeToMarkdown(child, context);
	}
	return output;
}

/**
 * Compose a full markdown document from messages
 */
export function composeMarkdown(messages: Message[], title: string, platform: Platform, url: string): string {
	const timestamp = new Date().toISOString();
	const platformName = platform === 'chatgpt' ? 'ChatGPT' : 'Claude';

	const lines: string[] = [];
	lines.push(`# ${title || 'AI Conversation'}`);
	lines.push('');
	lines.push(`- Exported from ${platformName} on ${timestamp}`);
	lines.push(`- URL: ${url}`);
	lines.push('');

	for (const { role, markdown } of messages) {
		const label = role === 'assistant' ? 'Assistant' : 'User';
		lines.push(`**${label}:**`);
		lines.push(markdown || '_No content available._');
		lines.push('');
		lines.push('---');
		lines.push('');
	}

	// Remove trailing separator
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
		lines.pop();
	}
	if (lines.length > 0 && lines[lines.length - 1] === '---') {
		lines.pop();
	}
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
		lines.pop();
	}

	return `${normalizeSpacing(lines.join('\n')).trimEnd()}\n`;
}
