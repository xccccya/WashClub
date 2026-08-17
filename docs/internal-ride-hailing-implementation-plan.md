# 内部“呼叫司机 / 内部司机”功能完整落地计划

> 文档状态：2026-08-17 已完成固定自定义预付及司机线下差额确认实现；新增 migration 尚未应用。真实高德、微信支付/退款、后台定位与真机流程仍须在目标环境验收。
>
> 目标：在现有 WashClub 一体化洗车系统中，快速上线一个仅供公司内部使用的乘客端和司机端行程功能。
>
> 术语约定：用户可见文案必须使用“呼叫司机”“内部司机”“行程订单”；后端代码可以使用 `ride`、`driver`、`passenger` 等英文标识。

## 1. 已确认的产品决策

| 项目 | 最终决定 |
|---|---|
| 司机权限 | 启用状态的员工可以进入“内部司机”；后端必须再次校验员工身份，不能只依赖前端隐藏入口 |
| 派单范围 | 后台配置订单起点半径，默认 3,000 米；向范围内符合条件的空闲司机广播 |
| 派单超时 | 后台配置，默认 90 秒；超时进入无司机状态并全额退款 |
| 计价规则 | 后台配置起步价、起步包含公里数、起步包含时间、每公里价格、每分钟价格、最低价、停车费开关、其他费用开关 |
| 支付结算 | 默认线上预付预估车费；后台可启用最低 ¥0.01 的固定线上预付。固定预付行程的最终差额可由司机确认线下付清，也可继续创建线上补款订单；低于线上预付时只退线上差额 |
| 导航 | 司机端不提供语音导航和外部导航，只绘制路线；司机位置每 5 秒更新，并重新计算、绘制到乘客起点或终点的路线 |
| 定位 | 行程中持续上报位置；微信小程序使用后台定位能力，必须补充隐私声明、权限申请和真机验证 |
| 司机忙碌状态 | `BUSY` 可以由司机在没有订单时主动打开，不等同于一定存在订单；忙碌司机可在乘客端地图显示并被联系 |
| 空闲司机校验 | 乘客叫车前必须检查乘客起点 3km 内是否存在在线且空闲司机；没有则禁止创建订单 |
| 忙碌司机联系 | 无空闲司机时允许查看地图中的忙碌司机并拨打电话/在线联系；第一版不绕过空闲校验直接创建订单，司机愿意接驾时先切换为空闲，乘客重新叫车 |
| 车辆 | 复用现有会员车辆；司机可以新增、编辑、删除自己的车辆并选择出车车辆。后续可通过绑定表支持集团车辆 |
| 车型数据 | 复用现有探数车型品牌、车系接口和图片填充逻辑，前端不得直连探数 |
| 在线联系 | 复用现有 WebSocket 连接，新增行程聊天事件；聊天记录保留时长后台可配置，默认 30 天 |

## 2. 最佳总体架构

采用“现有订单主表 + 独立行程领域”的方案：

```text
Order(type=RIDE)
  └── RideTrip
        ├── 司机与车辆
        ├── 起点、终点、路线快照
        ├── 行程状态机
        ├── 费用与结算
        ├── 实时位置
        └── 行程聊天
```

不要把行程订单直接伪装成现有 `SERVICE` 洗车订单。现有 `SERVICE` 与洗车队列、洗车卡、服务履约强耦合，直接复用会导致行程进入洗车业务流程。

可以复用：

- `Order` 主表的订单号、会员归属、支付、退款、订单时间线。
- 现有微信 JSAPI 预支付能力。
- 现有订单列表、订单详情和全部订单入口。
- 会员车辆、探数车型接口和文件图片绑定。
- 现有员工身份查询和 WebSocket 基础连接。

需要新增：

- `RIDE` 订单类型。
- `RideTrip` 行程模型。
- 司机状态、司机车辆绑定、位置、费用、聊天模型。
- 行程专属控制器、服务、状态机、派单和计价服务。
- 小程序独立视觉页面。
- 后台计价和行程运营配置。

## 3. 小程序页面规划

新增页面：

```text
apps/miniapp-uni/src/pages/ride/call-driver/index.vue
apps/miniapp-uni/src/pages/ride/driver/index.vue
apps/miniapp-uni/src/pages/ride/orders/index.vue
apps/miniapp-uni/src/pages/ride/detail/index.vue
apps/miniapp-uni/src/pages/ride/fare-confirm/index.vue
```

