import QRCode from 'qrcode';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { bar } = await parent();
	const { data } = await locals.supabase
		.from('tables')
		.select('id, label, token')
		.eq('bar_id', bar.id)
		.eq('active', true)
		.order('position');

	const tables = await Promise.all(
		(data ?? []).map(async (t) => ({
			id: t.id as string,
			label: t.label as string,
			svg: await QRCode.toString(`${url.origin}/m/${bar.slug}/${t.token}`, {
				type: 'svg',
				margin: 0,
				errorCorrectionLevel: 'M'
			})
		}))
	);
	return { tables };
};
