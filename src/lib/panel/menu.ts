import type { SupabaseClient } from '@supabase/supabase-js';
import { compressImage } from '#lib/image.js';

export type EditOption = {
	id?: string;
	name: string;
	price_delta: number;
	available: boolean;
	position?: number;
};
export type EditGroup = {
	id?: string;
	name: string;
	min_select: number;
	max_select: number;
	options: EditOption[];
	position?: number;
};
export type EditProduct = {
	id?: string;
	category_id: string;
	name: string;
	description: string;
	price: number;
	image_url: string | null;
	tags: string[];
	available: boolean;
	active: boolean;
	position: number;
	option_groups: EditGroup[];
};
export type EditCategory = {
	id: string;
	name: string;
	position: number;
	active: boolean;
	products: EditProduct[];
};

type Positioned = { position?: number };
const byPos = (a: Positioned, b: Positioned) => (a.position ?? 0) - (b.position ?? 0);

/** Lee el menú completo del bar (incluye ocultos, solo para el panel). */
export async function loadMenu(sb: SupabaseClient, barId: string): Promise<EditCategory[]> {
	const { data, error } = await sb
		.from('categories')
		.select(
			`id, name, position, active,
			 products ( id, category_id, name, description, price, image_url, tags, available, active, position,
			   option_groups ( id, name, min_select, max_select, position,
			     options ( id, name, price_delta, available, position ) ) )`
		)
		.eq('bar_id', barId)
		.order('position');
	if (error) throw error;
	return (
		(data ?? []) as unknown as (EditCategory & { products: (EditProduct & Positioned)[] })[]
	).map((c) => ({
		...c,
		products: [...(c.products ?? [])].sort(byPos).map((p) => ({
			...p,
			description: p.description ?? '',
			price: Number(p.price),
			option_groups: [...(p.option_groups ?? [])].sort(byPos).map((g) => ({
				...g,
				options: [...(g.options ?? [])]
					.sort(byPos)
					.map((o) => ({ ...o, price_delta: Number(o.price_delta) }))
			}))
		}))
	}));
}

/** Guarda un producto y reemplaza sus grupos de opciones (los pedidos guardan copia, no se rompen). */
export async function saveProduct(sb: SupabaseClient, barId: string, p: EditProduct) {
	const row = {
		bar_id: barId,
		category_id: p.category_id,
		name: p.name.trim(),
		description: p.description.trim() || null,
		price: p.price,
		image_url: p.image_url,
		tags: p.tags,
		available: p.available,
		active: p.active,
		position: p.position
	};
	const res = p.id
		? await sb.from('products').update(row).eq('id', p.id).select('id').single()
		: await sb.from('products').insert(row).select('id').single();
	if (res.error) throw res.error;
	const productId = res.data.id as string;

	const del = await sb.from('option_groups').delete().eq('product_id', productId);
	if (del.error) throw del.error;

	for (const [gi, g] of p.option_groups.entries()) {
		const options = g.options.filter((o) => o.name.trim());
		if (!g.name.trim() || options.length === 0) continue;
		const max = Math.max(1, Math.min(g.max_select, options.length));
		const gr = await sb
			.from('option_groups')
			.insert({
				bar_id: barId,
				product_id: productId,
				name: g.name.trim(),
				min_select: Math.min(g.min_select, max),
				max_select: max,
				position: gi
			})
			.select('id')
			.single();
		if (gr.error) throw gr.error;
		const or = await sb.from('options').insert(
			options.map((o, oi) => ({
				bar_id: barId,
				group_id: gr.data.id,
				name: o.name.trim(),
				price_delta: o.price_delta || 0,
				available: o.available,
				position: oi
			}))
		);
		if (or.error) throw or.error;
	}
	return productId;
}

/** Sube una foto comprimida al bucket público "menu" y devuelve su URL. */
export async function uploadImage(
	sb: SupabaseClient,
	barId: string,
	file: File,
	opts: { max?: number } = {}
) {
	const blob = await compressImage(file, { max: opts.max ?? 1000 });
	const path = `${barId}/${crypto.randomUUID()}.webp`;
	const { error } = await sb.storage
		.from('menu')
		.upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
	if (error) throw error;
	return sb.storage.from('menu').getPublicUrl(path).data.publicUrl;
}

/** Intercambia la posición de dos filas (subir/bajar). */
export async function swapPositions(
	sb: SupabaseClient,
	table: 'categories' | 'products' | 'tables',
	a: { id: string; position: number },
	b: { id: string; position: number }
) {
	const pa = a.position === b.position ? b.position + 1 : b.position;
	const [r1, r2] = await Promise.all([
		sb.from(table).update({ position: pa }).eq('id', a.id),
		sb.from(table).update({ position: a.position }).eq('id', b.id)
	]);
	if (r1.error ?? r2.error) throw r1.error ?? r2.error;
}