修改页面：

```text
apps/miniapp-uni/src/pages/me/index.vue
apps/miniapp-uni/src/pages/order/index.vue
apps/miniapp-uni/src/pages/order/detail.vue
apps/miniapp-uni/src/pages.json
```

### 3.1 “呼叫司机”页面

- 全屏地图 + 顶部状态栏 + 底部抽屉。
- 显示当前定位、空闲司机数量、忙碌司机标记。
- 起点和终点地址输入支持输入提示、POI 选择、地图回填。
- 起点变更后调用后端检查半径内空闲司机。
- 没有空闲司机时禁止叫车，提示：`3km内无司机，请查看地图在线/忙碌司机，手动联系其是否愿意接驾`。
- 可查看忙碌司机位置、车辆简要信息、拨打电话和在线联系。
- 有空闲司机时允许路线预览、手动选择路线、查看收费路段和预估价格。
- 支付完成后进入等待接单、司机前往、到达、行程中、费用结算等状态。

### 3.2 “内部司机”页面

- 只有启用员工可进入。
- 地图为主视图，顶部显示空闲/忙碌/离线状态。
- `BUSY` 是司机主动设置的接单可用性状态，不要求当前存在订单。
- 显示出车车辆和车辆管理入口。
- 显示新订单弹窗和订单列表。
- 接单后显示乘客信息、起点、终点、路线和费用。
- 司机位置每 5 秒上报一次。
- 每次位置更新后重新计算路线并绘制：
  - 前往乘客起点时：司机当前位置 -> 乘客起点。
  - 已开始行程后：司机当前位置/乘客起点 -> 乘客终点。
- 不提供语音导航，不调用外部地图导航。
- 提供滑动操作：到达上车点、开始订单、到达目的地、确认费用。
- 开始订单必须验证乘客手机号后四位。

### 3.3 行程订单入口

- “呼叫司机”页面有“行程订单”入口。
- “内部司机”页面有“行程订单”入口。
- 现有 `/pages/order/index` 增加“行程订单”分类。
- 现有“全部订单”必须包含 `RIDE`。
- 行程详情使用独立的行程展示样式，但仍可从原订单详情入口打开。

## 4. 数据库设计

### 4.1 新增枚举

```prisma
enum OrderType {
  SERVICE
  SP
  FK
  RIDE
}

enum RideDriverAvailability {
  OFFLINE
  AVAILABLE
  BUSY
}

enum RideTripStatus {
  CREATED
  PREPAY_PENDING
  DISPATCHING
  ACCEPTED
  TO_PICKUP
  ARRIVED_PICKUP
  IN_TRIP
  ARRIVED_DESTINATION
  FARE_PENDING
  SUPPLEMENT_PENDING
  COMPLETED
  CANCELLED
  NO_DRIVER
  REFUND_PENDING
}
```

### 4.2 `RideTrip`

建议字段：

- `id`、`orderId`，订单与行程一对一。
- `driverMemberId`、`driverEmployeeId`、`vehicleId`。
- `status`、`version`、`dispatchExpireAt`。
- 起点经纬度、地址、POI ID、坐标系。
- 终点经纬度、地址、POI ID、坐标系。
- 选中路线 JSON 快照。
- 预估距离、预估时间、预估高速费、预估金额、固定预付模式快照。
- 最终距离、最终时间、最终费用、司机确认的线下差额金额与确认时间。
- 到达起点、开始订单、到达终点、完成时间。
- 乘客手机号后四位验证时间。
- 取消原因和操作人。

所有金额使用 Decimal，单位为元；高德距离使用米、时间使用秒；前端传入的路线和金额只能作为展示参数，后端必须重新校验。

### 4.3 `RideDriverProfile`

建议字段：

- `memberId` 唯一。
- `employeeId`。
- `availabilityStatus`：空闲、忙碌、离线。
- `busyReason`：司机手动忙碌、订单忙碌。
- `currentVehicleId`。
- 最新经纬度、方向、速度、水平精度。
- `lastLocationAt`、`lastHeartbeatAt`。
- `previousManualStatus`，用于订单结束后恢复司机原来的手动状态。

