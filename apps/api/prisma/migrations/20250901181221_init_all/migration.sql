-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'staff',
    `roleId` INTEGER NULL,
    `weixinOpenId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_phone_key`(`phone`),
    UNIQUE INDEX `User_weixinOpenId_key`(`weixinOpenId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Member` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uid` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastActiveAt` DATETIME(3) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `weixinOpenId` VARCHAR(191) NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `balance` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `levelId` INTEGER NULL,
    `categoryId` INTEGER NULL,

    UNIQUE INDEX `Member_uid_key`(`uid`),
    UNIQUE INDEX `Member_phone_key`(`phone`),
    UNIQUE INDEX `Member_weixinOpenId_key`(`weixinOpenId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberLevel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 0,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `MemberTag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `permissions` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `plateNumber` VARCHAR(191) NOT NULL,
    `vin` VARCHAR(191) NULL,
    `brand` VARCHAR(191) NULL DEFAULT '-',
    `series` VARCHAR(191) NULL DEFAULT '-',
    `typeMain` VARCHAR(191) NOT NULL DEFAULT '-',
    `typeSub` VARCHAR(191) NULL DEFAULT '-',
    `color` VARCHAR(191) NULL DEFAULT '-',
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `brandImage` VARCHAR(191) NULL,
    `seriesImage` VARCHAR(191) NULL,
    `memberId` INTEGER NULL,

    UNIQUE INDEX `Vehicle_plateNumber_key`(`plateNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WashCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '洗车计次卡',
    `ownerMemberId` INTEGER NOT NULL,
    `totalTimes` INTEGER NOT NULL DEFAULT 0,
    `remainingTimes` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `expiryAt` DATETIME(3) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `cardNo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `WashCard_cardNo_key`(`cardNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WashCardShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `cardId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,

    UNIQUE INDEX `WashCardShare_cardId_memberId_key`(`cardId`, `memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WashCardLog` (
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
    `serviceOrderId` INTEGER NULL,
    `purchaseOrderId` INTEGER NULL,
    `refundRecordId` INTEGER NULL,
    `vehicleId` INTEGER NULL,
    `memberId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScrollNotice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdBanner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `jumpEnabled` BOOLEAN NOT NULL DEFAULT false,
    `linkPath` VARCHAR(191) NULL,
    `weight` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceQueueItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `vehicleId` INTEGER NULL,
    `plateNumber` VARCHAR(191) NOT NULL,
    `guest` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('IN_QUEUE', 'SERVING', 'COMPLETED') NOT NULL DEFAULT 'IN_QUEUE',
    `orderSort` INTEGER NOT NULL DEFAULT 0,
    `currentTaskIndex` INTEGER NOT NULL DEFAULT -1,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `queueItemId` INTEGER NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `name` VARCHAR(191) NOT NULL,
    `durationMin` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'DOING', 'DONE') NOT NULL DEFAULT 'PENDING',
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `ServiceTask_queueItemId_idx`(`queueItemId`),
    INDEX `ServiceTask_orderIndex_idx`(`orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `phone` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL DEFAULT 'login',
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,

    INDEX `SmsCode_phone_idx`(`phone`),
    INDEX `SmsCode_purpose_idx`(`purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `weight` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('COUPON', 'WASH_CARD') NOT NULL,
    `groupId` INTEGER NULL,
    `expiryType` ENUM('FIXED', 'AFTER_RECEIVE', 'PERMANENT') NOT NULL DEFAULT 'PERMANENT',
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `ruleJson` JSON NULL,
    `totalTimes` INTEGER NOT NULL DEFAULT 0,
    `validDays` INTEGER NULL,
    `imageUrl` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `adminRemark` VARCHAR(191) NULL,
    `perMemberLimit` INTEGER NULL,
    `allowMiniappClaim` BOOLEAN NOT NULL DEFAULT false,
    `allowCombine` BOOLEAN NOT NULL DEFAULT false,
    `allowStackWithPoints` BOOLEAN NOT NULL DEFAULT true,
    `allowStackWithMemberDiscount` BOOLEAN NOT NULL DEFAULT true,
    `faceValue` DECIMAL(65, 30) NULL,
    `minOrderAmount` DECIMAL(65, 30) NULL,
    `issueTotal` INTEGER NULL,
    `applyScope` ENUM('ALL', 'SPECIFIED') NOT NULL DEFAULT 'ALL',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponApplicableProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `couponId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,

    INDEX `CouponApplicableProduct_productId_idx`(`productId`),
    UNIQUE INDEX `CouponApplicableProduct_couponId_productId_key`(`couponId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberCoupon` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `memberId` INTEGER NOT NULL,
    `couponId` INTEGER NOT NULL,
    `name` VARCHAR(191) NULL,
    `expiryType` ENUM('FIXED', 'AFTER_RECEIVE', 'PERMANENT') NOT NULL DEFAULT 'PERMANENT',
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `receiveAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usedAt` DATETIME(3) NULL,
    `orderId` INTEGER NULL,

    INDEX `MemberCoupon_memberId_idx`(`memberId`),
    INDEX `MemberCoupon_couponId_idx`(`couponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `weight` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `type` ENUM('SERVICE', 'PHYSICAL', 'VIRTUAL_CARD') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(191) NULL,
    `categoryId` INTEGER NULL,
    `imageUrl` VARCHAR(191) NULL,
    `imagesJson` JSON NULL,
    `specsDefinitionJson` JSON NULL,
    `sortWeight` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `pointsDeductible` BOOLEAN NOT NULL DEFAULT false,
    `memberDiscount` BOOLEAN NOT NULL DEFAULT false,
    `specType` ENUM('SINGLE', 'MULTI') NOT NULL DEFAULT 'SINGLE',
    `price` DECIMAL(65, 30) NULL DEFAULT 0,
    `listPrice` DECIMAL(65, 30) NULL DEFAULT 0,
    `stockQuantity` INTEGER NULL DEFAULT 0,
    `initialSales` INTEGER NOT NULL DEFAULT 0,
    `sellPoint` VARCHAR(191) NULL,
    `couponId` INTEGER NULL,

    UNIQUE INDEX `Product_barcode_key`(`barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductSku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `productId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `specsJson` JSON NULL,
    `skuCode` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `price` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `listPrice` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `stockQuantity` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ProductSku_skuCode_key`(`skuCode`),
    INDEX `ProductSku_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `productId` INTEGER NOT NULL,
    `skuId` INTEGER NULL,
    `change` INTEGER NOT NULL,
    `beforeStock` INTEGER NOT NULL,
    `afterStock` INTEGER NOT NULL,
    `reason` ENUM('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'ORDER_DEDUCT', 'ORDER_ROLLBACK', 'REFUND_RETURN') NOT NULL,
    `remark` VARCHAR(191) NULL,
    `operatorUserId` INTEGER NULL,

    INDEX `InventoryLog_productId_idx`(`productId`),
    INDEX `InventoryLog_skuId_idx`(`skuId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `no` VARCHAR(191) NOT NULL,
    `type` ENUM('SERVICE', 'SP', 'FK') NOT NULL,
    `status` ENUM('CREATED', 'PAID', 'FULFILLED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'CREATED',
    `fulfillmentStatus` ENUM('NONE', 'PENDING', 'SHIPPED', 'RECEIVED', 'IN_SERVICE', 'DONE') NOT NULL DEFAULT 'PENDING',
    `reviewStatus` ENUM('NONE', 'PENDING', 'REVIEWED') NOT NULL DEFAULT 'NONE',
    `deletedAt` DATETIME(3) NULL,
    `totalAmount` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `payAmount` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `refundedAmount` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `shippingFee` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `payStatus` ENUM('UNPAID', 'PAID', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'UNPAID',
    `payMethod` ENUM('CASH', 'SHOUQIANBA', 'OFFLINE', 'WECHAT_JSAPI') NULL,
    `paidAt` DATETIME(3) NULL,
    `wechatTransactionId` VARCHAR(191) NULL,
    `usedPoints` INTEGER NOT NULL DEFAULT 0,
    `pointsAmount` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `couponInfo` JSON NULL,
    `shippingAddressId` INTEGER NULL,
    `shippingAddressSnapshot` JSON NULL,
    `memberId` INTEGER NOT NULL,
    `vehicleId` INTEGER NULL,
    `remark` VARCHAR(191) NULL,
    `shippedAt` DATETIME(3) NULL,
    `shipNoExpress` BOOLEAN NOT NULL DEFAULT false,
    `shipExpressCompanyCode` VARCHAR(191) NULL,
    `shipExpressCompanyName` VARCHAR(191) NULL,
    `shipExpressCompanyLogo` VARCHAR(191) NULL,
    `shipExpressTrackingNo` VARCHAR(191) NULL,
    `shipExpressExtra` JSON NULL,

    UNIQUE INDEX `Order_no_key`(`no`),
    INDEX `Order_type_idx`(`type`),
    INDEX `Order_status_idx`(`status`),
    INDEX `Order_memberId_idx`(`memberId`),
    INDEX `Order_payStatus_idx`(`payStatus`),
    INDEX `Order_createdAt_idx`(`createdAt`),
    INDEX `Order_fulfillmentStatus_idx`(`fulfillmentStatus`),
    INDEX `Order_shippingAddressId_idx`(`shippingAddressId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderId` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `skuId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `specsText` VARCHAR(191) NULL,
    `barcode` VARCHAR(191) NULL,
    `price` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `discount` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `OrderItem_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AfterSalesRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `orderId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `type` ENUM('REFUND', 'EXCHANGE', 'RE_SERVICE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `requestedAmount` DECIMAL(65, 30) NULL,
    `reasonCode` VARCHAR(191) NULL,
    `reasonText` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `imagesJson` JSON NULL,
    `exchangeAddressSnapshot` JSON NULL,
    `auditUserId` INTEGER NULL,
    `auditRemark` VARCHAR(191) NULL,
    `auditedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `AfterSalesRequest_orderId_idx`(`orderId`),
    INDEX `AfterSalesRequest_memberId_idx`(`memberId`),
    INDEX `AfterSalesRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefundRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `orderId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `method` ENUM('CASH', 'SHOUQIANBA', 'OFFLINE', 'WECHAT_JSAPI') NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reasonCode` VARCHAR(191) NULL,
    `reasonText` VARCHAR(191) NULL,
    `outRefundNo` VARCHAR(191) NULL,
    `wechatRefundId` VARCHAR(191) NULL,
    `wechatResp` JSON NULL,
    `failedReason` VARCHAR(191) NULL,
    `operatorUserId` INTEGER NULL,

    UNIQUE INDEX `RefundRecord_outRefundNo_key`(`outRefundNo`),
    INDEX `RefundRecord_orderId_idx`(`orderId`),
    INDEX `RefundRecord_memberId_idx`(`memberId`),
    INDEX `RefundRecord_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponRestoreLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `memberId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `couponSnapshot` JSON NULL,
    `remark` VARCHAR(191) NULL,

    INDEX `CouponRestoreLog_memberId_idx`(`memberId`),
    INDEX `CouponRestoreLog_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CouponFlowLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `memberId` INTEGER NULL,
    `orderId` INTEGER NULL,
    `couponId` INTEGER NULL,
    `memberCouponId` INTEGER NULL,
    `action` ENUM('ISSUE', 'CLAIM', 'USE', 'RESTORE', 'REVOKE', 'EXPIRE', 'ADJUST') NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `remark` VARCHAR(191) NULL,
    `snapshot` JSON NULL,
    `operatorUserId` INTEGER NULL,

    INDEX `CouponFlowLog_memberId_idx`(`memberId`),
    INDEX `CouponFlowLog_orderId_idx`(`orderId`),
    INDEX `CouponFlowLog_couponId_idx`(`couponId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderTimeline` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderId` INTEGER NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `operatorUserId` INTEGER NULL,

    INDEX `OrderTimeline_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `orderId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,
    `content` VARCHAR(191) NULL,
    `imagesJson` JSON NULL,
    `replyContent` VARCHAR(191) NULL,
    `replyUserId` INTEGER NULL,
    `replyAt` DATETIME(3) NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `OrderReview_orderId_key`(`orderId`),
    INDEX `OrderReview_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberAddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `memberId` INTEGER NOT NULL,
    `province` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,

    INDEX `MemberAddress_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberCartItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `memberId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `skuId` INTEGER NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `checked` BOOLEAN NOT NULL DEFAULT true,

    INDEX `MemberCartItem_memberId_idx`(`memberId`),
    UNIQUE INDEX `MemberCartItem_memberId_productId_skuId_key`(`memberId`, `productId`, `skuId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberFavoriteProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `memberId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,

    INDEX `MemberFavoriteProduct_memberId_idx`(`memberId`),
    UNIQUE INDEX `MemberFavoriteProduct_memberId_productId_key`(`memberId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_MemberToMemberTag` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_MemberToMemberTag_AB_unique`(`A`, `B`),
    INDEX `_MemberToMemberTag_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `AdminRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Member` ADD CONSTRAINT `Member_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `MemberLevel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Member` ADD CONSTRAINT `Member_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `MemberCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCard` ADD CONSTRAINT `WashCard_ownerMemberId_fkey` FOREIGN KEY (`ownerMemberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCardShare` ADD CONSTRAINT `WashCardShare_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `WashCard`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCardShare` ADD CONSTRAINT `WashCardShare_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCardLog` ADD CONSTRAINT `WashCardLog_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `WashCard`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCardLog` ADD CONSTRAINT `WashCardLog_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCardLog` ADD CONSTRAINT `WashCardLog_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCardLog` ADD CONSTRAINT `WashCardLog_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceQueueItem` ADD CONSTRAINT `ServiceQueueItem_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceTask` ADD CONSTRAINT `ServiceTask_queueItemId_fkey` FOREIGN KEY (`queueItemId`) REFERENCES `ServiceQueueItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `CouponGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponApplicableProduct` ADD CONSTRAINT `CouponApplicableProduct_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponApplicableProduct` ADD CONSTRAINT `CouponApplicableProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberCoupon` ADD CONSTRAINT `MemberCoupon_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberCoupon` ADD CONSTRAINT `MemberCoupon_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberCoupon` ADD CONSTRAINT `MemberCoupon_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductSku` ADD CONSTRAINT `ProductSku_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLog` ADD CONSTRAINT `InventoryLog_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLog` ADD CONSTRAINT `InventoryLog_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLog` ADD CONSTRAINT `InventoryLog_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_shippingAddressId_fkey` FOREIGN KEY (`shippingAddressId`) REFERENCES `MemberAddress`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesRequest` ADD CONSTRAINT `AfterSalesRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesRequest` ADD CONSTRAINT `AfterSalesRequest_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterSalesRequest` ADD CONSTRAINT `AfterSalesRequest_auditUserId_fkey` FOREIGN KEY (`auditUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundRecord` ADD CONSTRAINT `RefundRecord_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundRecord` ADD CONSTRAINT `RefundRecord_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefundRecord` ADD CONSTRAINT `RefundRecord_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponRestoreLog` ADD CONSTRAINT `CouponRestoreLog_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponRestoreLog` ADD CONSTRAINT `CouponRestoreLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponFlowLog` ADD CONSTRAINT `CouponFlowLog_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponFlowLog` ADD CONSTRAINT `CouponFlowLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponFlowLog` ADD CONSTRAINT `CouponFlowLog_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `Coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponFlowLog` ADD CONSTRAINT `CouponFlowLog_memberCouponId_fkey` FOREIGN KEY (`memberCouponId`) REFERENCES `MemberCoupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CouponFlowLog` ADD CONSTRAINT `CouponFlowLog_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderTimeline` ADD CONSTRAINT `OrderTimeline_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderTimeline` ADD CONSTRAINT `OrderTimeline_operatorUserId_fkey` FOREIGN KEY (`operatorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderReview` ADD CONSTRAINT `OrderReview_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderReview` ADD CONSTRAINT `OrderReview_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderReview` ADD CONSTRAINT `OrderReview_replyUserId_fkey` FOREIGN KEY (`replyUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberAddress` ADD CONSTRAINT `MemberAddress_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberCartItem` ADD CONSTRAINT `MemberCartItem_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberCartItem` ADD CONSTRAINT `MemberCartItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberCartItem` ADD CONSTRAINT `MemberCartItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberFavoriteProduct` ADD CONSTRAINT `MemberFavoriteProduct_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberFavoriteProduct` ADD CONSTRAINT `MemberFavoriteProduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_MemberToMemberTag` ADD CONSTRAINT `_MemberToMemberTag_A_fkey` FOREIGN KEY (`A`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_MemberToMemberTag` ADD CONSTRAINT `_MemberToMemberTag_B_fkey` FOREIGN KEY (`B`) REFERENCES `MemberTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
