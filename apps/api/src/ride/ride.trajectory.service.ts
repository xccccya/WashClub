import { Injectable } from '@nestjs/common';

export type RideLocationRecord = {
	id?: bigint | number | string;
	createdAt: Date;
	clientTimestamp?: Date | null;
	longitude: unknown;
	latitude: unknown;
	heading?: unknown;
	speedMetersPerSecond?: unknown;
	accuracyMeters?: unknown;
	clientPointId?: string | null;
	source?: string | null;
};

export type RideTrajectoryPoint = {
	id: string | null;
	longitude: number;
	latitude: number;
	heading: number | null;
	speedMetersPerSecond: number | null;
	accuracyMeters: number | null;
	clientPointId: string | null;
	source: string;
	effectiveAt: Date;
	createdAt: Date;
};

type RejectionReason = 'INVALID' | 'POOR_ACCURACY' | 'REPORTED_SPEED' | 'IMPOSSIBLE_JUMP' | 'DUPLICATE_OR_JITTER';

@Injectable()
export class RideTrajectoryService {
	private readonly maximumAccuracyMeters = 80;
	private readonly maximumReportedSpeedMetersPerSecond = 60;
	private readonly maximumImpliedSpeedMetersPerSecond = 55;

	process(records: RideLocationRecord[]) {
		const rejectedByReason: Record<RejectionReason, number> = {
			INVALID: 0,
			POOR_ACCURACY: 0,
			REPORTED_SPEED: 0,
			IMPOSSIBLE_JUMP: 0,
			DUPLICATE_OR_JITTER: 0,
		};
		const normalized = records.flatMap((record) => {
			const point = this.normalize(record);
			if (!point) { rejectedByReason.INVALID += 1; return []; }
			return [point];
		}).sort((left, right) => {
			const timeDiff = left.effectiveAt.getTime() - right.effectiveAt.getTime();
			if (timeDiff) return timeDiff;
			return left.createdAt.getTime() - right.createdAt.getTime();
		});

		const points: RideTrajectoryPoint[] = [];
		for (const point of normalized) {
			const anchor = point.source !== 'GPS';
			if (!anchor && point.accuracyMeters != null && point.accuracyMeters > this.maximumAccuracyMeters) {
				rejectedByReason.POOR_ACCURACY += 1;
				continue;
			}
			if (!anchor && point.speedMetersPerSecond != null && point.speedMetersPerSecond > this.maximumReportedSpeedMetersPerSecond) {
				rejectedByReason.REPORTED_SPEED += 1;
				continue;
			}
			const previous = points[points.length - 1];
			if (!previous) { points.push(point); continue; }
			if (anchor) { points.push(point); continue; }
			const elapsedSeconds = (point.effectiveAt.getTime() - previous.effectiveAt.getTime()) / 1000;
			const distanceMeters = this.distanceBetween(previous, point);
			if (elapsedSeconds <= 0) {
				if (distanceMeters <= 3) rejectedByReason.DUPLICATE_OR_JITTER += 1;
				else rejectedByReason.IMPOSSIBLE_JUMP += 1;
				continue;
			}
			const accuracyAllowance = Math.min(80, (previous.accuracyMeters ?? 15) + (point.accuracyMeters ?? 15));
			const impliedSpeed = distanceMeters / elapsedSeconds;
			if (impliedSpeed > this.maximumImpliedSpeedMetersPerSecond && distanceMeters > Math.max(100, accuracyAllowance * 2)) {
				rejectedByReason.IMPOSSIBLE_JUMP += 1;
				continue;
			}
			const jitterRadius = Math.min(20, Math.max(5, Math.max(previous.accuracyMeters ?? 10, point.accuracyMeters ?? 10) * 0.6));
			const reportedSlow = (previous.speedMetersPerSecond ?? 0) <= 1.5 && (point.speedMetersPerSecond ?? 0) <= 1.5;
			if (distanceMeters <= jitterRadius && reportedSlow) {
				rejectedByReason.DUPLICATE_OR_JITTER += 1;
				continue;
			}
			points.push(point);
		}

		return {
			points,
			rawPointCount: records.length,
			acceptedPointCount: points.length,
			rejectedPointCount: records.length - points.length,
			rejectedByReason,
		};
	}

	segment(points: RideTrajectoryPoint[], startAt: Date, endAt: Date) {
		const selected = points.filter((point) => point.effectiveAt >= startAt && point.effectiveAt <= endAt);
		let distanceMeters = 0;
		for (let index = 1; index < selected.length; index += 1) distanceMeters += this.distanceBetween(selected[index - 1], selected[index]);
		return { points: selected, distanceMeters: Math.round(distanceMeters) };
	}

	split(points: RideTrajectoryPoint[], startedAt: Date | null, arrivedDestinationAt: Date | null, settlementAt: Date | null) {
		const pickup = !startedAt ? points : points.filter((point) => point.effectiveAt <= startedAt);
		const passenger = !startedAt ? [] : points.filter((point) => point.effectiveAt >= startedAt && (!arrivedDestinationAt || point.effectiveAt <= arrivedDestinationAt));
		const settlement = !arrivedDestinationAt ? [] : points.filter((point) => point.effectiveAt >= arrivedDestinationAt && (!settlementAt || point.effectiveAt <= settlementAt));
		return { pickup, passenger, settlement };
	}

	isUsableSample(point: { accuracyMeters?: number | null; speedMetersPerSecond?: number | null }) {
		return (point.accuracyMeters == null || point.accuracyMeters <= this.maximumAccuracyMeters)
			&& (point.speedMetersPerSecond == null || point.speedMetersPerSecond <= this.maximumReportedSpeedMetersPerSecond);
	}

	distanceBetween(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) {
		const rad = (value: number) => (value * Math.PI) / 180;
		const dLat = rad(right.latitude - left.latitude);
		const dLng = rad(right.longitude - left.longitude);
		const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(left.latitude)) * Math.cos(rad(right.latitude)) * Math.sin(dLng / 2) ** 2;
		return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

	private normalize(record: RideLocationRecord): RideTrajectoryPoint | null {
		const longitude = Number(record.longitude);
		const latitude = Number(record.latitude);
		if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
		const effectiveAt = record.clientTimestamp instanceof Date && !Number.isNaN(record.clientTimestamp.getTime()) ? record.clientTimestamp : record.createdAt;
		if (!(effectiveAt instanceof Date) || Number.isNaN(effectiveAt.getTime())) return null;
		const numberOrNull = (value: unknown) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
		return {
			id: record.id == null ? null : String(record.id),
			longitude,
			latitude,
			heading: numberOrNull(record.heading),
			speedMetersPerSecond: numberOrNull(record.speedMetersPerSecond),
			accuracyMeters: numberOrNull(record.accuracyMeters),
			clientPointId: record.clientPointId || null,
			source: String(record.source || 'GPS'),
			effectiveAt,
			createdAt: record.createdAt,
		};
	}
}
