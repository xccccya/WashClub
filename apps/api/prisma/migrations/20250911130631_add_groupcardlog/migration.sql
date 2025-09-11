-- AlterTable
ALTER TABLE `GroupWashCardLog` ADD COLUMN `purchaseOrderId` INTEGER NULL,
    ADD COLUMN `refundRecordId` INTEGER NULL,
    ADD COLUMN `serviceOrderId` INTEGER NULL;
