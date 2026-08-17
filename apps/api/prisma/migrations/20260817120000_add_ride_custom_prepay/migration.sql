-- AlterTable
ALTER TABLE `RideSetting`
  ADD COLUMN `customPrepayEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `customPrepayAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.01;

-- AlterTable
ALTER TABLE `RideTrip`
  ADD COLUMN `customPrepayEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `offlinePaidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `offlinePaidAt` DATETIME(3) NULL;
