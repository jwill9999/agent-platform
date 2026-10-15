CREATE TABLE `git_delivery_operations` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `repository_root` text NOT NULL,
  `source` text NOT NULL,
  `session_id` text,
  `agent_id` text,
  `tool_call_id` text,
  `action_key` text NOT NULL,
  `state` text NOT NULL,
  `receipt_json` text NOT NULL,
  `material_json` text NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  `expires_at_ms` integer NOT NULL,
  `acknowledged_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `git_delivery_project_idx` ON `git_delivery_operations` (`project_id`, `created_at_ms`);
--> statement-breakpoint
CREATE UNIQUE INDEX `git_delivery_chat_call_idx` ON `git_delivery_operations` (`session_id`, `tool_call_id`) WHERE `source` = 'chat';
--> statement-breakpoint
CREATE UNIQUE INDEX `git_delivery_active_repo_idx` ON `git_delivery_operations` (`repository_root`) WHERE `state` = 'executing';
