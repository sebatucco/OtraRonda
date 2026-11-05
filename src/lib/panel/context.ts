import { getContext, setContext } from 'svelte';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LiveBar } from './live.svelte.js';

export type PanelBar = {
	id: string;
	slug: string;
	name: string;
	logo_url: string | null;
	accent_color: string;
	currency: string;
	order_mode: 'open' | 'approve_first';
	ordering_enabled: boolean;
};

export type PanelContext = {
	supabase: SupabaseClient;
	live: LiveBar;
	readonly bar: PanelBar;
	readonly role: 'owner' | 'staff';
};

const KEY = Symbol('panel');

export const setPanel = (ctx: PanelContext) => setContext(KEY, ctx);
export const usePanel = () => getContext<PanelContext>(KEY);
