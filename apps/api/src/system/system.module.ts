import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { SystemSettingController } from './system.setting.controller.js';
import { SystemEmployeeController } from './employee.controller.js';
import { SystemMiniappEmployeeController } from './miniapp.controller.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { FileModule } from '../file/file.module.js';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'dev_secret',
        }),
        FileModule,
    ],
    controllers: [SystemSettingController, SystemEmployeeController, SystemMiniappEmployeeController],
    providers: [PrismaService, AdminGuard],
})
export class SystemModule {}


