<template>
	<div>
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<el-form class="orders-filters" :inline="true" size="small" @submit.prevent>
			<el-form-item label="关键词">
				<el-input v-model="keyword" class="of-w-260" clearable placeholder="订单号/备注/手机号" @keyup.enter="fetchList" />
			</el-form-item>
			<el-form-item label="场景">
				<el-select v-model="scene" class="of-w-180" clearable placeholder="全部">
					<el-option label="无" value="" />
					<el-option label="待支付" value="PENDING_PAYMENT" />
					<el-option label="待发货（商品）" value="PENDING_DELIVERY" />
					<el-option label="待收货（商品）" value="PENDING_RECEIPT" />
					<el-option label="待服务（服务）" value="PENDING_SERVICE" />
					<el-option label="退款/售后" value="REFUND_AFTERSALE" />
					<el-option label="已完成" value="COMPLETED" />
					<el-option label="已取消" value="CANCELLED" />
					<el-option label="已删除" value="DELETED" />
				</el-select>
			</el-form-item>
			<el-form-item label="类型">
				<el-select v-model="type" class="of-w-140" clearable placeholder="全部">
					<el-option label="服务" value="SERVICE" />
					<el-option label="商品" value="SP" />
					<el-option label="付款" value="FK" />
				</el-select>
			</el-form-item>
			<el-form-item label="下单时间">
				<el-date-picker
					v-model="createdAtRange"
					class="of-w-320"
					type="datetimerange"
					start-placeholder="开始时间"
					end-placeholder="结束时间"
					value-format="YYYY-MM-DDTHH:mm:ssZ"
					teleported
					clearable
				/>
			</el-form-item>

			<el-form-item class="of-more-toggle">
				<el-button link type="primary" @click="showMore = !showMore">{{ showMore ? '收起筛选' : '更多筛选' }}</el-button>
			</el-form-item>

			<template v-if="showMore">
				<el-form-item label="状态">
					<el-select v-model="status" class="of-w-140" clearable placeholder="全部">
						<el-option label="已创建" value="CREATED" />
						<el-option label="已支付" value="PAID" />
						<el-option label="已履约" value="FULFILLED" />
						<el-option label="已完成" value="CLOSED" />
						<el-option label="已取消" value="CANCELLED" />
					</el-select>
				</el-form-item>
				<el-form-item label="支付状态">
					<el-select v-model="payStatus" class="of-w-140" clearable placeholder="全部">
						<el-option label="未支付" value="UNPAID" />
						<el-option label="已支付" value="PAID" />
						<el-option label="已退款" value="REFUNDED" />
						<el-option label="已作废" value="CANCELLED" />
					</el-select>
				</el-form-item>
				<el-form-item label="支付方式">
					<el-select v-model="payMethodFilter" class="of-w-150" clearable placeholder="全部">
						<el-option label="现金" value="CASH" />
						<el-option label="收钱吧" value="SHOUQIANBA" />
						<el-option label="线下其他" value="OFFLINE" />
						<el-option label="微信JSAPI" value="WECHAT_JSAPI" />
						<el-option label="微信付款码" value="WECHAT_MICROPAY" />
						<el-option label="洗车卡" value="WASH_CARD" />
						<el-option label="集团余额" value="GROUP_BALANCE" />
					</el-select>
				</el-form-item>
			</template>

			<el-form-item v-if="createdAtRangeLabel">
				<el-tag size="small" effect="plain" type="info" closable @close="clearCreatedAtRange">下单：{{ createdAtRangeLabel }}</el-tag>
			</el-form-item>
			<el-form-item v-if="typeLabelText">
				<el-tag size="small" effect="plain" type="info" closable @close="clearType">类型：{{ typeLabelText }}</el-tag>
			</el-form-item>
			<el-form-item v-if="sceneLabelText">
				<el-tag size="small" effect="plain" type="info" closable @close="clearScene">场景：{{ sceneLabelText }}</el-tag>
			</el-form-item>
			<el-form-item v-if="statusLabelText">
				<el-tag size="small" effect="plain" type="info" closable @close="clearStatus">状态：{{ statusLabelText }}</el-tag>
			</el-form-item>
			<el-form-item v-if="payStatusLabelText">
				<el-tag size="small" effect="plain" type="info" closable @close="clearPayStatus">支付：{{ payStatusLabelText }}</el-tag>
			</el-form-item>
			<el-form-item v-if="payMethodLabelText">
				<el-tag size="small" effect="plain" type="info" closable @close="clearPayMethod">方式：{{ payMethodLabelText }}</el-tag>
			</el-form-item>

			<el-form-item class="of-actions">
				<el-button type="primary" @click="fetchList">查询</el-button>
				<el-button @click="resetFilters">重置</el-button>
			</el-form-item>
		</el-form>
		<div class="table-scroll"><el-table :data="pagedList" border stripe size="small" style="min-width: 980px; width: 100%; border-radius:8px;overflow:hidden;">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="no" label="订单号" min-width="280">
				<template #default="{ row }">
					<span class="order-no" :class="{ deleted: !!row.deletedAt }" title="点击查看详情" @click="open(row.id)">
						<span class="order-no__prefix">{{ orderNoPrefix(row.no) }}</span><span class="order-no__suffix">{{ orderNoSuffix(row.no) }}</span>
					</span>
				</template>
			</el-table-column>
			<el-table-column label="类型" width="100">
				<template #default="{ row }"><el-tag :type="row.deletedAt ? 'info' : undefined">{{ typeLabel(row.type) }}</el-tag></template>
			</el-table-column>
			<el-table-column label="状态" width="100">
				<template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
			</el-table-column>
			<el-table-column label="履约状态" width="120">
				<template #default="{ row }"><el-tag type="info">{{ fulfillLabel(row.fulfillmentStatus) }}</el-tag></template>
			</el-table-column>
			<el-table-column label="支付状态" width="100">
				<template #default="{ row }">
					<div style="display:flex;align-items:center;gap:6px;">
						<el-tag v-if="!(row.payStatus==='UNPAID' && remainSeconds(row)>0)" :type="payStatusTagType(row.payStatus)">{{ payStatusLabel(row.payStatus) }}</el-tag>
						<el-tag v-if="row.payStatus==='UNPAID' && remainSeconds(row)>0" type="warning" effect="light">倒计时 {{ formatRemain(remainSeconds(row)) }}</el-tag>
					</div>
				</template>
			</el-table-column>
			<el-table-column label="会员" min-width="200">
				<template #default="{ row }">
					<span>UID: {{ row.member?.uid || '-' }} / ID: {{ row.memberId }}</span>
					<br />
					<span>{{ row.member?.name || '-' }}（<span v-if="row.member?.phone">****<span class="phone-tail">{{ last4Phone(row.member?.phone) }}</span></span><span v-else>-</span>）</span>
				</template>
			</el-table-column>
			<el-table-column label="支付方式" width="120">
				<template #default="{ row }">{{ payMethodLabel(row.payMethod) }}</template>
			</el-table-column>
			<el-table-column prop="totalAmount" label="订单总额" width="120">
				<template #default="{ row }">
					<span class="money money--total"><span class="unit">¥</span>{{ formatMoney(row.totalAmount) }}</span>
				</template>
			</el-table-column>
			<el-table-column prop="payAmount" label="支付金额" width="120">
				<template #default="{ row }">
					<span class="money money--pay"><span class="unit">¥</span>{{ formatMoney(row.payAmount) }}</span>
				</template>
			</el-table-column>
			<el-table-column prop="createdAt" label="下单时间" width="170">
				<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column prop="paidAt" label="支付时间" width="170">
				<template #default="{ row }">{{ formatDate(row.paidAt) }}</template>
			</el-table-column>
			<el-table-column label="售后/退款" width="100">
				<template #default="{ row }">
					<el-tag v-if="Array.isArray((row as any).afterSalesRequests) && (row as any).afterSalesRequests.some((x:any)=>x.status==='PENDING'||x.status==='APPROVED')" type="warning">售后中</el-tag>
					<span v-else>-</span>
				</template>
			</el-table-column>
			<el-table-column prop="remark" label="备注" min-width="160" />
			<el-table-column label="操作" width="150" fixed="right">
				<template #default="{ row }">
					<el-tooltip content="查看">
						<el-button text class="icon-btn" title="查看" @click="open(row.id)">
							<el-icon><View /></el-icon>
						</el-button>
					</el-tooltip>
					<el-dropdown trigger="click" placement="bottom-end">
						<span class="dropdown-ref">
							<el-tooltip content="更多">
								<el-button text class="icon-btn" title="更多">
									<el-icon><MoreFilled /></el-icon>
								</el-button>
							</el-tooltip>
						</span>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item v-if="row.payStatus==='UNPAID' && !row.deletedAt" @click="openPay(row)"><el-icon style="margin-right:6px;"><Wallet /></el-icon>标记支付</el-dropdown-item>
								<el-dropdown-item v-if="row.payStatus==='PAID' && !row.deletedAt" @click="openRefund(row)"><el-icon style="margin-right:6px;"><Money /></el-icon>退款</el-dropdown-item>
								<el-dropdown-item v-if="canWriteoff() && !row.deletedAt" @click="writeoff(row)"><el-icon style="margin-right:6px;"><Delete /></el-icon>作废/红冲</el-dropdown-item>
								<el-dropdown-item v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='PENDING' && !row.deletedAt" @click="openShip(row)"><el-icon style="margin-right:6px;"><Promotion /></el-icon>发货</el-dropdown-item>
								<el-dropdown-item v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='SHIPPED' && !row.deletedAt" @click="receive(row.id)"><el-icon style="margin-right:6px;"><Finished /></el-icon>确认收货</el-dropdown-item>
								<el-dropdown-item v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='SHIPPED' && row.payMethod==='WECHAT_JSAPI' && !row.deletedAt" @click="openEditTracking(row)"><el-icon style="margin-right:6px;"><EditPen /></el-icon>修改物流单号</el-dropdown-item>
								<el-dropdown-item v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='PENDING') && !row.deletedAt" @click="startService(row.id)"><el-icon style="margin-right:6px;"><Timer /></el-icon>开始服务</el-dropdown-item>
								<el-dropdown-item v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='IN_SERVICE' || row.fulfillmentStatus==='PENDING') && !row.deletedAt" @click="finishService(row.id)"><el-icon style="margin-right:6px;"><SuccessFilled /></el-icon>结束服务{{ row.payMethod==='WECHAT_JSAPI' ? '（上报小程序）' : '' }}</el-dropdown-item>
								<el-dropdown-item v-if="row.deletedAt" @click="restore(row.id)">恢复</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
					<el-popconfirm v-if="!row.deletedAt" title="确认删除（软删除）？" @confirm="close(row.id)">
						<template #reference>
							<span class="popconfirm-ref">
								<el-tooltip content="删除">
									<el-button text class="icon-btn danger" title="删除">
										<el-icon><Delete /></el-icon>
									</el-button>
								</el-tooltip>
							</span>
						</template>
					</el-popconfirm>
				</template>
			</el-table-column>
		</el-table></div>

		<!-- 分页与统计 -->
		<div v-if="list.length" class="orders-pagination">
			<div class="pagination-info">
				<span>显示 {{ displayFrom }}-{{ displayTo }} 项，共 {{ list.length }} 项</span>
			</div>
			<el-pagination
				background
				layout="sizes, prev, pager, next, jumper"
				:total="list.length"
				:page-size="pageSize"
				:current-page="page"
				:page-sizes="pageSizes"
				@current-change="onPage"
				@size-change="onPageSizeChange"
			/>
		</div>

		<el-dialog v-model="showPay" title="手动确认支付" width="420px">
			<el-tabs v-model="payTab">
				<el-tab-pane label="常规方式" name="manual">
					<el-select v-model="payMethod" placeholder="支付方式" style="width: 100%">
						<el-option label="现金" value="CASH" />
						<el-option label="收钱吧" value="SHOUQIANBA" />
						<el-option label="线下其他" value="OFFLINE" />
					</el-select>
					<div v-if="orderForPay" style="margin-top:12px; display:flex; align-items:center; gap:8px;">
						<div style="flex:0 0 auto; color:#606266;">收银立减</div>
						<el-input-number
							v-model="cashierDiscountInput"
							:min="0"
							:max="payAmountCap"
							:step="0.01"
							:precision="2"
							:controls="false"
							size="small"
							style="width: 140px;"
							@change="onManualDiscountChange"
						/>
						<div style="flex:1; color:#909399; font-size:12px;">最多可减至 0 元；0 元仅支持内部支付</div>
					</div>
					<div v-if="orderForPay" style="margin-top:6px; text-align:right; color:#303133;">应收：<b>¥{{ payAmountAfterManual.toFixed(2) }}</b></div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" @click="doMarkPaid">确认支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane label="微信付款码" name="wx">
					<el-input v-model="wxAuthCode" placeholder="请扫描/输入顾客微信付款码" maxlength="24" />
					<div style="margin-top:8px; display:flex; gap:8px;">
						<el-button @click="openScan">打开摄像头识别</el-button>
						<el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="onSelectImage">
							<el-button>从图片识别</el-button>
						</el-upload>
					</div>
					<div style="color:#909399;font-size:12px; margin-top:6px;">提示：仅用于线下收银，成功后订单将自动标记已支付。</div>
					<div v-if="orderForPay" style="margin-top:6px; display:flex; justify-content:space-between; align-items:center; color:#303133;">
						<div>应收：<b>¥{{ payAmountAfterManual.toFixed(2) }}</b></div>
						<div v-if="payAmountAfterManual<=0" style="color:#f56c6c; font-size:12px;">零元订单不支持微信付款码</div>
					</div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" :loading="wxPayLoading" :disabled="payAmountAfterManual<=0" @click="doWxMicropay">发起付款码支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane label="洗车卡划扣" name="wash">
					<el-form label-width="92px" style="margin-bottom:8px;">
						<el-form-item label="付款会员">
							<div style="display:flex; gap:6px; width:100%;">
								<el-input v-model="payerMemberKeyword" placeholder="手机号/昵称（可留空使用自动策略）" clearable />
								<el-button @click="searchPayerMember">搜索</el-button>
							</div>
						</el-form-item>
						<el-form-item v-if="payerMemberList.length" label="选择会员">
							<el-select v-model="payerMemberId" placeholder="选择付款会员" filterable style="width:100%;">
								<el-option v-for="m in payerMemberList" :key="m.id" :label="memberLabel(m)" :value="m.id" />
							</el-select>
						</el-form-item>
						<el-form-item v-if="payerMemberId" label="选择卡片">
							<el-select v-model="payerCardId" placeholder="选择指定卡（可留空自动在该会员名下选择）" style="width:100%;">
								<el-option v-for="c in payerCards" :key="c.key" :label="c.label" :value="c.value" />
							</el-select>
						</el-form-item>
					</el-form>
					<div style="color:#606266; font-size:13px; line-height:1.6; background:#f9fafb; padding:8px 10px; border-radius:6px; border:1px dashed #e5e7eb; margin-bottom:8px;">
						系统会自动识别本订单中标记为“计为洗车(次)”的服务商品数量作为需要扣减的次数，并从车辆所属集团或会员的洗车卡中优先扣减。次数不可手动修改。
					</div>
					<el-radio-group v-model="washPrefer" size="small">
						<el-radio-button label="AUTO">自动选择</el-radio-button>
						<el-radio-button label="GROUP">优先集团卡</el-radio-button>
						<el-radio-button label="MEMBER">优先会员卡</el-radio-button>
					</el-radio-group>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" @click="doWashDeduct">确认划扣并支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane v-if="canGroupBalance" label="集团余额" name="group">
					<div style="color:#606266; font-size:13px; line-height:1.6; background:#f9fafb; padding:8px 10px; border-radius:6px; border:1px dashed #e5e7eb; margin-bottom:8px;">
						仅用于集团服务订单。集团余额支付不计入支付金额统计，仅进行集团余额内部扣减并记录关联订单流水。
					</div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" @click="doGroupBalance">确认集团余额支付</el-button>
					</div>
				</el-tab-pane>
			</el-tabs>
		</el-dialog>

		<el-dialog v-model="showScan" title="摄像头识别付款码" width="520px" @closed="stopScan">
			<div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
				<video ref="videoRef" style="width:100%;max-height:360px;background:#000;" playsinline muted></video>
				<canvas ref="canvasRef" style="display:none;"></canvas>
				<div style="color:#909399;font-size:12px;">将顾客付款码对准摄像头，系统会自动识别</div>
			</div>
			<template #footer>
				<el-button @click="showScan=false">关闭</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showRefund" title="退款确认" width="520px">
			<el-form label-width="96px">
				<template v-if="currentOrder && (currentOrder.payMethod==='WECHAT_JSAPI' || currentOrder.payMethod==='WECHAT_MICROPAY')">
					<el-form-item label="退款方式">
						<el-radio-group v-model="refundMode">
							<el-radio label="FULL" :disabled="hasPartialRefund">全额退款</el-radio>
							<el-radio label="PART">部分退款</el-radio>
						</el-radio-group>
					</el-form-item>
					<el-form-item v-if="refundMode==='PART'" label="退款金额">
						<el-input v-model="refundAmountText" inputmode="decimal" :placeholder="'输入金额，最低0.01，最高¥' + refundableLeft.toFixed(2)" />
						<div style="margin-left:8px;color:#666;">剩余可退：¥{{ refundableLeft.toFixed(2) }}</div>
					</el-form-item>
				</template>
				<el-form-item label="原因">
					<el-input v-model="refundReason" type="textarea" placeholder="可选，填写退款原因" :rows="3" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showRefund=false">取消</el-button>
				<el-button type="primary" @click="doRefund">确认退款</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showShipDialog" :title="shipDialogTitle" width="560px">
			<el-radio-group v-model="shipMode" style="margin-bottom:12px;">
				<el-radio label="express">快递发货</el-radio>
				<el-radio label="noExpress">无需快递发货</el-radio>
			</el-radio-group>
			<div v-if="shipMode==='express'">
				<div style="margin-bottom:10px;">
					<el-select v-model="selectedCompanyCode" placeholder="选择快递公司" style="width:100%;" filterable @change="onCompanyChange">
						<el-option v-for="c in companies" :key="c.code" :label="c.name" :value="c.code">
							<div style="display:flex;align-items:center;gap:8px;">
								<img v-if="c.logo" :src="c.logo" style="width:18px;height:18px;object-fit:contain;" />
								<span>{{ c.name }}</span>
							</div>
						</el-option>
					</el-select>
				</div>
				<el-input v-model="trackingNo" placeholder="快递单号" />
				<div v-if="isSF" style="margin-top:10px;">
					<div style="color:#909399; font-size:12px; margin-bottom:6px;">顺丰要求提供寄件人或收件人联系方式（掩码规则：手机号中间四位用*替代，如 138****1234）</div>
					<el-input v-model="contactSenderMasked" placeholder="寄件人手机号（掩码，可选，二选一）" style="margin-bottom:6px;" />
					<el-input v-model="contactReceiverMasked" placeholder="收件人手机号（掩码，可选，二选一）" />
				</div>
			</div>
			<template #footer>
				<el-button @click="showShipDialog=false">取消</el-button>
				<el-button type="primary" @click="doShip">提交</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showEditTrackingDialog" title="修改物流单号（仅一次）" width="460px">
			<el-input v-model="editTrackingNo" placeholder="新物流单号" />
			<div style="margin-top:10px;">
				<div style="margin-bottom:6px;">（可选）更新快递公司</div>
				<el-select v-model="selectedCompanyCode" placeholder="选择快递公司" style="width:100%;" filterable @change="onCompanyChange">
					<el-option v-for="c in companies" :key="c.code" :label="c.name" :value="c.code">
						<div style="display:flex;align-items:center;gap:8px;">
							<img v-if="c.logo" :src="c.logo" style="width:18px;height:18px;object-fit:contain;" />
							<span>{{ c.name }}</span>
						</div>
					</el-option>
				</el-select>
			</div>
			<div v-if="editIsSF" style="margin-top:10px;">
				<div style="color:#909399; font-size:12px; margin-bottom:6px;">顺丰要求提供寄件人或收件人联系方式（掩码规则：手机号中间四位用*替代，如 138****1234）</div>
				<el-input v-model="contactSenderMasked" placeholder="寄件人手机号（掩码，可选，二选一）" style="margin-bottom:6px;" />
				<el-input v-model="contactReceiverMasked" placeholder="收件人手机号（掩码，可选，二选一）" />
			</div>
			<template #footer>
				<el-button @click="showEditTrackingDialog=false">取消</el-button>
				<el-button type="primary" @click="doEditTracking">提交</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watchEffect, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
	memberControllerList,
	orderControllerAdjustCashierDiscount,
	orderControllerClose,
	orderControllerEditTracking,
	orderControllerFinishService,
	orderControllerGet,
	orderControllerGetCompanies,
	orderControllerGetCompaniesFromTanshu,
	orderControllerList,
	orderControllerMarkPaid,
	orderControllerPayByGroupBalance,
	orderControllerPayByWashCard,
	orderControllerReceive,
	orderControllerRestore,
	orderControllerShip,
	orderControllerStartService,
	orderControllerWechatMicropay,
	orderControllerWechatRefund,
	orderControllerWriteoff,
	washCardControllerAdminList,
} from '@wash/api-client';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
// 替换为 Element Plus 内置图标（已在 main.ts 全局注册）

