import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { RideRealtimeService } from './ride.realtime.service.js';

const DEFAULT_SETTING = {
	dispatchRadiusMeters: 3000,
	dispatchTimeoutSeconds: 90,
	locationIntervalSeconds: 5,
};

@Injectable()
export class RideDispatchService {
	constructor(private readonly prisma: PrismaService, private readonly realtime: RideRealtimeService) {}

	async setting() {
		return (await this.prisma.rideSetting.findUnique({ where: { id: 1 } })) || DEFAULT_SETTING;
	}

	async nearby(origin: { longitude: number; latitude: number }) {
		const setting = await this.setting();
		const now = Date.now();
		const intervalSeconds = Math.max(5, Number(setting.locationIntervalSeconds || 5));
		const onlineSince = new Date(now - Math.max(15, intervalSeconds * 3) * 1000);
		const profiles = await this.prisma.rideDriverProfile.findMany({
			where: {
				employee: { enabled: true },
				lastLocationAt: { gte: onlineSince },
				longitude: { not: null },
				latitude: { not: null },
				currentVehicle: { is: { enabled: true } },
			},
			include: {
				employee: { select: { name: true, title: true } },
				member: { select: { name: true } },
				currentVehicle: { include: { vehicle: true } },
			},
		});
		const radius = Number(setting.dispatchRadiusMeters || 3000);
		const inRange = profiles.flatMap((profile) => {
			const longitude = Number(profile.longitude);
			const latitude = Number(profile.latitude);
			const distanceMeters = this.distance(origin.latitude, origin.longitude, latitude, longitude);
			if (distanceMeters > radius) return [];
			return [{
				memberId: profile.memberId,
				status: profile.availabilityStatus,
				longitude,
				latitude,
				distanceMeters: Math.round(distanceMeters),
				driverName: profile.employee.name || profile.member.name,
				vehicle: profile.currentVehicle ? {
					id: profile.currentVehicle.vehicle.id,
					plateNumber: profile.currentVehicle.vehicle.plateNumber,
					brand: profile.currentVehicle.vehicle.brand,
					series: profile.currentVehicle.vehicle.series,
					color: profile.currentVehicle.vehicle.color,
					displayName: profile.currentVehicle.displayName,
				} : null,
			}];
		});
		return {
			radiusMeters: radius,
			availableCount: inRange.filter((item) => item.status === 'AVAILABLE').length,
			availableDrivers: inRange.filter((item) => item.status === 'AVAILABLE').sort((a, b) => a.distanceMeters - b.distanceMeters),
			busyDrivers: inRange.filter((item) => item.status === 'BUSY').sort((a, b) => a.distanceMeters - b.distanceMeters),
		};
	}

	async beginDispatch(rideTripId: number) {
		const setting = await this.setting();
		const expireAt = new Date(Date.now() + Number(setting.dispatchTimeoutSeconds || 90) * 1000);
		const updated = await this.prisma.rideTrip.updateMany({
			where: { id: rideTripId, status: 'PREPAY_PENDING', order: { payStatus: 'PAID' } },
			data: { status: 'DISPATCHING', dispatchExpireAt: expireAt, version: { increment: 1 } },
		});
		if (!updated.count) return null;
		const trip = await this.prisma.rideTrip.findUnique({ where: { id: rideTripId }, include: { order: true } });
		if (!trip) return null;
		const nearby = await this.nearby({ longitude: Number(trip.originLongitude), latitude: Number(trip.originLatitude) });
		const targets = nearby.availableDrivers.map((driver) => driver.memberId);
		this.realtime.toMembers(targets, 'ride:dispatch:new', this.tripEvent(trip));
		this.realtime.toMember(trip.passengerMemberId, 'ride:status', this.tripEvent(trip));
		return trip;
	}

