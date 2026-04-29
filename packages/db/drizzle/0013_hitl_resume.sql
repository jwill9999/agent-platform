ALTER TABLE `messages` ADD COLUMN `tool_calls_json` text;
--> statement-breakpoint
ALTER TABLE `approval_requests` ADD COLUMN `resumed_at_ms` integer;
