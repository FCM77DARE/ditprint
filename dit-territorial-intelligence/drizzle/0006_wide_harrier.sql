ALTER TABLE `territories` ADD `contextData` json;--> statement-breakpoint
ALTER TABLE `territories` ADD `onboardingStatus` enum('pending','processing','ready','error') DEFAULT 'ready';