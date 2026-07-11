import type { Message, Platform } from '@/types';

export interface PlatformConfig {
	platform: Platform;
	displayName: string;
	ensureButton(): boolean;
	prepareForExport?(): Promise<Message[] | undefined>;
	extractConversation(): Message[];
	deriveTitle(): string;
	isEligibleConversation(): boolean;
}
