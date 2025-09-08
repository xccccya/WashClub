-- AlterTable
ALTER TABLE `MemberGrowthLog` ADD COLUMN `operatorUserId` INTEGER NULL,
    ADD COLUMN `orderId` INTEGER NULL,
    MODIFY `source` ENUM('SIGN', 'PAY', 'ADJUST', 'ADMIN', 'REFUND') NOT NULL DEFAULT 'ADJUST';

-- CreateIndex
CREATE INDEX `MemberGrowthLog_orderId_idx` ON `MemberGrowthLog`(`orderId`);

-- AddForeignKey
ALTER TABLE `MemberGrowthLog` ADD CONSTRAINT `MemberGrowthLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberGrowthLog` ADD CONSTRAINT `MemberGrowthLog_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
