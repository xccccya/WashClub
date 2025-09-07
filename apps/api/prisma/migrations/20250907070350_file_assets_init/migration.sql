-- CreateTable
CREATE TABLE `FileAsset` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `filename` VARCHAR(191) NOT NULL,
    `extension` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `checksumSha256` VARCHAR(64) NOT NULL,
    `storage` VARCHAR(191) NOT NULL,
    `bucket` VARCHAR(191) NULL,
    `objectKey` VARCHAR(512) NOT NULL,
    `url` VARCHAR(1024) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `tagsJson` JSON NULL,
    `variants` JSON NULL,
    `extra` JSON NULL,
    `refCount` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `FileAsset_checksumSha256_key`(`checksumSha256`),
    INDEX `FileAsset_mimeType_createdAt_idx`(`mimeType`, `createdAt`),
    INDEX `FileAsset_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileBinding` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fileId` VARCHAR(191) NOT NULL,
    `tableName` VARCHAR(191) NOT NULL,
    `rowId` VARCHAR(191) NOT NULL,
    `fieldName` VARCHAR(191) NOT NULL,

    INDEX `FileBinding_tableName_rowId_fieldName_idx`(`tableName`, `rowId`, `fieldName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FileBinding` ADD CONSTRAINT `FileBinding_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
