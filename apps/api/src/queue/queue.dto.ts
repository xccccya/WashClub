import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueueTaskResponseDto {
	@ApiProperty({ example: 1 })
	id!: number;

	@ApiProperty({ example: 0 })
	orderIndex!: number;

	@ApiProperty({ example: '外表清洗' })
	name!: string;

	@ApiProperty({ example: 10 })
	durationMin!: number;

	@ApiProperty({ enum: ['PENDING', 'DOING', 'DONE'], example: 'PENDING' })
	status!: string;
}

export class QueueTypeResponseDto {
	@ApiProperty({ example: 1 })
	id!: number;

	@ApiProperty({ example: '标准洗车' })
	name!: string;

	@ApiPropertyOptional({ nullable: true, example: '#2563eb' })
	displayColor?: string | null;
}

export class ManagedQueueMemberDto {
	@ApiProperty({ example: 1 })
	id!: number;

	@ApiProperty({ example: '会员' })
	name!: string;

	@ApiProperty({ example: '13800138000' })
	phone!: string;
}

export class ManagedQueueGroupDto {
	@ApiProperty({ example: 1 })
	id!: number;

	@ApiProperty({ example: '示例集团' })
	name!: string;
}

export class ManagedQueueVehicleDto {
	@ApiProperty({ example: 1 })
	id!: number;

	@ApiPropertyOptional({ nullable: true })
	brand?: string | null;

	@ApiPropertyOptional({ nullable: true })
	series?: string | null;

	@ApiPropertyOptional({ nullable: true })
	brandImage?: string | null;

	@ApiPropertyOptional({ type: ManagedQueueMemberDto, nullable: true })
	member?: ManagedQueueMemberDto | null;

	@ApiPropertyOptional({ type: ManagedQueueGroupDto, nullable: true })
	group?: ManagedQueueGroupDto | null;
}

export class ManagedQueueItemDto {
	@ApiProperty({ example: 1 })
	id!: number;

	@ApiProperty({ example: '川A12345' })
	plateNumber!: string;

	@ApiProperty({ example: false })
	guest!: boolean;

	@ApiProperty({ enum: ['IN_QUEUE', 'SERVING', 'COMPLETED'], example: 'IN_QUEUE' })
	status!: string;

	@ApiPropertyOptional({ nullable: true, example: 10 })
	orderId?: number | null;

	@ApiProperty({ example: -1 })
	currentTaskIndex!: number;

	@ApiPropertyOptional({ nullable: true, example: 1 })
	queueTypeId?: number | null;

	@ApiProperty({ type: () => [QueueTaskResponseDto] })
	tasks!: QueueTaskResponseDto[];

	@ApiPropertyOptional({ type: QueueTypeResponseDto, nullable: true })
	queueType?: QueueTypeResponseDto | null;

	@ApiPropertyOptional({ type: ManagedQueueVehicleDto, nullable: true })
	vehicle?: ManagedQueueVehicleDto | null;

	@ApiProperty({ example: 0 })
	aheadCount!: number;

	@ApiProperty({ example: 0 })
	aheadMinutes!: number;

	@ApiProperty({ example: 20 })
	remainingMinutes!: number;

	@ApiProperty({ example: false })
	excludedFromEta!: boolean;

	@ApiProperty({ example: true })
	etaConfigured!: boolean;

	@ApiProperty({ example: 0 })
	aheadMinutesEta!: number;

	@ApiProperty({ example: 20 })
	remainingMinutesEta!: number;
}

export class PublicQueueVehicleDto {
	@ApiPropertyOptional({ nullable: true })
	brand?: string | null;

	@ApiPropertyOptional({ nullable: true })
	series?: string | null;

	@ApiPropertyOptional({ nullable: true })
	brandImage?: string | null;
}

export class PublicQueueItemDto {
	@ApiProperty({ description: '队列展示 ID', example: 1 })
	id!: number;

	@ApiProperty({ description: '服务端已遮罩的车牌展示值', example: '川A***5' })
	displayPlate!: string;

	@ApiProperty({ enum: ['GUEST', 'MEMBER', 'GROUP'], example: 'MEMBER' })
	customerKind!: 'GUEST' | 'MEMBER' | 'GROUP';

	@ApiProperty({ enum: ['IN_QUEUE', 'SERVING'], example: 'IN_QUEUE' })
	status!: string;

	@ApiProperty({ example: -1 })
	currentTaskIndex!: number;

	@ApiPropertyOptional({ nullable: true, example: 1 })
	queueTypeId?: number | null;

	@ApiProperty({ type: () => [QueueTaskResponseDto] })
	tasks!: QueueTaskResponseDto[];

	@ApiPropertyOptional({ type: QueueTypeResponseDto, nullable: true })
	queueType?: QueueTypeResponseDto | null;

	@ApiPropertyOptional({ type: PublicQueueVehicleDto, nullable: true })
	vehicle?: PublicQueueVehicleDto | null;

	@ApiProperty({ example: 0 })
	aheadCount!: number;

	@ApiProperty({ example: 0 })
	aheadMinutes!: number;

	@ApiProperty({ example: 20 })
	remainingMinutes!: number;

