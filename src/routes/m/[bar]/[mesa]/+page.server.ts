import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Bar, Category, Product } from '#lib/types.js';

/**
 * Menú de una mesa. URL del QR: /m/<slug-del-bar>/<token-de-la-mesa>
 * El token es aleatorio para que nadie pueda "pedir" desde la mesa de otro adivinando la URL.
 */
export const load: PageServerLoad = async ({ params, locals: { supabase }, setHeaders }) => {
	const { data: table } = await supabase
		.rpc('resolve_table', { p_token: params.mesa })
		.maybeSingle<{ bar_id: string; bar_slug: string; table_id: string; table_label: string }>();

	if (!table || table.bar_slug !== params.bar) {
		error(404, 'Este QR no corresponde a ninguna mesa. Pedile ayuda al mozo.');
	}

	const [{ data: bar }, { data: categories }] = await Promise.all([
		supabase
			.from('bars')
			.select(
				'id, slug, name, logo_url, cover_url, accent_color, currency, ordering_enabled, order_mode'
			)
			.eq('id', table.bar_id)
			.single<Bar>(),
		supabase
			.from('categories')
			.select(
				`id, name,
				 products ( id, category_id, name, description, price, image_url, tags, available, featured, position,
				   option_groups ( id, name, min_select, max_select, position,
				     options ( id, name, price_delta, available, position ) ) )`
			)
			.eq('bar_id', table.bar_id)
			.eq('active', true)
			.eq('products.active', true)
			.order('position')
			.order('position', { referencedTable: 'products' })
	]);

	if (!bar) error(404, 'Bar no encontrado');

	// Postgres devuelve numeric como string: normalizamos y ordenamos los anidados.
	type Positioned = { position?: number };
	const byPos = (a: Positioned, b: Positioned) => (a.position ?? 0) - (b.position ?? 0);

	const menu: Category[] = ((categories ?? []) as unknown as Category[])
		.map((c) => ({
			id: c.id,
			name: c.name,
			products: c.products.map((p): Product => ({
				...p,
				price: Number(p.price),
				option_groups: [...(p.option_groups ?? [])].sort(byPos).map((g) => ({
					...g,
					options: [...g.options]
						.sort(byPos)
						.map((o) => ({ ...o, price_delta: Number(o.price_delta) }))
				}))
			}))
		}))
		.filter((c) => c.products.length > 0);

	// El menú cambia poco: cache corto en el CDN, siempre fresco en pocos segundos.
	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' });

	return {
		bar,
		table: { id: table.table_id, label: table.table_label, token: params.mesa },
		menu
	};
};
