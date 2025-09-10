import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service.js';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { MemberModule } from './member/member.module.js';
import { FileModule } from './file/file.module.js';
import { ContentModule } from './content/content.module.js';
import { QueueModule } from './queue/queue.module.js';
import { StoreModule } from './store/store.module.js';
import { OrderModule } from './order/order.module.js';
import { CouponModule } from './coupon/coupon.module.js';
import { SystemModule } from './system/system.module.js';
import { GroupModule } from './group/group.module.js';


@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', 'apps/api/.env', 'apps/api/prisma/.env'] }), AuthModule, MemberModule, FileModule, ContentModule, QueueModule, StoreModule, OrderModule, CouponModule, SystemModule, GroupModule],
	controllers: [AppController],
	providers: [PrismaService],
})
export class AppModule {}


