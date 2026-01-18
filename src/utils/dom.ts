import { SANITIZE_SELECTORS } from '@/constants';

/**
 * Remove unwanted elements from a cloned DOM node
 */
export function pruneNode(root: Element): void {
	for (const selector of SANITIZE_SELECTORS) {
		for (const el of root.querySelectorAll(selector)) {
			el.remove();
		}
	}
}

/**
 * Check if an element should be skipped during markdown conversion
 */
export function shouldSkipElement(element: Element): boolean {
	if (element.hasAttribute('hidden')) return true;
	if (element.getAttribute('aria-hidden') === 'true') return true;
	if (element.matches('.sr-only, .visually-hidden, .hidden')) return true;
	if (element.matches('[data-message-author-role="system"]')) return true;
	const inlineStyle = element.getAttribute('style') ?? '';
	if (/display\s*:\s*none/i.test(inlineStyle) || /visibility\s*:\s*hidden/i.test(inlineStyle)) {
		return true;
	}
	if (element.isConnected) {
		const style = window.getComputedStyle(element);
		if (style.display === 'none' || style.visibility === 'hidden') {
			return true;
		}
	}
	if (element.matches('[contenteditable="false"][role="presentation"]')) {
		return true;
	}
	return false;
}
