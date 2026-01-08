import { detectLanguage, pickFence } from '@/utils/markdown';

/**
 * Format a <pre> element as a markdown code block
 */
export function formatCodeBlock(preElement: Element): string {
	const codeElement = preElement.querySelector('code');
	const rawText = codeElement ? (codeElement.textContent ?? '') : (preElement.textContent ?? '');
	const language = detectLanguage(codeElement);
	const fence = pickFence(rawText);
	const header = language ? `${fence}${language}` : fence;
	return `${header}\n${rawText.replace(/\n$/, '')}\n${fence}\n\n`;
}
