ALTER TABLE `signals` MODIFY COLUMN `source` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `signals` MODIFY COLUMN `relatedIndex` enum('D1','D2','D3','D4','D5','D6','D7','GERAL') DEFAULT 'GERAL';--> statement-breakpoint
ALTER TABLE `signals` MODIFY COLUMN `llmSuggestedIndex` enum('D1','D2','D3','D4','D5','D6','D7','GERAL');--> statement-breakpoint
ALTER TABLE `index_history` ADD `d7Score` float;--> statement-breakpoint
ALTER TABLE `index_history` ADD `d7Delta` float;--> statement-breakpoint
ALTER TABLE `stt_scores` ADD `d7Score` float;