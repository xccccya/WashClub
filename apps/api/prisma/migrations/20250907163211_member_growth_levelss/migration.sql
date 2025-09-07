-- DropForeignKey
ALTER TABLE `MemberSignInLog` DROP FOREIGN KEY `fk_signin_member`;

-- AlterTable
ALTER TABLE `MemberSignInLog` MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE `MemberSignInLog` ADD CONSTRAINT `MemberSignInLog_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `MemberSignInLog` RENAME INDEX `idx_member` TO `MemberSignInLog_memberId_idx`;

-- RenameIndex
ALTER TABLE `MemberSignInLog` RENAME INDEX `uniq_member_date` TO `MemberSignInLog_memberId_dateStr_key`;
