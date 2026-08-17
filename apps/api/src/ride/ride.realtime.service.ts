import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service.js';

@Injectable()
export class RideRealtimeService {
	constructor(private readonly notifications: NotificationService) {}

	toMember(memberId: number | null | undefined, type: string, data: unknown) {
		if (!memberId) return;
		this.notifications.broadcastRealtimeToMember(memberId, { type, data });
	}

	toMembers(memberIds: number[], type: string, data: unknown) {
		for (const memberId of new Set(memberIds.filter((id) => Number.isFinite(id) && id > 0))) this.toMember(memberId, type, data);
	}

	toAdmins(type: string, data: unknown) {
		this.notifications.broadcastRealtimeToAllAdmins({ type, data });
	}
}
