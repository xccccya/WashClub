#!/usr/bin/env node
/**
 * 清空 FileAsset 表数据的脚本
 * 
 * 使用方法：
 * 1. cd apps/api
 * 2. node scripts/clear-file-assets.mjs
 * 
 * 注意：此脚本会删除所有文件资产数据，请谨慎使用！
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function clearFileAssets() {
  console.log('🚀 开始清空 FileAsset 表数据...\n');

  try {
    // 1. 统计现有数据
    const assetCount = await prisma.fileAsset.count();
    const bindingCount = await prisma.fileBinding.count();
    
    console.log(`📊 当前数据统计:`);
    console.log(`   - FileAsset 记录数: ${assetCount}`);
    console.log(`   - FileBinding 记录数: ${bindingCount}\n`);

    if (assetCount === 0) {
      console.log('✅ FileAsset 表已经是空的，无需清理');
      return;
    }

    // 2. 询问用户确认
    console.log('⚠️  警告：此操作将删除所有文件资产数据，且不可恢复！');
    console.log('   - 删除所有 FileBinding 记录');
    console.log('   - 删除所有 FileAsset 记录');
    console.log('   - 不会删除磁盘上的实际文件\n');

    // 在脚本中直接执行，跳过交互确认
    console.log('🔄 开始清理数据...\n');

    // 3. 在事务中执行清理
    await prisma.$transaction(async (tx) => {
      // 先删除 FileBinding 记录（避免外键约束）
      if (bindingCount > 0) {
        console.log('🗑️  删除 FileBinding 记录...');
        const deletedBindings = await tx.fileBinding.deleteMany({});
        console.log(`   ✅ 已删除 ${deletedBindings.count} 条 FileBinding 记录`);
      }

      // 再删除 FileAsset 记录
      console.log('🗑️  删除 FileAsset 记录...');
      const deletedAssets = await tx.fileAsset.deleteMany({});
      console.log(`   ✅ 已删除 ${deletedAssets.count} 条 FileAsset 记录`);
    });

    console.log('\n✅ 数据清理完成！');
    console.log('\n📝 后续步骤建议：');
    console.log('   1. 如需清理磁盘文件，请手动删除 uploads/ 目录下的文件');
    console.log('   2. 重新上传需要的文件');
    console.log('   3. 检查其他业务数据是否需要相应调整');

  } catch (error) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
clearFileAssets().catch((error) => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
