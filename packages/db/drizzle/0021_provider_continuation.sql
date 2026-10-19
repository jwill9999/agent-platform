ALTER TABLE `model_configs` ADD `base_url` text;
--> statement-breakpoint
ALTER TABLE `messages` ADD `provider_continuation_format` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `provider_continuations` (
  `message_id` text PRIMARY KEY NOT NULL REFERENCES `messages`(`id`) ON DELETE cascade,
  `session_id` text NOT NULL REFERENCES `sessions`(`id`) ON DELETE cascade,
  `ciphertext_b64` text NOT NULL,
  `iv_b64` text NOT NULL,
  `auth_tag_b64` text NOT NULL,
  `key_version` integer NOT NULL,
  `algorithm` text NOT NULL,
  `plaintext_bytes` integer NOT NULL CHECK (`plaintext_bytes` > 0 AND `plaintext_bytes` <= 262144)
);
