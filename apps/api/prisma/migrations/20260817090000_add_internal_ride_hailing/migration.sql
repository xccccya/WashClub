-- AlterTable
ALTER TABLE `Order`
  MODIFY `type` ENUM('SERVICE', 'SP', 'FK', 'RIDE') NOT NULL;

-- CreateTable
CREATE TABLE `RideSetting` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,
  `dispatchRadiusMeters` INTEGER NOT NULL DEFAULT 3000,
  `dispatchTimeoutSeconds` INTEGER NOT NULL DEFAULT 90,
  `baseFare` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `includedDistanceKm` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `includedDurationMinutes` INTEGER NOT NULL DEFAULT 0,
  `pricePerKm` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `pricePerMinute` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `minimumFare` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `allowParkingFee` BOOLEAN NOT NULL DEFAULT false,
  `allowOtherFee` BOOLEAN NOT NULL DEFAULT false,
  `chatRetentionDays` INTEGER NOT NULL DEFAULT 30,
  `locationIntervalSeconds` INTEGER NOT NULL DEFAULT 5,
  `updatedByUserId` INTEGER NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideDriverProfile` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `memberId` INTEGER NOT NULL,
  `employeeId` INTEGER NOT NULL,
  `availabilityStatus` ENUM('OFFLINE', 'AVAILABLE', 'BUSY') NOT NULL DEFAULT 'OFFLINE',
  `busyReason` ENUM('MANUAL', 'ORDER') NULL,
  `previousManualStatus` ENUM('OFFLINE', 'AVAILABLE', 'BUSY') NOT NULL DEFAULT 'OFFLINE',
  `currentVehicleId` INTEGER NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `latitude` DECIMAL(10, 7) NULL,
  `heading` DECIMAL(6, 2) NULL,
  `speedMetersPerSecond` DECIMAL(8, 2) NULL,
  `lastLocationAt` DATETIME(3) NULL,
  `lastHeartbeatAt` DATETIME(3) NULL,
  UNIQUE INDEX `RideDriverProfile_memberId_key`(`memberId`),
  UNIQUE INDEX `RideDriverProfile_employeeId_key`(`employeeId`),
  INDEX `RideDriverProfile_availabilityStatus_lastLocationAt_idx`(`availabilityStatus`, `lastLocationAt`),
  INDEX `RideDriverProfile_lastHeartbeatAt_idx`(`lastHeartbeatAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideDriverVehicle` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `driverMemberId` INTEGER NOT NULL,
  `vehicleId` INTEGER NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `displayName` VARCHAR(191) NULL,
  UNIQUE INDEX `RideDriverVehicle_driverMemberId_vehicleId_key`(`driverMemberId`, `vehicleId`),
  INDEX `RideDriverVehicle_vehicleId_idx`(`vehicleId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideTrip` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `orderId` INTEGER NOT NULL,
  `supplementOrderId` INTEGER NULL,
  `passengerMemberId` INTEGER NOT NULL,
  `driverMemberId` INTEGER NULL,
  `driverEmployeeId` INTEGER NULL,
  `vehicleId` INTEGER NULL,
  `status` ENUM('CREATED', 'PREPAY_PENDING', 'DISPATCHING', 'ACCEPTED', 'TO_PICKUP', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING', 'COMPLETED', 'CANCELLED', 'NO_DRIVER', 'REFUND_PENDING') NOT NULL DEFAULT 'CREATED',
  `version` INTEGER NOT NULL DEFAULT 0,
  `dispatchExpireAt` DATETIME(3) NULL,
  `originLongitude` DECIMAL(10, 7) NOT NULL,
  `originLatitude` DECIMAL(10, 7) NOT NULL,
  `originAddress` VARCHAR(191) NOT NULL,
  `originPoiId` VARCHAR(191) NULL,
  `originCoordinateSystem` VARCHAR(191) NOT NULL DEFAULT 'GCJ-02',
  `destinationLongitude` DECIMAL(10, 7) NOT NULL,
  `destinationLatitude` DECIMAL(10, 7) NOT NULL,
  `destinationAddress` VARCHAR(191) NOT NULL,
  `destinationPoiId` VARCHAR(191) NULL,
  `destinationCoordinateSystem` VARCHAR(191) NOT NULL DEFAULT 'GCJ-02',
  `selectedRouteSnapshot` JSON NULL,
  `estimatedDistanceMeters` INTEGER NOT NULL DEFAULT 0,
  `estimatedDurationSeconds` INTEGER NOT NULL DEFAULT 0,
  `estimatedTollAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `estimatedAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `finalDistanceMeters` INTEGER NULL,
  `finalDurationSeconds` INTEGER NULL,
  `finalAmount` DECIMAL(12, 2) NULL,
  `arrivedPickupAt` DATETIME(3) NULL,
  `passengerPhoneVerifiedAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NULL,
  `arrivedDestinationAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelReason` VARCHAR(191) NULL,
  `cancelActor` VARCHAR(191) NULL,
  UNIQUE INDEX `RideTrip_orderId_key`(`orderId`),
  UNIQUE INDEX `RideTrip_supplementOrderId_key`(`supplementOrderId`),
  INDEX `RideTrip_passengerMemberId_createdAt_idx`(`passengerMemberId`, `createdAt`),
  INDEX `RideTrip_driverMemberId_status_idx`(`driverMemberId`, `status`),
  INDEX `RideTrip_status_dispatchExpireAt_idx`(`status`, `dispatchExpireAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideDispatchRejection` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rideTripId` INTEGER NOT NULL,
  `driverMemberId` INTEGER NOT NULL,
  UNIQUE INDEX `RideDispatchRejection_rideTripId_driverMemberId_key`(`rideTripId`, `driverMemberId`),
  INDEX `RideDispatchRejection_driverMemberId_createdAt_idx`(`driverMemberId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideLocation` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rideTripId` INTEGER NOT NULL,
  `driverMemberId` INTEGER NOT NULL,
  `longitude` DECIMAL(10, 7) NOT NULL,
  `latitude` DECIMAL(10, 7) NOT NULL,
  `heading` DECIMAL(6, 2) NULL,
  `speedMetersPerSecond` DECIMAL(8, 2) NULL,
  `clientTimestamp` DATETIME(3) NULL,
  INDEX `RideLocation_rideTripId_createdAt_idx`(`rideTripId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideExtraFee` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rideTripId` INTEGER NOT NULL,
  `type` ENUM('TOLL', 'PARKING', 'OTHER', 'REVERSAL') NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `remark` VARCHAR(191) NULL,
  `reversesFeeId` INTEGER NULL,
  `createdByMemberId` INTEGER NULL,
  `createdByUserId` INTEGER NULL,
  INDEX `RideExtraFee_rideTripId_createdAt_idx`(`rideTripId`, `createdAt`),
  INDEX `RideExtraFee_reversesFeeId_idx`(`reversesFeeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RideMessage` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rideTripId` INTEGER NOT NULL,
  `senderMemberId` INTEGER NOT NULL,
  `content` VARCHAR(1000) NOT NULL,
  `readAt` DATETIME(3) NULL,
  INDEX `RideMessage_rideTripId_createdAt_idx`(`rideTripId`, `createdAt`),
  INDEX `RideMessage_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RideSetting` ADD CONSTRAINT `RideSetting_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideDriverProfile` ADD CONSTRAINT `RideDriverProfile_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideDriverProfile` ADD CONSTRAINT `RideDriverProfile_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideDriverProfile` ADD CONSTRAINT `RideDriverProfile_currentVehicleId_fkey` FOREIGN KEY (`currentVehicleId`) REFERENCES `RideDriverVehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideDriverVehicle` ADD CONSTRAINT `RideDriverVehicle_driverMemberId_fkey` FOREIGN KEY (`driverMemberId`) REFERENCES `RideDriverProfile`(`memberId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideDriverVehicle` ADD CONSTRAINT `RideDriverVehicle_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideTrip` ADD CONSTRAINT `RideTrip_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideTrip` ADD CONSTRAINT `RideTrip_supplementOrderId_fkey` FOREIGN KEY (`supplementOrderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideTrip` ADD CONSTRAINT `RideTrip_passengerMemberId_fkey` FOREIGN KEY (`passengerMemberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RideTrip` ADD CONSTRAINT `RideTrip_driverMemberId_fkey` FOREIGN KEY (`driverMemberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideTrip` ADD CONSTRAINT `RideTrip_driverEmployeeId_fkey` FOREIGN KEY (`driverEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideTrip` ADD CONSTRAINT `RideTrip_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideDispatchRejection` ADD CONSTRAINT `RideDispatchRejection_rideTripId_fkey` FOREIGN KEY (`rideTripId`) REFERENCES `RideTrip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideLocation` ADD CONSTRAINT `RideLocation_rideTripId_fkey` FOREIGN KEY (`rideTripId`) REFERENCES `RideTrip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideExtraFee` ADD CONSTRAINT `RideExtraFee_rideTripId_fkey` FOREIGN KEY (`rideTripId`) REFERENCES `RideTrip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideExtraFee` ADD CONSTRAINT `RideExtraFee_createdByMemberId_fkey` FOREIGN KEY (`createdByMemberId`) REFERENCES `Member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideExtraFee` ADD CONSTRAINT `RideExtraFee_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RideMessage` ADD CONSTRAINT `RideMessage_rideTripId_fkey` FOREIGN KEY (`rideTripId`) REFERENCES `RideTrip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RideMessage` ADD CONSTRAINT `RideMessage_senderMemberId_fkey` FOREIGN KEY (`senderMemberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
