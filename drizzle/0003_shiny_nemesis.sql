ALTER TABLE `dishes` ADD `specifications` text;--> statement-breakpoint
ALTER TABLE `users` ADD `merchantCodeHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `merchantLoginFailedAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `merchantLoginLockedUntil` timestamp;