-- DropIndex
DROP INDEX `AfterSalesRequest_auditUserId_fkey` ON `aftersalesrequest`;

-- DropIndex
DROP INDEX `Coupon_groupId_fkey` ON `coupon`;

-- DropIndex
DROP INDEX `CouponFlowLog_memberCouponId_fkey` ON `couponflowlog`;

-- DropIndex
DROP INDEX `CouponFlowLog_operatorUserId_fkey` ON `couponflowlog`;

-- DropIndex
DROP INDEX `InventoryLog_operatorUserId_fkey` ON `inventorylog`;

-- DropIndex
DROP INDEX `Member_categoryId_fkey` ON `member`;

-- DropIndex
DROP INDEX `Member_levelId_fkey` ON `member`;

-- DropIndex
DROP INDEX `MemberCartItem_productId_fkey` ON `membercartitem`;

-- DropIndex
DROP INDEX `MemberCartItem_skuId_fkey` ON `membercartitem`;

-- DropIndex
DROP INDEX `MemberCoupon_orderId_fkey` ON `membercoupon`;

-- DropIndex
DROP INDEX `MemberFavoriteProduct_productId_fkey` ON `memberfavoriteproduct`;

-- DropIndex
DROP INDEX `Order_vehicleId_fkey` ON `order`;

-- DropIndex
DROP INDEX `OrderReview_replyUserId_fkey` ON `orderreview`;

-- DropIndex
DROP INDEX `OrderTimeline_operatorUserId_fkey` ON `ordertimeline`;

-- DropIndex
DROP INDEX `Product_categoryId_fkey` ON `product`;

-- DropIndex
DROP INDEX `Product_couponId_fkey` ON `product`;

-- DropIndex
DROP INDEX `RefundRecord_operatorUserId_fkey` ON `refundrecord`;

-- DropIndex
DROP INDEX `ServiceQueueItem_vehicleId_fkey` ON `servicequeueitem`;

-- DropIndex
DROP INDEX `User_roleId_fkey` ON `user`;

-- DropIndex
DROP INDEX `Vehicle_memberId_fkey` ON `vehicle`;

-- DropIndex
DROP INDEX `WashCard_ownerMemberId_fkey` ON `washcard`;

-- DropIndex
DROP INDEX `WashCardLog_cardId_fkey` ON `washcardlog`;

-- DropIndex
DROP INDEX `WashCardLog_memberId_fkey` ON `washcardlog`;

-- DropIndex
DROP INDEX `WashCardLog_operatorUserId_fkey` ON `washcardlog`;

-- DropIndex
DROP INDEX `WashCardLog_vehicleId_fkey` ON `washcardlog`;

-- DropIndex
DROP INDEX `WashCardShare_memberId_fkey` ON `washcardshare`;

-- AlterTable
ALTER TABLE `order` MODIFY `payMethod` ENUM('CASH', 'SHOUQIANBA', 'OFFLINE', 'WECHAT_JSAPI', 'WECHAT_MICROPAY') NULL;

-- AlterTable
ALTER TABLE `refundrecord` MODIFY `method` ENUM('CASH', 'SHOUQIANBA', 'OFFLINE', 'WECHAT_JSAPI', 'WECHAT_MICROPAY') NULL;

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
