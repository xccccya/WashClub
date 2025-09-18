-- AlterTable
ALTER TABLE `User` ADD COLUMN `avatarUrl` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `GroupWashCardLog_serviceOrderId_idx` ON `GroupWashCardLog`(`serviceOrderId`);

-- CreateIndex
CREATE INDEX `GroupWashCardLog_purchaseOrderId_idx` ON `GroupWashCardLog`(`purchaseOrderId`);
