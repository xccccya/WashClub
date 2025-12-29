-- CreateTable
CREATE TABLE `NotificationJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `type` ENUM('COUPON_WILL_EXPIRE') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `runAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 20,
    `lastError` LONGTEXT NULL,
    `lockedAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `memberId` INTEGER NULL,
    `memberCouponId` INTEGER NULL,
    `payload` JSON NULL,

    INDEX `NotificationJob_status_runAt_idx`(`status`, `runAt`),
    UNIQUE INDEX `NotificationJob_type_memberCouponId_key`(`type`, `memberCouponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