司机接单时可以自动进入订单忙碌；行程结束后，如果司机原先手动设置为忙碌，则恢复忙碌，否则恢复空闲。

轨迹记录使用 `RideLocation` 保存经纬度、方向、速度、水平精度、客户端采样时间、客户端幂等点 ID 和来源。轨迹处理规则如下：

- 服务端优先按客户端采样时间排序，缺失时再使用服务端创建时间，避免断网补传打乱轨迹。
- 水平精度超过 80 米、设备报告速度异常、相邻点推算速度异常和低速小范围漂移点不参与计费与地图展示；原始点仍保留用于审计。
- 小程序先把定位点持久化到本地队列，每批最多补传 100 点；同一个客户端点 ID 重试不会重复入库，超过服务端补传窗口的旧点会在发送前清理，避免阻塞后续新点。
- 开始载客和到达目的地时，服务端把司机最新有效位置分别写入 `START_ANCHOR`、`END_ANCHOR`，并与状态迁移放在同一个事务中。
- 最终里程、实时计价和后台轨迹共用同一套清洗算法；有效点不足两个时，最终结算回退到预估距离。

### 4.4 司机车辆绑定

新增 `RideDriverVehicle`：

- `driverMemberId`
- `vehicleId`
- `enabled`
- `displayName`

会员车辆可直接绑定。集团车辆后续通过同一张绑定表授权给司机，不能改变现有 `Vehicle.memberId`/`groupId` 业务含义。

### 4.5 计价配置

建议单行配置模型 `RideSetting`：

- `dispatchRadiusMeters`，默认 3000。
- `dispatchTimeoutSeconds`，默认 90。
- `baseFare`。
- `includedDistanceKm`。
- `includedDurationMinutes`。
- `pricePerKm`。
- `pricePerMinute`。
- `minimumFare`。
- `customPrepayEnabled`，是否启用固定线上预付。
- `customPrepayAmount`，启用时的固定线上预付金额，最低 ¥0.01。
- `allowParkingFee`。
- `allowOtherFee`。
- `chatRetentionDays`，默认 30。
- `locationIntervalSeconds`，固定默认 5，必要时后台可配置但不得低于平台安全阈值。

过路费由高德路线结果提供预估值，停车费和其他费用由司机在费用确认页面添加，并根据配置开关决定是否允许。固定预付配置只影响新建行程：订单 `totalAmount` 保留预估车费，`payAmount` 仅记录实际线上预付，避免线上收入、退款和后续统计混入线下差额。

### 4.6 费用流水和聊天

`RideExtraFee`：

- 过路费、停车费、其他费用。
- 金额、备注、创建人、创建时间。
- 不允许修改已确认的费用，只能追加冲正或审计记录。

`RideMessage`：

- 行程 ID、发送人会员 ID、消息内容、创建时间、已读时间。
- 只允许行程乘客、当前司机和受授权后台人员读取。
- 根据后台配置定期清理过期记录。

## 5. 行程状态机和并发规则

```text
CREATED
  -> PREPAY_PENDING
  -> DISPATCHING
  -> ACCEPTED
  -> TO_PICKUP
  -> ARRIVED_PICKUP
  -> IN_TRIP
  -> ARRIVED_DESTINATION
  -> FARE_PENDING
  -> COMPLETED
```

异常路径：

```text
PREPAY_PENDING -> CANCELLED
DISPATCHING -> NO_DRIVER -> REFUND_PENDING
任意未开始状态 -> CANCELLED
FARE_PENDING -> SUPPLEMENT_PENDING -> COMPLETED
```

关键并发规则：

1. 司机接单使用带状态条件的原子更新或事务行锁：只有一个司机能成功。
2. 司机切换状态时必须检查是否存在未完成行程。
3. 乘客创建订单时，后端再次检查起点半径内有空闲司机。
4. 司机位置必须满足最新时间窗口，否则不能被判定为在线空闲。
5. 支付回调、取消、退款、补款、完成行程都必须幂等。
6. 状态操作必须校验当前状态，不能通过接口顺序跳跃。
7. `BUSY` 不参与自动派单，但可以显示在地图并接受联系。

## 6. 3km 空闲司机检测

乘客选择起点后执行：

