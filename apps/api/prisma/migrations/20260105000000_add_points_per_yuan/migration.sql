-- AlterTable
ALTER TABLE `SiteSetting` ADD COLUMN `pointsPerYuan` INTEGER NOT NULL DEFAULT 0;

-- Backfill (keep current business behavior deterministic after deploy)
-- If a row already has pointsPerFen, set pointsPerYuan = pointsPerFen * 100 when pointsPerYuan is still 0
UPDATE `SiteSetting`
SET `pointsPerYuan` = `pointsPerFen` * 100
WHERE `pointsPerYuan` = 0;


