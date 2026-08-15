import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from '../auth/admin.guard.js';
import { AdminOrMemberGuard } from '../auth/admin-or-member.guard.js';
import { AuthController } from '../auth/auth.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { PERM_KEY } from '../auth/perm.decorator.js';
import { AdBannerController } from '../content/ad-banner.controller.js';
import { ScrollNoticeController } from '../content/scroll-notice.controller.js';
import { CouponGroupController } from '../coupon/group.controller.js';
import { MemberCategoryController } from '../member/category.controller.js';
import { MemberLevelController } from '../member/level.controller.js';
import { MemberTagController } from '../member/tag.controller.js';
import { QueueTypeController } from '../queue/queue-type.controller.js';
import { QueueController } from '../queue/queue.controller.js';
import { toPublicQueueItem } from '../queue/queue.dto.js';
import { QueueService } from '../queue/queue.service.js';
import { StoreCategoryController } from '../store/category.controller.js';
import { StoreProductController } from '../store/product.controller.js';

process.env.JWT_SECRET ||= 'test-only-p0-security-secret-32-bytes-minimum';

const GUARDS_METADATA = '__guards__';

function executionContext(
	headers: Record<string, string> = {},
	handler: Function = () => undefined,
	controller: Function = class TestController {},
): ExecutionContext {
	const request: { headers: Record<string, string>; user?: unknown } = { headers };
	return {
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => undefined,
			getNext: () => undefined,
		}),
		getHandler: () => handler,
		getClass: () => controller,
		getArgs: () => [request],
		getArgByIndex: () => request,
		switchToRpc: () => { throw new Error('not implemented'); },
		switchToWs: () => { throw new Error('not implemented'); },
		getType: () => 'http',
	} as unknown as ExecutionContext;
}

function handlerOf(controller: { prototype: object }, method: string): Function {
	const handler = (controller.prototype as Record<string, unknown>)[method];
	assert.equal(typeof handler, 'function', `${controller.constructor.name}.${method} 不存在`);
	return handler as Function;
}

test('换手机号接口无登录态时由现有 Bearer Guard 拒绝', async () => {
	const guard = new AdminOrMemberGuard({} as never, {} as never);
	await assert.rejects(
		guard.canActivate(executionContext()),
		(error: unknown) => error instanceof UnauthorizedException,
	);

	for (const method of ['sendChangePhoneCode', 'changePhone']) {
		const guards = Reflect.getMetadata(GUARDS_METADATA, handlerOf(AuthController, method)) as unknown[] | undefined;
		assert.ok(guards?.includes(AdminOrMemberGuard), `${method} 必须使用 AdminOrMemberGuard`);
	}
});

test('换手机号拒绝管理员身份，且 memberId 只取自 Guard 注入身份', async () => {
	const calls: Array<{ memberId: number; newPhone: string }> = [];
	const service = {
		changeMemberPhoneByCode: async (memberId: number, newPhone: string) => {
			calls.push({ memberId, newPhone });
			return { ok: true };
		},
	};
	const controller = new AuthController(service as unknown as AuthService);
	const dto = { newPhone: '13900139000', oldPhoneCode: '123456', newPhoneCode: '654321' };

	assert.throws(
		() => controller.changePhone({ user: { kind: 'admin', id: 1 } }, dto),
		(error: unknown) => error instanceof ForbiddenException,
	);

	await controller.changePhone(
		{ user: { kind: 'member', memberId: 42 } },
		{ ...dto, memberId: 999, oldPhone: '13700137000' } as typeof dto,
	);
	assert.deepEqual(calls, [{ memberId: 42, newPhone: dto.newPhone }]);
});

type MemberRow = { id: number; phone: string };
type SmsRow = {
	id: number;
	phone: string;
	code: string;
	purpose: string;
	expiresAt: Date;
	usedAt: Date | null;
	createdAt: Date;
};
type FakeState = { members: MemberRow[]; smsCodes: SmsRow[] };

