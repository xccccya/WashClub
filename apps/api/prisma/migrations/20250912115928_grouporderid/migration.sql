-- AlterTable
ALTER TABLE `Group` ADD COLUMN `orderOwnerMemberId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_orderOwnerMemberId_fkey` FOREIGN KEY (`orderOwnerMemberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
