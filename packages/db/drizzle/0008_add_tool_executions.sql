CREATE TABLE `tool_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`tool_name` text NOT NULL,
	`agent_id` text NOT NULL,
	`session_id` text NOT NULL,
	`args_json` text NOT NULL,
	`result_json` text,
	`risk_tier` text,
	`status` text NOT NULL DEFAULT 'pending',
	`started_at_ms` integer NOT NULL,
	`completed_at_ms` integer,
	`duration_ms` integer
);
