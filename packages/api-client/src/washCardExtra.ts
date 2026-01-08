import { createHttpClient } from './http-mutator';

export type WashCardAdminMemberStatsParams = {
	memberId: number;
};

export type WashCardAdminMemberStatsResponse = {
	memberId: number;
	// 累计服务划扣次数（按会员维度聚合）
	deductTimes: number;
	// 当前可用洗车卡总余次（持有人 + 被共享可见卡）
	remainingTimes: number;
};

export async function washCardControllerAdminMemberStats(
	params: WashCardAdminMemberStatsParams,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	options?: any,
): Promise<WashCardAdminMemberStatsResponse> {
	return createHttpClient<WashCardAdminMemberStatsResponse>(`/wash-card/member-stats`, {
		...(options || {}),
		method: 'GET',
		query: params,
	});
}

