import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Prisma 全局模块（单例）
 *
 * 目的：
 * - 避免在多个业务 Module 里重复 providers:[PrismaService] 导致创建多套 PrismaClient/连接池
 * - 统一生命周期：只在应用启动时初始化一次 onModuleInit
 */
@Global()
@Module({
	providers: [PrismaService],
	exports: [PrismaService],
})
export class PrismaModule {}


