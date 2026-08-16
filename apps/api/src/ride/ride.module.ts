import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { OrderModule } from '../order/order.module.js';
import { RideAdminController, RideController } from './ride.controller.js';
import { RideAmapProxyController } from './ride.amap-proxy.controller.js';
import { RideAmapService } from './ride.amap.service.js';
import { RideDispatchService } from './ride.dispatch.service.js';
import { RideFareService } from './ride.fare.service.js';
import { RideIdentityService } from './ride.identity.service.js';
import { RideLocationService } from './ride.location.service.js';
import { RideRealtimeService } from './ride.realtime.service.js';
import { RideService } from './ride.service.js';

@Module({
	imports: [AuthModule, NotificationModule, OrderModule],
	controllers: [RideController, RideAdminController, RideAmapProxyController],
	providers: [RideService, RideIdentityService, RideFareService, RideAmapService, RideDispatchService, RideLocationService, RideRealtimeService],
	exports: [RideService, RideDispatchService],
})
export class RideModule {}