function cloneState(state: FakeState): FakeState {
	return {
		members: state.members.map((row) => ({ ...row })),
		smsCodes: state.smsCodes.map((row) => ({
			...row,
			expiresAt: new Date(row.expiresAt),
			usedAt: row.usedAt ? new Date(row.usedAt) : null,
			createdAt: new Date(row.createdAt),
		})),
	};
}

function conditionMatches(value: unknown, condition: unknown): boolean {
	if (!condition || typeof condition !== 'object' || condition instanceof Date) return Object.is(value, condition);
	const rule = condition as Record<string, unknown>;
	if (Array.isArray(rule.in) && !rule.in.includes(value)) return false;
	if (typeof rule.startsWith === 'string' && !String(value || '').startsWith(rule.startsWith)) return false;
	if (rule.gt instanceof Date && (!(value instanceof Date) || value <= rule.gt)) return false;
	if (rule.gte instanceof Date && (!(value instanceof Date) || value < rule.gte)) return false;
	return true;
}

function rowMatches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => conditionMatches(row[key], condition));
}

type FakeClientOptions = {
	failMemberUpdate?: boolean;
};

function fakeClient(state: FakeState, options: FakeClientOptions = {}) {
	return {
		member: {
			findUnique: async ({ where }: { where: { id?: number; phone?: string } }) => {
				const row = state.members.find((item) => where.id !== undefined ? item.id === where.id : item.phone === where.phone);
				return row ? { ...row } : null;
			},
			update: async ({ where, data }: { where: { id: number }; data: Partial<MemberRow> }) => {
				if (options.failMemberUpdate) throw new Error('simulated transaction failure');
				const row = state.members.find((item) => item.id === where.id);
				if (!row) throw new Error('member not found');
				Object.assign(row, data);
				return { ...row };
			},
		},
		smsCode: {
			findFirst: async ({ where }: { where: Record<string, unknown> }) => {
				const row = state.smsCodes
					.filter((item) => rowMatches(item as unknown as Record<string, unknown>, where))
					.sort((left, right) => right.id - left.id)[0];
				return row ? { ...row } : null;
			},
			updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<SmsRow> }) => {
				let count = 0;
				for (const row of state.smsCodes) {
					if (!rowMatches(row as unknown as Record<string, unknown>, where)) continue;
					Object.assign(row, data);
					count += 1;
				}
				return { count };
			},
		},
	};
}

function fakePrisma(state: FakeState, transactionOptions: FakeClientOptions = {}) {
	const client = fakeClient(state);
	return {
		...client,
		$transaction: async (operation: unknown) => {
			if (Array.isArray(operation)) return Promise.all(operation);
			if (typeof operation !== 'function') throw new Error('unsupported transaction');
			const draft = cloneState(state);
			const result = await (operation as (tx: ReturnType<typeof fakeClient>) => Promise<unknown>)(fakeClient(draft, transactionOptions));
			state.members.splice(0, state.members.length, ...draft.members);
			state.smsCodes.splice(0, state.smsCodes.length, ...draft.smsCodes);
			return result;
		},
	};
}

type AuthServiceInternals = {
	changePhonePurpose(memberId: number, stage: 'old' | 'new'): string;
	encodeChangePhoneCode(code: string, attempts?: number): string;
	hashChangePhoneCode(salt: string, code: string): string;
	parseStoredChangePhoneCode(value: string): {
		version: 'v1';
		attempts: number;
		salt: string;
		digest: string;
	} | null;
	matchesStoredChangePhoneCode(
		record: { version: 'v1'; attempts: number; salt: string; digest: string },
		code: string,
	): boolean;
	verifyChangePhoneCode(memberId: number, stage: 'old' | 'new', phone: string, code: string): Promise<unknown>;
};

