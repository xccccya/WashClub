-- AlterTable
ALTER TABLE `Order` ADD COLUMN `payAfterService` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `ServiceQueueItem` ADD COLUMN `orderId` INTEGER NULL,
    ADD COLUMN `queueTypeId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ServiceQueueType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortWeight` INTEGER NOT NULL DEFAULT 0,
    `remark` VARCHAR(191) NULL,

    INDEX `ServiceQueueType_enabled_idx`(`enabled`),
    INDEX `ServiceQueueType_sortWeight_idx`(`sortWeight`),
    INDEX `ServiceQueueType_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceQueueStep` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `queueTypeId` INTEGER NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `durationMin` INTEGER NOT NULL DEFAULT 0,

    INDEX `ServiceQueueStep_queueTypeId_idx`(`queueTypeId`),
    INDEX `ServiceQueueStep_orderIndex_idx`(`orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceQueueTypeProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `queueTypeId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,

    INDEX `ServiceQueueTypeProduct_productId_idx`(`productId`),
    UNIQUE INDEX `ServiceQueueTypeProduct_queueTypeId_productId_key`(`queueTypeId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ServiceQueueItem_queueTypeId_idx` ON `ServiceQueueItem`(`queueTypeId`);

-- CreateIndex
CREATE INDEX `ServiceQueueItem_orderId_idx` ON `ServiceQueueItem`(`orderId`);

-- AddForeignKey
ALTER TABLE `ServiceQueueItem` ADD CONSTRAINT `ServiceQueueItem_queueTypeId_fkey` FOREIGN KEY (`queueTypeId`) REFERENCES `ServiceQueueType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceQueueItem` ADD CONSTRAINT `ServiceQueueItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceQueueStep` ADD CONSTRAINT `ServiceQueueStep_queueTypeId_fkey` FOREIGN KEY (`queueTypeId`) REFERENCES `ServiceQueueType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceQueueTypeProduct` ADD CONSTRAINT `ServiceQueueTypeProduct_queueTypeId_fkey` FOREIGN KEY (`queueTypeId`) REFERENCES `ServiceQueueType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceQueueTypeProduct` ADD CONSTRAINT `ServiceQueueTypeProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