```text
起点坐标
  -> 后端读取 RideSetting.dispatchRadiusMeters
  -> 查询 enabled 员工司机
  -> status = AVAILABLE
  -> lastLocationAt 在有效窗口内
  -> 计算司机与起点的球面距离
  -> 返回空闲数量、空闲司机摘要、忙碌司机标记
```

默认半径为 3,000 米，后台可改为其他米数。

前端检测只用于即时提示，创建订单接口必须再次执行同样校验，避免绕过前端直接下单。

无空闲司机时：

- 不创建订单。
- 不调用微信支付。
- 地图显示在线忙碌司机。
- 支持拨打电话和在线联系。
- 忙碌司机愿意接驾时，先切换为空闲，再由乘客重新叫车。

## 7. 高德地图实现方案

### 7.1 H5：高德 JSAPI v2.0

H5 使用 `@amap/amap-jsapi-loader`，负责：

- 地图实例。
- Marker 和车辆图标。
- Polyline。
- 地图视野调整。
- H5 端地图交互。

加载前必须设置安全配置；`AMapLoader.load().then()` 回调第一行设置：

```ts
AMap.getConfig().appname = 'amap-jsapi-skill';
```

生产环境使用 `serviceHost` 代理，安全密钥只放服务端；组件卸载时调用 `map.destroy()`。

### 7.2 微信小程序：不使用 JSAPI 也可以绘制

微信小程序使用原生 `map` 组件绘制地图，路线绘制不是由高德 JSAPI 完成，而是：

```text
高德 Web Service / AMapWX
  -> 返回路线 polyline 坐标串
  -> 解析为微信 map 组件要求的 points
  -> 通过 polyline 属性绘制路线
  -> 通过 markers 属性绘制起点、终点、司机位置
```

示意数据结构：

```ts
const polyline = [{
  points: routePoints,
  color: '#22c55e',
  width: 6,
  arrowLine: true,
}];

const markers = [
  { id: 1, longitude: originLng, latitude: originLat },
  { id: 2, longitude: destinationLng, latitude: destinationLat },
  { id: 3, longitude: driverLng, latitude: driverLat },
];
```

因此小程序不是不能画高德路线，而是由微信原生地图负责视觉渲染，高德负责坐标、POI 和路线数据。

本项目推荐后端统一调用高德 Web Service：

- 不把 Web Service Key 放到小程序。
- H5 和小程序使用相同的路线结果和计价结果。
- 服务器统一解析高德返回的 `paths`、`steps`、`polyline`、`tolls`、`toll_distance`、`toll_road`。
- 小程序只接收脱敏后的路线数据。

如果未来需要直接使用官方 AMapWX，只允许将小程序平台专用 Key 放入小程序，并配置微信 request 合法域名；不能把后端安全密钥放进去。

### 7.3 路线刷新策略

行程中司机端每 5 秒：

1. 获取当前位置、方向和速度。
2. 上报后端。
3. 后端验证司机身份和当前行程归属。
4. 重新调用驾车路线规划。
5. 返回到起点或终点的新路线。
6. 司机端重新绘制路线。
7. 通过 WebSocket 把位置和必要路线状态推送给乘客端。

为避免高德配额被瞬间耗尽，服务端增加同一行程的短时缓存、请求超时、失败重试上限和路线调用监控；功能语义仍保持 5 秒位置更新和路线刷新。

## 8. 高德配置方案

### 8.1 本地 H5

`apps/miniapp-uni/.env.local`：

```env
VITE_AMAP_JSAPI_KEY=replace_with_local_web_jsapi_key
VITE_AMAP_JSAPI_SECURITY_JSCODE=replace_with_local_jsapi_security_code
VITE_AMAP_JSAPI_SERVICE_HOST=http://127.0.0.1:3000/_AMapService
```

开发环境可以明文配置 `securityJsCode`，只允许使用本地 Key，不得提交 `.env.local`。

### 8.2 本地微信小程序

```env
VITE_API_BASE=http://192.168.x.x:3000
```

- 小程序不能访问电脑的 `127.0.0.1`，真机使用开发电脑局域网 IP。
- 开发工具可以关闭域名校验；真机需要配置可访问的 API 地址。
- 小程序端不配置高德安全密钥。

### 8.3 后端

建议新增并在 `.env.example` 中说明：

```env
AMAP_WEBSERVICE_KEY=replace_with_server_webservice_key
AMAP_JSAPI_SECURITY_JSCODE=replace_with_web_jsapi_security_code
```

