CREATE TABLE `alert_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriberId` int NOT NULL,
	`territoryId` int NOT NULL,
	`signalTitle` varchar(500),
	`impactScore` float,
	`dimension` enum('D1','D2','D3','D4','D5','D6','GERAL'),
	`channel` enum('email','push','sse') NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`delivered` boolean NOT NULL DEFAULT false,
	`opened` boolean NOT NULL DEFAULT false,
	`errorMessage` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriberId` int NOT NULL,
	`territoryId` int NOT NULL,
	`channels` json NOT NULL,
	`minImpactThreshold` float NOT NULL DEFAULT 0.7,
	`quietHoursStart` varchar(5),
	`quietHoursEnd` varchar(5),
	`digestFrequency` enum('realtime','daily','weekly') NOT NULL DEFAULT 'realtime',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_prefs_subscriber_territory_uidx` UNIQUE(`subscriberId`,`territoryId`)
);
--> statement-breakpoint
CREATE TABLE `indicator_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`territoryId` int NOT NULL,
	`indicatorId` int NOT NULL,
	`period` varchar(7) NOT NULL,
	`score` float,
	`rawValue` float,
	`unit` varchar(50),
	`sourceAgentId` varchar(100),
	`confidence` float,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indicator_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `indicator_scores_territory_indicator_period_uidx` UNIQUE(`territoryId`,`indicatorId`,`period`)
);
--> statement-breakpoint
CREATE TABLE `indicators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`indicatorId` varchar(100) NOT NULL,
	`dimension` enum('D1','D2','D3','D4','D5','D6') NOT NULL,
	`objectOfStudy` varchar(200) NOT NULL,
	`itemOfStudy` varchar(300) NOT NULL,
	`name` varchar(300) NOT NULL,
	`weight` int NOT NULL DEFAULT 1,
	`sources` json NOT NULL,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indicators_id` PRIMARY KEY(`id`),
	CONSTRAINT `indicators_code_unique` UNIQUE(`code`),
	CONSTRAINT `indicators_indicatorId_unique` UNIQUE(`indicatorId`)
);
--> statement-breakpoint
ALTER TABLE `dashboard_admins` MODIFY COLUMN `passwordHash` varchar(72) NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` MODIFY COLUMN `relatedIndex` enum('D1','D2','D3','D4','D5','D6','GERAL') DEFAULT 'GERAL';--> statement-breakpoint
ALTER TABLE `signals` MODIFY COLUMN `llmSuggestedIndex` enum('D1','D2','D3','D4','D5','D6','GERAL');--> statement-breakpoint
ALTER TABLE `index_history` ADD `d1Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d2Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d3Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d4Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d5Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d6Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d1Delta` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d2Delta` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d3Delta` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d4Delta` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d5Delta` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d6Delta` float;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD `d1Score` float;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD `d2Score` float;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD `d3Score` float;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD `d4Score` float;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD `d5Score` float;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD `d6Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD CONSTRAINT `index_history_territory_period_uidx` UNIQUE(`territoryId`,`period`);--> statement-breakpoint
ALTER TABLE `stt_scores` ADD CONSTRAINT `stt_scores_territory_period_uidx` UNIQUE(`territoryId`,`period`);--> statement-breakpoint
ALTER TABLE `alert_log` ADD CONSTRAINT `alert_log_subscriberId_subscribers_id_fk` FOREIGN KEY (`subscriberId`) REFERENCES `subscribers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_log` ADD CONSTRAINT `alert_log_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_preferences` ADD CONSTRAINT `alert_preferences_subscriberId_subscribers_id_fk` FOREIGN KEY (`subscriberId`) REFERENCES `subscribers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_preferences` ADD CONSTRAINT `alert_preferences_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `indicator_scores` ADD CONSTRAINT `indicator_scores_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `indicator_scores` ADD CONSTRAINT `indicator_scores_indicatorId_indicators_id_fk` FOREIGN KEY (`indicatorId`) REFERENCES `indicators`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_sttScoreId_stt_scores_id_fk` FOREIGN KEY (`sttScoreId`) REFERENCES `stt_scores`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collection_snapshots` ADD CONSTRAINT `collection_snapshots_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `index_history` ADD CONSTRAINT `index_history_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `index_history` ADD CONSTRAINT `index_history_snapshotId_collection_snapshots_id_fk` FOREIGN KEY (`snapshotId`) REFERENCES `collection_snapshots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `signals` ADD CONSTRAINT `signals_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD CONSTRAINT `stt_scores_territoryId_territories_id_fk` FOREIGN KEY (`territoryId`) REFERENCES `territories`(`id`) ON DELETE cascade ON UPDATE no action;