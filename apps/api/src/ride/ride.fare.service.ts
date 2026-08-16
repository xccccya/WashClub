import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type FareSetting = {
	baseFare: Prisma.Decimal | number | string;
	includedDistanceKm: Prisma.Decimal | number | string;
	includedDurationMinutes: number;
	pricePerKm: Prisma.Decimal | number | string;
	pricePerMinute: Prisma.Decimal | number | string;
	minimumFare: Prisma.Decimal | number | string;
};

@Injectable()
export class RideFareService {
	calculate(setting: FareSetting, distanceMeters: number, durationSeconds: number, extraAmount = 0) {
		if (!Number.isFinite(distanceMeters) || distanceMeters < 0) throw new BadRequestException('行程距离无效');
		if (!Number.isFinite(durationSeconds) || durationSeconds < 0) throw new BadRequestException('行程时长无效');
		const baseFare = Number(setting.baseFare || 0);
		const distanceKm = distanceMeters / 1000;
		const durationMinutes = durationSeconds / 60;
		const chargeableKm = Math.max(0, distanceKm - Number(setting.includedDistanceKm || 0));
		const chargeableMinutes = Math.max(0, durationMinutes - Number(setting.includedDurationMinutes || 0));
		const distanceFare = chargeableKm * Number(setting.pricePerKm || 0);
		const durationFare = chargeableMinutes * Number(setting.pricePerMinute || 0);
		const subtotal = baseFare + distanceFare + durationFare + Math.max(0, Number(extraAmount || 0));
		const minimumFare = Number(setting.minimumFare || 0);
		const amount = Math.max(minimumFare, subtotal);
		return {
			baseFare: this.money(baseFare),
			includedDistanceKm: this.distance(Number(setting.includedDistanceKm || 0)),
			includedDurationMinutes: this.distance(Number(setting.includedDurationMinutes || 0)),
			chargeableDistanceKm: this.distance(chargeableKm),
			chargeableDurationMinutes: this.distance(chargeableMinutes),
			pricePerKm: this.money(Number(setting.pricePerKm || 0)),
			pricePerMinute: this.money(Number(setting.pricePerMinute || 0)),
			distanceFare: this.money(distanceFare),
			durationFare: this.money(durationFare),
			extraAmount: this.money(extraAmount),
			subtotal: this.money(subtotal),
			minimumFare: this.money(minimumFare),
			minimumApplied: minimumFare > subtotal,
			amount: this.money(amount),
		};
	}

	private distance(value: number) {
		return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
	}

	private money(value: number) {
		return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
	}
}
