export type RideMapPoint = { longitude: number; latitude: number };
export type RideMapMarker = RideMapPoint & { id: number; title?: string; kind?: 'origin' | 'destination' | 'driver-available' | 'driver-busy' | 'driver-current' };

export function toNativeMarkers(markers: RideMapMarker[]) {
	return markers.map((marker) => {
		const isDriver = String(marker.kind || '').startsWith('driver-');
		const iconPath = marker.kind === 'origin'
			? '/static/icons/ride-origin-marker.svg'
			: marker.kind === 'destination'
				? '/static/icons/ride-destination-marker.svg'
				: isDriver ? '/static/icons/ride-vehicle-location.svg' : undefined;
		return {
			id: marker.id,
			longitude: Number(marker.longitude), latitude: Number(marker.latitude),
			title: marker.title || '', width: isDriver ? 40 : 36, height: isDriver ? 40 : 44,
			...(iconPath ? { iconPath, anchor: { x: 0.5, y: 1 } } : {}),
			callout: { content: marker.title || '', display: marker.title ? 'BYCLICK' : 'NEVER', padding: 8, borderRadius: 10, bgColor: '#ffffff', color: '#0f172a' },
		};
	});
}

export function toNativePolyline(points: RideMapPoint[]) {
	return points.length > 1 ? [{ points: points.map((point) => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) })), color: '#2563eb', width: 6, arrowLine: true }] : [];
}
