INSERT OR IGNORE INTO `app_meta` (`key`, `value`)
SELECT 'weeks_initialized:' || `owner_email`, '1'
FROM `weeks`
GROUP BY `owner_email`;