`AMAP_WEBSERVICE_KEY` 只用于服务端 POI、地理编码和驾车路线规划。高德 Web Service API 只有 Key，没有 `securityJsCode`。

`AMAP_JSAPI_SECURITY_JSCODE` 只用于 `/_AMapService` 代理为 Web 端 JSAPI v2.0 追加安全码。它不是 Web Service 凭据，也不能作为路线/POI 请求的 Key。两套凭据不得 fallback、复用或互换。

`TANSHU_CAR_API_KEY` 继续只保留在后端，用于车型品牌、车系和车辆图片。

### 8.4 线上 H5

```env
VITE_AMAP_JSAPI_KEY=replace_with_production_web_jsapi_key
VITE_AMAP_JSAPI_SERVICE_HOST=https://api.example.com/_AMapService
```

生产前端不配置 `VITE_AMAP_JSAPI_SECURITY_JSCODE`。JSAPI 安全码放在 API/Nginx 代理服务端的 `AMAP_JSAPI_SECURITY_JSCODE`，并由服务端追加到 JSAPI 请求；Web Service 请求只携带 `AMAP_WEBSERVICE_KEY`。

高德控制台配置：

- H5 Key 选择“Web端(JS API)”。
- 后端 Key 选择“Web服务 API”。
- 配置生产域名白名单。
- 不提交任何真实 Key、security code 或生产地址密码。

## 9. 建议 API

### 乘客 API

```text
GET  /rides/availability
POST /rides/routes/preview
POST /rides
GET  /rides
GET  /rides/:id
POST /rides/:id/cancel
GET  /rides/:id/contact
GET  /rides/:id/messages
POST /rides/:id/messages
```

### 司机 API

```text
GET    /rides/driver/profile
PATCH  /rides/driver/status
GET    /rides/driver/orders
GET    /rides/driver/vehicles
POST   /rides/driver/vehicles
PUT    /rides/driver/vehicles/:id
DELETE /rides/driver/vehicles/:id
POST   /rides/:id/accept
POST   /rides/:id/reject
POST   /rides/:id/arrive-pickup
POST   /rides/:id/start
POST   /rides/:id/arrive-destination
POST   /rides/:id/finalize
POST   /rides/location
POST   /rides/locations/batch
```

### 后台 API

```text
GET  /system/ride-settings
PUT  /system/ride-settings
GET  /system/rides
GET  /system/rides/:id
GET  /system/rides/:id/track
GET  /system/ride-drivers
```

## 10. 支付、退款和补款

主订单使用 `Order(type=RIDE)`：

```text
创建行程订单
  -> payStatus=UNPAID
  -> 调用现有微信 JSAPI 预支付
  -> 支付成功后开始派单
```

行程完成后：

- 默认模式：线上预付预估车费；最终费用小于线上预付金额时，对主订单执行部分退款；等于时直接完成；高于时创建行程补款订单。
- 固定预付模式：乘客线上仅支付后台配置的固定金额。最终费用高于线上预付时，司机可在确认费用时明确确认“乘客已线下付清差额”；服务端按最终费用减线上预付重新计算并审计该差额，订单直接完成，不创建线上补款单。司机未确认线下收款时，仍创建线上补款单。
- 线下确认金额只保存在 `RideTrip.offlinePaidAmount/offlinePaidAt` 和订单时间线中；它不是 `Order.payAmount`，不属于线上实收，也不参与线上退款口径。
- 最终费用低于线上预付金额时，仍只退实际线上预付款中的差额。

不能通过前端直接修改 `payAmount`，不能通过司机端传入的总价绕过后端计价。

## 11. 后端代码落点

新增：

```text
apps/api/src/ride/ride.module.ts
apps/api/src/ride/ride.controller.ts
apps/api/src/ride/ride.service.ts
apps/api/src/ride/ride.dto.ts
apps/api/src/ride/ride.dispatch.service.ts
apps/api/src/ride/ride.location.service.ts
apps/api/src/ride/ride.fare.service.ts
apps/api/src/ride/ride.realtime.service.ts
apps/api/src/ride/ride.amap.service.ts
```

建议职责：

