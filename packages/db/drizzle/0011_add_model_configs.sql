CREATE TABLE `model_configs` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `secret_ref_id` text REFERENCES `secret_refs`(`id`) ON DELETE SET NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `agents` ADD COLUMN `model_config_id` text REFERENCES `model_configs`(`id`) ON DELETE SET NULL;
