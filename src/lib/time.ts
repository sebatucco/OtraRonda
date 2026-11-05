const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto', style: 'short' });

/** "hace 3 min" — pensado para pedidos que esperan. */
export function ago(iso: string, now = Date.now()) {
	const s = Math.round((new Date(iso).getTime() - now) / 1000);
	if (s > -45) return 'recién';
	const m = Math.round(s / 60);
	if (m > -60) return rtf.format(m, 'minute');
	return rtf.format(Math.round(m / 60), 'hour');
}

export function minutesSince(iso: string, now = Date.now()) {
	return Math.floor((now - new Date(iso).getTime()) / 60000);
}

export const clock = (iso: string) =>
	new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
