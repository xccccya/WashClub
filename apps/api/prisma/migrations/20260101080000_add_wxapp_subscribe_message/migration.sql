-- Add WXAPP config fields to NotificationTemplate
ALTER TABLE `NotificationTemplate`
  ADD COLUMN `wxTemplateId` VARCHAR(128) NULL,
  ADD COLUMN `wxPagePathTemplate` VARCHAR(512) NULL,
  ADD COLUMN `wxMiniprogramState` VARCHAR(32) NULL,
  ADD COLUMN `wxLang` VARCHAR(16) NULL;

-- CreateTable
CREATE TABLE `WxappSubscribePreference` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `memberId` INTEGER NOT NULL,
  `templateId` VARCHAR(128) NOT NULL,
  `status` VARCHAR(32) NOT NULL,

  UNIQUE INDEX `WxappSubscribePreference_memberId_templateId_key`(`memberId`, `templateId`),
  INDEX `WxappSubscribePreference_templateId_idx`(`templateId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WxappSubscribeSendLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `typeKey` VARCHAR(64) NOT NULL,
  `memberId` INTEGER NULL,
  `openid` VARCHAR(128) NULL,
  `templateId` VARCHAR(128) NOT NULL,
  `page` VARCHAR(512) NULL,
  `payload` JSON NULL,
  `errcode` INTEGER NULL,
  `errmsg` VARCHAR(256) NULL,
  `msgid` VARCHAR(64) NULL,

  INDEX `WxappSubscribeSendLog_typeKey_createdAt_idx`(`typeKey`, `createdAt`),
  INDEX `WxappSubscribeSendLog_memberId_createdAt_idx`(`memberId`, `createdAt`),
  INDEX `WxappSubscribeSendLog_templateId_createdAt_idx`(`templateId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WxappSubscribePreference`
  ADD CONSTRAINT `WxappSubscribePreference_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


