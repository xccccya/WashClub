import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

export type RideMapFitPadding = [number, number, number, number];

type RideMapFitOptions = {
	topSelector: string;
	bottomSelector: string;
	topFallbackRpx: number;
	bottomFallbackRpx: number;
	sideRpx?: number;
	marginRpx?: number;
};

function rpxToPx(value: number) {
	return Math.max(0, Math.round(uni.upx2px(value)));
}

export function useRideMapFitPadding(options: RideMapFitOptions) {
	const instance = getCurrentInstance();
	const side = rpxToPx(options.sideRpx ?? 24);
	const margin = rpxToPx(options.marginRpx ?? 24);
	const paddingPx = ref<RideMapFitPadding>([
		rpxToPx(options.topFallbackRpx),
		side,
		rpxToPx(options.bottomFallbackRpx),
		side,
	]);
	let settleTimer: ReturnType<typeof setTimeout> | undefined;

	function applyPadding(topRect: any, bottomRect: any) {
		const system = uni.getSystemInfoSync?.() || {};
		const windowHeight = Number(system.windowHeight || system.screenHeight || 0);
		const top = Number.isFinite(Number(topRect?.bottom))
			? Math.round(Number(topRect.bottom) + margin)
			: rpxToPx(options.topFallbackRpx);
		const bottom = windowHeight > 0 && Number.isFinite(Number(bottomRect?.top))
			? Math.round(windowHeight - Number(bottomRect.top) + margin)
			: rpxToPx(options.bottomFallbackRpx);
		const next: RideMapFitPadding = [Math.max(0, top), side, Math.max(0, bottom), side];
		if (next.some((value, index) => value !== paddingPx.value[index])) paddingPx.value = next;
	}

	function measure() {
		try {
			const query = uni.createSelectorQuery();
			if (instance?.proxy && typeof query.in === 'function') query.in(instance.proxy);
			query.select(options.topSelector).boundingClientRect();
			query.select(options.bottomSelector).boundingClientRect();
			query.exec((results: any[]) => applyPadding(results?.[0], results?.[1]));
		} catch {
			applyPadding(null, null);
		}
	}

	function refresh() {
		if (settleTimer) clearTimeout(settleTimer);
		void nextTick(() => {
			measure();
			settleTimer = setTimeout(measure, 380);
		});
	}

	function onWindowResize() { refresh(); }
	onMounted(() => {
		refresh();
		try { uni.onWindowResize?.(onWindowResize); } catch {}
	});
	onBeforeUnmount(() => {
		if (settleTimer) clearTimeout(settleTimer);
		try { uni.offWindowResize?.(onWindowResize); } catch {}
	});

	return { paddingPx, refresh };
}
