CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sttScoreId` int NOT NULL,
	`territoryId` int NOT NULL,
	`subject` varchar(300) NOT NULL,
	`sentAt` timestamp,
	`recipientCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`territoryId` int NOT NULL,
	`source` enum('newsapi','dou','ibama','manual') NOT NULL,
	`relatedIndex` enum('ITT','ICS','IVS','IVE','ICI','GERAL') DEFAULT 'GERAL',
	`title` varchar(500) NOT NULL,
	`summary` text,
	`url` text,
	`publishedAt` timestamp,
	`curationStatus` enum('pending','relevant','ignored','analyzed') NOT NULL DEFAULT 'pending',
	`curationNote` text,
	`curatedBy` int,
	`curatedAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stt_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`territoryId` int NOT NULL,
	`period` varchar(7) NOT NULL,
	`stt` float NOT NULL,
	`itt` float,
	`ics` float,
	`ivs` float,
	`ive` float,
	`ici` float,
	`activatedIndex` varchar(10),
	`variation` float,
	`executiveNote` text,
	`scenario` enum('estabilidade','pressao','escalada'),
	`published` boolean NOT NULL DEFAULT false,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stt_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(200),
	`jobRole` varchar(200),
	`sector` varchar(100),
	`territoryInterest` varchar(100),
	`plan` enum('free_alert','radar','dit') NOT NULL DEFAULT 'free_alert',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `territories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(200) NOT NULL,
	`region` varchar(100),
	`state` varchar(50),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `territories_id` PRIMARY KEY(`id`),
	CONSTRAINT `territories_slug_unique` UNIQUE(`slug`)
);