	@ApiProperty({ example: false })
	excludedFromEta!: boolean;

	@ApiProperty({ example: true })
	etaConfigured!: boolean;

	@ApiProperty({ example: 0 })
	aheadMinutesEta!: number;

	@ApiProperty({ example: 20 })
	remainingMinutesEta!: number;
}

export class QueueSummaryDto {
	@ApiProperty({ example: 1 })
	servingCars!: number;

	@ApiProperty({ example: 2 })
	waitingCars!: number;
}

export class QueueEtaSummaryDto {
	@ApiProperty({ example: 1 })
	typeId!: number;

	@ApiProperty({ example: '标准洗车' })
	typeName!: string;

	@ApiPropertyOptional({ nullable: true })
	displayColor?: string | null;

	@ApiProperty({ example: true })
	etaConfigured!: boolean;

	@ApiProperty({ example: false })
	excludedFromEta!: boolean;

	@ApiPropertyOptional({ nullable: true, example: 15 })
	etaForNewCar!: number | null;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown, fallback = 0): number {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}

function nullableNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function nullableString(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	return String(value);
}

function mapTask(value: unknown): QueueTaskResponseDto {
	const task = asRecord(value);
	return {
		id: asNumber(task.id),
		orderIndex: asNumber(task.orderIndex),
		name: String(task.name || ''),
		durationMin: asNumber(task.durationMin),
		status: String(task.status || 'PENDING'),
	};
}

function mapQueueType(value: unknown): QueueTypeResponseDto | null {
	if (!value) return null;
	const queueType = asRecord(value);
	return {
		id: asNumber(queueType.id),
		name: String(queueType.name || ''),
		displayColor: nullableString(queueType.displayColor),
	};
}

function mapComputedFields(source: Record<string, unknown>) {
	return {
		aheadCount: asNumber(source.aheadCount),
		aheadMinutes: asNumber(source.aheadMinutes),
		remainingMinutes: asNumber(source.remainingMinutes),
		excludedFromEta: source.excludedFromEta === true,
		etaConfigured: source.etaConfigured === true,
		aheadMinutesEta: asNumber(source.aheadMinutesEta),
		remainingMinutesEta: asNumber(source.remainingMinutesEta),
	};
}

function maskPlateNumber(value: unknown): string {
	const plate = String(value || '').trim();
	if (!plate) return '-';
	if (plate.length <= 2) return `${plate.slice(0, 1)}*`;
	return `${plate.slice(0, 2)}***${plate.slice(-1)}`;
}

export function toManagedQueueItem(value: unknown): ManagedQueueItemDto {
	const source = asRecord(value);
	const vehicleSource = source.vehicle ? asRecord(source.vehicle) : null;
	const memberSource = vehicleSource?.member ? asRecord(vehicleSource.member) : null;
	const groupSource = vehicleSource?.group ? asRecord(vehicleSource.group) : null;
	const tasks = Array.isArray(source.tasks) ? source.tasks.map(mapTask) : [];
	return {
		id: asNumber(source.id),
		plateNumber: String(source.plateNumber || ''),
		guest: source.guest === true,
		status: String(source.status || 'IN_QUEUE'),
		orderId: nullableNumber(source.orderId),
		currentTaskIndex: asNumber(source.currentTaskIndex, -1),
		queueTypeId: nullableNumber(source.queueTypeId),
		tasks,
		queueType: mapQueueType(source.queueType),
		vehicle: vehicleSource ? {
			id: asNumber(vehicleSource.id),
			brand: nullableString(vehicleSource.brand),
			series: nullableString(vehicleSource.series),
			brandImage: nullableString(vehicleSource.brandImage),
			member: memberSource ? {
				id: asNumber(memberSource.id),
				name: String(memberSource.name || ''),
				phone: String(memberSource.phone || ''),
			} : null,
			group: groupSource ? {
				id: asNumber(groupSource.id),
				name: String(groupSource.name || ''),
			} : null,
		} : null,
		...mapComputedFields(source),
	};
}

export function toPublicQueueItem(value: unknown): PublicQueueItemDto {
	const source = asRecord(value);
	const vehicleSource = source.vehicle ? asRecord(source.vehicle) : null;
	const customerKind: PublicQueueItemDto['customerKind'] = vehicleSource?.group
		? 'GROUP'
		: (vehicleSource?.member ? 'MEMBER' : 'GUEST');
	const tasks = Array.isArray(source.tasks) ? source.tasks.map(mapTask) : [];
	return {
		id: asNumber(source.id),
		displayPlate: maskPlateNumber(source.plateNumber),
		customerKind,
		status: String(source.status || 'IN_QUEUE'),
		currentTaskIndex: asNumber(source.currentTaskIndex, -1),
		queueTypeId: nullableNumber(source.queueTypeId),
		tasks,
		queueType: mapQueueType(source.queueType),
		vehicle: vehicleSource ? {
			brand: nullableString(vehicleSource.brand),
			series: nullableString(vehicleSource.series),
			brandImage: nullableString(vehicleSource.brandImage),
		} : null,
		...mapComputedFields(source),
	};
}
