import type { Message, Platform } from '@/types';

export interface PlatformConfig {
	platform: Platform;
	displayName: string;
	ensureButton(): boolean;
	extractConversation(): Message[];
	deriveTitle(): string;
	isEligibleConversation(): boolean;
}
