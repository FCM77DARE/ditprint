CREATE TABLE `dashboard_admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`name` varchar(200) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastLoginAt` timestamp,
	CONSTRAINT `dashboard_admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_admins_email_unique` UNIQUE(`email`)
);
