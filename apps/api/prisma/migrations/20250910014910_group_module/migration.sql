-- AlterTable
ALTER TABLE `Order` ADD COLUMN `groupId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Vehicle` ADD COLUMN `groupId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `iconUrl` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,

    UNIQUE INDEX `Group_code_key`(`code`),
    INDEX `Group_createdAt_idx`(`createdAt`),
    INDEX `Group_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `groupId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `role` ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GroupMember_memberId_key`(`memberId`),
    INDEX `GroupMember_groupId_idx`(`groupId`),
    INDEX `GroupMember_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupBalanceAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `updatedAt` DATETIME(3) NOT NULL,
    `groupId` INTEGER NOT NULL,
    `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `GroupBalanceAccount_groupId_key`(`groupId`),
    INDEX `GroupBalanceAccount_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupBalanceLedger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `groupId` INTEGER NOT NULL,
    `type` ENUM('RECHARGE', 'DEDUCT', 'ADJUST', 'REFUND') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `orderId` INTEGER NULL,
    `operatorUserId` INTEGER NULL,
    `note` VARCHAR(191) NULL,

    INDEX `GroupBalanceLedger_groupId_createdAt_idx`(`groupId`, `createdAt`),
    INDEX `GroupBalanceLedger_orderId_idx`(`orderId`),
    INDEX `GroupBalanceLedger_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupWashCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `groupId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '集团洗车计次卡',
    `totalTimes` INTEGER NOT NULL DEFAULT 0,
    `remainingTimes` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `expiryAt` DATETIME(3) NULL,
    `cardNo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `GroupWashCard_cardNo_key`(`cardNo`),
    INDEX `GroupWashCard_groupId_idx`(`groupId`),
    INDEX `GroupWashCard_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupWashCardLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cardId` INTEGER NOT NULL,
    `action` ENUM('ADD', 'DEDUCT', 'SHARE') NOT NULL,
    `reason` ENUM('BACKEND_ADD', 'PURCHASE_ADD', 'SERVICE_DEDUCT', 'REFUND_DEDUCT', 'BACKEND_DEDUCT', 'SHARE_ADD', 'SHARE_REMOVE') NOT NULL,
    `change` INTEGER NOT NULL,
    `beforeRemaining` INTEGER NOT NULL,
    `afterRemaining` INTEGER NOT NULL,
    `remark` VARCHAR(191) NULL,
    `operatorUserId` INTEGER NULL,
    `vehicleId` INTEGER NULL,
    `memberId` INTEGER NULL,

    INDEX `GroupWashCardLog_cardId_createdAt_idx`(`cardId`, `createdAt`),
    INDEX `GroupWashCardLog_vehicleId_idx`(`vehicleId`),
    INDEX `GroupWashCardLog_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_groupId_idx` ON `Order`(`groupId`);

-- CreateIndex
CREATE INDEX `Vehicle_groupId_idx` ON `Vehicle`(`groupId`);

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupBalanceAccount` ADD CONSTRAINT `GroupBalanceAccount_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupBalanceLedger` ADD CONSTRAINT `GroupBalanceLedger_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupBalanceLedger` ADD CONSTRAINT `GroupBalanceLedger_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupBalanceLedger` ADD CONSTRAINT `GroupBalanceLedger_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupWashCard` ADD CONSTRAINT `GroupWashCard_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupWashCardLog` ADD CONSTRAINT `GroupWashCardLog_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `GroupWashCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupWashCardLog` ADD CONSTRAINT `GroupWashCardLog_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupWashCardLog` ADD CONSTRAINT `GroupWashCardLog_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupWashCardLog` ADD CONSTRAINT `GroupWashCardLog_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
