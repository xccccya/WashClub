/*
  Points system migration: Convert pointsPerYuan to pointsPerFen
  
  - Convert from "points per yuan" to "points per fen" (1 yuan = 100 fen)
  - For existing data, divide pointsPerYuan by 100 to get pointsPerFen
  - If result is 0, set to 1 to maintain minimum functionality

*/
-- Add new column first
ALTER TABLE `SiteSetting` ADD COLUMN `pointsPerFen` INTEGER NOT NULL DEFAULT 1;

-- Update pointsPerFen based on existing pointsPerYuan values
-- Convert yuan-based to fen-based: divide by 100, minimum value 1
UPDATE `SiteSetting` SET `pointsPerFen` = GREATEST(1, FLOOR(`pointsPerYuan` / 100)) WHERE `pointsPerYuan` IS NOT NULL;

-- Drop the old column
ALTER TABLE `SiteSetting` DROP COLUMN `pointsPerYuan`;