const router = useRouter();
const list = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(10);
const pageSizes = [10, 20, 30, 50, 100];
const pagedList = computed(()=> list.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
const displayFrom = computed(()=> list.value.length ? Math.min((page.value - 1) * pageSize.value + 1, list.value.length) : 0);
const displayTo = computed(()=> Math.min(page.value * pageSize.value, list.value.length));
function last4Phone(p?: string){ try{ const s=String(p||''); return s.slice(-4); }catch{ return ''; } }
function formatMoney(v: any){ try{ const n=Number(v||0); return n.toFixed(2); }catch{ return '0.00'; } }
const keyword = ref('');
const type = ref<string | ''>('');
const scene = ref<string | ''>('');
const status = ref<string | ''>('');
const payStatus = ref<string | ''>('');
// 顶部列表筛选：支付方式（避免与“标记支付”弹窗中的 payMethod 重名）
const payMethodFilter = ref<string | ''>('');
const createdAtRange = ref<[string, string] | null>(null);
const showMore = ref(false);
const nowTick = ref(0);
let tickTimer: any = null;

const route = useRoute();
function applyRouteQuery(){
	try{
		const q:any = route.query || {};
		if (q.keyword != null) keyword.value = String(q.keyword||'');
		if (q.type != null) type.value = String(q.type||'');
		if (q.scene != null) scene.value = String(q.scene||'');
		if (q.status != null) status.value = String(q.status||'');
		if (q.payStatus != null) payStatus.value = String(q.payStatus||'');
		if (q.payMethod != null) payMethodFilter.value = String(q.payMethod||'');
		const start = q.start != null ? String(q.start||'').trim() : '';
		const end = q.end != null ? String(q.end||'').trim() : '';
		createdAtRange.value = start && end ? [start, end] : null;
	}catch{}
}

function fmtLocalTimeText(val: string){
	try{
		const d = new Date(val);
		if (isNaN(d.getTime())) return String(val);
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth()+1).padStart(2,'0');
		const dd = String(d.getDate()).padStart(2,'0');
		const hh = String(d.getHours()).padStart(2,'0');
		const mi = String(d.getMinutes()).padStart(2,'0');
		return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
	}catch{ return String(val); }
}