	async accept(rideTripId: number, driverMemberId: number) {
		const now = new Date();
		const result = await this.prisma.$transaction(async (tx) => {
			const profile = await tx.rideDriverProfile.findUnique({ where: { memberId: driverMemberId }, include: { employee: true, currentVehicle: true } });
			if (!profile?.employee.enabled) throw new BadRequestException('司机身份无效或已禁用');
			if (profile.availabilityStatus !== 'AVAILABLE' || !profile.currentVehicle?.enabled) throw new ConflictException('当前状态不可接单，请检查司机状态和出车车辆');
			const trip = await tx.rideTrip.findUnique({ where: { id: rideTripId } });
			if (!trip || trip.status !== 'DISPATCHING' || !trip.dispatchExpireAt || trip.dispatchExpireAt <= now) throw new ConflictException('行程已被接单或派单已结束');
			const active = await tx.rideTrip.count({ where: { driverMemberId, status: { in: ['ACCEPTED', 'TO_PICKUP', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING'] } } });
			if (active) throw new ConflictException('司机已有未完成行程');
			const claimed = await tx.rideTrip.updateMany({
				where: { id: rideTripId, status: 'DISPATCHING', version: trip.version },
				data: {
					status: 'TO_PICKUP',
					driverMemberId,
					driverEmployeeId: profile.employeeId,
					vehicleId: profile.currentVehicle.vehicleId,
					version: { increment: 1 },
				},
			});
			if (!claimed.count) throw new ConflictException('行程已被其他司机接单');
			const profileUpdated = await tx.rideDriverProfile.updateMany({
				where: { id: profile.id, availabilityStatus: 'AVAILABLE' },
				data: { previousManualStatus: 'AVAILABLE', availabilityStatus: 'BUSY', busyReason: 'ORDER' },
			});
			if (!profileUpdated.count) throw new ConflictException('司机状态已变化，请刷新后重试');
			await tx.orderTimeline.create({ data: { orderId: trip.orderId, event: 'RIDE_STATUS', value: 'TO_PICKUP', remark: `司机会员ID：${driverMemberId}` } });
			return tx.rideTrip.findUniqueOrThrow({ where: { id: rideTripId }, include: { order: true } });
		});
		this.realtime.toMember(result.passengerMemberId, 'ride:status', this.tripEvent(result));
		this.realtime.toMember(driverMemberId, 'ride:status', this.tripEvent(result));
		this.realtime.toAdmins('ride:status', this.tripEvent(result));
		return result;
	}

	async reject(rideTripId: number, driverMemberId: number) {
		const trip = await this.prisma.rideTrip.findUnique({ where: { id: rideTripId } });
		if (!trip || trip.status !== 'DISPATCHING') throw new ConflictException('当前行程不可拒绝');
		await this.prisma.rideDispatchRejection.upsert({
			where: { rideTripId_driverMemberId: { rideTripId, driverMemberId } },
			create: { rideTripId, driverMemberId },
			update: {},
		});
		this.realtime.toMember(driverMemberId, 'ride:dispatch:cancelled', { rideTripId });
		return { ok: true };
	}

	restoreDriver(memberId: number | null | undefined) {
		if (!memberId) return Promise.resolve();
		return this.prisma.$transaction(async (tx) => {
			const profile = await tx.rideDriverProfile.findUnique({ where: { memberId } });
			if (!profile || profile.busyReason !== 'ORDER') return;
			const next = profile.previousManualStatus === 'BUSY' ? 'BUSY' : 'AVAILABLE';
			await tx.rideDriverProfile.update({ where: { id: profile.id }, data: { availabilityStatus: next, busyReason: next === 'BUSY' ? 'MANUAL' : null } });
		});
	}

	private tripEvent(trip: any) {
		return { id: trip.id, orderId: trip.orderId, status: trip.status, version: trip.version, dispatchExpireAt: trip.dispatchExpireAt };
	}

	private distance(lat1: number, lng1: number, lat2: number, lng2: number) {
		const rad = (value: number) => (value * Math.PI) / 180;
		const dLat = rad(lat2 - lat1);
		const dLng = rad(lng2 - lng1);
		const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
		return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}
}
