import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$app/env/public';

/** Cliente de Supabase para el navegador (panel en tiempo real, carrito). */
export function browserClient() {
	if (!isBrowser()) throw new Error('browserClient() solo se usa en el navegador');
	return createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
