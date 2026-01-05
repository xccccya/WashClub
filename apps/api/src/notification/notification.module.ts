import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { NotificationGateway } from './notification.gateway.js';
import { NotificationTemplateController } from './template.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { WxappSubscribeService } from './wxapp-subscribe.service.js';

@Module({
    imports: [AuthModule],
    providers: [NotificationService, NotificationGateway, WxappSubscribeService],
    controllers: [NotificationController, NotificationTemplateController],
    exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}


