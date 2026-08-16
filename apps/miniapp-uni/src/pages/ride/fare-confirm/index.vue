<template>
	<view class="page">
		<RidePageHeader title="确认行程费用" subtitle="费用将由服务端重新核算" />
		<view class="card">
			<view class="row"><view><strong>停车费</strong><text>按实际发生填写</text></view><view class="money-input"><text>¥</text><input v-model.number="parking" type="digit" placeholder="0.00" /></view></view>
			<view class="row"><view><strong>其他费用</strong><text>仅填写已向乘客说明的费用</text></view><view class="money-input"><text>¥</text><input v-model.number="other" type="digit" placeholder="0.00" /></view></view>
			<view class="remark"><text>费用备注</text><textarea v-model="remark" maxlength="191" placeholder="选填，例如停车场名称或费用说明" /></view>
			<view class="hint">最终距离和时间由服务器根据行程定位记录计算，客户端不能修改行程基础金额。</view>
			<button class="primary" :loading="loading" :disabled="loading" @tap="submit">提交最终费用</button>
		</view>
	</view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import RidePageHeader from '../../../components/ride/RidePageHeader.vue';
import { rideApi } from '../../../services/ride';
let id=0;const parking=ref(0),other=ref(0),remark=ref(''),loading=ref(false);
async function submit(){if(loading.value)return;loading.value=true;try{const extraFees:any[]=[];if(parking.value>0)extraFees.push({type:'PARKING',amount:Number(parking.value),remark:remark.value});if(other.value>0)extraFees.push({type:'OTHER',amount:Number(other.value),remark:remark.value});await rideApi.finalize(id,{finalDistanceMeters:0,finalDurationSeconds:0,extraFees});uni.redirectTo({url:`/pages/ride/detail/index?id=${id}&driver=1`})}catch(error:any){uni.showToast({title:error?.message||'费用确认失败',icon:'none'})}finally{loading.value=false}}
onLoad((query:any)=>{id=Number(query?.id||0)});
</script>
<style scoped>
.page{min-height:100vh;padding-bottom:calc(env(safe-area-inset-bottom) + 32rpx);background:linear-gradient(180deg,#eaf5ff 0,#fff1f7 360rpx,#f8fafc 720rpx);box-sizing:border-box}.card{margin:10rpx 24rpx 0;padding:28rpx;border-radius:30rpx;background:rgba(255,255,255,.96);box-shadow:0 14rpx 38rpx rgba(15,23,42,.08)}.row{display:flex;align-items:center;justify-content:space-between;padding:22rpx 0;border-bottom:1rpx solid #e2e8f0}.row strong,.row text{display:block}.row strong{color:#0f172a;font-size:27rpx}.row view>text{margin-top:5rpx;color:#94a3b8;font-size:20rpx}.money-input{display:flex;align-items:center;gap:6rpx}.money-input text{margin:0;color:#3580ff;font-size:28rpx;font-weight:800}.money-input input{width:150rpx;text-align:right;color:#0f172a;font-size:30rpx;font-weight:800}.remark{padding:24rpx 0}.remark>text{color:#334155;font-size:25rpx;font-weight:700}.remark textarea{width:100%;height:150rpx;margin-top:14rpx;padding:18rpx;border-radius:20rpx;background:#f8fafc;font-size:24rpx;box-sizing:border-box}.hint{padding:18rpx;border-radius:18rpx;background:#eff6ff;color:#475569;font-size:22rpx;line-height:1.6}.primary{margin-top:26rpx;border:0;border-radius:999rpx;background:#0f172a;color:#fff;font-weight:700}button::after{border:0}
</style>
