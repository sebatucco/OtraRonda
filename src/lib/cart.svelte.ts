import { readJSON, writeJSON } from './storage.js';
import type { CartLine } from './types.js';

export type CartItem = {
	/** Mismo producto + mismas opciones + misma nota = misma línea. */
	key: string;
	product_id: string;
	name: string;
	unit_price: number;
	quantity: number;
	option_ids: string[];
	option_names: string[];
	note?: string;
};

export function lineKey(product_id: string, option_ids: string[], note = '') {
	return [product_id, [...option_ids].sort().join(','), note.trim()].join('|');
}

/** Carrito de una mesa, guardado en el celular para no perderlo si se recarga la página. */
export class Cart {
	items = $state<CartItem[]>([]);
	count = $derived(this.items.reduce((n, i) => n + i.quantity, 0));
	total = $derived(this.items.reduce((s, i) => s + i.unit_price * i.quantity, 0));

	#key: string;
	#lastKey: string;

	constructor(tableToken: string) {
		this.#key = `or:cart:${tableToken}`;
		this.#lastKey = `or:last:${tableToken}`;
		if (typeof localStorage !== 'undefined') this.items = readJSON<CartItem[]>(this.#key, []);
	}

	add(item: Omit<CartItem, 'key'>) {
		const key = lineKey(item.product_id, item.option_ids, item.note);
		const existing = this.items.find((i) => i.key === key);
		if (existing) existing.quantity = Math.min(50, existing.quantity + item.quantity);
		else this.items.push({ ...item, key });
		this.#save();
	}

	setQuantity(key: string, quantity: number) {
		if (quantity <= 0) this.items = this.items.filter((i) => i.key !== key);
		else {
			const item = this.items.find((i) => i.key === key);
			if (item) item.quantity = Math.min(50, quantity);
		}
		this.#save();
	}

	clear() {
		this.items = [];
		this.#save();
	}

	/** Guarda lo enviado para el botón "Otra ronda igual". */
	rememberAsLastRound() {
		writeJSON(this.#lastKey, $state.snapshot(this.items));
	}

	get lastRound(): CartItem[] {
		return typeof localStorage === 'undefined' ? [] : readJSON<CartItem[]>(this.#lastKey, []);
	}

	toPayload(): CartLine[] {
		return this.items.map((i) => ({
			product_id: i.product_id,
			quantity: i.quantity,
			option_ids: i.option_ids,
			...(i.note ? { note: i.note } : {})
		}));
	}

	#save() {
		writeJSON(this.#key, $state.snapshot(this.items));
	}
}
