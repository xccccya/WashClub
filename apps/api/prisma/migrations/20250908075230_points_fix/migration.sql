-- AlterTable
ALTER TABLE `SiteSetting` ADD COLUMN `pointsFenPerPoint` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `pointsMaxDeductFenPerOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `pointsPerYuan` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `MemberPointsLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `memberId` INTEGER NOT NULL,
    `change` INTEGER NOT NULL,
    `desc` VARCHAR(191) NULL,
    `source` ENUM('PAY', 'ADMIN', 'REFUND', 'USE') NOT NULL DEFAULT 'ADMIN',
    `orderId` INTEGER NULL,
    `operatorUserId` INTEGER NULL,

    INDEX `MemberPointsLog_memberId_createdAt_idx`(`memberId`, `createdAt`),
    INDEX `MemberPointsLog_memberId_idx`(`memberId`),
    INDEX `MemberPointsLog_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MemberPointsLog` ADD CONSTRAINT `MemberPointsLog_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberPointsLog` ADD CONSTRAINT `MemberPointsLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberPointsLog` ADD CONSTRAINT `MemberPointsLog_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
