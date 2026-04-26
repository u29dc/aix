import { detectLanguage, pickFence } from '@/utils/markdown';

function collectCodeText(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
	if (node.nodeType !== Node.ELEMENT_NODE) return '';

	const element = node as Element;
	if (element.tagName.toLowerCase() === 'br') return '\n';

	let output = '';
	for (const child of Array.from(element.childNodes)) {
		output += collectCodeText(child);
	}
	return output;
}

function normalizeLanguageLabel(value: string): string {
	const label = value.replace(/\s+/g, ' ').trim();
	if (!/^[a-z0-9+#.-]{1,32}$/i.test(label)) return '';
	return label.toLowerCase();
}

function extractChromeCodeViewerLanguage(preElement: Element): string {
	const clone = preElement.cloneNode(true) as Element;
	for (const element of Array.from(clone.querySelectorAll('.cm-content, code, button, svg'))) {
		element.remove();
	}
	return normalizeLanguageLabel(clone.textContent ?? '');
}

function extractCodeText(preElement: Element, codeElement: Element | null): string {
	const codeMirrorContent = preElement.querySelector('.cm-content');
	if (codeMirrorContent) return collectCodeText(codeMirrorContent);
	if (codeElement) return codeElement.textContent ?? '';
	return preElement.textContent ?? '';
}

function extractLanguage(preElement: Element, codeElement: Element | null): string {
	return detectLanguage(codeElement) || extractChromeCodeViewerLanguage(preElement);
}

/**
 * Format a <pre> element as a markdown code block
 */
export function formatCodeBlock(preElement: Element): string {
	const codeElement = preElement.querySelector('code');
	const rawText = extractCodeText(preElement, codeElement);
	const language = extractLanguage(preElement, codeElement);
	const fence = pickFence(rawText);
	const header = language ? `${fence}${language}` : fence;
	return `${header}\n${rawText.replace(/\n$/, '')}\n${fence}\n\n`;
}
