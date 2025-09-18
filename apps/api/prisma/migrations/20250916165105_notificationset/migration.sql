-- CreateTable
CREATE TABLE `NotificationTypeSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `typeKey` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `allowFallback` BOOLEAN NOT NULL DEFAULT true,
    `defaultUi` JSON NULL,

    UNIQUE INDEX `NotificationTypeSetting_typeKey_channel_key`(`typeKey`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
