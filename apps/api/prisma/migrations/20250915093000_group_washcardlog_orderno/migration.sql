-- Add order no columns to GroupWashCardLog and backfill from Order

ALTER TABLE `GroupWashCardLog`
  ADD COLUMN `serviceOrderNo` VARCHAR(191) NULL,
  ADD COLUMN `purchaseOrderNo` VARCHAR(191) NULL;

CREATE INDEX `GroupWashCardLog_serviceOrderNo_idx` ON `GroupWashCardLog`(`serviceOrderNo`);
CREATE INDEX `GroupWashCardLog_purchaseOrderNo_idx` ON `GroupWashCardLog`(`purchaseOrderNo`);

UPDATE `GroupWashCardLog` l
LEFT JOIN `Order` o1 ON o1.id = l.serviceOrderId
LEFT JOIN `Order` o2 ON o2.id = l.purchaseOrderId
SET l.serviceOrderNo = o1.no,
    l.purchaseOrderNo = o2.no
WHERE (l.serviceOrderId IS NOT NULL AND l.serviceOrderNo IS NULL)
   OR (l.purchaseOrderId IS NOT NULL AND l.purchaseOrderNo IS NULL);


