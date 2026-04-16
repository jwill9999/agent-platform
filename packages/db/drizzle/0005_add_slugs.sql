-- Add slug (and name for skills) columns, then populate from existing data.
-- Step 1: Add new columns (nullable/default first)
ALTER TABLE `agents` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mcp_servers` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tools` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint

-- Step 2: Populate slugs from existing names (lowercase, spaces→hyphens, strip special chars)
UPDATE `agents` SET `slug` = LOWER(REPLACE(REPLACE(TRIM(`name`), ' ', '-'), '--', '-'));--> statement-breakpoint
UPDATE `tools` SET `slug` = LOWER(REPLACE(REPLACE(TRIM(`name`), ' ', '-'), '--', '-'));--> statement-breakpoint
UPDATE `mcp_servers` SET `slug` = LOWER(REPLACE(REPLACE(TRIM(`name`), ' ', '-'), '--', '-'));--> statement-breakpoint
-- Skills: derive name from first 60 chars of goal, slug from that
UPDATE `skills` SET `name` = SUBSTR(`goal`, 1, 60), `slug` = LOWER(REPLACE(REPLACE(TRIM(SUBSTR(`goal`, 1, 60)), ' ', '-'), '--', '-'));--> statement-breakpoint

-- Step 3: Add unique indexes
CREATE UNIQUE INDEX `agents_slug_idx` ON `agents` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_servers_slug_idx` ON `mcp_servers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_idx` ON `skills` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tools_slug_idx` ON `tools` (`slug`);