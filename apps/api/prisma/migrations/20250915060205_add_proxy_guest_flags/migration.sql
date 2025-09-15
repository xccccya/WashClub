-- AlterTable
ALTER TABLE `Order` ADD COLUMN `isGuestOrder` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isProxyOrder` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `proxyAdminSnapshot` JSON NULL,
    ADD COLUMN `proxyAdminUserId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Order_isProxyOrder_idx` ON `Order`(`isProxyOrder`);

-- CreateIndex
CREATE INDEX `Order_isGuestOrder_idx` ON `Order`(`isGuestOrder`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_proxyAdminUserId_fkey` FOREIGN KEY (`proxyAdminUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
