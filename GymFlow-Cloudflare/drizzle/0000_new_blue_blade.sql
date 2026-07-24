CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week` integer NOT NULL,
	`name` text NOT NULL,
	`muscle_group` text DEFAULT '' NOT NULL,
	`sets` integer DEFAULT 3 NOT NULL,
	`reps` text DEFAULT '10' NOT NULL,
	`weight` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
