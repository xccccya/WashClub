import { applyDecorators, Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import {
	RideAvailabilityQueryDto,
	RideAdminListQueryDto,
	RideArrivalDto,
	RideCancelDto,
	RideCreateDto,
	RideDriverStatusDto,
	RideDriverVehicleCreateDto,
	RideDriverVehicleUpdateDto,
	RideFinalizeDto,
	RideListQueryDto,
	RideLocationDto,
	RideMessageCreateDto,
	RideMessageDto,
	RideMessageReadResultDto,
	RideMessageUnreadCountDto,
	RidePlaceQueryDto,
	RideReverseGeocodeQueryDto,
	RideRoutePreviewDto,
	RideSettingUpdateDto,
	RideStartDto,
} from './ride.dto.js';
import { RideAmapService } from './ride.amap.service.js';
import { RideDispatchService } from './ride.dispatch.service.js';
import { RideIdentityService } from './ride.identity.service.js';
import { RideLocationService } from './ride.location.service.js';
import { RideService } from './ride.service.js';

const RideOperation = (options: Parameters<typeof ApiOperation>[0]) => applyDecorators(
	ApiOperation(options),
	ApiOkResponse({ schema: { type: 'object', additionalProperties: true } }),
);

@ApiTags('rides')
@ApiBearerAuth()
@Controller('rides')
export class RideController {
	constructor(
		private readonly rides: RideService,
		private readonly identity: RideIdentityService,
		private readonly dispatch: RideDispatchService,
		private readonly location: RideLocationService,
		private readonly amap: RideAmapService,
	) {}

	@Get('availability')
	@RideOperation({ summary: '查询起点半径内的空闲和忙碌内部司机' })
	availability(@Headers() headers: Record<string, unknown>, @Query() query: RideAvailabilityQueryDto) {
		this.identity.memberId(headers);
		return this.dispatch.nearby(query);
	}

	@Get('places/tips')
	@RideOperation({ summary: '高德地点输入提示（服务端代理）' })
	places(@Headers() headers: Record<string, unknown>, @Query() query: RidePlaceQueryDto) {
		this.identity.memberId(headers);
		const origin = query.longitude != null && query.latitude != null ? { longitude: query.longitude, latitude: query.latitude } : undefined;
		return this.amap.inputTips(query.keywords, query.city, origin);
	}

	@Get('places/reverse')
	@RideOperation({ summary: '地图选点逆地理编码（服务端代理）' })
	reverseGeocode(@Headers() headers: Record<string, unknown>, @Query() query: RideReverseGeocodeQueryDto) {
		this.identity.memberId(headers);
		return this.amap.reverseGeocode(query.longitude, query.latitude);
	}

	@Post('routes/preview')
	@RideOperation({ summary: '预览行程路线和后端计价结果' })
	routePreview(@Headers() headers: Record<string, unknown>, @Body() dto: RideRoutePreviewDto) {
		this.identity.memberId(headers);
		return this.rides.routePreview(dto);
	}

	@Get('driver/profile')
	@RideOperation({ summary: '内部司机档案' })
	async driverProfile(@Headers() headers: Record<string, unknown>) {
		const memberId = this.identity.memberId(headers);
		const employee = await this.identity.enabledEmployee(memberId);
		return this.rides.driverProfile(memberId, employee);
	}

	@Patch('driver/status')
	@RideOperation({ summary: '切换内部司机空闲、忙碌或离线状态' })
	async driverStatus(@Headers() headers: Record<string, unknown>, @Body() dto: RideDriverStatusDto) {
		const memberId = this.identity.memberId(headers);
		const employee = await this.identity.enabledEmployee(memberId);
		return this.rides.setDriverStatus(memberId, employee.id, dto.status);
	}

	@Get('driver/orders')
	@RideOperation({ summary: '内部司机行程订单列表' })
	async driverOrders(@Headers() headers: Record<string, unknown>, @Query() query: RideListQueryDto) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.driverList(memberId, query);
	}

	@Get('driver/vehicles')
	@RideOperation({ summary: '内部司机的出车车辆' })
	async driverVehicles(@Headers() headers: Record<string, unknown>) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.driverVehicles(memberId);
	}

	@Post('driver/vehicles')
	@RideOperation({ summary: '内部司机新增或绑定账号已有车辆' })
	async createDriverVehicle(@Headers() headers: Record<string, unknown>, @Body() dto: RideDriverVehicleCreateDto) {
		const memberId = this.identity.memberId(headers);
		const employee = await this.identity.enabledEmployee(memberId);
		return this.rides.createDriverVehicle(memberId, employee.id, dto);
	}

	@Put('driver/vehicles/:id')
	@RideOperation({ summary: '内部司机编辑或选择自己的车辆' })
	async updateDriverVehicle(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number, @Body() dto: RideDriverVehicleUpdateDto) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.updateDriverVehicle(memberId, id, dto);
	}

	@Delete('driver/vehicles/:id')
	@RideOperation({ summary: '内部司机解绑未产生行程的出车车辆' })
	async deleteDriverVehicle(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.deleteDriverVehicle(memberId, id);
	}

	@Post('location')
	@RideOperation({ summary: '内部司机上报实时位置并刷新当前路线' })
	async reportLocation(@Headers() headers: Record<string, unknown>, @Body() dto: RideLocationDto) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.location.report(memberId, dto);
	}

	@Get('driver-contact/:driverMemberId')
	@RideOperation({ summary: '联系地图中在线忙碌司机' })
	busyDriverContact(@Headers() headers: Record<string, unknown>, @Param('driverMemberId', ParseIntPipe) driverMemberId: number) {
		this.identity.memberId(headers);
		return this.rides.busyDriverContact(driverMemberId);
	}

	@Post()
	@RideOperation({ summary: '创建待预付的行程订单' })
	create(@Headers() headers: Record<string, unknown>, @Body() dto: RideCreateDto) {
		return this.rides.create(this.identity.memberId(headers), dto);
	}

	@Get()
	@RideOperation({ summary: '乘客的行程订单列表' })
	list(@Headers() headers: Record<string, unknown>, @Query() query: RideListQueryDto) {
		return this.rides.passengerList(this.identity.memberId(headers), query);
	}

	@Post(':id/accept')
	@RideOperation({ summary: '内部司机原子抢单' })
	async accept(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.dispatch.accept(id, memberId);
	}

	@Post(':id/reject')
	@RideOperation({ summary: '内部司机拒绝本次派单' })
	async reject(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.dispatch.reject(id, memberId);
	}

	@Post(':id/arrive-pickup')
	@RideOperation({ summary: '司机到达乘客上车点' })
	async arrivePickup(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number, @Body() dto?: RideArrivalDto) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.arrivePickup(id, memberId, dto?.confirmFarAway);
	}

	@Post(':id/start')
	@RideOperation({ summary: '验证乘客手机号后四位并开始行程' })
	async start(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number, @Body() dto: RideStartDto) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.start(id, memberId, dto.phoneLastFour);
	}

	@Post(':id/arrive-destination')
	@RideOperation({ summary: '司机到达目的地' })
	async arriveDestination(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number, @Body() dto?: RideArrivalDto) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.arriveDestination(id, memberId, dto?.confirmFarAway);
	}

	@Post(':id/finalize')
	@RideOperation({ summary: '后端重算并确认最终车费' })
	async finalize(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number, @Body() dto: RideFinalizeDto) {
		const memberId = this.identity.memberId(headers);
		await this.identity.enabledEmployee(memberId);
		return this.rides.finalize(id, memberId, dto);
	}

	@Post(':id/cancel')
	@RideOperation({ summary: '乘客取消未开始行程' })
	cancel(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number, @Body() dto: RideCancelDto) {
		return this.rides.cancel(id, this.identity.memberId(headers), dto.reason);
	}

	@Get(':id/contact')
	@RideOperation({ summary: '获取当前行程另一参与人的联系信息' })
	contact(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		return this.rides.contact(id, this.identity.memberId(headers));
	}

	@Get(':id/messages')
	@ApiOperation({ summary: '读取当前行程聊天记录' })
	@ApiOkResponse({ type: RideMessageDto, isArray: true })
	messages(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		return this.rides.messages(id, this.identity.memberId(headers));
	}

	@Post(':id/messages')
	@ApiOperation({ summary: '发送行程聊天消息' })
	@ApiOkResponse({ type: RideMessageDto })
	sendMessage(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number, @Body() dto: RideMessageCreateDto) {
		return this.rides.sendMessage(id, this.identity.memberId(headers), dto);
	}

	@Get(':id/messages/unread-count')
	@ApiOperation({ summary: '读取当前行程聊天未读数' })
	@ApiOkResponse({ type: RideMessageUnreadCountDto })
	messageUnreadCount(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		return this.rides.messageUnreadCount(id, this.identity.memberId(headers));
	}

	@Post(':id/messages/read')
	@ApiOperation({ summary: '将当前行程中对方发送的消息标记为已读' })
	@ApiOkResponse({ type: RideMessageReadResultDto })
	markMessagesRead(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		return this.rides.markMessagesRead(id, this.identity.memberId(headers));
	}

	@Get(':id')
	@RideOperation({ summary: '乘客或当前司机读取行程详情' })
	detail(@Headers() headers: Record<string, unknown>, @Param('id', ParseIntPipe) id: number) {
		return this.rides.detail(id, { memberId: this.identity.memberId(headers) });
	}
}

