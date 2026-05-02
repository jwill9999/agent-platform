CREATE TABLE `working_memory_artifacts` (
  `session_id` text PRIMARY KEY NOT NULL,
  `run_id` text,
  `current_goal` text,
  `active_project` text,
  `active_task` text,
  `decisions_json` text DEFAULT '[]' NOT NULL,
  `important_files_json` text DEFAULT '[]' NOT NULL,
  `tools_used_json` text DEFAULT '[]' NOT NULL,
  `tool_summaries_json` text DEFAULT '[]' NOT NULL,
  `blockers_json` text DEFAULT '[]' NOT NULL,
  `pending_approval_ids_json` text DEFAULT '[]' NOT NULL,
  `next_action` text,
  `summary` text DEFAULT '' NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