function authFixture(options: { failMemberUpdateInTransaction?: boolean } = {}) {
	const now = Date.now();
	const state: FakeState = {
		members: [
			{ id: 7, phone: '13800138000' },
			{ id: 8, phone: '13700137000' },
		],
		smsCodes: [],
	};
	const prisma = fakePrisma(state, { failMemberUpdate: options.failMemberUpdateInTransaction });
	const service = new AuthService(prisma as never, {} as never, {} as never, {} as never);
	const internals = service as unknown as AuthServiceInternals;
	const oldCode = '123456';
	const newCode = '654321';
	state.smsCodes.push(
		{
			id: 1,
			phone: state.members[0].phone,
			code: internals.encodeChangePhoneCode(oldCode),
			purpose: internals.changePhonePurpose(7, 'old'),
			expiresAt: new Date(now + 60_000),
			usedAt: null,
			createdAt: new Date(now),
		},
		{
			id: 2,
			phone: '13900139000',
			code: internals.encodeChangePhoneCode(newCode),
			purpose: internals.changePhonePurpose(7, 'new'),
			expiresAt: new Date(now + 60_000),
			usedAt: null,
			createdAt: new Date(now),
		},
	);
	return { state, service, internals, oldCode, newCode };
}

test('换号验证码绑定会员，其他会员不能复用', async () => {
	const { state, service, oldCode, newCode } = authFixture();
	await assert.rejects(service.changeMemberPhoneByCode(8, '13900139000', oldCode, newCode));
	assert.equal(state.members.find((member) => member.id === 8)?.phone, '13700137000');
	assert.ok(state.smsCodes.every((code) => code.usedAt === null));
});

test('错误验证码持久化尝试次数，并在第五次后失效', async () => {
	const { state, internals, oldCode } = authFixture();
	for (let attempt = 1; attempt <= 5; attempt++) {
		await assert.rejects(internals.verifyChangePhoneCode(7, 'old', '13800138000', '000000'));
		assert.equal(Number(state.smsCodes[0].code.split('$')[1]), attempt);
	}
	assert.ok(state.smsCodes[0].usedAt instanceof Date);
	await assert.rejects(internals.verifyChangePhoneCode(7, 'old', '13800138000', oldCode));
});

