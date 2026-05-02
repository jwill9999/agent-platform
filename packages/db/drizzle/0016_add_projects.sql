CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `workspace_path` text NOT NULL,
  `workspace_key` text,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `archived_at_ms` integer,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_idx` ON `projects` (`slug`);
--> statement-breakpoint
CREATE INDEX `projects_workspace_key_idx` ON `projects` (`workspace_key`);
--> statement-breakpoint
CREATE INDEX `projects_archived_at_idx` ON `projects` (`archived_at_ms`);
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `sessions_project_idx` ON `sessions` (`project_id`);
--> statement-breakpoint
ALTER TABLE `memories` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `memories_project_idx` ON `memories` (`project_id`);
--> statement-breakpoint
ALTER TABLE `working_memory_artifacts` ADD COLUMN `project_id` text REFERENCES `projects`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `working_memory_project_idx` ON `working_memory_artifacts` (`project_id`);
