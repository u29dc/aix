import type { ConvertNodeFn } from "@/parsers/markdown";
import type { ConversionContext } from "@/types";

function isListMarkerLine(line: string): boolean {
	return /^\s*(?:[-*+]\s+\S|\d+\.\s+\S)/.test(line);
}

function normalizeTaskMarkerSpacing(value: string): string {
	return value.replace(/^(\[[ x]\])\s+/, "$1 ");
}

function collectListItemMarkdown(item: Element, context: ConversionContext, convertNode: ConvertNodeFn): string {
	let output = "";
	for (const child of Array.from(item.childNodes)) {
		if (child.nodeType === Node.ELEMENT_NODE && ["ul", "ol"].includes((child as Element).tagName.toLowerCase())) {
			const nested = convertNode(child, context).trimEnd();
			if (nested.trim()) output = `${output.trimEnd()}\n${nested}`;
			continue;
		}

		output += convertNode(child, context);
	}
	return output.trim();
}

/**
 * Format a list element (ul/ol) as markdown
 */
export function formatList(listElement: Element, context: ConversionContext, ordered: boolean, convertNode: ConvertNodeFn): string {
	const depth = context.listDepth;
	const indent = "  ".repeat(depth);
	const items: string[] = [];
	let index = ordered ? Number(listElement.getAttribute("start") ?? 1) : 0;
	const nextContext: ConversionContext = { ...context, listDepth: depth + 1 };

	for (const child of Array.from(listElement.children)) {
		if (child.tagName?.toLowerCase() === "li") {
			const value = ordered ? `${index}. ` : "- ";
			const continuation = " ".repeat(value.length);
			const content = normalizeTaskMarkerSpacing(collectListItemMarkdown(child, nextContext, convertNode));
			const lines = content.split("\n").filter((line) => line.trim().length > 0);
			const firstLine = `${indent}${value}${lines.shift() ?? ""}`;
			const extraLines = lines.map((line) => (isListMarkerLine(line) ? line : `${indent}${continuation}${line}`));
			items.push([firstLine, ...extraLines].join("\n"));
			if (ordered) index += 1;
		}
	}

	if (!items.length) return "";
	return `${items.join("\n")}\n\n`;
}
