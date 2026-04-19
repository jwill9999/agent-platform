ALTER TABLE tools ADD COLUMN risk_tier TEXT NOT NULL DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE tools ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 0;
