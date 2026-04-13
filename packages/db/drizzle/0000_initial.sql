CREATE TABLE `agent_mcp_servers` (
	`agent_id` text NOT NULL,
	`mcp_server_id` text NOT NULL,
	PRIMARY KEY(`agent_id`, `mcp_server_id`),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mcp_server_id`) REFERENCES `mcp_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_skills` (
	`agent_id` text NOT NULL,
	`skill_id` text NOT NULL,
	PRIMARY KEY(`agent_id`, `skill_id`),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_tools` (
	`agent_id` text NOT NULL,
	`tool_id` text NOT NULL,
	PRIMARY KEY(`agent_id`, `tool_id`),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`execution_limits_json` text NOT NULL,
	`model_override_json` text,
	`plugin_allowlist_json` text,
	`plugin_denylist_json` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`title` text,
	`metadata_json` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_metadata_session_id_unique` ON `chat_metadata` (`session_id`);--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`transport` text NOT NULL,
	`command` text,
	`args_json` text,
	`url` text,
	`metadata_json` text
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `plugin_catalog_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_id` text NOT NULL,
	`version` text NOT NULL,
	`source_uri` text NOT NULL,
	`checksum` text
);
--> statement-breakpoint
CREATE TABLE `secret_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`goal` text NOT NULL,
	`constraints_json` text NOT NULL,
	`tool_ids_json` text NOT NULL,
	`output_schema_json` text
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config_json` text
);
