CREATE TABLE `memories` (
  `id` text PRIMARY KEY NOT NULL,
  `scope` text NOT NULL,
  `scope_id` text,
  `kind` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `review_status` text DEFAULT 'unreviewed' NOT NULL,
  `content` text NOT NULL,
  `confidence` real DEFAULT 0.5 NOT NULL,
  `source_kind` text NOT NULL,
  `source_id` text,
  `source_label` text,
  `source_metadata_json` text DEFAULT '{}' NOT NULL,
  `tags_json` text DEFAULT '[]' NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `safety_state` text DEFAULT 'unchecked' NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  `expires_at_ms` integer,
  `reviewed_at_ms` integer,
  `reviewed_by` text
);
--> statement-breakpoint
CREATE INDEX `memories_scope_idx` ON `memories` (`scope`, `scope_id`);
--> statement-breakpoint
CREATE INDEX `memories_kind_idx` ON `memories` (`kind`);
--> statement-breakpoint
CREATE INDEX `memories_status_idx` ON `memories` (`status`);
--> statement-breakpoint
CREATE INDEX `memories_review_status_idx` ON `memories` (`review_status`);
--> statement-breakpoint
CREATE INDEX `memories_expires_at_idx` ON `memories` (`expires_at_ms`);
--> statement-breakpoint
CREATE INDEX `memories_source_idx` ON `memories` (`source_kind`, `source_id`);
--> statement-breakpoint
CREATE TABLE `memory_links` (
  `source_memory_id` text NOT NULL,
  `target_memory_id` text NOT NULL,
  `relation` text NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `created_at_ms` integer NOT NULL,
  PRIMARY KEY(`source_memory_id`, `target_memory_id`, `relation`),
  FOREIGN KEY (`source_memory_id`) REFERENCES `memories`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`target_memory_id`) REFERENCES `memories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memory_links_target_idx` ON `memory_links` (`target_memory_id`);
