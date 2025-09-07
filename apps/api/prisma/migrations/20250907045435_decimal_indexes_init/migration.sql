/*
  Warnings:

  - You are about to alter the column `requestedAmount` on the `AfterSalesRequest` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `faceValue` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `minOrderAmount` on the `Coupon` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `balance` on the `Member` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `totalAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `discountAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `payAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `refundedAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFee` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `pointsAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `discount` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `listPrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `ProductSku` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `listPrice` on the `ProductSku` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `RefundRecord` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(12,2)`.

*/
-- AlterTable
ALTER TABLE `AfterSalesRequest` MODIFY `requestedAmount` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `Coupon` MODIFY `faceValue` DECIMAL(12, 2) NULL,
    MODIFY `minOrderAmount` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `Member` MODIFY `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Order` MODIFY `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `payAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `refundedAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `shippingFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `pointsAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `OrderItem` MODIFY `price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Product` MODIFY `price` DECIMAL(12, 2) NULL DEFAULT 0,
    MODIFY `listPrice` DECIMAL(12, 2) NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `ProductSku` MODIFY `price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `listPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `RefundRecord` MODIFY `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Order_payStatus_deletedAt_paidAt_idx` ON `Order`(`payStatus`, `deletedAt`, `paidAt`);

-- CreateIndex
CREATE INDEX `Order_memberId_createdAt_idx` ON `Order`(`memberId`, `createdAt`);
