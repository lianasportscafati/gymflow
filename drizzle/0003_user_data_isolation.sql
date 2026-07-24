ALTER TABLE `weeks` ADD `owner_email` text NOT NULL DEFAULT '';
ALTER TABLE `exercises` ADD `owner_email` text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX `weeks_owner_position_idx` ON `weeks` (`owner_email`,`position`);
CREATE INDEX `exercises_owner_week_idx` ON `exercises` (`owner_email`,`week`);
