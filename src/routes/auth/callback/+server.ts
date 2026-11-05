import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Destino del link mágico del email: canjea el código por una sesión. */
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/panel';
	// Solo rutas internas, para no convertirnos en un redirector abierto.
	const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/panel';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, safeNext);
	}
	redirect(303, '/panel/login?error=link');
};
