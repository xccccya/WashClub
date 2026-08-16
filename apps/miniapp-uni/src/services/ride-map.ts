export type RideMapPoint = { longitude: number; latitude: number };
export type RideMapMarker = RideMapPoint & { id: number; title?: string; kind?: 'origin' | 'destination' | 'driver-available' | 'driver-busy' | 'driver-current' };

export function toNativeMarkers(markers: RideMapMarker[]) {
	return markers.map((marker) => ({
		id: marker.id,
		longitude: Number(marker.longitude), latitude: Number(marker.latitude),
		title: marker.title || '', width: 36, height: 36,
		...(String(marker.kind || '').startsWith('driver-') ? { iconPath: '/static/icons/ride-vehicle-location.svg', anchor: { x: 0.5, y: 1 } } : {}),
		callout: { content: marker.title || '', display: marker.title ? 'BYCLICK' : 'NEVER', padding: 6, borderRadius: 6 },
	}));
}

export function toNativePolyline(points: RideMapPoint[]) {
	return points.length > 1 ? [{ points: points.map((point) => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) })), color: '#2563eb', width: 6, arrowLine: true }] : [];
}
