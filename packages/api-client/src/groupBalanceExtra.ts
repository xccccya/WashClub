import { createHttpClient } from './http-mutator';

export type GroupBalanceMonthlyConsumptionResponse = {
	startMonth: string;
	endMonth: string;
	total: number;
	avg: number;
	latestMonth: string | null;
	latestAmount: number;
	months: Array<{ month: string; amount: number }>;
};

export type GroupBalanceMonthlyConsumptionParams = {
	startMonth?: string;
	endMonth?: string;
	months?: number;
};

/**
 * 集团余额按月累计消费（仅统计“集团余额支付”扣减：type=DEDUCT 且 orderId 非空）
 */
export function groupBalanceControllerMonthlyConsumption(id: number, params?: GroupBalanceMonthlyConsumptionParams, options?: RequestInit) {
	const normalized = new URLSearchParams();
	Object.entries(params || {}).forEach(([k, v]) => {
		if (v === undefined) return;
		normalized.append(k, String(v));
	});
	const qs = normalized.toString();
	const url = qs ? `/group/${id}/balance/monthly-consumption?${qs}` : `/group/${id}/balance/monthly-consumption`;
	return createHttpClient<GroupBalanceMonthlyConsumptionResponse>(url, { ...options, method: 'GET' });
}

