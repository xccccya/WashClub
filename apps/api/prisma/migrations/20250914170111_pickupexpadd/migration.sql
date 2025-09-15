-- AlterTable
ALTER TABLE `Product` ADD COLUMN `shipAllowExpress` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `shipAllowPickup` BOOLEAN NOT NULL DEFAULT true;
