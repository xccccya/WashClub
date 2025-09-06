-- CreateTable
CREATE TABLE `SiteSetting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `updatedAt` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'WashClub 管理后台',
    `logoUrl` VARCHAR(191) NULL,
    `bgType` VARCHAR(191) NOT NULL DEFAULT 'bing',
    `bgImageUrl` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
