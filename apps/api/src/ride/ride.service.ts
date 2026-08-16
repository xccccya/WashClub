import { BadRequestException, ConflictException, ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { OrderRefundService } from '../order/order-refund.service.js';
import {
	RideAdminListQueryDto,
	RideCreateDto,
	RideDriverStatusDtoValue,
	RideDriverVehicleCreateDto,
	RideDriverVehicleUpdateDto,
	RideFinalizeDto,
	RideListQueryDto,
	RideMessageCreateDto,
	RideRoutePreviewDto,
	RideSettingUpdateDto,
} from './ride.dto.js';
import { RideAmapService } from './ride.amap.service.js';
import { RideDispatchService } from './ride.dispatch.service.js';
import { RideFareService } from './ride.fare.service.js';
import { RideRealtimeService } from './ride.realtime.service.js';

const ACTIVE_DRIVER_STATUSES = ['ACCEPTED', 'TO_PICKUP', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING'] as const;
const PASSENGER_CANCELLABLE = ['CREATED', 'PREPAY_PENDING', 'DISPATCHING'] as const;

@Injectable()
export class RideService implements OnModuleInit, OnModuleDestroy {
	private maintenanceTimer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly prisma: PrismaService,
		private readonly amap: RideAmapService,
		private readonly fare: RideFareService,
		private readonly dispatch: RideDispatchService,
		private readonly realtime: RideRealtimeService,
		private readonly refund: OrderRefundService,
	) {}

	onModuleInit() {
		this.maintenanceTimer = setInterval(() => void this.runMaintenance(), 5000);
		this.maintenanceTimer.unref?.();
	}

	onModuleDestroy() {
		if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
	}

	async getSetting() {
		return (await this.prisma.rideSetting.findUnique({ where: { id: 1 } })) || {
			id: 1,
			dispatchRadiusMeters: 3000,
			dispatchTimeoutSeconds: 90,
			baseFare: 0,
			includedDistanceKm: 0,
			includedDurationMinutes: 0,
			pricePerKm: 0,
			pricePerMinute: 0,
			minimumFare: 0,
			allowParkingFee: false,
			allowOtherFee: false,
			chatRetentionDays: 30,
			locationIntervalSeconds: 5,
		};
	}

	updateSetting(dto: RideSettingUpdateDto, adminId: number) {
		return this.prisma.rideSetting.upsert({
			where: { id: 1 },
			create: { id: 1, ...dto, updatedByUserId: adminId },
			update: { ...dto, updatedByUserId: adminId },
		});
	}

	async routePreview(dto: RideRoutePreviewDto) {
		const [setting, recommendedRoutes] = await Promise.all([
			this.getSetting(),
			this.amap.drivingRoutes(dto.origin, dto.destination, 3),
		]);
		let routes = recommendedRoutes;
		if (recommendedRoutes.some((route) => route.tollAmount > 0 || route.tollDistanceMeters > 0)) {
			try {
				const [avoidHighway] = await this.amap.drivingRoutes(dto.origin, dto.destination, 1, { strategy: '35', preference: 'AVOID_HIGHWAY' });
				if (avoidHighway) routes = recommendedRoutes.length >= 3 ? [...recommendedRoutes.slice(0, 2), avoidHighway] : [...recommendedRoutes, avoidHighway];
			} catch {
				// 不走高速是补充候选；高德策略路线暂不可用时仍保留基础路线预览。
			}
		}
		const candidates = routes.map((route) => ({ route, fare: this.fare.calculate(setting, route.distanceMeters, route.durationSeconds, route.tollAmount) }));
		return { coordinateSystem: 'GCJ-02', routes: candidates, ...candidates[0] };
	}

	async create(memberId: number, dto: RideCreateDto) {
		const nearby = await this.dispatch.nearby(dto.origin);
		if (!nearby.availableCount) throw new ConflictException('3km内无司机，请查看地图在线/忙碌司机，手动联系其是否愿意接驾');
		const preview = await this.routePreview(dto);
		const selected = preview.routes[dto.routeIndex || 0];
		if (!selected) throw new BadRequestException('所选路线已失效，请重新预览');
		const amount = selected.fare.amount;
		if (amount <= 0) throw new BadRequestException('预估车费必须大于0，请联系管理员配置计价规则');
		const no = this.orderNo('RIDE');
		const result = await this.prisma.$transaction(async (tx) => {
			const order = await tx.order.create({
				data: {
					no,
					type: 'RIDE',
					status: 'CREATED',
					fulfillmentStatus: 'PENDING',
					payStatus: 'UNPAID',
					totalAmount: amount,
					payAmount: amount,
					memberId,
					paymentExpireAt: new Date(Date.now() + 15 * 60_000),
				},
			});
			const trip = await tx.rideTrip.create({
				data: {
					orderId: order.id,
					passengerMemberId: memberId,
					status: 'PREPAY_PENDING',
					originLongitude: dto.origin.longitude,
					originLatitude: dto.origin.latitude,
					originAddress: dto.origin.address,
					originPoiId: dto.origin.poiId || null,
					destinationLongitude: dto.destination.longitude,
					destinationLatitude: dto.destination.latitude,
					destinationAddress: dto.destination.address,
					destinationPoiId: dto.destination.poiId || null,
					selectedRouteSnapshot: selected.route as any,
					estimatedDistanceMeters: selected.route.distanceMeters,
					estimatedDurationSeconds: selected.route.durationSeconds,
					estimatedTollAmount: selected.route.tollAmount,
					estimatedAmount: amount,
				},
			});
			await tx.orderTimeline.createMany({ data: [
				{ orderId: order.id, event: 'ORDER_STATUS', value: 'CREATED', remark: '行程订单已创建' },
				{ orderId: order.id, event: 'RIDE_STATUS', value: 'PREPAY_PENDING' },
			] });
			return { order, trip };
		});
		return { ...result, route: selected.route, fare: selected.fare };
	}

	async passengerList(memberId: number, query: RideListQueryDto) {
		const page = query.page || 1;
		const pageSize = query.pageSize || 20;
		const where: Prisma.RideTripWhereInput = { passengerMemberId: memberId };
		if (query.status) where.status = query.status as any;
		const [items, total] = await Promise.all([
			this.prisma.rideTrip.findMany({ where, include: this.tripInclude(), orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
			this.prisma.rideTrip.count({ where }),
		]);
		return { items: items.map((item) => this.serializeTrip(item)), total, page, pageSize };
	}

	async driverList(memberId: number, query: RideListQueryDto) {
		const page = query.page || 1;
		const pageSize = query.pageSize || 20;
		const where: Prisma.RideTripWhereInput = {
			OR: [
				{ driverMemberId: memberId },
				{ status: 'DISPATCHING' },
			],
		};
		if (query.status) Object.assign(where, { status: query.status as any });
		const [items, total] = await Promise.all([
			this.prisma.rideTrip.findMany({ where, include: this.tripInclude(), orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
			this.prisma.rideTrip.count({ where }),
		]);
		return { items: items.map((item) => this.serializeTrip(item)), total, page, pageSize };
	}

	async detail(rideTripId: number, actor: { memberId?: number; admin?: boolean }) {
		const trip = await this.prisma.rideTrip.findUnique({ where: { id: rideTripId }, include: this.tripInclude() });
		if (!trip) throw new BadRequestException('行程不存在');
		if (!actor.admin && actor.memberId !== trip.passengerMemberId && actor.memberId !== trip.driverMemberId) {
			const driverCandidate = trip.status === 'DISPATCHING' && actor.memberId
				? await this.prisma.employee.findFirst({ where: { memberId: actor.memberId, enabled: true }, select: { id: true } })
				: null;
			if (!driverCandidate) throw new ForbiddenException('无权访问该行程');
		}
		return this.serializeTripWithFare(trip);
	}

	async driverProfile(memberId: number, employee: { id: number }) {
		const profile = await this.prisma.rideDriverProfile.upsert({
			where: { memberId },
			create: { memberId, employeeId: employee.id },
			update: { employeeId: employee.id },
			include: { currentVehicle: { include: { vehicle: true } }, employee: true },
		});
		return this.serialize(profile);
	}

	async setDriverStatus(memberId: number, employeeId: number, status: RideDriverStatusDtoValue) {
		const profile = await this.prisma.rideDriverProfile.upsert({ where: { memberId }, create: { memberId, employeeId }, update: { employeeId } });
		const active = await this.prisma.rideTrip.count({ where: { driverMemberId: memberId, status: { in: [...ACTIVE_DRIVER_STATUSES] } } });
		if (active) throw new ConflictException('存在未完成行程，不能手动切换司机状态');
		if (status === 'AVAILABLE') {
			const selected = profile.currentVehicleId ? await this.prisma.rideDriverVehicle.findFirst({ where: { id: profile.currentVehicleId, driverMemberId: memberId, enabled: true } }) : null;
			if (!selected) throw new ConflictException('请先选择有效的出车车辆');
		}
		const updated = await this.prisma.rideDriverProfile.update({
			where: { memberId },
			data: {
				availabilityStatus: status,
				previousManualStatus: status === 'AVAILABLE' && profile.availabilityStatus === 'BUSY' && profile.busyReason === 'MANUAL' ? 'BUSY' : status,
				busyReason: status === 'BUSY' ? 'MANUAL' : null,
				lastHeartbeatAt: new Date(),
			},
		});
		this.realtime.toAdmins('ride:driver:availability', { driverMemberId: memberId, status });
		return updated;
	}

	async driverVehicles(memberId: number) {
		return this.prisma.rideDriverVehicle.findMany({ where: { driverMemberId: memberId }, include: { vehicle: true }, orderBy: { id: 'desc' } });
	}

	async createDriverVehicle(memberId: number, employeeId: number, dto: RideDriverVehicleCreateDto) {
		await this.prisma.rideDriverProfile.upsert({ where: { memberId }, create: { memberId, employeeId }, update: { employeeId } });
		return this.prisma.$transaction(async (tx) => {
			if (dto.vehicleId) {
				const vehicle = await tx.vehicle.findFirst({ where: { id: dto.vehicleId, memberId } });
				if (!vehicle) throw new ForbiddenException('只能使用当前账号已有的会员车辆');
				const binding = await tx.rideDriverVehicle.upsert({
					where: { driverMemberId_vehicleId: { driverMemberId: memberId, vehicleId: vehicle.id } },
					create: { driverMemberId: memberId, vehicleId: vehicle.id, displayName: dto.displayName || null },
					update: { enabled: true, displayName: dto.displayName },
					include: { vehicle: true },
				});
				if (dto.selected) await tx.rideDriverProfile.update({ where: { memberId }, data: { currentVehicleId: binding.id } });
				return binding;
			}
			const vehicle = await tx.vehicle.create({ data: {
				memberId,
				plateNumber: dto.plateNumber!.trim().toUpperCase(),
				typeMain: dto.typeMain!,
				brand: dto.brand || '-',
				series: dto.series || '-',
				color: dto.color || '-',
				brandImage: dto.brandImage || null,
				seriesImage: dto.seriesImage || null,
			} });
			const binding = await tx.rideDriverVehicle.create({ data: { driverMemberId: memberId, vehicleId: vehicle.id, displayName: dto.displayName || null }, include: { vehicle: true } });
			if (dto.selected) await tx.rideDriverProfile.update({ where: { memberId }, data: { currentVehicleId: binding.id } });
			return binding;
		});
	}

	async updateDriverVehicle(memberId: number, bindingId: number, dto: RideDriverVehicleUpdateDto) {
		const binding = await this.prisma.rideDriverVehicle.findFirst({ where: { id: bindingId, driverMemberId: memberId }, include: { vehicle: true } });
		if (!binding || binding.vehicle.memberId !== memberId) throw new ForbiddenException('只能修改自己的车辆');
		return this.prisma.$transaction(async (tx) => {
			await tx.vehicle.update({ where: { id: binding.vehicleId }, data: {
				plateNumber: dto.plateNumber?.trim().toUpperCase(),
				typeMain: dto.typeMain,
				brand: dto.brand,
				series: dto.series,
				color: dto.color,
				brandImage: dto.brandImage,
				seriesImage: dto.seriesImage,
			} });
			const updated = await tx.rideDriverVehicle.update({ where: { id: binding.id }, data: { enabled: dto.enabled, displayName: dto.displayName } });
			if (dto.selected) {
				if (dto.enabled === false) throw new BadRequestException('已停用车辆不能设为出车车辆');
				await tx.rideDriverProfile.update({ where: { memberId }, data: { currentVehicleId: binding.id } });
			}
			return tx.rideDriverVehicle.findUnique({ where: { id: updated.id }, include: { vehicle: true } });
		});
	}

	async deleteDriverVehicle(memberId: number, bindingId: number) {
		const binding = await this.prisma.rideDriverVehicle.findFirst({ where: { id: bindingId, driverMemberId: memberId }, include: { vehicle: true } });
		if (!binding || binding.vehicle.memberId !== memberId) throw new ForbiddenException('只能删除自己的车辆');
		const used = await this.prisma.rideTrip.count({ where: { vehicleId: binding.vehicleId } });
		if (used) throw new ConflictException('车辆已有行程记录，只能停用，不能删除');
		await this.prisma.$transaction(async (tx) => {
			await tx.rideDriverProfile.updateMany({ where: { memberId, currentVehicleId: binding.id }, data: { currentVehicleId: null, availabilityStatus: 'OFFLINE', busyReason: null } });
			await tx.rideDriverVehicle.delete({ where: { id: binding.id } });
		});
		return { ok: true };
	}

	async arrivePickup(id: number, driverMemberId: number, confirmFarAway = false) {
		await this.assertArrivalDistance(id, driverMemberId, 'origin', confirmFarAway);
		return this.transition(id, driverMemberId, 'TO_PICKUP', 'ARRIVED_PICKUP', { arrivedPickupAt: new Date() });
	}

	async start(id: number, driverMemberId: number, phoneLastFour: string) {
		const trip = await this.ownedDriverTrip(id, driverMemberId);
		if (trip.status !== 'ARRIVED_PICKUP') throw new ConflictException('司机到达上车点后才能开始订单');
		const passenger = await this.prisma.member.findUnique({ where: { id: trip.passengerMemberId }, select: { phone: true } });
		if (!passenger || passenger.phone.slice(-4) !== phoneLastFour) throw new BadRequestException('乘客手机号后四位错误');
		return this.transition(id, driverMemberId, 'ARRIVED_PICKUP', 'IN_TRIP', { passengerPhoneVerifiedAt: new Date(), startedAt: new Date() });
	}

	async arriveDestination(id: number, driverMemberId: number, confirmFarAway = false) {
		await this.assertArrivalDistance(id, driverMemberId, 'destination', confirmFarAway);
		return this.transition(id, driverMemberId, 'IN_TRIP', 'ARRIVED_DESTINATION', { arrivedDestinationAt: new Date() });
	}

	async finalize(id: number, driverMemberId: number, dto: RideFinalizeDto) {
		const trip = await this.ownedDriverTrip(id, driverMemberId);
		if (trip.status !== 'ARRIVED_DESTINATION') {
			if (['FARE_PENDING', 'REFUND_PENDING', 'SUPPLEMENT_PENDING', 'COMPLETED'].includes(trip.status)) {
				await this.settleFinalFare(trip);
				return this.detail(id, { memberId: driverMemberId });
			}
			throw new ConflictException('到达目的地后才能确认费用');
		}
		if (!trip.startedAt || !trip.arrivedDestinationAt) throw new ConflictException('行程时间记录不完整');
		const [setting, locations] = await Promise.all([
			this.getSetting(),
			this.prisma.rideLocation.findMany({ where: { rideTripId: id, createdAt: { gte: trip.startedAt, lte: trip.arrivedDestinationAt } }, orderBy: { createdAt: 'asc' } }),
		]);
		let measuredDistance = 0;
		for (let index = 1; index < locations.length; index += 1) {
			measuredDistance += this.distance(Number(locations[index - 1].latitude), Number(locations[index - 1].longitude), Number(locations[index].latitude), Number(locations[index].longitude));
		}
		const finalDistanceMeters = locations.length >= 2 ? Math.round(measuredDistance) : trip.estimatedDistanceMeters;
		const finalDurationSeconds = Math.max(0, Math.round((trip.arrivedDestinationAt.getTime() - trip.startedAt.getTime()) / 1000));
		const extraFees = dto.extraFees || [];
		if (!setting.allowParkingFee && extraFees.some((item) => item.type === 'PARKING' && item.amount > 0)) throw new BadRequestException('当前配置不允许添加停车费');
		if (!setting.allowOtherFee && extraFees.some((item) => item.type === 'OTHER' && item.amount > 0)) throw new BadRequestException('当前配置不允许添加其他费用');
		const extraAmount = Number(trip.estimatedTollAmount || 0) + extraFees.reduce((sum, item) => sum + item.amount, 0);
		const calculated = this.fare.calculate(setting, finalDistanceMeters, finalDurationSeconds, extraAmount);
		const updated = await this.prisma.$transaction(async (tx) => {
			const moved = await tx.rideTrip.updateMany({ where: { id, driverMemberId, status: 'ARRIVED_DESTINATION', version: trip.version }, data: {
				status: 'FARE_PENDING', finalDistanceMeters, finalDurationSeconds, finalAmount: calculated.amount, version: { increment: 1 },
			} });
			if (!moved.count) throw new ConflictException('行程状态已变化，请刷新后重试');
			if (Number(trip.estimatedTollAmount || 0) > 0) await tx.rideExtraFee.create({ data: { rideTripId: id, type: 'TOLL', amount: trip.estimatedTollAmount, remark: '高德路线预估过路费', createdByMemberId: driverMemberId } });
			for (const fee of extraFees) if (fee.amount > 0) await tx.rideExtraFee.create({ data: { rideTripId: id, type: fee.type, amount: fee.amount, remark: fee.remark || null, createdByMemberId: driverMemberId } });
			await tx.orderTimeline.create({ data: { orderId: trip.orderId, event: 'RIDE_FARE', value: calculated.amount.toFixed(2), remark: `距离${finalDistanceMeters}米，时长${finalDurationSeconds}秒` } });
			return tx.rideTrip.findUniqueOrThrow({ where: { id }, include: { order: true } });
		});

		await this.settleFinalFare(updated);
		const fresh = await this.prisma.rideTrip.findUniqueOrThrow({ where: { id }, include: this.tripInclude() });
		this.realtime.toMembers([fresh.passengerMemberId, driverMemberId], 'ride:status', { id, status: fresh.status, finalAmount: fresh.finalAmount, supplementOrderId: fresh.supplementOrderId });
		return this.serializeTripWithFare(fresh);
	}

	async cancel(id: number, passengerMemberId: number, reason?: string) {
		const trip = await this.prisma.rideTrip.findUnique({ where: { id }, include: { order: true } });
		if (!trip || trip.passengerMemberId !== passengerMemberId) throw new ForbiddenException('无权操作该行程');
		if (!PASSENGER_CANCELLABLE.includes(trip.status as any)) throw new ConflictException('行程已开始，不能取消');
		const paid = trip.order.payStatus === 'PAID';
		await this.prisma.$transaction(async (tx) => {
			const moved = await tx.rideTrip.updateMany({ where: { id, status: { in: [...PASSENGER_CANCELLABLE] } }, data: { status: paid ? 'REFUND_PENDING' : 'CANCELLED', cancelledAt: new Date(), cancelReason: reason || '乘客取消', cancelActor: 'PASSENGER', version: { increment: 1 } } });
			if (!moved.count) throw new ConflictException('行程状态已变化');
			if (!paid) await tx.order.update({ where: { id: trip.orderId }, data: { status: 'CANCELLED', payStatus: 'CANCELLED' } });
			await tx.orderTimeline.create({ data: { orderId: trip.orderId, event: 'RIDE_STATUS', value: paid ? 'REFUND_PENDING' : 'CANCELLED', remark: reason || '乘客取消' } });
		});
		if (paid) await this.refund.createWechatRefund({ orderId: trip.orderId, reason: reason || '乘客取消行程' });
		this.realtime.toMembers([trip.driverMemberId || 0, passengerMemberId], 'ride:status', { id, status: paid ? 'REFUND_PENDING' : 'CANCELLED' });
		return { ok: true, status: paid ? 'REFUND_PENDING' : 'CANCELLED' };
	}

	async messages(id: number, memberId: number) {
		await this.assertParticipant(id, memberId);
		const rows = await this.prisma.rideMessage.findMany({ where: { rideTripId: id }, orderBy: { createdAt: 'asc' }, take: 200 });
		return rows.map((row) => this.serialize(row));
	}

	async messageUnreadCount(id: number, memberId: number) {
		await this.assertParticipant(id, memberId);
		const count = await this.prisma.rideMessage.count({ where: { rideTripId: id, senderMemberId: { not: memberId }, readAt: null } });
		return { count };
	}

	async markMessagesRead(id: number, memberId: number) {
		const trip = await this.assertParticipant(id, memberId);
		const unread = await this.prisma.rideMessage.findMany({
			where: { rideTripId: id, senderMemberId: { not: memberId }, readAt: null },
			select: { id: true },
		});
		if (!unread.length) return { rideTripId: id, messageIds: [], readAt: null, unreadCount: 0 };
		const readAt = new Date();
		await this.prisma.rideMessage.updateMany({ where: { id: { in: unread.map((item) => item.id) }, readAt: null }, data: { readAt } });
		const result = this.serialize({ rideTripId: id, messageIds: unread.map((item) => item.id), readAt, unreadCount: 0 });
		const senderMemberId = memberId === trip.passengerMemberId ? trip.driverMemberId : trip.passengerMemberId;
		this.realtime.toMember(senderMemberId, 'ride:message-read', result);
		return result;
	}

	async sendMessage(id: number, memberId: number, dto: RideMessageCreateDto) {
		const trip = await this.assertParticipant(id, memberId);
		const target = memberId === trip.passengerMemberId ? trip.driverMemberId : trip.passengerMemberId;
		if (!target) throw new ConflictException('尚未匹配司机，无法发送消息');
		const message = await this.prisma.rideMessage.create({ data: { rideTripId: id, senderMemberId: memberId, content: dto.content.trim() } });
		const unreadCount = await this.prisma.rideMessage.count({ where: { rideTripId: id, senderMemberId: { not: target }, readAt: null } });
		const serialized = this.serialize(message);
		this.realtime.toMember(target, 'ride:message', { ...serialized, unreadCount });
		return serialized;
	}

	async contact(id: number, memberId: number) {
		const trip = await this.assertParticipant(id, memberId);
		const targetId = memberId === trip.passengerMemberId ? trip.driverMemberId : trip.passengerMemberId;
		if (!targetId) throw new ConflictException('尚未匹配司机');
		const member = await this.prisma.member.findUnique({ where: { id: targetId }, select: { id: true, name: true, phone: true, avatarUrl: true } });
		return member;
	}

	async busyDriverContact(driverMemberId: number) {
		const profile = await this.prisma.rideDriverProfile.findUnique({ where: { memberId: driverMemberId }, include: { member: { select: { id: true, name: true, phone: true, avatarUrl: true } }, employee: true } });
		if (!profile?.employee.enabled || profile.availabilityStatus !== 'BUSY' || !profile.lastLocationAt || Date.now() - profile.lastLocationAt.getTime() > 5000) throw new ConflictException('该司机当前不可联系');
		return profile.member;
	}

	async adminList(query: RideAdminListQueryDto) {
		const page = query.page || 1;
		const pageSize = query.pageSize || 20;
		const where: Prisma.RideTripWhereInput = {};
		if (query.status) where.status = query.status as any;
		if (query.keyword?.trim()) where.order = { no: { contains: query.keyword.trim() } };
		if (query.passenger?.trim()) {
			const value = query.passenger.trim();
			where.passenger = { OR: [{ name: { contains: value } }, { phone: { contains: value } }] };
		}
		if (query.driver?.trim()) {
			const value = query.driver.trim();
			where.OR = [
				{ driverMember: { OR: [{ name: { contains: value } }, { phone: { contains: value } }] } },
				{ driverEmployee: { name: { contains: value } } },
			];
		}
		if (query.startAt || query.endAt) where.createdAt = {
			...(query.startAt ? { gte: new Date(query.startAt) } : {}),
			...(query.endAt ? { lte: new Date(query.endAt) } : {}),
		};
		const [items, total] = await Promise.all([
			this.prisma.rideTrip.findMany({ where, include: this.tripInclude(), orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
			this.prisma.rideTrip.count({ where }),
		]);
		return { items: items.map((item) => this.serializeTrip(item)), total, page, pageSize };
	}

	adminDrivers() {
		return this.prisma.rideDriverProfile.findMany({
			include: {
				employee: true,
				member: {
					select: {
						id: true, name: true, phone: true,
						rideTripsAsDriver: { where: { status: { in: [...ACTIVE_DRIVER_STATUSES] } }, select: { id: true, status: true, orderId: true }, take: 1, orderBy: { id: 'desc' } },
					},
				},
				currentVehicle: { include: { vehicle: true } },
			},
			orderBy: { updatedAt: 'desc' },
		});
	}

	async adminTrack(id: number) {
		const trip = await this.prisma.rideTrip.findUnique({ where: { id }, select: {
			id: true, originLongitude: true, originLatitude: true, originAddress: true,
			destinationLongitude: true, destinationLatitude: true, destinationAddress: true,
			selectedRouteSnapshot: true,
		} });
		if (!trip) throw new BadRequestException('行程不存在');
		const locations = await this.prisma.rideLocation.findMany({ where: { rideTripId: id }, orderBy: { createdAt: 'asc' }, take: 10000 });
		return this.serialize({ ...trip, locations });
	}

	async adminMessages(id: number) {
		const trip = await this.prisma.rideTrip.findUnique({ where: { id }, select: { id: true } });
		if (!trip) throw new BadRequestException('行程不存在');
		const rows = await this.prisma.rideMessage.findMany({
			where: { rideTripId: id },
			include: { senderMember: { select: { id: true, name: true, avatarUrl: true } } },
			orderBy: { createdAt: 'asc' },
			take: 500,
		});
		return rows.map((row) => this.serialize(row));
	}

	private async assertArrivalDistance(id: number, driverMemberId: number, target: 'origin' | 'destination', confirmed: boolean) {
		const [trip, profile] = await Promise.all([
			this.ownedDriverTrip(id, driverMemberId),
			this.prisma.rideDriverProfile.findUnique({ where: { memberId: driverMemberId }, select: { longitude: true, latitude: true, lastLocationAt: true } }),
		]);
		if (!profile?.lastLocationAt || profile.longitude == null || profile.latitude == null) throw new ConflictException('请先开启定位并更新当前位置');
		if (Date.now() - profile.lastLocationAt.getTime() > 30_000) throw new ConflictException('当前位置已过期，请重新定位后再确认到达');
		const targetLatitude = Number(target === 'origin' ? trip.originLatitude : trip.destinationLatitude);
		const targetLongitude = Number(target === 'origin' ? trip.originLongitude : trip.destinationLongitude);
		const distanceMeters = Math.round(this.distance(Number(profile.latitude), Number(profile.longitude), targetLatitude, targetLongitude));
		if (distanceMeters > 500 && !confirmed) {
			throw new ConflictException({
				message: `当前位置距离${target === 'origin' ? '上车点' : '目的地'}约 ${distanceMeters} 米，请确认是否仍要标记到达`,
				code: 'RIDE_ARRIVAL_TOO_FAR',
				distanceMeters,
				target,
			});
		}
	}

	private async transition(id: number, driverMemberId: number, from: any, to: any, data: Record<string, unknown>) {
		const trip = await this.ownedDriverTrip(id, driverMemberId);
		if (trip.status !== from) throw new ConflictException(`当前状态不能执行此操作（${trip.status}）`);
		const moved = await this.prisma.rideTrip.updateMany({ where: { id, driverMemberId, status: from, version: trip.version }, data: { ...data, status: to, version: { increment: 1 } } as any });
		if (!moved.count) throw new ConflictException('行程状态已变化，请刷新后重试');
		await this.prisma.orderTimeline.create({ data: { orderId: trip.orderId, event: 'RIDE_STATUS', value: to } });
		this.realtime.toMembers([trip.passengerMemberId, driverMemberId], 'ride:status', { id, status: to });
		return this.detail(id, { memberId: driverMemberId });
	}

	private async ownedDriverTrip(id: number, driverMemberId: number) {
		const trip = await this.prisma.rideTrip.findUnique({ where: { id }, include: { order: true } });
		if (!trip || trip.driverMemberId !== driverMemberId) throw new ForbiddenException('非当前司机无权操作该行程');
		return trip;
	}

	private async assertParticipant(id: number, memberId: number) {
		const trip = await this.prisma.rideTrip.findUnique({ where: { id } });
		if (!trip || (trip.passengerMemberId !== memberId && trip.driverMemberId !== memberId)) throw new ForbiddenException('无权访问该行程');
		return trip;
	}

	private async completeTrip(id: number) {
		const trip = await this.prisma.$transaction(async (tx) => {
			const current = await tx.rideTrip.findUniqueOrThrow({ where: { id } });
			await tx.rideTrip.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date(), version: { increment: 1 } } });
			await tx.order.update({ where: { id: current.orderId }, data: { status: 'FULFILLED', fulfillmentStatus: 'DONE' } });
			await tx.orderTimeline.createMany({ data: [
				{ orderId: current.orderId, event: 'RIDE_STATUS', value: 'COMPLETED' },
				{ orderId: current.orderId, event: 'FULFILLMENT', value: 'DONE' },
			] });
			return current;
		});
		await this.dispatch.restoreDriver(trip.driverMemberId);
	}

	private async settleFinalFare(input: { id: number; status: string; version: number; finalAmount: unknown; orderId: number; passengerMemberId: number; driverMemberId: number | null; order: { payAmount: unknown; no: string } }) {
		let trip = input;
		if (trip.status === 'FARE_PENDING') {
			const diffFen = Math.round((Number(trip.finalAmount || 0) - Number(trip.order.payAmount || 0)) * 100);
			if (diffFen < 0) {
				const moved = await this.prisma.rideTrip.updateMany({ where: { id: trip.id, status: 'FARE_PENDING', version: trip.version }, data: { status: 'REFUND_PENDING', version: { increment: 1 } } });
				if (moved.count) trip = await this.prisma.rideTrip.findUniqueOrThrow({ where: { id: trip.id }, include: { order: true } });
			} else if (diffFen > 0) {
				await this.prisma.$transaction(async (tx) => {
					const supplement = await tx.order.create({ data: {
						no: this.orderNo('RIDE_SUP'), type: 'RIDE', status: 'CREATED', fulfillmentStatus: 'PENDING', payStatus: 'UNPAID', totalAmount: diffFen / 100, payAmount: diffFen / 100,
						memberId: trip.passengerMemberId, paymentExpireAt: new Date(Date.now() + 15 * 60_000), paymentNote: `行程 ${trip.order.no} 补款`,
					} });
					const moved = await tx.rideTrip.updateMany({ where: { id: trip.id, status: 'FARE_PENDING', version: trip.version }, data: { status: 'SUPPLEMENT_PENDING', supplementOrderId: supplement.id, version: { increment: 1 } } });
					if (!moved.count) throw new ConflictException('费用状态已变化，请刷新后重试');
				});
				return;
			} else {
				await this.completeTrip(trip.id);
				return;
			}
		}
		if (trip.status === 'REFUND_PENDING') {
			if (await this.refund.reconcileRideRefund(trip.orderId)) return;
			const payAmount = Math.max(0, Number(trip.order.payAmount || 0));
			const targetRefundAmount = trip.finalAmount == null ? payAmount : Math.max(0, payAmount - Number(trip.finalAmount || 0));
			const order = await this.prisma.order.findUnique({ where: { id: trip.orderId }, select: { refundedAmount: true } });
			const pending = await this.prisma.refundRecord.aggregate({
				where: { orderId: trip.orderId, status: { in: ['PENDING', 'PROCESSING'] } },
				_sum: { amount: true },
			});
			const targetRefundFen = Math.max(0, Math.round(targetRefundAmount * 100));
			const refundedFen = Math.max(0, Math.round(Number(order?.refundedAmount || 0) * 100));
			const pendingFen = Math.max(0, Math.round(Number(pending._sum.amount || 0) * 100));
			const remainingRefundFen = Math.max(0, targetRefundFen - refundedFen - pendingFen);
			if (remainingRefundFen < 1) return;
			const amount = remainingRefundFen / 100;
			const result = await this.refund.createWechatRefund({ orderId: trip.orderId, amount, reason: trip.finalAmount == null ? '行程取消退款' : '行程最终费用低于预付金额' });
			if ((result as any)?.ok === false) throw new ConflictException('退款提交失败，系统将自动重试');
		}
	}

	private async runMaintenance() {
		try {
			const expired = await this.prisma.rideTrip.findMany({ where: { status: 'DISPATCHING', dispatchExpireAt: { lte: new Date() } }, include: { order: true }, take: 20 });
			for (const trip of expired) {
				const moved = await this.prisma.rideTrip.updateMany({ where: { id: trip.id, status: 'DISPATCHING', version: trip.version }, data: { status: 'NO_DRIVER', version: { increment: 1 } } });
				if (!moved.count) continue;
				await this.prisma.orderTimeline.create({ data: { orderId: trip.orderId, event: 'RIDE_STATUS', value: 'NO_DRIVER', remark: '派单超时' } });
				this.realtime.toMember(trip.passengerMemberId, 'ride:status', { id: trip.id, status: 'NO_DRIVER' });
				if (trip.order.payStatus === 'PAID') {
					await this.prisma.rideTrip.update({ where: { id: trip.id }, data: { status: 'REFUND_PENDING', version: { increment: 1 } } });
					try { await this.refund.createWechatRefund({ orderId: trip.orderId, reason: '派单超时无司机接单' }); } catch {}
				}
			}
			const retryableRefunds = await this.prisma.rideTrip.findMany({ where: { status: 'REFUND_PENDING', updatedAt: { lte: new Date(Date.now() - 60_000) } }, include: { order: true }, take: 10 });
			for (const trip of retryableRefunds) {
				const claimed = await this.prisma.rideTrip.updateMany({ where: { id: trip.id, status: 'REFUND_PENDING', version: trip.version }, data: { version: { increment: 1 } } });
				if (!claimed.count) continue;
				try { await this.settleFinalFare({ ...trip, version: trip.version + 1 }); } catch {}
			}
			const setting = await this.getSetting();
			const cutoff = new Date(Date.now() - Number(setting.chatRetentionDays || 30) * 86_400_000);
			await this.prisma.rideMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
		} catch {
			// 维护任务失败后下一轮重试。
		}
	}

	private tripInclude() {
		return {
			order: true,
			supplementOrder: true,
			passenger: { select: { id: true, name: true, phone: true, avatarUrl: true } },
			driverMember: { select: { id: true, name: true, avatarUrl: true } },
			driverEmployee: { select: { id: true, name: true, title: true } },
			vehicle: true,
			extraFees: { orderBy: { createdAt: 'asc' as const } },
			locations: { orderBy: { createdAt: 'desc' as const }, take: 1 },
		};
	}

	private async serializeTripWithFare(trip: any) {
		const serialized = this.serializeTrip(trip);
		serialized.fareDetails = await this.buildFareDetails(trip);
		return serialized;
	}

	private serializeTrip(trip: any) {
		const serialized = this.serialize(trip);
		if (serialized?.passenger) {
			// 行程响应只下发末两位用于遮罩展示；后四位核验始终在服务端完成。
			serialized.passenger.phoneLastFour = String(serialized.passenger.phone || '').slice(-2);
			delete serialized.passenger.phone;
		}
		return serialized;
	}

	private async buildFareDetails(trip: any) {
		const setting = await this.getSetting();
		let mode: 'ESTIMATED' | 'LIVE' | 'FINAL' = 'ESTIMATED';
		let distanceMeters = Number(trip.estimatedDistanceMeters || 0);
		let durationSeconds = Number(trip.estimatedDurationSeconds || 0);
		let feeRows: Array<{ type: string; amount: unknown }> = [];

		if (trip.finalAmount != null) {
			mode = 'FINAL';
			distanceMeters = Number(trip.finalDistanceMeters || 0);
			durationSeconds = Number(trip.finalDurationSeconds || 0);
			feeRows = Array.isArray(trip.extraFees) ? trip.extraFees : [];
		} else if (trip.startedAt) {
			mode = 'LIVE';
			const endAt = trip.arrivedDestinationAt || new Date();
			const locations = await this.prisma.rideLocation.findMany({
				where: { rideTripId: trip.id, createdAt: { gte: trip.startedAt, lte: endAt } },
				orderBy: { createdAt: 'asc' },
				select: { longitude: true, latitude: true },
			});
			distanceMeters = 0;
			for (let index = 1; index < locations.length; index += 1) {
				distanceMeters += this.distance(Number(locations[index - 1].latitude), Number(locations[index - 1].longitude), Number(locations[index].latitude), Number(locations[index].longitude));
			}
			distanceMeters = Math.round(distanceMeters);
			durationSeconds = Math.max(0, Math.round((endAt.getTime() - trip.startedAt.getTime()) / 1000));
		}

		const sumType = (type: string) => feeRows.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.amount || 0), 0);
		const tollAmount = mode === 'FINAL' ? sumType('TOLL') : Number(trip.estimatedTollAmount || 0);
		const parkingAmount = mode === 'FINAL' ? sumType('PARKING') : 0;
		const otherAmount = mode === 'FINAL' ? sumType('OTHER') + sumType('REVERSAL') : 0;
		const calculated = this.fare.calculate(setting, distanceMeters, durationSeconds, tollAmount + parkingAmount + otherAmount);
		const amount = mode === 'FINAL' ? Number(trip.finalAmount || 0) : mode === 'ESTIMATED' ? Number(trip.estimatedAmount || calculated.amount) : calculated.amount;
		const payAmount = Number(trip.order?.payAmount || 0);
		return {
			mode,
			distanceMeters,
			durationSeconds,
			...calculated,
			tollAmount: this.money(tollAmount),
			parkingAmount: this.money(parkingAmount),
			otherAmount: this.money(otherAmount),
			amount: this.money(amount),
			prepaidAmount: this.money(payAmount),
			supplementAmount: this.money(Math.max(0, amount - payAmount)),
			refundableAmount: this.money(Math.max(0, payAmount - amount)),
			refundedAmount: this.money(Number(trip.order?.refundedAmount || 0)),
		};
	}

	private serialize<T>(value: T): any {
		return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item));
	}

	private money(value: number) {
		return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
	}

	private orderNo(prefix: string) {
		const date = new Date();
		const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
		return `${prefix}${stamp}${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`;
	}

	private distance(lat1: number, lng1: number, lat2: number, lng2: number) {
		const rad = (value: number) => (value * Math.PI) / 180;
		const dLat = rad(lat2 - lat1);
		const dLng = rad(lng2 - lng1);
		const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
		return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}
}
