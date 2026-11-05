import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$app/env/public';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				for (const { name, value, options } of cookies) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	/** Valida el JWT contra Supabase (no confiar solo en la cookie). */
	event.locals.getUser = async () => {
		const { data, error } = await event.locals.supabase.auth.getUser();
		return error ? null : data.user;
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};
