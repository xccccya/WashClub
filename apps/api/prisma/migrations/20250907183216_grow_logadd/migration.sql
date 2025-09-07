-- CreateTable
CREATE TABLE `MemberGrowthLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `memberId` INTEGER NOT NULL,
    `change` INTEGER NOT NULL,
    `desc` VARCHAR(191) NULL,
    `source` ENUM('SIGN', 'PAY', 'ADJUST', 'ADMIN') NOT NULL DEFAULT 'ADJUST',

    INDEX `MemberGrowthLog_memberId_createdAt_idx`(`memberId`, `createdAt`),
    INDEX `MemberGrowthLog_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MemberGrowthLog` ADD CONSTRAINT `MemberGrowthLog_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
