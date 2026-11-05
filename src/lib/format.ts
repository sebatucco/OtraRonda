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
	nuevo: 'Nuevo',
	picante: 'Picante',
	sin_tacc: 'Sin TACC',
	vegano: 'Vegano',
	vegetariano: 'Vegetariano',
	sin_alcohol: 'Sin alcohol'
};

/** Colores de las etiquetas: se reconocen de un vistazo. */
export const TAG_STYLES: Record<string, string> = {
	nuevo: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
	picante: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
	sin_tacc: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
	vegano: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
	vegetariano: 'bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200',
	sin_alcohol: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200'
};

/** Para buscar sin importar tildes ni mayúsculas. */
export const normalize = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