function formatDate(val: string | null | undefined){
	if(!val) return '-';
	try{ return new Date(val).toLocaleString(); }catch{ return String(val); }
}

function typeLabel(v?: string){ if(v==='SERVICE') return '服务订单'; if(v==='SP') return '商品订单'; if(v==='FK') return '付款订单'; return v || '-'; }
function statusLabel(v?: string){ if(v==='CREATED') return '已创建'; if(v==='PAID') return '已支付'; if(v==='FULFILLED') return '已履约'; if(v==='CLOSED') return '已完成'; if(v==='CANCELLED') return '已取消'; return v || '-'; }
function statusTagType(v?: string){ if(v==='CREATED') return 'info'; if(v==='PAID') return 'success'; if(v==='FULFILLED') return 'success'; if(v==='CLOSED') return 'warning'; if(v==='CANCELLED') return 'danger'; return undefined as any; }
function payStatusLabel(v?: string){ if(v==='UNPAID') return '未支付'; if(v==='PAID') return '已支付'; if(v==='REFUNDED') return '已退款'; if(v==='CANCELLED') return '已作废'; return v || '-'; }
function payStatusTagType(v?: string){ if(v==='UNPAID') return 'info'; if(v==='PAID') return 'success'; if(v==='REFUNDED') return 'warning'; if(v==='CANCELLED') return 'danger'; return undefined as any; }
function payMethodLabel(v?: string | null){ if(!v) return '-'; if(v==='CASH') return '现金'; if(v==='SHOUQIANBA') return '收钱吧'; if(v==='OFFLINE') return '线下其他'; if(v==='WECHAT_JSAPI') return '微信JSAPI'; if(v==='WECHAT_MICROPAY') return '微信付款码'; if(v==='WASH_CARD') return '洗车卡结算'; if(v==='GROUP_BALANCE') return '集团余额支付'; return v; }
function fulfillLabel(v?: string){ if(!v) return '-'; if(v==='NONE') return '不需履约'; if(v==='PENDING') return '待履约/待发货'; if(v==='SHIPPED') return '已发货'; if(v==='RECEIVED') return '已收货'; if(v==='IN_SERVICE') return '服务中'; if(v==='DONE') return '服务完成'; return v; }

