ALTER TABLE `weeks` ADD `archived` integer DEFAULT 0 NOT NULL;
ALTER TABLE `weeks` ADD `archived_at` text;
CREATE INDEX `weeks_owner_archive_idx` ON `weeks` (`owner_email`, `archived`, `archived_at`);
