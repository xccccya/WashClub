-- AlterTable
ALTER TABLE `SiteSetting` ADD COLUMN `businessHoursJson` JSON NULL,
    ADD COLUMN `busyEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pausedEnabled` BOOLEAN NOT NULL DEFAULT false;
