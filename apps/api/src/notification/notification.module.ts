import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { NotificationGateway } from './notification.gateway.js';
import { NotificationTemplateController } from './template.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [AuthModule],
    providers: [PrismaService, NotificationService, NotificationGateway],
    controllers: [NotificationController, NotificationTemplateController],
    exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}


