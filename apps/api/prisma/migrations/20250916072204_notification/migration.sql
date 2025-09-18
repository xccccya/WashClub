-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `linkPath` VARCHAR(191) NULL,
    `targetType` ENUM('ADMIN', 'MEMBER') NOT NULL,
    `targetUserId` INTEGER NULL,
    `targetMemberId` INTEGER NULL,
    `status` ENUM('UNREAD', 'READ') NOT NULL DEFAULT 'UNREAD',
    `readAt` DATETIME(3) NULL,

    INDEX `Notification_targetUserId_status_createdAt_idx`(`targetUserId`, `status`, `createdAt`),
    INDEX `Notification_targetMemberId_status_createdAt_idx`(`targetMemberId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `typeKey` VARCHAR(191) NOT NULL,
    `titleTemplate` VARCHAR(191) NOT NULL,
    `contentTemplate` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
