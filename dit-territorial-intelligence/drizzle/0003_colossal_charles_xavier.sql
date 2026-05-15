ALTER TABLE `signals` ADD `imageUrl` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `llmAnalysis` text;--> statement-breakpoint
ALTER TABLE `signals` ADD `llmImpactScore` float;--> statement-breakpoint
ALTER TABLE `signals` ADD `llmSuggestedIndex` enum('ITT','ICS','IVS','IVE','ICI','GERAL');