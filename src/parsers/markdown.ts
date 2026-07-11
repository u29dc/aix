import { formatCodeBlock } from "@/parsers/code-block";
import { formatList } from "@/parsers/list";
import { formatTable } from "@/parsers/table";
import type { ConversionContext, Message, Platform } from "@/types";
import { shouldSkipElement } from "@/utils/dom";
import { escapeMarkdown, normalizeMarkdown, wrapInlineCode, wrapMarkdown } from "@/utils/markdown";

export type ConvertNodeFn = (node: Node, context?: ConversionContext) => string;

const DEFAULT_CONTEXT: ConversionContext = { listDepth: 0 };
const CHATGPT_THUMBNAIL_PREFIX = "https://images.openai.com/thumbnails/";

/**
 * Format a blockquote element as markdown
 */
function formatBlockquote(element: Element, context: ConversionContext): string {
	const inner = collectChildrenMarkdown(element, context).trim();
	if (!inner) return "";
	return `${inner
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n")}\n\n`;
}

/**
 * Format a link element as markdown
 */
function formatLink(element: Element, context: ConversionContext): string {
	const href = element.getAttribute("href") ?? "";
	const label = collectChildrenMarkdown(element, context).trim() || href;
	if (!href) return label;
	return `[${label}](${href})`;
}

/**
 * Format an image element as markdown
 */
function formatImage(element: Element): string {
	const alt = element.getAttribute("alt")?.trim() || "Image";
	const src = element.getAttribute("src") ?? "";
	const label = escapeMarkdown(alt);
	if (src.startsWith(CHATGPT_THUMBNAIL_PREFIX) && element.closest("table")) return "";
	return src ? `![${label}](${src})` : `![${label}]`;
}

function extractTexAnnotation(element: Element): string {
	const annotation = element.matches('annotation[encoding="application/x-tex"]') ? element : element.querySelector('annotation[encoding="application/x-tex"]');
	return annotation?.textContent?.trim() ?? "";
}

function isDisplayMath(element: Element): boolean {
	const mathElement = element.matches("math") ? element : element.querySelector("math");
	return mathElement?.getAttribute("display") === "block" || element.closest(".katex-display") !== null;
}

function isMathElement(element: Element): boolean {
	const tag = element.tagName.toLowerCase();
	return tag === "math" || element.classList.contains("katex") || element.classList.contains("katex-mathml");
}

function formatMath(element: Element): string {
	const tex = extractTexAnnotation(element);
	if (!tex) return "";
	return isDisplayMath(element) ? `$$\n${tex}\n$$\n\n` : `$${tex}$`;
}

/**
 * Format a heading element as markdown
 */
function formatHeading(element: Element, level: number, context: ConversionContext): string {
	const content = collectChildrenMarkdown(element, context).trim();
	if (!content) return "";
	const hashes = "#".repeat(Math.min(Math.max(level, 1), 6));
	return `${hashes} ${content}\n\n`;
}

function formatDetails(element: Element, context: ConversionContext): string {
	const inner = collectNonWhitespaceChildrenMarkdown(element, context).trim();
	return `<details>\n${inner}\n</details>\n\n`;
}

function formatSummary(element: Element, context: ConversionContext): string {
	const inner = collectChildrenMarkdown(element, context).trim();
	return `<summary>${inner}</summary>\n\n`;
}

/**
 * Format inline code element as markdown
 */
function formatInlineCode(element: Element): string {
	if (element.parentElement?.tagName.toLowerCase() === "pre") {
		return "";
	}
	return wrapInlineCode(element.textContent ?? "");
}

/**
 * Format checkbox input element as markdown
 */
function formatCheckboxInput(element: Element): string {
	const type = element.getAttribute("type")?.toLowerCase();
	if (type !== "checkbox") return "";
	const checked = element.hasAttribute("checked") || element.getAttribute("aria-checked") === "true";
	return checked ? "[x] " : "[ ] ";
}

/**
 * Convert a DOM node to markdown
 */
