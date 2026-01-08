import type { Message, Platform } from '@/types';

export interface PlatformConfig {
	platform: Platform;
	ensureButton(): boolean;
	extractConversation(): Message[];
	deriveTitle(): string;
	isEligibleConversation(): boolean;
}
