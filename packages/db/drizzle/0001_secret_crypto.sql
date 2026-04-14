ALTER TABLE `secret_refs` ADD `ciphertext_b64` text;--> statement-breakpoint
ALTER TABLE `secret_refs` ADD `iv_b64` text;--> statement-breakpoint
ALTER TABLE `secret_refs` ADD `auth_tag_b64` text;--> statement-breakpoint
ALTER TABLE `secret_refs` ADD `key_version` integer;--> statement-breakpoint
ALTER TABLE `secret_refs` ADD `algorithm` text;