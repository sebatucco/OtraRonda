/** localStorage tolerante: modo incógnito, bloqueado o lleno nunca rompe la app. */
export function readJSON<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

export function writeJSON(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* sin almacenamiento: seguimos en memoria */
	}
}
