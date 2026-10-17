CREATE TABLE controlled_runs (
  id text PRIMARY KEY NOT NULL,
  session_id text NOT NULL,
  project_id text,
  process_instance_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('running', 'waiting_for_approval', 'stop_requested', 'cancelled', 'completed', 'failed', 'interrupted', 'outcome_unknown')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at_ms integer NOT NULL,
  updated_at_ms integer NOT NULL,
  stop_requested_at_ms integer,
  stop_acknowledged_at_ms integer,
  settled_at_ms integer,
  reason text NOT NULL DEFAULT 'none' CHECK (reason IN ('none', 'user_stop', 'timeout', 'client_disconnect', 'process_interrupted', 'execution_failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX controlled_runs_active_session_idx ON controlled_runs(session_id) WHERE state IN ('running', 'waiting_for_approval', 'stop_requested');
--> statement-breakpoint
CREATE INDEX controlled_runs_session_idx ON controlled_runs(session_id, created_at_ms);
--> statement-breakpoint
CREATE TABLE run_executions (
  execution_id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL REFERENCES controlled_runs(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE run_attempts (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL REFERENCES controlled_runs(id) ON DELETE CASCADE,
  execution_id text NOT NULL REFERENCES run_executions(execution_id),
  kind text NOT NULL CHECK (kind IN ('model', 'tool', 'sensor', 'setup')),
  outcome text NOT NULL DEFAULT 'running' CHECK (outcome IN ('running', 'succeeded', 'failed', 'unknown')),
  admitted_at_ms integer NOT NULL,
  settled_at_ms integer
);
--> statement-breakpoint
CREATE INDEX run_attempts_run_idx ON run_attempts(run_id);
--> statement-breakpoint
CREATE INDEX run_executions_run_idx ON run_executions(run_id);
--> statement-breakpoint
CREATE INDEX approval_requests_run_idx ON approval_requests(run_id);
