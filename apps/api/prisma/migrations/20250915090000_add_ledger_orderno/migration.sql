-- Add column orderNo on GroupBalanceLedger, add index, and backfill from Order by orderId

-- AlterTable: add orderNo column
ALTER TABLE `GroupBalanceLedger`
  ADD COLUMN `orderNo` VARCHAR(191) NULL;

-- Index for orderNo
CREATE INDEX `GroupBalanceLedger_orderNo_idx` ON `GroupBalanceLedger`(`orderNo`);

-- Backfill existing rows from Order.no via orderId
UPDATE `GroupBalanceLedger` g
LEFT JOIN `Order` o ON o.id = g.orderId
SET g.orderNo = o.no
WHERE g.orderId IS NOT NULL AND g.orderNo IS NULL;