- `ride.service.ts`：行程生命周期、权限和状态迁移。
- `ride.dispatch.service.ts`：半径筛选、派单广播、抢单事务、超时处理。
- `ride.location.service.ts`：位置鉴权、5 秒上报、在线判断、位置缓存和清理。
- `ride.fare.service.ts`：预估、最终费用、停车费、其他费用、退款/补款。
- `ride.amap.service.ts`：高德输入提示、地理编码、逆地理编码和驾车路线。
- `ride.realtime.service.ts`：WebSocket 行程事件。

## 12. 前端共享代码落点

```text
apps/miniapp-uni/src/services/ride.ts
apps/miniapp-uni/src/services/ride-map.ts
apps/miniapp-uni/src/services/ride-realtime.ts
apps/miniapp-uni/src/components/ride/RideMap.vue
apps/miniapp-uni/src/components/ride/RideStatusBar.vue
apps/miniapp-uni/src/components/ride/RideSlideAction.vue
apps/miniapp-uni/src/components/ride/RideChatSheet.vue
```

要求：

- 所有后端请求通过 `@wash/api-client` 公开入口。
- 不从 generated 内部路径导入。
- 不在页面内重复实现 API base、token 或 401 处理。
- H5 和微信小程序通过 `RideMap` 适配层复用业务数据，不共享底层地图实现。

## 13. 后台页面

在 `apps/web-admin` 新增统一的一级菜单“内部用车”，所有行程相关运营能力集中在该菜单下，不散落到普通洗车订单或系统设置菜单。建议子页面：

```text
内部用车
  ├── 实时总览
  ├── 行程订单
  ├── 内部司机
  └── 用车配置
```

具体功能：

- 行程计价规则配置。
- 派单半径和派单超时配置。
- 停车费、其他费用开关。
- 聊天保留时间。
- 司机在线/空闲/忙碌/离线列表。
- 查看全部行程订单，不受乘客或司机身份范围限制；支持按状态、订单号、乘客、司机和时间筛选。
- 行程订单详情使用高德 JSAPI 绘制订单地图，显示起点、终点、服务端规划路线和清洗后的实际行驶轨迹；接驾轨迹为黄色、载客轨迹为红色、到达目的地至费用结算为紫色，并展示关键状态时间点、费用流水、补款、退款和异常状态。
- “实时总览”使用一张大地图展示所有内部司机的最新位置和空闲/忙碌/离线状态；复用现有 `/ws` 接收 `ride:location`、`ride:driver:availability` 和 `ride:status`，断线后自动重连并通过后台查询接口全量校准。
- 大地图 Marker 至少显示司机姓名、状态、当前车辆和最后位置时间；状态颜色必须可区分，离线司机不得伪装为在线位置。
- 总览地图可从司机 Marker 跳转司机详情或其当前行程；行程列表可进入独立行程详情。
- 费用流水、补款、退款和异常状态。

后台 H5 地图统一使用 `@amap/amap-jsapi-loader` 和高德 JSAPI v2.0：

- 加载前配置 `_AMapSecurityConfig`；生产环境只使用 `VITE_AMAP_JSAPI_SERVICE_HOST` 代理，不在前端暴露 JSAPI `securityJsCode`。
- `AMapLoader.load().then()` 回调第一行设置 `AMap.getConfig().appname = 'amap-jsapi-skill'`。
- 司机、起点、终点使用 Marker；规划路线使用蓝色 Polyline，接驾、载客、到达后结算分别使用黄色、红色、紫色 Polyline，并提供图例。
- 组件卸载时移除事件监听并调用 `map.destroy()`。
- 所有后台地图页面复用共享地图组件/加载器，不能各自重复加载 JSAPI。

新增权限键建议：

```text
ride-settings
ride-orders
ride-drivers
```

员工司机端不依赖后台权限键，只依赖启用员工档案；后台管理人员依赖上述权限。

## 14. 实时通信设计

复用现有 `/ws`，扩展事件：

```text
ride:dispatch:new
ride:dispatch:cancelled
ride:status
ride:location
ride:route
ride:message
ride:driver:availability
```

规则：

- 状态改变一律走 HTTP API，WebSocket 只负责推送。
- 新订单只推给目标半径内、启用、在线、空闲且已选择出车车辆的司机。
- 司机位置只推给对应行程乘客和司机本人。
- 忙碌司机地图标记只返回必要信息，不暴露其他乘客信息。
- 断线后前端自动重连，并用轮询兜底。
- 司机停止上报超过有效窗口后自动离线。

