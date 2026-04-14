ALTER TABLE `agents` ADD `system_prompt` text DEFAULT 'You are a helpful assistant.' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `description` text;