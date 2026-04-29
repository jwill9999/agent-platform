CREATE TABLE `approval_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `run_id` text NOT NULL,
  `agent_id` text NOT NULL,
  `tool_name` text NOT NULL,
  `args_json` text NOT NULL,
  `execution_payload_json` text,
  `risk_tier` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at_ms` integer NOT NULL,
  `decided_at_ms` integer,
  `expires_at_ms` integer,
  `decision_reason` text
);