const createdAtRangeLabel = computed(()=>{
	const a = createdAtRange.value?.[0] ? String(createdAtRange.value[0]) : '';
	const b = createdAtRange.value?.[1] ? String(createdAtRange.value[1]) : '';
	if (!a || !b) return '';
	return `${fmtLocalTimeText(a)} ~ ${fmtLocalTimeText(b)}`;
});
const typeLabelText = computed(()=>{
	const v = String(type.value||'').trim();
	if (!v) return '';
	return v==='SERVICE' ? '服务' : v==='SP' ? '商品' : v==='FK' ? '付款' : v;
});
const sceneLabelText = computed(()=>{
	const v = String(scene.value||'').trim();
	if (!v) return '';
	return v==='PENDING_PAYMENT' ? '待支付'
		: v==='PENDING_DELIVERY' ? '待发货'
		: v==='PENDING_RECEIPT' ? '待收货'
		: v==='PENDING_SERVICE' ? '待服务'
		: v==='REFUND_AFTERSALE' ? '退款/售后'
		: v==='COMPLETED' ? '已完成'
		: v==='CANCELLED' ? '已取消'
		: v==='DELETED' ? '已删除'
		: v;
});
const statusLabelText = computed(()=> status.value ? statusLabel(status.value) : '');
const payStatusLabelText = computed(()=> payStatus.value ? payStatusLabel(payStatus.value) : '');
const payMethodLabelText = computed(()=> payMethodFilter.value ? payMethodLabel(payMethodFilter.value) : '');