test('换号验证码使用服务端密钥摘要，明文和篡改值均不能通过', () => {
	const { internals, oldCode } = authFixture();
	const encoded = internals.encodeChangePhoneCode(oldCode);
	assert.equal(encoded.includes(oldCode), false);
	const parsed = internals.parseStoredChangePhoneCode(encoded);
	assert.ok(parsed);
	assert.equal(internals.matchesStoredChangePhoneCode(parsed, oldCode), true);

	const flipLastHex = (value: string) => `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
	assert.equal(internals.matchesStoredChangePhoneCode({ ...parsed, salt: flipLastHex(parsed.salt) }, oldCode), false);
	assert.equal(internals.matchesStoredChangePhoneCode({ ...parsed, digest: flipLastHex(parsed.digest) }, oldCode), false);

	const originalSecret = process.env.JWT_SECRET;
	const originalDigest = internals.hashChangePhoneCode(parsed.salt, oldCode);
	try {
		process.env.JWT_SECRET = `${originalSecret}:different-test-secret`;
		assert.notEqual(internals.hashChangePhoneCode(parsed.salt, oldCode), originalDigest);
	} finally {
		process.env.JWT_SECRET = originalSecret;
	}
});

test('正确验证码必须赢得原子 CAS 才能通过', async () => {
	const { state, oldCode } = authFixture();
	const record = { ...state.smsCodes[0] };
	let updateAttempts = 0;
	const service = new AuthService({
		smsCode: {
			findFirst: async () => ({ ...record }),
			updateMany: async () => {
				updateAttempts += 1;
				return { count: 0 };
			},
		},
	} as never, {} as never, {} as never, {} as never);
	const internals = service as unknown as AuthServiceInternals;

	await assert.rejects(
		internals.verifyChangePhoneCode(7, 'old', record.phone, oldCode),
		(error: unknown) => error instanceof UnauthorizedException,
	);
	assert.equal(updateAttempts, 6);
});

test('双验证码成功只能更新一次，并发重放只有一个请求成功', async () => {
	const { state, service, oldCode, newCode } = authFixture();
	const results = await Promise.allSettled([
		service.changeMemberPhoneByCode(7, '13900139000', oldCode, newCode),
		service.changeMemberPhoneByCode(7, '13900139000', oldCode, newCode),
	]);
	assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
	assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
	assert.equal(state.members.find((member) => member.id === 7)?.phone, '13900139000');
	assert.ok(state.smsCodes.every((code) => code.usedAt instanceof Date));
	await assert.rejects(service.changeMemberPhoneByCode(7, '13900139000', oldCode, newCode));
});

test('双码消费后的事务失败会回滚手机号和 usedAt', async () => {
	const { state, service, oldCode, newCode } = authFixture({ failMemberUpdateInTransaction: true });
	await assert.rejects(
		service.changeMemberPhoneByCode(7, '13900139000', oldCode, newCode),
		/simulated transaction failure/,
	);
	assert.equal(state.members.find((member) => member.id === 7)?.phone, '13800138000');
	assert.ok(state.smsCodes.every((code) => code.usedAt === null));
});

const protectedHandlers: Array<[controller: { prototype: object }, method: string, permission: string | undefined]> = [
	[AdBannerController, 'list', 'content-banners'],
	[AdBannerController, 'create', 'content-banners'],
	[AdBannerController, 'update', 'content-banners'],
	[AdBannerController, 'remove', 'content-banners'],
	[AdBannerController, 'setEnable', 'content-banners'],
	[ScrollNoticeController, 'list', 'content-notices'],
	[ScrollNoticeController, 'create', 'content-notices'],
	[ScrollNoticeController, 'update', 'content-notices'],
	[ScrollNoticeController, 'remove', 'content-notices'],
	[ScrollNoticeController, 'enable', 'content-notices'],
	[CouponGroupController, 'list', undefined],
	[CouponGroupController, 'create', 'coupon-groups'],
	[CouponGroupController, 'update', 'coupon-groups'],
	[CouponGroupController, 'remove', 'coupon-groups'],
	[MemberCategoryController, 'list', undefined],
	[MemberCategoryController, 'create', 'member-categories'],
	[MemberCategoryController, 'update', 'member-categories'],
	[MemberCategoryController, 'remove', 'member-categories'],
	[MemberLevelController, 'create', 'member-levels'],
	[MemberLevelController, 'update', 'member-levels'],
	[MemberLevelController, 'remove', 'member-levels'],
	[MemberLevelController, 'getGrowthConfig', 'member-levels'],
	[MemberLevelController, 'saveGrowthConfig', 'member-levels'],
	[MemberTagController, 'list', undefined],
	[MemberTagController, 'create', 'member-tags'],
	[MemberTagController, 'update', 'member-tags'],
	[MemberTagController, 'remove', 'member-tags'],
	[MemberTagController, 'members', 'member-tags'],
	[QueueTypeController, 'list', 'service-queue'],
	[QueueTypeController, 'create', 'service-queue'],
	[QueueTypeController, 'update', 'service-queue'],
	[QueueTypeController, 'remove', 'service-queue'],
	[QueueTypeController, 'setSteps', 'service-queue'],
	[QueueTypeController, 'setProducts', 'service-queue'],
	[StoreCategoryController, 'create', 'store-categories'],
	[StoreCategoryController, 'update', 'store-categories'],
	[StoreCategoryController, 'remove', 'store-categories'],
	[StoreProductController, 'create', 'store-products'],
	[StoreProductController, 'update', 'store-products'],
	[StoreProductController, 'remove', 'store-products'],
	[StoreProductController, 'uploadImage', 'store-products'],
	[QueueController, 'manageList', 'service-queue'],
	[QueueController, 'add', 'service-queue'],
	[QueueController, 'createServiceOrderAndEnqueue', 'service-queue'],
	[QueueController, 'setCurrent', 'service-queue'],
	[QueueController, 'finishTask', 'service-queue'],
	[QueueController, 'confirmComplete', 'service-queue'],
	[QueueController, 'startFirst', 'service-queue'],
	[QueueController, 'remove', 'service-queue'],
];

test('所有 P0 管理 handler 均使用 AdminGuard 和仓库真实权限键', () => {
	for (const [controller, method, permission] of protectedHandlers) {
		const handler = handlerOf(controller, method);
		const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined;
		assert.ok(guards?.includes(AdminGuard), `${controller.constructor.name}.${method} 缺少 AdminGuard`);
		assert.equal(Reflect.getMetadata(PERM_KEY, handler), permission, `${controller.constructor.name}.${method} 权限键错误`);
	}
});

test('管理写接口无 token 为 401，有登录态但缺权限为 403', async () => {
	const handler = handlerOf(StoreProductController, 'create');
	const noLoginGuard = new AdminGuard({} as never, {} as never, new Reflector());
	await assert.rejects(
		noLoginGuard.canActivate(executionContext({}, handler, StoreProductController)),
		(error: unknown) => error instanceof UnauthorizedException,
	);

	const missingPermissionGuard = new AdminGuard(
		{ verify: () => ({ type: 'admin', sub: 1 }) } as never,
		{
			user: {
				findUnique: async () => ({
					id: 1,
					roleId: 2,
					role: 'admin',
					phone: '13800138000',
					name: 'test',
					roleRef: { enabled: true, permissions: [] },
				}),
			},
		} as never,
		new Reflector(),
	);
	await assert.rejects(
		missingPermissionGuard.canActivate(executionContext({ authorization: 'Bearer test-token' }, handler, StoreProductController)),
		(error: unknown) => error instanceof ForbiddenException,
	);
});

test('公开队列 mapper 不返回手机号、密码、openId、VIN、订单号或完整车牌', () => {
	const publicItem = toPublicQueueItem({
		id: 1,
		plateNumber: '川A12345',
		orderId: 999,
		memberId: 7,
		groupId: 8,
		status: 'IN_QUEUE',
		currentTaskIndex: 0,
		tasks: [{ id: 1, name: '清洗', orderIndex: 0, durationMin: 10, status: 'DOING' }],
		vehicle: {
			id: 5,
			vin: 'VIN-SENSITIVE-SENTINEL',
			brand: '示例品牌',
			series: '示例车系',
			member: {
				id: 7,
				phone: 'PHONE-SENSITIVE-SENTINEL',
				password: 'PASSWORD-SENSITIVE-SENTINEL',
				weixinOpenId: 'OPENID-SENSITIVE-SENTINEL',
			},
			group: null,
		},
	});
	const serialized = JSON.stringify(publicItem);
	for (const sensitiveValue of [
		'川A12345',
		'VIN-SENSITIVE-SENTINEL',
		'PHONE-SENSITIVE-SENTINEL',
		'PASSWORD-SENSITIVE-SENTINEL',
		'OPENID-SENSITIVE-SENTINEL',
	]) {
		assert.ok(!serialized.includes(sensitiveValue), `公开响应泄露 ${sensitiveValue}`);
	}
	for (const sensitiveKey of ['plateNumber', 'orderId', 'memberId', 'groupId', 'member', 'group', 'phone', 'password', 'weixinOpenId', 'vin']) {
		assert.ok(!serialized.includes(`\"${sensitiveKey}\"`), `公开响应包含敏感键 ${sensitiveKey}`);
	}
	assert.equal(publicItem.displayPlate, '川A***5');
});

test('公开队列查询只读取进行中状态和最小身份字段', async () => {
	let query: Record<string, unknown> | undefined;
	const service = new QueueService(
		{
			serviceQueueItem: {
				findMany: async (args: Record<string, unknown>) => {
					query = args;
					return [];
				},
			},
		} as never,
		{} as never,
		{} as never,
		{} as never,
	);
	assert.deepEqual(await service.listPublic(), []);
	const where = query?.where as { status?: { in?: string[] } } | undefined;
	assert.deepEqual(where?.status?.in, ['IN_QUEUE', 'SERVING']);
	const select = query?.select as Record<string, unknown> | undefined;
	assert.equal(select?.orderId, undefined);
	const vehicleSelect = ((select?.vehicle as { select?: Record<string, unknown> })?.select || {});
	const memberSelect = ((vehicleSelect.member as { select?: Record<string, unknown> })?.select || {});
	assert.deepEqual(Object.keys(memberSelect), ['id']);
});