@ApiTags('system-rides')
@ApiBearerAuth()
@Controller('system')
@UseGuards(AdminGuard)
export class RideAdminController {
	constructor(private readonly rides: RideService, private readonly identity: RideIdentityService) {}

	@Get('ride-settings')
	@RequirePerm('ride-settings')
	@RideOperation({ summary: '后台读取行程派单和计价配置' })
	setting() {
		return this.rides.getSetting();
	}

	@Put('ride-settings')
	@RequirePerm('ride-settings')
	@RideOperation({ summary: '后台更新行程派单和计价配置' })
	updateSetting(@Headers() headers: Record<string, unknown>, @Body() dto: RideSettingUpdateDto) {
		return this.rides.updateSetting(dto, this.identity.adminId(headers));
	}

	@Get('rides')
	@RequirePerm('ride-orders')
	@RideOperation({ summary: '后台行程订单监控' })
	list(@Query() query: RideAdminListQueryDto) {
		return this.rides.adminList(query);
	}

	@Get('rides/:id')
	@RequirePerm('ride-orders')
	@RideOperation({ summary: '后台行程订单详情' })
	detail(@Param('id', ParseIntPipe) id: number) {
		return this.rides.detail(id, { admin: true });
	}

	@Get('rides/:id/track')
	@RequirePerm('ride-orders')
	@RideOperation({ summary: '后台读取行程起终点、规划路线和实际轨迹' })
	track(@Param('id', ParseIntPipe) id: number) {
		return this.rides.adminTrack(id);
	}

	@Get('rides/:id/messages')
	@RequirePerm('ride-orders')
	@RideOperation({ summary: '后台读取行程聊天记录' })
	messages(@Param('id', ParseIntPipe) id: number) {
		return this.rides.adminMessages(id);
	}

	@Get('ride-drivers')
	@RequirePerm('ride-drivers')
	@RideOperation({ summary: '后台司机在线与可用状态监控' })
	drivers() {
		return this.rides.adminDrivers();
	}
}
