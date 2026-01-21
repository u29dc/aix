import { chatgptAdapter } from '@/platforms/chatgpt';
import { claudeAdapter } from '@/platforms/claude';
import type { PlatformConfig } from '@/platforms/types';
import type { Platform } from '@/types';

export { chatgptAdapter } from '@/platforms/chatgpt';
export { claudeAdapter } from '@/platforms/claude';
export type { PlatformConfig } from '@/platforms/types';

/**
 * Detect which platform (if any) we're on
 */
export function detectPlatform(): Platform | null {
	const host = window.location.hostname;
	if (/claude\.ai$/i.test(host)) return 'claude';
	if (/chatgpt\.com$/i.test(host) || /chat\.openai\.com$/i.test(host)) return 'chatgpt';
	return null;
}

/**
 * Get the platform adapter for the detected platform
 */
export function getPlatformAdapter(platform: Platform): PlatformConfig {
	switch (platform) {
		case 'claude':
			return claudeAdapter;
		case 'chatgpt':
			return chatgptAdapter;
	}
}
