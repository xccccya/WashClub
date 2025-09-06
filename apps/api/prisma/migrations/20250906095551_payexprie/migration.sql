-- AlterTable
ALTER TABLE `Order` ADD COLUMN `paymentExpireAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Order_paymentExpireAt_idx` ON `Order`(`paymentExpireAt`);
