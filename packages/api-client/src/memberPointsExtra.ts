import { createHttpClient } from './http-mutator';

export type MemberPointsAdminLogsPagedParams = {
	page?: number;
	pageSize?: number;
	memberId?: number;
	source?: 'PAY' | 'ADMIN' | 'REFUND' | 'USE' | string;
	orderNo?: string;
	keyword?: string;
	from?: string;
	to?: string;
};

export type MemberPointsAdminLogsPagedItem = {
	id: number;
	createdAt: string;
	memberId: number;
	member: { id: number; uid?: number | null; name?: string | null; phone?: string | null } | null;
	change: number;
	source: string;
	desc?: string | null;
	orderId?: number | null;
	orderNo?: string | null;
	operatorUserId?: number | null;
};

export type MemberPointsAdminLogsPagedResponse = {
	total: number;
	page: number;
	pageSize: number;
	items: MemberPointsAdminLogsPagedItem[];
};

export async function memberPointsControllerListLogsPaged(
	params: MemberPointsAdminLogsPagedParams = {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	options?: any,
): Promise<MemberPointsAdminLogsPagedResponse> {
	return createHttpClient<MemberPointsAdminLogsPagedResponse>(`/member-points/logs-paged`, {
		...(options || {}),
		method: 'GET',
		query: params,
	});
}