## 15. 安全和隐私要求

- 司机入口隐藏不等于权限控制，所有司机接口必须服务端校验启用员工。
- 乘客只能访问自己的行程。
- 司机只能访问分配给自己的行程。
- 手机号接口只允许当前行程参与者访问。
- 开始订单的手机号后四位必须服务端验证。
- 司机位置、路线、费用和状态均不能信任前端。
- 单点位置上报需要限频；批量补传需要校验 24 小时时间窗口、行程归属和客户端点 ID 幂等性。
- 司机切换空闲前必须校验已选择有效车辆。
- 生产环境不暴露高德安全密钥、微信支付密钥、探数 Key。
- 增加微信后台定位隐私说明、用户授权失败提示和撤销授权处理。
- 记录订单状态、接单、到达、开始、到达终点、费用确认、退款和补款时间线。

## 16. 实施阶段

### 阶段 A：契约和数据库

1. 开始前运行 `git status --short`，保护用户已有改动。
2. 修改 Prisma schema，新增 `RIDE` 和行程模型。
3. 创建新的命名 migration，禁止修改已应用 migration。
4. 审阅 SQL 和 Decimal 字段。
5. 运行 Prisma Client 生成。

### 阶段 B：后端核心

1. 新增 `RideModule` 并装配到 `AppModule`。
2. 实现计价配置和后台接口。
3. 实现高德服务端代理。
4. 实现 3km/后台半径空闲司机检测。
5. 实现司机状态和车辆选择。
6. 实现创建订单、支付后派单、原子抢单。
7. 实现全部行程状态迁移。
8. 实现位置上报和 5 秒路线刷新。
9. 实现费用确认、退款和补款。
10. 实现聊天和 WebSocket 推送。

### 阶段 C：OpenAPI 和 SDK

接口和 DTO 完成后按仓库规定执行：

```powershell
pnpm -F WashClubAPI run openapi
pnpm generate:client
```

审阅 `apps/api/openapi.json` 和 SDK diff，不能手改生成文件。

### 阶段 D：小程序页面

1. 修改 `pages.json`。
2. 修改 `pages/me/index.vue` 入口和员工判断。
3. 实现 H5 地图适配。
4. 实现微信小程序原生地图适配。
5. 实现乘客端页面。
6. 实现司机端页面。
7. 实现持续定位、授权、断线和异常状态。
8. 更新现有订单入口和行程详情。

### 阶段 E：后台页面

1. 新增统一一级菜单“内部用车”及实时总览、行程订单、内部司机、用车配置子路由。
2. 新增实时总览大地图，首屏加载全部司机位置/状态并通过 WebSocket 增量刷新，断线重连后重新校准。
3. 新增全部行程订单列表、筛选和详情。
4. 行程详情用 JSAPI 绘制起点、终点、规划路线和实际行驶轨迹。
5. 新增行程计价配置、派单半径、派单超时和聊天保留时间配置。
6. 新增司机状态、车辆、当前行程监控。
7. 新增费用、补款、退款和异常状态展示。

### 阶段 F：验证和交付

先确认裸 `pnpm --version` 为 `11.19.0`，再运行：

```powershell
pnpm -F WashClubAPI run build
pnpm -F @wash/api-client run build
pnpm -F miniapp-uni run build:mp-weixin
pnpm -F miniapp-uni run build:h5
```

当前仓库没有完整测试脚本和有效 lint 门禁，不能把“构建成功”表述成“业务测试通过”。

## 17. 必须验收的场景

### 权限

- 普通会员看不到“内部司机”。
- 普通会员直接调用司机接口返回 403。
- 已禁用员工无法进入司机端。
- 管理员可以按后台权限访问配置和运营页面。

### 司机状态

- 空闲司机可被派单。
- 忙碌司机可自行开启，不被自动派单。
- 忙碌司机可在地图显示并联系。
- 未选择车辆不能进入空闲。
- 行程结束后恢复手动忙碌或空闲状态。
- 司机端每 5 秒发送一次位置心跳；服务端连续缺失 3 个心跳（默认约 15 秒）后才进入离线，避免单次定位或网络抖动导致状态立即回退。

### 叫车和派单

