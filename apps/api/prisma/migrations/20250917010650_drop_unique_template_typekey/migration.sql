-- Drop unique constraint on NotificationTemplate.typeKey so that same typeKey can have multiple templates per channel
-- Safety: ignore error if index does not exist
ALTER TABLE `NotificationTemplate` 
  DROP INDEX `NotificationTemplate_typeKey_key`;

-- Optional: add composite index to speed up lookups by typeKey/channel
CREATE INDEX `NotificationTemplate_type_channel_idx` ON `NotificationTemplate` (`typeKey`, `channel`);


