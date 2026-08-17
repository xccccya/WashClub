import { BadRequestException, ConflictException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { RideAmapService, type RideRoute } from './ride.amap.service.js';
import { RideDispatchService } from './ride.dispatch.service.js';
import { RideFareService } from './ride.fare.service.js';
import { RideLocationBatchDto, RideLocationDto } from './ride.dto.js';
import { RideRealtimeService } from './ride.realtime.service.js';
import { RideTrajectoryService } from './ride.trajectory.service.js';

@Injectable()
export class RideLocationService implements OnModuleInit, OnModuleDestroy {
	private offlineTimer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly prisma: PrismaService,
		private readonly amap: RideAmapService,
		private readonly dispatch: RideDispatchService,
		private readonly fare: RideFareService,
		private readonly realtime: RideRealtimeService,
		private readonly trajectory: RideTrajectoryService,
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
		return this.reportLocations(driverMemberId, [dto], setting, profile);
	}

	async reportBatch(driverMemberId: number, dto: RideLocationBatchDto) {
		const [employee, setting, profile] = await Promise.all([
			this.prisma.employee.findUnique({ where: { memberId: driverMemberId } }),
			this.dispatch.setting(),
			this.prisma.rideDriverProfile.findUnique({ where: { memberId: driverMemberId } }),
		]);
		if (!employee?.enabled) throw new BadRequestException('司机身份无效或已禁用');
		if (!profile) throw new BadRequestException('请先初始化司机档案');
		return this.reportLocations(driverMemberId, dto.locations, setting, profile);
	}

	private async reportLocations(driverMemberId: number, dtos: RideLocationDto[], setting: any, profile: any) {
		const receivedAt = new Date();

		const activeTrip = await this.prisma.rideTrip.findFirst({
			where: { driverMemberId, status: { in: ['TO_PICKUP', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING'] } },
			orderBy: { id: 'desc' },
		});
		const requestedTripIds = [...new Set(dtos.flatMap((item) => typeof item.rideTripId === 'number' ? [item.rideTripId] : []))];
		const requestedTrips = requestedTripIds.length ? await this.prisma.rideTrip.findMany({ where: { id: { in: requestedTripIds }, driverMemberId } }) : [];
		if (requestedTrips.length !== requestedTripIds.length) throw new BadRequestException('定位点所属行程无效');
		const tripsById = new Map(requestedTrips.map((trip) => [trip.id, trip]));
		const normalized = dtos.map((dto) => {
			const clientTimestamp = dto.clientTimestamp ? new Date(dto.clientTimestamp) : receivedAt;
			if (Number.isNaN(clientTimestamp.getTime()) || clientTimestamp.getTime() > receivedAt.getTime() + 60_000 || clientTimestamp.getTime() < receivedAt.getTime() - 24 * 60 * 60_000) {
				throw new BadRequestException('位置时间戳无效或超出补传窗口');
			}
			const targetTripId = dto.rideTripId === null ? null : (dto.rideTripId ?? activeTrip?.id ?? null);
			const targetTrip = targetTripId == null ? null : (tripsById.get(targetTripId) || (activeTrip?.id === targetTripId ? activeTrip : null));
			if (targetTrip) {
				const earliest = targetTrip.createdAt.getTime() - 5 * 60_000;
				const closedAt = targetTrip.completedAt || targetTrip.cancelledAt;
				const latest = (closedAt || receivedAt).getTime() + 60_000;
				if (clientTimestamp.getTime() < earliest || clientTimestamp.getTime() > latest) return null;
			}
			return {
				dto, clientTimestamp, targetTripId,
				longitude: Number(dto.longitude), latitude: Number(dto.latitude),
				heading: dto.heading ?? null, speedMetersPerSecond: dto.speedMetersPerSecond ?? null, accuracyMeters: dto.accuracyMeters ?? null,
			};
		}).filter((item): item is NonNullable<typeof item> => !!item);
		if (!normalized.length) throw new BadRequestException('没有可接收的定位点');
		normalized.sort((left, right) => left.clientTimestamp.getTime() - right.clientTimestamp.getTime());
		const latestUsable = [...normalized].reverse().find((item) => this.trajectory.isUsableSample(item));
		const realtimeAgeMs = latestUsable ? receivedAt.getTime() - latestUsable.clientTimestamp.getTime() : Number.POSITIVE_INFINITY;
		const realtimePoint = latestUsable && realtimeAgeMs >= -5000 && realtimeAgeMs <= 60_000 ? latestUsable : null;
		const locationRows = normalized.flatMap((item) => item.targetTripId == null ? [] : [{
			rideTripId: item.targetTripId,
			driverMemberId,
			longitude: item.longitude,
			latitude: item.latitude,
			heading: item.heading,
			speedMetersPerSecond: item.speedMetersPerSecond,
			accuracyMeters: item.accuracyMeters,
			clientTimestamp: item.clientTimestamp,
			clientPointId: item.dto.clientPointId || null,
			source: 'GPS',
		}]);
		let insertedCount = 0;
		await this.prisma.$transaction(async (tx) => {
			if (realtimePoint) await tx.rideDriverProfile.update({
				where: { memberId: driverMemberId },
				data: {
					longitude: realtimePoint.longitude, latitude: realtimePoint.latitude, heading: realtimePoint.heading,
					speedMetersPerSecond: realtimePoint.speedMetersPerSecond, accuracyMeters: realtimePoint.accuracyMeters,
					lastLocationAt: new Date(Math.min(receivedAt.getTime(), realtimePoint.clientTimestamp.getTime())), lastHeartbeatAt: receivedAt,
					availabilityStatus: activeTrip ? 'BUSY' : (profile.availabilityStatus === 'OFFLINE' ? profile.previousManualStatus : profile.availabilityStatus),
					busyReason: activeTrip ? 'ORDER' : (profile.previousManualStatus === 'BUSY' ? 'MANUAL' : null),
				},
			});
			if (locationRows.length) insertedCount = (await tx.rideLocation.createMany({ data: locationRows, skipDuplicates: true })).count;
		});

		const location = realtimePoint ? {
			rideTripId: realtimePoint.targetTripId, driverMemberId, longitude: realtimePoint.longitude, latitude: realtimePoint.latitude,
			heading: realtimePoint.heading, speedMetersPerSecond: realtimePoint.speedMetersPerSecond, accuracyMeters: realtimePoint.accuracyMeters,
			at: realtimePoint.clientTimestamp.toISOString(), receivedAt: receivedAt.toISOString(),
		} : null;
		if (!activeTrip || !realtimePoint || realtimePoint.targetTripId !== activeTrip.id) {
			if (location) this.realtime.toAdmins('ride:driver:availability', location);
			return { location, route: null, meter: null, receivedCount: normalized.length, insertedCount };
		}
		this.realtime.toMember(activeTrip.passengerMemberId, 'ride:location', location);
		let route: RideRoute | null = null;
		try {
			const toDestination = ['IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING'].includes(activeTrip.status);
			route = await this.amap.drivingRoute(
				{ longitude: realtimePoint.longitude, latitude: realtimePoint.latitude },
				toDestination
					? { longitude: Number(activeTrip.destinationLongitude), latitude: Number(activeTrip.destinationLatitude) }
					: { longitude: Number(activeTrip.originLongitude), latitude: Number(activeTrip.originLatitude) },
			);
			this.realtime.toMembers([activeTrip.passengerMemberId, driverMemberId], 'ride:route', { rideTripId: activeTrip.id, route });
		} catch {
			// 路线失败不能阻塞位置上报；客户端保留上一条路线并展示降级提示。
		}
		let meter: Record<string, unknown> | null = null;
		if (activeTrip.status === 'IN_TRIP' && activeTrip.startedAt) {
			const locations = await this.prisma.rideLocation.findMany({
				where: { rideTripId: activeTrip.id },
				orderBy: { createdAt: 'desc' },
				take: 10000,
			});
			const processed = this.trajectory.process(locations);
			const segment = this.trajectory.segment(processed.points, activeTrip.startedAt, receivedAt);
			const durationSeconds = Math.max(0, Math.round((Date.now() - activeTrip.startedAt.getTime()) / 1000));
			const calculated = this.fare.calculate(setting, segment.distanceMeters, durationSeconds, Number(activeTrip.estimatedTollAmount || 0));
			meter = { distanceMeters: segment.distanceMeters, durationSeconds, ...calculated, trajectoryQuality: { rawPointCount: processed.rawPointCount, acceptedPointCount: processed.acceptedPointCount, rejectedPointCount: processed.rejectedPointCount } };
			this.realtime.toMembers([activeTrip.passengerMemberId, driverMemberId], 'ride:meter', { rideTripId: activeTrip.id, meter });
		}
		return { location, route, meter, receivedCount: normalized.length, insertedCount };
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
