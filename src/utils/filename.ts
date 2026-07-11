import type { Platform } from "@/types";

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/**
 * Build a filename for the exported conversation
 */
export function buildFilename(title: string, platform: Platform): string {
	const date = new Date();
	const timestamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return `${platform}-chat-${timestamp}${slug ? `-${slug}` : ""}.md`;
}