- 起点 3km 内无空闲司机不能创建订单。
- 半径由后台配置改变后立即生效。
- 多司机同时接单只有一个成功。
- 派单超时自动退款。
- 司机拒绝后仍可继续派给其他司机。
- 支付未完成不能进入派单。

### 行程流程

- 到达起点前不能开始订单。
- 手机号后四位错误不能开始订单。
- 非当前司机不能操作行程。
- 司机位置每 5 秒更新。
- 司机位置变化后路线重新计算和绘制。
- 到达终点后才能确认费用。

### 金额和支付

- 起步价、包含公里、包含时间计算正确。
- 停车费开关关闭时不能添加停车费。
- 其他费用开关关闭时不能添加其他费用。
- 低于预付金额能正确部分退款。
- 高于预付金额能创建补款订单。
- 固定预付金额不能低于 ¥0.01，且只影响新建行程。
- 固定预付行程中，司机确认线下收款后只记录最终费用与线上预付之间的差额，不创建线上补款单，也不把线下金额写入线上实收。
- 重复支付、重复退款、重复完成请求均幂等。

### 地图

- H5 地图正常初始化和销毁。
- H5 使用安全密钥配置。
- 小程序原生地图可以显示起点、终点、司机和折线。
- 坐标顺序始终为经度、纬度。
- H5、微信小程序和后端统一 GCJ-02 口径。
- 高德请求失败时页面有可理解的降级提示。
- 路线请求超时不会阻塞位置上报和行程状态。
- 管理后台“内部用车/实时总览”可在一张大地图上显示全部司机最新位置和状态，并通过 WebSocket 实时刷新。
- 后台司机状态 Marker 的颜色、文案和最后位置时间一致，超时司机显示为离线。
- 后台行程详情同时绘制起点、终点、服务端规划路线和实际位置轨迹，两类折线可明确区分。
- 后台地图组件卸载后不残留地图实例、定时器或 WebSocket 事件监听。

## 18. 给新 AI 对话的执行约束

请按本文档完整实施，不要先写页面 mock 再绕过后端；必须先完成数据库、API、OpenAPI/SDK，再接页面。

执行时必须：

1. 先阅读根 `AGENTS.md` 和本计划。
2. 开始和交付前运行 `git status --short`。
3. 保留用户已有未提交改动。
4. 所有接口通过 `@wash/api-client` 公开入口调用。
5. 不手改 `apps/api/openapi.json` 和 generated SDK。
6. 不使用 `db push`、`migrate deploy`、seed、backfill 或生产数据库写入，除非用户在当轮明确授权。
7. 不把真实 Key、手机号、数据库地址和支付密钥写进代码或文档。
8. 修改后端 DTO/Controller 后重新生成 OpenAPI 和 SDK。
9. 小程序构建前后检查 `src/assets/changelog.html` 和 `changelog.ts` 是否出现无关生成改动。
10. 使用高德 JSAPI 技能生成 H5 地图代码时，遵守安全密钥、`appname`、按需插件加载和 `map.destroy()` 要求。
11. 使用高德 LBS Web Service 时，Key 只在后端使用，并对路线请求、配额、超时和错误进行处理。
12. 交付时逐项报告实际执行的命令、构建结果、未验证项和数据库操作风险。

## 19. 参考事实入口

- 小程序页面注册：`apps/miniapp-uni/src/pages.json`
- 我的页面：`apps/miniapp-uni/src/pages/me/index.vue`
- 会员车辆：`apps/api/src/member/vehicle.service.ts`
- 探数车型：`apps/api/src/content/car-data.controller.ts`
- 订单模型：`apps/api/prisma/schema.prisma`
- 订单接口：`apps/api/src/order/order.controller.ts`
- 员工身份接口：`apps/api/src/system/miniapp.controller.ts`
- 员工 Guard：`apps/api/src/auth/admin-or-employee.guard.ts`
- 实时连接：`apps/api/src/notification/notification.gateway.ts`
- 高德 JSAPI 2.0：<https://lbs.amap.com/api/javascript-api-v2/guide/abc/load>
- 高德 Web Service 路径规划：<https://lbs.amap.com/api/webservice/guide/api/newroute>
- 高德微信小程序插件：<https://lbs.amap.com/api/wx/gettingstarted>
- 高德 Web Service Skill：<https://lbs.amap.com/api/webservice/summary>
