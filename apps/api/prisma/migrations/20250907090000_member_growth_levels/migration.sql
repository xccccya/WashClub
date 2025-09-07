-- 添加会员累计支付金额与成长值
ALTER TABLE `Member`
    ADD COLUMN `totalPaidAmount` DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN `growthPoints` INT NOT NULL DEFAULT 0;

-- 会员等级：新增字段并用原 weight 迁移为 level
ALTER TABLE `MemberLevel`
    ADD COLUMN `level` INT NOT NULL DEFAULT 1,
    ADD COLUMN `requiredGrowth` INT NOT NULL DEFAULT 0,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `pointsMultiplier` INT NOT NULL DEFAULT 1,
    ADD COLUMN `payDiscountPercent` INT NOT NULL DEFAULT 0;

-- 迁移旧权重到新等级，并确保默认等级的成长要求为 0
UPDATE `MemberLevel` SET `level` = IFNULL(`weight`, 1);
UPDATE `MemberLevel` SET `requiredGrowth` = 0 WHERE `isDefault` = 1;

-- 删除旧的 weight 字段
ALTER TABLE `MemberLevel` DROP COLUMN `weight`;

-- 站点设置：新增“每元成长值”配置
ALTER TABLE `SiteSetting`
    ADD COLUMN `growthPerYuan` INT NOT NULL DEFAULT 1;

-- 会员签到日志表
CREATE TABLE IF NOT EXISTS `MemberSignInLog` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `memberId` INT NOT NULL,
    `dateStr` VARCHAR(10) NOT NULL,
    `growthGranted` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_member_date` (`memberId`, `dateStr`),
    KEY `idx_member` (`memberId`),
    CONSTRAINT `fk_signin_member` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE
);


