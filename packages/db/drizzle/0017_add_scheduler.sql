CREATE TABLE `scheduled_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `scope` text NOT NULL,
  `scope_id` text,
  `project_id` text REFERENCES `projects`(`id`) ON DELETE set null,
  `owner_agent_id` text REFERENCES `agents`(`id`) ON DELETE set null,
  `owner_session_id` text REFERENCES `sessions`(`id`) ON DELETE set null,
  `execution_agent_id` text REFERENCES `agents`(`id`) ON DELETE set null,
  `created_from_session_id` text REFERENCES `sessions`(`id`) ON DELETE set null,
  `name` text NOT NULL,
  `description` text,
  `instructions` text NOT NULL,
  `target_kind` text NOT NULL,
  `target_payload_json` text DEFAULT '{}' NOT NULL,
  `schedule_type` text NOT NULL,
  `run_at_ms` integer,
  `interval_ms` integer,
  `cron_expression` text,
  `timezone` text DEFAULT 'UTC' NOT NULL,
  `next_run_at_ms` integer,
  `status` text DEFAULT 'paused' NOT NULL,
  `retry_policy_json` text DEFAULT '{}' NOT NULL,
  `timeout_ms` integer NOT NULL,
  `last_run_at_ms` integer,
  `lease_owner` text,
  `lease_expires_at_ms` integer,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_scope_idx` ON `scheduled_jobs` (`scope`, `scope_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_project_idx` ON `scheduled_jobs` (`project_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_owner_agent_idx` ON `scheduled_jobs` (`owner_agent_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_owner_session_idx` ON `scheduled_jobs` (`owner_session_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_execution_agent_idx` ON `scheduled_jobs` (`execution_agent_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_status_idx` ON `scheduled_jobs` (`status`);
--> statement-breakpoint
CREATE INDEX `scheduled_jobs_next_run_idx` ON `scheduled_jobs` (`status`, `next_run_at_ms`);
--> statement-breakpoint
CREATE TABLE `scheduled_job_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL REFERENCES `scheduled_jobs`(`id`) ON DELETE cascade,
  `status` text NOT NULL,
  `attempt` integer DEFAULT 1 NOT NULL,
  `queued_at_ms` integer NOT NULL,
  `started_at_ms` integer,
  `completed_at_ms` integer,
  `lease_owner` text,
  `lease_expires_at_ms` integer,
  `cancel_requested_at_ms` integer,
  `result_summary` text,
  `error_code` text,
  `error_message` text,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_job_idx` ON `scheduled_job_runs` (`job_id`);
--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_status_idx` ON `scheduled_job_runs` (`status`);
--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_lease_idx` ON `scheduled_job_runs` (`status`, `lease_expires_at_ms`);
--> statement-breakpoint
CREATE TABLE `scheduled_job_run_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `scheduled_job_runs`(`id`) ON DELETE cascade,
  `job_id` text NOT NULL REFERENCES `scheduled_jobs`(`id`) ON DELETE cascade,
  `sequence` integer NOT NULL,
  `level` text NOT NULL,
  `message` text NOT NULL,
  `data_json` text DEFAULT '{}' NOT NULL,
  `truncated` integer DEFAULT false NOT NULL,
  `created_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_job_run_logs_run_sequence_idx` ON `scheduled_job_run_logs` (`run_id`, `sequence`);
--> statement-breakpoint
CREATE INDEX `scheduled_job_run_logs_job_idx` ON `scheduled_job_run_logs` (`job_id`);
