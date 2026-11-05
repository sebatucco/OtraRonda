const formatters = new Map<string, Intl.NumberFormat>();

/** $ 4.500 — sin decimales cuando no hacen falta. */
export function price(amount: number, currency = 'ARS') {
	let f = formatters.get(currency);
	if (!f) {
		f = new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency,
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		});
		formatters.set(currency, f);
	}
	return f.format(amount);
}

export const TAG_LABELS: Record<string, string> = {
	sin_tacc: 'Sin TACC',
	vegano: 'Vegano',
	vegetariano: 'Vegetariano',
	picante: 'Picante',
	sin_alcohol: 'Sin alcohol'
};
