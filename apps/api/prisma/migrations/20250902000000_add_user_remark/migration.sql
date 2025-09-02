-- AlterTable: add userRemark column to Order and create index
ALTER TABLE `Order`
  ADD COLUMN `userRemark` VARCHAR(191) NULL;

CREATE INDEX `Order_userRemark_idx` ON `Order`(`userRemark`);


