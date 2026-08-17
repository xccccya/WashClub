-- AlterTable
ALTER TABLE `RideDriverProfile`
  ADD COLUMN `accuracyMeters` DECIMAL(8, 2) NULL;

-- AlterTable
ALTER TABLE `RideLocation`
  ADD COLUMN `accuracyMeters` DECIMAL(8, 2) NULL,
  ADD COLUMN `clientPointId` VARCHAR(80) NULL,
  ADD COLUMN `source` VARCHAR(24) NOT NULL DEFAULT 'GPS';

-- CreateIndex
CREATE UNIQUE INDEX `RideLocation_driverMemberId_clientPointId_key`
  ON `RideLocation`(`driverMemberId`, `clientPointId`);
