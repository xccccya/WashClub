export function formatRidePassengerLabel(phoneLastFour: unknown) {
	const digits = String(phoneLastFour || '').replace(/\D/g, '');
	return `乘客**${digits.slice(-2).padStart(2, '0')}`;
}
