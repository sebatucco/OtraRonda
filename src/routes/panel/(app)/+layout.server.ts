import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { PanelBar } from '#lib/panel/context.js';

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, `/panel/login?next=${encodeURIComponent(url.pathname)}`);

	const { data: memberships } = await locals.supabase
		.from('bar_members')
		.select(
			'role, bars ( id, slug, name, logo_url, accent_color, currency, order_mode, ordering_enabled )'
		)
		.eq('user_id', user.id);

	const list = (memberships ?? []) as unknown as { role: 'owner' | 'staff'; bars: PanelBar }[];
	if (list.length === 0) redirect(303, '/panel/nuevo');

	// Si la persona trabaja en varios bares, recordamos el último elegido.
	const wanted = cookies.get('or_bar');
	const current = list.find((m) => m.bars.id === wanted) ?? list[0];

	return {
		bar: current.bars,
		role: current.role,
		bars: list.map((m) => ({ id: m.bars.id, name: m.bars.name })),
		email: user.email ?? ''
	};
};
