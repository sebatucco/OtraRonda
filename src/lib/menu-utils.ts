import type { CartItem } from './cart.svelte.js';
import type { Category, Product } from './types.js';

/** ¿Hay que abrir la ficha para elegir algo obligatorio (ej: tamaño)? */
export const needsChoice = (p: Product) => p.option_groups.some((g) => g.min_select > 0);

/** Ítem listo para el carrito, sin opciones (para el botón "+"). */
export const quickItem = (p: Product): Omit<CartItem, 'key'> => ({
	product_id: p.id,
	name: p.name,
	unit_price: p.price,
	quantity: 1,
	option_ids: [],
	option_names: []
});

/**
 * "¿Algo para acompañar?": productos de categorías que todavía no están en el carrito,
 * primero los destacados. Solo los que se agregan con un toque.
 */
export function suggestions(menu: Category[], inCart: Set<string>, max = 3): Product[] {
	const catsInCart = new Set(
		menu.filter((c) => c.products.some((p) => inCart.has(p.id))).map((c) => c.id)
	);
	return menu
		.filter((c) => !catsInCart.has(c.id))
		.flatMap((c) => c.products)
		.filter((p) => p.available && !needsChoice(p) && !inCart.has(p.id))
		.sort((a, b) => Number(b.featured) - Number(a.featured))
		.slice(0, max);
}
