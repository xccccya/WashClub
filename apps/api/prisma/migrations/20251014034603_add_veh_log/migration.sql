-- CreateTable
CREATE TABLE `VehicleRebindLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vehicleId` INTEGER NOT NULL,
    `fromMemberId` INTEGER NULL,
    `fromGroupId` INTEGER NULL,
    `toMemberId` INTEGER NULL,
    `toGroupId` INTEGER NULL,
    `operatorUserId` INTEGER NULL,
    `remark` VARCHAR(191) NULL,

    INDEX `VehicleRebindLog_vehicleId_createdAt_idx`(`vehicleId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VehicleRebindLog` ADD CONSTRAINT `VehicleRebindLog_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleRebindLog` ADD CONSTRAINT `VehicleRebindLog_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
