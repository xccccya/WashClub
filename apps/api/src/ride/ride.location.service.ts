import { BadRequestException, ConflictException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { RideAmapService, type RideRoute } from './ride.amap.service.js';
import { RideDispatchService } from './ride.dispatch.service.js';
import { RideLocationDto } from './ride.dto.js';
import { RideRealtimeService } from './ride.realtime.service.js';

@Injectable()
export class RideLocationService implements OnModuleInit, OnModuleDestroy {
	private offlineTimer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly prisma: PrismaService,
		private readonly amap: RideAmapService,
		private readonly dispatch: RideDispatchService,
		private readonly realtime: RideRealtimeService,
	) {}

	onModuleInit() {
		this.offlineTimer = setInterval(() => void this.markStaleDriversOffline(), 5000);
		this.offlineTimer.unref?.();
	}

	onModuleDestroy() {
		if (this.offlineTimer) clearInterval(this.offlineTimer);
	}

	async report(driverMemberId: number, dto: RideLocationDto) {
		const employee = await this.prisma.employee.findUnique({ where: { memberId: driverMemberId } });
		if (!employee?.enabled) throw new BadRequestException('司机身份无效或已禁用');
		const setting = await this.dispatch.setting();
		const profile = await this.prisma.rideDriverProfile.findUnique({ where: { memberId: driverMemberId } });
		if (!profile) throw new BadRequestException('请先初始化司机档案');
		const minimumGapMs = Math.max(1000, Math.floor(Number(setting.locationIntervalSeconds || 5) * 500));
		if (profile.lastLocationAt && Date.now() - profile.lastLocationAt.getTime() < minimumGapMs) throw new ConflictException('位置上报过于频繁');
		let clientTimestamp: Date | null = null;
		if (dto.clientTimestamp) {
			clientTimestamp = new Date(dto.clientTimestamp);
			if (Number.isNaN(clientTimestamp.getTime()) || Math.abs(Date.now() - clientTimestamp.getTime()) > 60_000) throw new BadRequestException('位置时间戳无效');
		}

		const activeTrip = await this.prisma.rideTrip.findFirst({
			where: { driverMemberId, status: { in: ['TO_PICKUP', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING'] } },
			orderBy: { id: 'desc' },
		});
		await this.prisma.$transaction(async (tx) => {
			await tx.rideDriverProfile.update({
				where: { memberId: driverMemberId },
				data: {
					longitude: dto.longitude,
					latitude: dto.latitude,
					heading: dto.heading ?? null,
					speedMetersPerSecond: dto.speedMetersPerSecond ?? null,
					lastLocationAt: new Date(),
					lastHeartbeatAt: new Date(),
					availabilityStatus: activeTrip ? 'BUSY' : (profile.availabilityStatus === 'OFFLINE' ? profile.previousManualStatus : profile.availabilityStatus),
					busyReason: activeTrip ? 'ORDER' : (profile.previousManualStatus === 'BUSY' ? 'MANUAL' : null),
				},
			});
			if (activeTrip) {
				await tx.rideLocation.create({
					data: {
						rideTripId: activeTrip.id,
						driverMemberId,
						longitude: dto.longitude,
						latitude: dto.latitude,
						heading: dto.heading ?? null,
						speedMetersPerSecond: dto.speedMetersPerSecond ?? null,
						clientTimestamp,
					},
				});
			}
		});

		const location = { rideTripId: activeTrip?.id || null, driverMemberId, longitude: dto.longitude, latitude: dto.latitude, heading: dto.heading ?? null, speedMetersPerSecond: dto.speedMetersPerSecond ?? null, at: new Date().toISOString() };
		if (!activeTrip) {
			this.realtime.toAdmins('ride:driver:availability', location);
			return { location, route: null };
		}
		this.realtime.toMember(activeTrip.passengerMemberId, 'ride:location', location);
		let route: RideRoute | null = null;
		try {
			const toDestination = ['IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING'].includes(activeTrip.status);
			route = await this.amap.drivingRoute(
				{ longitude: dto.longitude, latitude: dto.latitude },
				toDestination
					? { longitude: Number(activeTrip.destinationLongitude), latitude: Number(activeTrip.destinationLatitude) }
					: { longitude: Number(activeTrip.originLongitude), latitude: Number(activeTrip.originLatitude) },
			);
			this.realtime.toMembers([activeTrip.passengerMemberId, driverMemberId], 'ride:route', { rideTripId: activeTrip.id, route });
		} catch {
			// 路线失败不能阻塞位置上报；客户端保留上一条路线并展示降级提示。
		}
		return { location, route };
	}

	private async markStaleDriversOffline() {
		try {
			const setting = await this.dispatch.setting();
			const intervalSeconds = Math.max(5, Number(setting.locationIntervalSeconds || 5));
			const cutoff = new Date(Date.now() - Math.max(15, intervalSeconds * 3) * 1000);
			const stale = await this.prisma.rideDriverProfile.findMany({
				where: { availabilityStatus: { not: 'OFFLINE' }, OR: [{ lastLocationAt: null }, { lastLocationAt: { lt: cutoff } }] },
				select: { id: true, memberId: true },
			});
			if (!stale.length) return;
			await this.prisma.rideDriverProfile.updateMany({ where: { id: { in: stale.map((item) => item.id) } }, data: { availabilityStatus: 'OFFLINE', busyReason: null } });
			for (const item of stale) this.realtime.toAdmins('ride:driver:availability', { driverMemberId: item.memberId, status: 'OFFLINE' });
		} catch {
			// 后台清理失败由下一轮重试，不影响请求线程。
		}
	}
}
