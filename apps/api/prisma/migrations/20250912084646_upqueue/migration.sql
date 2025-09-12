-- AlterTable
ALTER TABLE `ServiceQueueStep` ADD COLUMN `isEta` BOOLEAN NULL;

-- AlterTable
ALTER TABLE `ServiceQueueType` ADD COLUMN `displayColor` VARCHAR(191) NULL,
    ADD COLUMN `etaGroupKey` VARCHAR(191) NULL,
    ADD COLUMN `etaParallelSlots` INTEGER NULL,
    ADD COLUMN `participateInEta` BOOLEAN NULL;

-- CreateIndex
CREATE INDEX `ServiceQueueType_etaGroupKey_idx` ON `ServiceQueueType`(`etaGroupKey`);
