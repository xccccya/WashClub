import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { SystemSettingController } from './system.setting.controller.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { FileModule } from '../file/file.module.js';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'dev_secret',
        }),
        FileModule,
    ],
    controllers: [SystemSettingController],
    providers: [PrismaService, AdminGuard],
})
export class SystemModule {}


