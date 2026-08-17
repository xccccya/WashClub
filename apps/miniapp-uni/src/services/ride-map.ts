export type RideMapPoint = { longitude: number; latitude: number };
export type RideMapMarker = RideMapPoint & { id: number; title?: string; kind?: 'origin' | 'destination' | 'driver-available' | 'driver-busy' | 'driver-current' };

const MARKER_COLLISION_METERS = 22;
const MARKER_SPREAD_METERS = 18;

function distanceMeters(a: RideMapPoint, b: RideMapPoint) {
	const rad = (value: number) => value * Math.PI / 180;
	const dLat = rad(Number(b.latitude) - Number(a.latitude));
	const dLng = rad(Number(b.longitude) - Number(a.longitude));
	const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(a.latitude))) * Math.cos(rad(Number(b.latitude))) * Math.sin(dLng / 2) ** 2;
	return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function offsetPoint(point: RideMapPoint, distance: number, angle: number): RideMapPoint {
	const latitudeRadians = Number(point.latitude) * Math.PI / 180;
	const north = Math.cos(angle) * distance;
	const east = Math.sin(angle) * distance;
	return {
		longitude: Number(point.longitude) + east / (111320 * Math.max(0.2, Math.cos(latitudeRadians))),
		latitude: Number(point.latitude) + north / 110540,
	};
}

export function spreadOverlappingMarkers(markers: RideMapMarker[]) {
	const valid = markers.map((marker) => ({ ...marker, longitude: Number(marker.longitude), latitude: Number(marker.latitude) }));
	const visited = new Set<number>();
	for (let index = 0; index < valid.length; index += 1) {
		if (visited.has(index)) continue;
		const group = [index];
		visited.add(index);
		for (let cursor = 0; cursor < group.length; cursor += 1) {
			for (let candidate = index + 1; candidate < valid.length; candidate += 1) {
				if (visited.has(candidate)) continue;
				if (group.some((member) => distanceMeters(valid[member], valid[candidate]) < MARKER_COLLISION_METERS)) {
					group.push(candidate);
					visited.add(candidate);
				}
			}
		}
		if (group.length < 2) continue;
		const drivers = group.filter((member) => String(valid[member].kind || '').startsWith('driver-'));
		if (!drivers.length) continue;
		const fixedPoint = group.map((member) => valid[member]).find((marker) => !String(marker.kind || '').startsWith('driver-'));
		const center = fixedPoint || {
			longitude: group.reduce((sum, member) => sum + valid[member].longitude, 0) / group.length,
			latitude: group.reduce((sum, member) => sum + valid[member].latitude, 0) / group.length,
		};
		const movable = fixedPoint ? drivers : group;
		movable.forEach((member, position) => {
			const angle = -Math.PI / 2 + position * (Math.PI * 2 / movable.length);
			const point = offsetPoint(center, MARKER_SPREAD_METERS + Math.floor(position / 6) * 8, angle);
			valid[member] = { ...valid[member], ...point };
		});
	}
	return valid;
}

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
			title: marker.title || '', width: isDriver ? 30 : 28, height: isDriver ? 30 : 34,
			...(iconPath ? { iconPath, anchor: { x: 0.5, y: 1 } } : {}),
			callout: { content: marker.title || '', display: marker.title ? 'BYCLICK' : 'NEVER', padding: 8, borderRadius: 10, bgColor: '#ffffff', color: '#0f172a' },
		};
	});
}

export function toNativePolyline(points: RideMapPoint[]) {
	return points.length > 1 ? [{ points: points.map((point) => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) })), color: '#3b82f6', width: 7, borderColor: '#ffffff', borderWidth: 2, arrowLine: true }] : [];
}
