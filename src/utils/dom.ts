import { SELECTORS_TO_PRUNE } from '@/constants';

/**
 * Remove unwanted elements from a cloned DOM node
 */
export function pruneNode(root: Element): void {
	for (const selector of SELECTORS_TO_PRUNE) {
		for (const el of root.querySelectorAll(selector)) {
			el.remove();
		}
	}
}

/**
 * Check if an element should be skipped during markdown conversion
 */
export function shouldSkipElement(element: Element): boolean {
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
