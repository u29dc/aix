/**
 * DOM element factory utilities for testing
 */

/**
 * Create an HTML document from string
 */
export function createDocument(html: string): Document {
	const parser = new DOMParser();
	return parser.parseFromString(html, 'text/html');
}

/**
 * Create an element with attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string>, children?: (Node | string)[]): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);

	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			element.setAttribute(key, value);
		}
	}

	if (children) {
		for (const child of children) {
			if (typeof child === 'string') {
				element.appendChild(document.createTextNode(child));
			} else {
				element.appendChild(child);
			}
		}
	}

	return element;
}

/**
 * Create a code block element
 */
export function createCodeBlock(code: string, language?: string): HTMLPreElement {
	const codeElement = createElement('code', language ? { class: `language-${language}` } : undefined, [code]);
	return createElement('pre', undefined, [codeElement]);
}

/**
 * Nested list item structure
 */
export interface NestedItem {
	text: string;
	children?: NestedItem[];
	ordered?: boolean;
}

/**
 * Create a list element (ul or ol)
 */
export function createList(items: (string | NestedItem)[], ordered = false, start?: number): HTMLUListElement | HTMLOListElement {
	const tag = ordered ? 'ol' : 'ul';
	const attrs: Record<string, string> | undefined = ordered && start !== undefined && start !== 1 ? { start: String(start) } : undefined;

	const listItems = items.map((item) => {
		if (typeof item === 'string') {
			return createElement('li', undefined, [item]);
		}

		const children: (Node | string)[] = [item.text];
		if (item.children?.length) {
			children.push(createList(item.children, item.ordered ?? ordered));
		}
		return createElement('li', undefined, children);
	});

	return createElement(tag, attrs, listItems) as HTMLUListElement | HTMLOListElement;
}

/**
 * Create a table element
 */
export function createTable(headers: string[], rows: string[][]): HTMLTableElement {
	const headerRow = createElement(
		'tr',
		undefined,
		headers.map((h) => createElement('th', undefined, [h])),
	);

	const bodyRows = rows.map((cells) =>
		createElement(
			'tr',
			undefined,
			cells.map((c) => createElement('td', undefined, [c])),
		),
	);

	return createElement('table', undefined, [headerRow, ...bodyRows]);
}

/**
 * Create a Claude-style user message container
 */
export function createClaudeUserMessage(content: string | Element): HTMLDivElement {
	const contentElement = typeof content === 'string' ? createElement('p', { class: 'whitespace-pre-wrap break-words' }, [content]) : content;

	return createElement('div', { 'data-testid': 'user-message', class: 'font-large !font-user-message' }, [contentElement]);
}

/**
 * Create a Claude-style assistant message container
 */
export function createClaudeAssistantMessage(content: string | Element, streaming = false): HTMLDivElement {
	const contentElement = typeof content === 'string' ? createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [createElement('p', undefined, [content])]) : content;

	const responseDiv = createElement('div', { class: 'font-claude-response' }, [contentElement]);

	return createElement('div', { 'data-is-streaming': String(streaming), class: 'group relative' }, [responseDiv]);
}
