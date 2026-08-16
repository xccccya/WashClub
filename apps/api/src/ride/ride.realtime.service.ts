import { Injectable } from '@nestjs/common';
import { NotificationGateway } from '../notification/notification.gateway.js';

@Injectable()
export class RideRealtimeService {
	constructor(private readonly gateway: NotificationGateway) {}

	toMember(memberId: number | null | undefined, type: string, data: unknown) {
		if (!memberId) return;
		this.gateway.broadcastToMember(memberId, { type, data });
	}

	toMembers(memberIds: number[], type: string, data: unknown) {
		for (const memberId of new Set(memberIds.filter((id) => Number.isFinite(id) && id > 0))) this.toMember(memberId, type, data);
	}

	toAdmins(type: string, data: unknown) {
		this.gateway.broadcastToAllAdmins({ type, data });
	}
}
