/**
 * Default selectors for elements that should be removed during sanitization
 */
export const DEFAULT_REMOVE_SELECTORS = [
	'script',
	'style',
	'svg',
	'button',
	'input',
	'textarea',
	'form',
	'[aria-hidden="true"]',
	'[role="img"]',
	'.copy-button',
	'[data-testid*="copy"]',
	'[data-testid="message-actions"]',
	'[data-testid="hover-card"]',
	'[data-testid="action-bar-copy"]',
	'.sr-only',
	'.visually-hidden',
] as const;

/**
 * Options for sanitization
 */
export interface SanitizeOptions {
	removeSelectors?: readonly string[];
	preserveWhitespace?: boolean;
}

/**
 * Sanitize an element by removing unwanted child elements
 * Returns a cloned element with sanitization applied
 */
export function sanitizeElement(element: Element, options: SanitizeOptions = {}): Element {
	const { removeSelectors = DEFAULT_REMOVE_SELECTORS, preserveWhitespace = false } = options;

	const clone = element.cloneNode(true) as Element;

	for (const selector of removeSelectors) {
		const elements = clone.querySelectorAll(selector);
		for (const el of Array.from(elements)) {
			el.remove();
		}
	}

	if (!preserveWhitespace) {
		removeEmptyTextNodes(clone);
	}

	return clone;
}

/**
 * Remove empty text nodes from an element tree
 */
function removeEmptyTextNodes(element: Element): void {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

	const nodesToRemove: Node[] = [];
	let node = walker.nextNode();

	while (node) {
		if (node.textContent?.trim() === '') {
			nodesToRemove.push(node);
		}
		node = walker.nextNode();
	}

	for (const n of nodesToRemove) {
		n.parentNode?.removeChild(n);
	}
}

/**
 * Normalize whitespace in text content
 */
export function normalizeWhitespace(text: string): string {
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n[ \t]+/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.trim();
}

/**
 * Check if an element should be considered empty
 */
export function isEmptyElement(element: Element): boolean {
	const text = element.textContent?.trim() ?? '';
	if (text) return false;

	const hasVisibleChildren = element.querySelector('img, video, audio, iframe, canvas, object, embed');
	return !hasVisibleChildren;
}