export function convertNodeToMarkdown(node: Node, context: ConversionContext = DEFAULT_CONTEXT): string {
	if (!node) return "";
	if (node.nodeType === Node.TEXT_NODE) return escapeMarkdown(node.nodeValue ?? "");
	if (node.nodeType !== Node.ELEMENT_NODE) return "";

	const element = node as Element;
	if (shouldSkipElement(element)) return "";

	return convertElementToMarkdown(element, context);
}

/**
 * Convert an element to markdown based on its tag
 */
function convertElementToMarkdown(element: Element, context: ConversionContext): string {
	const tag = element.tagName.toLowerCase();
	if (isMathElement(element)) return formatMath(element);

	switch (tag) {
		case "p":
			return `${collectChildrenMarkdown(element, context).trim()}\n\n`;
		case "br":
			return "  \n";
		case "strong":
		case "b":
			return wrapMarkdown("**", collectChildrenMarkdown(element, context));
		case "em":
		case "i":
			return wrapMarkdown("*", collectChildrenMarkdown(element, context));
		case "del":
		case "s":
		case "strike":
			return wrapMarkdown("~~", collectChildrenMarkdown(element, context));
		case "u":
			return `<u>${collectChildrenMarkdown(element, context)}</u>`;
		case "sup":
			return `<sup>${collectChildrenMarkdown(element, context)}</sup>`;
		case "sub":
			return `<sub>${collectChildrenMarkdown(element, context)}</sub>`;
		case "code":
			return formatInlineCode(element);
		case "pre":
			return formatCodeBlock(element);
		case "input":
			return formatCheckboxInput(element);
		case "ul":
			return formatList(element, context, false, convertNodeToMarkdown);
		case "ol":
			return formatList(element, context, true, convertNodeToMarkdown);
		case "li":
			return collectChildrenMarkdown(element, context).trim();
		case "blockquote":
			return formatBlockquote(element, context);
		case "details":
			return formatDetails(element, context);
		case "summary":
			return formatSummary(element, context);
		case "a":
			return formatLink(element, context);
		case "img":
			return formatImage(element);
		case "hr":
			return "\n---\n\n";
		case "h1":
		case "h2":
		case "h3":
		case "h4":
		case "h5":
		case "h6":
			return formatHeading(element, Number(tag[1]), context);
		case "table":
			return formatTable(element, convertNodeToMarkdown);
		default:
			return collectChildrenMarkdown(element, context);
	}
}

/**
 * Collect markdown from all child nodes
 */
export function collectChildrenMarkdown(element: Element, context: ConversionContext): string {
	let output = "";
	for (const child of Array.from(element.childNodes)) {
		output += convertNodeToMarkdown(child, context);
	}
	return output;
}

function collectNonWhitespaceChildrenMarkdown(element: Element, context: ConversionContext): string {
	let output = "";
	for (const child of Array.from(element.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE && !child.nodeValue?.trim()) continue;
		output += convertNodeToMarkdown(child, context);
	}
	return output;
}

/**
 * Compose a full markdown document from messages
 */
export function composeMarkdown(messages: Message[], title: string, platform: Platform, platformLabel: string, url: string): string {
	const exportedAt = new Date().toISOString();
	const platformName = platformLabel || platform;

	const lines: string[] = [];
	lines.push(`# ${title || "AI Conversation"}`);
	lines.push("");
	lines.push(`- Exported from ${platformName} on ${exportedAt}`);
	lines.push(`- URL: ${url}`);
	lines.push("");

	const separator = "=".repeat(100);

	for (const { role, markdown, timestamp } of messages) {
		const label = role === "assistant" ? "Assistant" : "User";
		const timestampLabel = timestamp ? ` (${escapeMarkdown(timestamp)})` : "";
		lines.push(`**${label}${timestampLabel}:**`);
		lines.push(markdown || "_No content available._");
		lines.push("");
		lines.push(separator);
		lines.push("");
	}

	// Remove trailing separator
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
	}
	if (lines.length > 0 && lines[lines.length - 1] === separator) {
		lines.pop();
	}
	while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
		lines.pop();
	}

	return `${normalizeMarkdown(lines.join("\n")).trimEnd()}\n`;
}