function clearCreatedAtRange(){ createdAtRange.value = null; fetchList(); }
function clearType(){ type.value = ''; fetchList(); }
function clearScene(){ scene.value = ''; fetchList(); }
function clearStatus(){ status.value = ''; fetchList(); }
function clearPayStatus(){ payStatus.value = ''; fetchList(); }
function clearPayMethod(){ payMethodFilter.value = ''; fetchList(); }

async function fetchList(){
	const start = createdAtRange.value?.[0];
	const end = createdAtRange.value?.[1];
	const resp: any = await (orderControllerList({
		keyword: keyword.value || undefined,
		type: type.value || undefined,
		scene: scene.value || undefined,
		status: status.value || undefined,
		payStatus: payStatus.value || undefined,
		payMethod: payMethodFilter.value || undefined,
		includeDeleted: true,
		start: start || undefined,
		end: end || undefined,
	} as any) as any);
	// 兼容：数组返回 vs 分页 items 返回
	list.value = (Array.isArray(resp) ? resp : (resp?.items || resp?.data?.items || [])) as any[];
	page.value = 1;
}
function remainSeconds(row:any): number {
    try{
        const exp:any = row?.paymentExpireAt || null; if(!exp) return 0;
        const t = new Date(exp).getTime();
        const now = Date.now() + nowTick.value * 0; // 依赖 nowTick 触发视图更新
        return Math.max(0, Math.floor((t - now)/1000));
    }catch{ return 0; }
}
function formatRemain(sec:number): string { const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60; return (h>0)?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function open(id:number){ router.push(`/orders/${id}`); }
async function close(id:number){
    try { await orderControllerClose(id); ElMessage.success('已关闭'); await fetchList(); }
    catch(e:any){ ElMessage.error(String(e?.message||e||'关闭失败')); }
}
async function restore(id:number){
    try { await orderControllerRestore(id); ElMessage.success('已恢复'); await fetchList(); }
    catch(e:any){ ElMessage.error(String(e?.message||e||'恢复失败')); }
}

// 履约操作
// 发货弹窗与逻辑
const showShipDialog = ref(false);
const shipOrderId = ref<number|null>(null);
const shipMode = ref<'noExpress'|'express'>('express');
const shipDialogTitle = computed(()=>{
    const row = list.value.find(x=> x.id===shipOrderId.value);
    return row && row.payMethod==='WECHAT_JSAPI' ? '发货（已接入小程序发货接口）' : '发货';
});
const companies = ref<Array<{ code:string; name:string; logo?:string }>>([]);
const selectedCompanyCode = ref<string>('');
const selectedCompany = ref<{ code:string; name:string; logo?:string }|null>(null);
const trackingNo = ref('');
const contactSenderMasked = ref('');
const contactReceiverMasked = ref('');
const isSF = computed(()=>{
    const code = String(selectedCompanyCode.value||'').toUpperCase();
    const name = String(selectedCompany.value?.name||'');
    return code==='SF' || /顺丰/.test(name);
});

// 修改物流单号（仅一次）
const showEditTrackingDialog = ref(false);
const editTrackingOrderId = ref<number|null>(null);
const editTrackingNo = ref('');
const editIsSF = computed(()=>{
    const row = list.value.find(x=>x.id===editTrackingOrderId.value);
    const code = String(row?.shipExpressCompanyCode||'').toUpperCase();
    const name = String(row?.shipExpressCompanyName||'');
    return code==='SF' || /顺丰/.test(name);
});
async function openEditTracking(row:any){ editTrackingOrderId.value = row?.id||null; editTrackingNo.value=''; contactSenderMasked.value=''; contactReceiverMasked.value=''; showEditTrackingDialog.value=true; }
async function doEditTracking(){
    if(!editTrackingOrderId.value){ return; }
    if(!editTrackingNo.value.trim()){ ElMessage.error('请输入新物流单号'); return; }
    const row = list.value.find(x=>x.id===editTrackingOrderId.value);
    if (row && row.payMethod !== 'WECHAT_JSAPI'){ ElMessage.error('非微信支付订单不支持修改物流单号'); return; }
    const body:any = { trackingNo: editTrackingNo.value.trim() };
    if (selectedCompany.value){
        body.companyCode = selectedCompany.value.code;
        body.companyName = selectedCompany.value.name;
        body.companyLogo = selectedCompany.value.logo || undefined;
    }
    const code = String(row?.shipExpressCompanyCode||'').toUpperCase();
    const name = String(row?.shipExpressCompanyName||'');
    const isSf2 = code==='SF' || /顺丰/.test(name);
    if (isSf2){
        if (!contactSenderMasked.value && !contactReceiverMasked.value){ ElMessage.error('顺丰需二选一填写寄件人或收件人联系方式（掩码）'); return; }
        body.contactSenderPhoneMasked = contactSenderMasked.value || undefined;
        body.contactReceiverPhoneMasked = contactReceiverMasked.value || undefined;
    }
    await orderControllerEditTracking(editTrackingOrderId.value, { body } as any);
    ElMessage.success('已修改'); showEditTrackingDialog.value=false; await fetchList();
}

function canWriteoff(){ try{ const raw = localStorage.getItem('user')||'{}'; const u = JSON.parse(raw||'{}'); const perms = Array.isArray(u?.permissions)?u.permissions:[]; return perms.includes('*') || perms.includes('orders-writeoff'); }catch{ return false; } }
async function writeoff(row:any){ try{ const ok = await new Promise<boolean>(r=>{ ElMessageBox.confirm('确认对该订单执行作废/红冲操作？', '操作确认', { type:'warning' }).then(()=>r(true)).catch(()=>r(false)); }); if(!ok) return; await orderControllerWriteoff(Number(row.id), { body: { reason: '后台作废/红冲' } } as any); ElMessage.success('操作成功'); await fetchList(); }catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }

function openShip(row:any){
    shipOrderId.value = row?.id || null;
    shipMode.value = 'express';
    selectedCompanyCode.value = '';
    selectedCompany.value = null;
    trackingNo.value = '';
    contactSenderMasked.value = '';
    contactReceiverMasked.value = '';
    showShipDialog.value = true;
    loadCompanies();
}

async function loadCompanies(){
    try {
        const row = list.value.find(x=> x.id===shipOrderId.value);
        const res: any = row && row.payMethod==='WECHAT_JSAPI'
			? await (orderControllerGetCompanies() as any)
			: await (orderControllerGetCompaniesFromTanshu() as any);
        companies.value = (Array.isArray(res) ? res : (res?.items || res?.data?.items || [])) as any;
    } catch { companies.value = []; }
}

function onCompanyChange(code:string){
    selectedCompany.value = companies.value.find(c=>c.code===code) || null;
}

async function doShip(){
    if (!shipOrderId.value) return;
    const row = list.value.find(x=> x.id===shipOrderId.value);
    if (shipMode.value === 'noExpress'){
        try { await orderControllerShip(shipOrderId.value, { body: { noExpress: true } } as any); ElMessage.success('已标记为无需快递发货'); }
        catch(e:any){ ElMessage.error(String(e?.message||e||'提交失败')); return; }
    } else {
        if (!selectedCompany.value || !trackingNo.value.trim()) { ElMessage.error('请选择快递公司并填写快递单号'); return; }
        const body:any = {
            noExpress: false,
            companyCode: selectedCompany.value.code,
            companyName: selectedCompany.value.name,
            companyLogo: selectedCompany.value.logo || undefined,
            trackingNo: trackingNo.value.trim(),
        };
        if (isSF.value){
            if (!contactSenderMasked.value && !contactReceiverMasked.value){ ElMessage.error('顺丰需二选一填写寄件人或收件人联系方式（掩码）'); return; }
            body.contactSenderPhoneMasked = contactSenderMasked.value || undefined;
            body.contactReceiverPhoneMasked = contactReceiverMasked.value || undefined;
        }
        // 非微信支付订单：仅内部发货，不提示“已接入”
        try { await orderControllerShip(shipOrderId.value, { body } as any); ElMessage.success('已提交发货信息'); }
        catch(e:any){ ElMessage.error(String(e?.message||e||'提交失败')); return; }
    }
    showShipDialog.value = false;
    await fetchList();
}
async function receive(id:number){ try { await orderControllerReceive(id); ElMessage.success('已收货'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }
async function startService(id:number){ try { await orderControllerStartService(id); ElMessage.success('已开始服务'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }
async function finishService(id:number){ try { await orderControllerFinishService(id); ElMessage.success('已结束服务'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }

const showPay = ref(false);
const currentOrderId = ref<number | null>(null);
const payMethod = ref<'CASH'|'SHOUQIANBA'|'OFFLINE'|'CASH'>('CASH');
const payTab = ref<'manual'|'wx'|'wash'|'group'>('manual');
const canGroupBalance = ref(false);
const washPrefer = ref<'AUTO'|'GROUP'|'MEMBER'>('AUTO');
const wxAuthCode = ref('');
const wxPayLoading = ref(false);
const showScan = ref(false);
const videoRef = ref<HTMLVideoElement|null>(null);
const canvasRef = ref<HTMLCanvasElement|null>(null);
let mediaStream: MediaStream | null = null;
let scanTimer: any = null;
// ========== 手动选择付款会员/卡 ==========
const payerMemberKeyword = ref('');
const payerMemberList = ref<Array<{ id:number; name?:string; phone?:string }>>([]);
const payerMemberId = ref<number|null>(null);
const payerCards = ref<Array<{ key:string; value:number; label:string }>>([]);
const payerCardId = ref<number|null>(null);
function memberLabel(m:any){ return `${m.name||'-'}（****${String(m.phone||'').slice(-4)}）#${m.id}`; }
async function searchPayerMember(){
    const q = String(payerMemberKeyword.value||'').trim(); if (!q){ payerMemberList.value=[]; payerMemberId.value=null; payerCards.value=[]; payerCardId.value=null; return; }
    try{
        const res:any = await memberControllerList({ keyword: q, page: 1, pageSize: 20 } as any);
        payerMemberList.value = Array.isArray(res?.items) ? res.items.map((x:any)=>({ id:x.id, name:x.name, phone:x.phone })) : [];
    }catch{ payerMemberList.value=[]; }
}
watchEffect(async ()=>{
    payerCards.value = []; payerCardId.value = null;
    const mid = payerMemberId.value; if (!mid) return;
    try{
        const res:any = await washCardControllerAdminList({ page: 1, pageSize: 50, memberId: String(mid) } as any);
        const items = Array.isArray(res?.items) ? res.items : [];
        payerCards.value = items.map((c:any)=>({ key: `M-${c.id}`, value: c.id, label: `[会员卡] ${c.name||''}（余${c.remainingTimes||0}）#${c.cardNo}` }));
    }catch{ payerCards.value = []; }
});
// 收银立减（标记支付专用）
const orderForPay = ref<any>(null);
const cashierDiscountInput = ref<number>(0);
const payAmountCap = computed(()=>{
    try{
        const o:any = orderForPay.value; if (!o) return 0;
        const total = Number(o.totalAmount||0);
        const discount = Number(o.discountAmount||0);
        const cashierPrev = Number(o.cashierDiscountAmount||0);
        const base = Math.max(0, Number((total - (discount - cashierPrev)).toFixed(2)));
        return base;
    }catch{ return 0; }
});
const payAmountAfterManual = computed(()=>{
    try{
        const o:any = orderForPay.value; if (!o) return 0;
        const shipping = Number(o.shippingFee||0);
        const points = Number(o.pointsAmount||0);
        const manual = Math.max(0, Number(cashierDiscountInput.value||0));
        const baseBeforeCashier = payAmountCap.value;
        const pay = Math.max(0, Number((baseBeforeCashier - manual + shipping - points).toFixed(2)));
        return pay;
    }catch{ return 0; }
});
function onManualDiscountChange(){
    try{
        let v = Number(cashierDiscountInput.value||0);
        if (!Number.isFinite(v) || v < 0) v = 0;
        const cap = Number(payAmountCap.value||0);
        cashierDiscountInput.value = Number(Math.min(cap, v).toFixed(2));
    }catch{}
}
function normalizeMoney2(v:any): number { try{ const n = Number(v||0); if (!Number.isFinite(n) || n<0) return 0; return Number(n.toFixed(2)); }catch{ return 0; } }
function moneyEq(a:any,b:any): boolean { return Math.abs(normalizeMoney2(a)-normalizeMoney2(b)) < 0.0001; }
async function openPay(row:any){
    currentOrderId.value = row.id;
    payMethod.value = 'CASH';
    payTab.value = 'manual';
    washPrefer.value='AUTO';
    canGroupBalance.value = false;
    try{
        const ord:any = await (orderControllerGet(row.id) as any);
        orderForPay.value = ord || null;
        cashierDiscountInput.value = Math.max(0, Number(ord?.cashierDiscountAmount||0)) || 0;
        canGroupBalance.value = String(ord?.type||'').toUpperCase()==='SERVICE' && !!ord?.groupId && String(ord?.payStatus||'')==='UNPAID';
    }catch{ orderForPay.value=null; canGroupBalance.value=false; cashierDiscountInput.value=0; }
    showPay.value = true;
}
async function doMarkPaid(){
    if (!currentOrderId.value) return;
    try {
        // 仅当收银立减发生变化时才调用调整接口（避免 0->0 写入时间线）
        try{
            const prev = Number((orderForPay.value as any)?.cashierDiscountAmount||0);
            const next = Number(cashierDiscountInput.value||0);
            if (!moneyEq(prev, next)){
                await orderControllerAdjustCashierDiscount(currentOrderId.value, { body: { amount: normalizeMoney2(next) } } as any);
            }
        }catch{}
        await orderControllerMarkPaid(currentOrderId.value, { body: { method: payMethod.value } } as any); ElMessage.success('已标记为已支付'); showPay.value = false; await fetchList(); }
    catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); }
}

async function doWxMicropay(){
    if (!currentOrderId.value) return;
    const code = wxAuthCode.value.trim();
    if (!/^\d{18,24}$/.test(code)){ ElMessage.error('请输入有效的微信付款码（18-24位数字）'); return; }
    try{
        wxPayLoading.value = true;
        // 仅当收银立减发生变化时才调用调整接口（避免 0->0 写入时间线）
        try{
            const prev = Number((orderForPay.value as any)?.cashierDiscountAmount||0);
            const next = Number(cashierDiscountInput.value||0);
            if (!moneyEq(prev, next)){
                await orderControllerAdjustCashierDiscount(currentOrderId.value, { body: { amount: normalizeMoney2(next) } } as any);
            }
        }catch{}
        await orderControllerWechatMicropay(currentOrderId.value, { body: { authCode: code } } as any);
        ElMessage.success('付款成功，已标记订单为已支付');
        showPay.value = false;
        wxAuthCode.value = '';
        await fetchList();
    }catch(e:any){
        ElMessage.error(String(e?.message||e||'付款失败'));
    }finally{
        wxPayLoading.value = false;
    }
}

async function doWashDeduct(){
    if (!currentOrderId.value) return;
    try{
        const detail:any = list.value.find(x=>x.id===currentOrderId.value) || await (orderControllerGet(currentOrderId.value) as any);
        if (String(detail?.type||'').toUpperCase()!=='SERVICE'){ ElMessage.error('仅服务订单可使用洗车卡划扣'); return; }
        const prefer = washPrefer.value === 'AUTO' ? undefined : washPrefer.value;
        const body:any = { prefer };
        if (payerMemberId.value){ body.payerMemberId = payerMemberId.value; }
        if (payerCardId.value){ body.payerCardId = payerCardId.value; }
        const ret:any = await orderControllerPayByWashCard(currentOrderId.value, { body } as any);
        const plan = Array.isArray(ret?.plan)?ret.plan:[];
        const times = Number(ret?.requiredTimes||0);
        ElMessage.success(`划扣成功：扣${times}次，使用${plan.length}张卡`);
        showPay.value = false;
        await fetchList();
    }catch(e:any){ ElMessage.error(String(e?.message||e||'划扣失败')); }
}

async function doGroupBalance(){
    if (!currentOrderId.value) return;
    try{
        const detail:any = await (orderControllerGet(currentOrderId.value) as any);
        if (String(detail?.type||'').toUpperCase()!=='SERVICE' || !detail?.groupId){ ElMessage.error('仅集团服务订单可使用集团余额支付'); return; }
        await orderControllerPayByGroupBalance(currentOrderId.value);
        ElMessage.success('集团余额支付成功');
        showPay.value = false;
        await fetchList();
    }catch(e:any){ ElMessage.error(String(e?.message||e||'支付失败')); }
}

async function openScan(){
    try{
        showScan.value = true;
        await nextTick();
        if (!videoRef.value) return;
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoRef.value.srcObject = mediaStream as any;
        await videoRef.value.play();
        startDecodeLoop();
    }catch(e:any){ ElMessage.error('无法打开摄像头：' + String(e?.message||e||'')); showScan.value=false; }
}

function stopScan(){
    try{ if (scanTimer){ clearInterval(scanTimer); scanTimer=null; } }catch{}
    try{ if (videoRef.value){ videoRef.value.pause(); videoRef.value.srcObject = null; } }catch{}
    try{ if (mediaStream){ mediaStream.getTracks().forEach(t=> t.stop()); mediaStream=null; } }catch{}
}

function startDecodeLoop(){
    const reader = new BrowserMultiFormatReader();
    scanTimer = setInterval(async ()=>{
        try{
            if (!videoRef.value) return;
            const video = videoRef.value;
            const canvas = canvasRef.value;
            if (!canvas) return;
            const w = video.videoWidth; const h = video.videoHeight;
            if (!w || !h) return;
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d'); if (!ctx) return;
            ctx.drawImage(video, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            // zxing 解码
            const result = await reader.decodeFromImage(undefined as any, canvas.toDataURL('image/png'));
            const text = String((result as any)?.getText?.()).trim();
            if (/^\d{18,24}$/.test(text)){
                wxAuthCode.value = text; ElMessage.success('识别成功'); showScan.value=false; stopScan();
            }
        }catch(err){ if (!(err instanceof NotFoundException)) {/* 非未识别错误忽略 */} }
    }, 500);
}

async function onSelectImage(file: any){
    try{
        const f = file?.raw || file?.target?.files?.[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = async ()=>{
            try{
                const img = new Image();
                img.onload = async ()=>{
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d'); if (!ctx) return;
                    ctx.drawImage(img, 0, 0);
                    const br = new BrowserMultiFormatReader();
                    const res = await br.decodeFromImage(undefined as any, canvas.toDataURL('image/png'));
                    const text = String((res as any)?.getText?.()).trim();
                    if (/^\d{18,24}$/.test(text)) { wxAuthCode.value = text; ElMessage.success('识别成功'); }
                    else { ElMessage.error('未检测到有效付款码'); }
                };
                img.onerror = ()=> ElMessage.error('图片读取失败');
                img.src = String(reader.result||'');
            }catch{ ElMessage.error('识别失败'); }
        };
        reader.onerror = ()=> ElMessage.error('图片读取失败');
        reader.readAsDataURL(f);
    }catch{ ElMessage.error('识别失败'); }
}

const showRefund = ref(false);
const refundReason = ref('');
const refundMode = ref<'FULL'|'PART'>('FULL');
const refundAmountText = ref<string>('');
const currentOrder = ref<any>(null);
const refundableLeft = ref(0);
const hasPartialRefund = ref(false);
async function openRefund(row:any){
    currentOrderId.value = row.id;
    try{ currentOrder.value = await (orderControllerGet(row.id) as any); }catch{ currentOrder.value = row; }
    refundReason.value = '';
    refundMode.value = 'FULL';
    refundAmountText.value = '';
    // 计算已成功部分退款累计
    const rr = Array.isArray((currentOrder.value as any)?.refundRecords) ? (currentOrder.value as any).refundRecords : [];
    const successSum = rr.filter((r:any)=> r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
    const payAmt = Number((currentOrder.value as any).payAmount||0);
    const left = Math.max(0, payAmt - successSum);
    refundableLeft.value = left;
    hasPartialRefund.value = successSum > 0;
    showRefund.value = true;
}
function resetFilters(){ keyword.value=''; type.value=''; scene.value=''; status.value=''; payStatus.value=''; payMethodFilter.value=''; createdAtRange.value=null; page.value=1; fetchList(); }

// 支持从 Dashboard 带 query 跳转并自动应用筛选
onMounted(()=>{
	applyRouteQuery();
	fetchList();
});
watch(() => route.fullPath, ()=>{
	applyRouteQuery();
	fetchList();
});
function onPage(p:number){ page.value = p; }
function onPageSizeChange(s:number){ pageSize.value = s; page.value = 1; }
function orderNoPrefix(no: any){
	try{
		const s = String(no ?? '');
		if (s.length <= 4) return '';
		return s.slice(0, -4);
	}catch{ return ''; }
}
function orderNoSuffix(no: any){
	try{
		const s = String(no ?? '');
		if (s.length <= 4) return s;
		return s.slice(-4);
	}catch{ return String(no ?? ''); }
}
async function doRefund(){
    if (!currentOrderId.value) return;
    const row = currentOrder.value;
    if (row?.payMethod === 'WECHAT_JSAPI' || row?.payMethod === 'WECHAT_MICROPAY'){
        let amount: number | undefined = undefined;
        if (refundMode.value === 'FULL'){
            if (hasPartialRefund.value){ ElMessage.error('已发生部分退款，不能再使用全额退款'); return; }
            amount = Number(row.payAmount||0);
        } else {
            const raw = (refundAmountText.value||'').trim().replace(',', '.');
            if (!/^\d+(\.\d{1,2})?$/.test(raw)) { ElMessage.error('金额格式不正确，最多保留2位小数'); return; }
            const v = Number(raw);
            if (!isFinite(v) || v < 0.01){ ElMessage.error('部分退款金额至少为0.01'); return; }
            if (v > refundableLeft.value + 1e-6){ ElMessage.error('超出剩余可退金额'); return; }
            amount = v;
        }
        const resAny: any = await orderControllerWechatRefund(currentOrderId.value, { body: { reason: refundReason.value || undefined, amount } } as any);
        if (resAny && resAny.ok){ ElMessage.success('退款已提交'); } else { ElMessage.error((resAny && resAny.error) || '退款申请失败'); }
    } else {
        const res = await orderControllerWechatRefund(currentOrderId.value, { body: { reason: refundReason.value || undefined } } as any);
        if ((res as any)?.id){ ElMessage.success('已退款'); }
    }
    showRefund.value = false;
    await fetchList();
}

onMounted(() => {
    try{ if (tickTimer) clearInterval(tickTimer); }catch{}
    tickTimer = setInterval(()=>{ nowTick.value++; }, 1000);
});

onUnmounted(()=>{
    try{ if (tickTimer){ clearInterval(tickTimer); tickTimer=null; } }catch{}
});

</script>

<style scoped>
.orders-filters{
	width: 100%;
	display:flex;
	flex-wrap:wrap;
	align-items:center;
	gap: 10px 12px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 14px;
	background:
		linear-gradient(180deg, color-mix(in oklab, var(--el-color-primary), transparent 94%) 0%, transparent 70%),
		color-mix(in oklab, var(--el-bg-color), transparent 0%);
	box-shadow: 0 10px 24px rgba(17, 24, 39, 0.04);
}
.orders-filters :deep(.el-form-item){ margin-right: 0; margin-bottom: 0; }
.orders-filters :deep(.el-form-item__label){ color: var(--el-text-color-secondary); font-size: 12px; }
.orders-filters :deep(.el-input__wrapper),
.orders-filters :deep(.el-select__wrapper){ border-radius: 10px; }
.of-w-140{ width: 140px; }
.of-w-150{ width: 150px; }
.of-w-180{ width: 180px; }
.of-w-260{ width: 260px; }
.of-w-320{ width: 320px; }
.of-more-toggle :deep(.el-button){ padding-inline: 8px; }
.of-actions{ margin-left: auto; }
.of-actions :deep(.el-button){ border-radius: 999px; padding-inline: 12px; }
.table-scroll{ overflow:auto; }
.order-no{ white-space: nowrap; font-variant-numeric: tabular-nums; font-size: 15px; color:#303133; cursor: pointer; }
.order-no:hover{ color: var(--app-primary); }
.order-no.deleted{ color: #909399; text-decoration: line-through; }
.order-no__prefix{ opacity: 0.80; font-size: 13px; }
.order-no__suffix{ font-weight: 800; font-size: 17px; letter-spacing: 0.3px; }
.orders-pagination{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; }
.orders-pagination .pagination-info{ color:#606266; font-size:12px; }
.dropdown-ref{ display:inline-flex; }
.popconfirm-ref{ display:inline-flex; }
.phone-tail{ font-weight:700; letter-spacing:0.5px; }
.money{ font-variant-numeric: tabular-nums; }
.money .unit{ margin-right:2px; color:#909399; font-size:12px; }
.money--total{ color:#303133; font-weight:600; }
.money--pay{ color: var(--el-color-success); font-weight:700; }
</style>