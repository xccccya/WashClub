-- 添加收银立减字段到订单表
ALTER TABLE `Order` ADD COLUMN `cashierDiscountAmount` DECIMAL(12,2) NOT NULL DEFAULT 0;

