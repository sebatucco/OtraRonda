import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { OrderStatus } from '#lib/types.js';

export type LiveItem = {
	id: string;
	name: string;
	quantity: number;
	unit_price: number;
	options: { group: string; name: string }[];
	note: string | null;
};

export type LiveOrder = {
	id: string;
	table_id: string;
	session_id: string;
	customer_name: string | null;
	note: string | null;
	status: OrderStatus;
	total: number;
	created_at: string;
	order_items: LiveItem[];
};

export type LiveSession = {
	id: string;
	table_id: string;
	status: 'open' | 'bill_requested';
	opened_at: string;
	orders: LiveOrder[];
};

export type LiveTable = { id: string; label: string; active: boolean; position: number };
export type LiveCall = {
	id: string;
	table_id: string;
	kind: 'waiter' | 'bill';
	created_at: string;
};

export type TableState = 'free' | 'new' | 'call' | 'bill' | 'busy';

export type TableView = {
	table: LiveTable;
	session: LiveSession | null;
	orders: LiveOrder[];
	calls: LiveCall[];
	total: number;
	state: TableState;
	since: string | null;
};

const ACTIVE: OrderStatus[] = ['pending', 'accepted', 'preparing', 'served'];

/**
 * Estado en vivo del salón: mesas, cuentas abiertas, pedidos y llamados.
 * Se suscribe a Supabase Realtime y, ante cualquier cambio, vuelve a leer todo
 * (simple y a prueba de eventos perdidos). Además refresca cada 20 s por si el wifi se corta.
 */
export class LiveBar {
	tables = $state<LiveTable[]>([]);
	sessions = $state<LiveSession[]>([]);
	calls = $state<LiveCall[]>([]);
	loaded = $state(false);
	connected = $state(false);
	lastError = $state<string | null>(null);

	views = $derived<TableView[]>(
		this.tables
			.filter((t) => t.active)
			.map((table) => {
				const session = this.sessions.find((s) => s.table_id === table.id) ?? null;
				const orders = (session?.orders ?? []).filter((o) => ACTIVE.includes(o.status));
				const calls = this.calls.filter((c) => c.table_id === table.id);
				const state: TableState = orders.some((o) => o.status === 'pending')
					? 'new'
					: calls.some((c) => c.kind === 'waiter')
						? 'call'
						: session?.status === 'bill_requested' || calls.some((c) => c.kind === 'bill')
							? 'bill'
							: session
								? 'busy'
								: 'free';
				return {
					table,
					session,
					orders,
					calls,
					total: orders.reduce((s, o) => s + Number(o.total), 0),
					state,
					since: session?.opened_at ?? null
				};
			})
	);

	/** Pedidos que el bar todavía tiene que mover (nuevos y en curso), más viejos primero. */
	queue = $derived(
		this.sessions
			.flatMap((s) => s.orders)
			.filter((o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing')
			.sort((a, b) => a.created_at.localeCompare(b.created_at))
	);

	pendingCount = $derived(this.queue.filter((o) => o.status === 'pending').length);
	alerting = $derived(this.pendingCount > 0 || this.calls.length > 0);

	#sb: SupabaseClient;
	#barId: string;
	#channel: RealtimeChannel | null = null;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#poll: ReturnType<typeof setInterval> | null = null;
	#onNew: ((kind: 'order' | 'call') => void) | null = null;
	// Interno, no necesita ser reactivo.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	#seen = new Set<string>();

	constructor(sb: SupabaseClient, barId: string) {
		this.#sb = sb;
		this.#barId = barId;
	}

	tableLabel(tableId: string) {
		return this.tables.find((t) => t.id === tableId)?.label ?? '?';
	}

	async refresh() {
		const sb = this.#sb;
		const id = this.#barId;
		const [t, s, c] = await Promise.all([
			sb.from('tables').select('id, label, active, position').eq('bar_id', id).order('position'),
			sb
				.from('table_sessions')
				.select(
					`id, table_id, status, opened_at,
					 orders ( id, table_id, session_id, customer_name, note, status, total, created_at,
					   order_items ( id, name, quantity, unit_price, options, note ) )`
				)
				.eq('bar_id', id)
				.neq('status', 'closed')
				.order('created_at', { referencedTable: 'orders' }),
			sb
				.from('waiter_calls')
				.select('id, table_id, kind, created_at')
				.eq('bar_id', id)
				.eq('resolved', false)
				.order('created_at')
		]);
		const err = t.error ?? s.error ?? c.error;
		if (err) {
			this.lastError = err.message;
			return;
		}
		this.lastError = null;
		this.tables = (t.data ?? []) as LiveTable[];
		this.sessions = (s.data ?? []) as unknown as LiveSession[];
		this.calls = (c.data ?? []) as LiveCall[];

		// Avisar solo por lo que es nuevo desde la última lectura.
		const ids = [
			...this.queue.filter((o) => o.status === 'pending').map((o) => `o:${o.id}`),
			...this.calls.map((x) => `c:${x.id}`)
		];
		const fresh = ids.filter((x) => !this.#seen.has(x));
		if (this.loaded && fresh.length)
			this.#onNew?.(fresh.some((x) => x.startsWith('c:')) ? 'call' : 'order');
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		this.#seen = new Set(ids);
		this.loaded = true;
	}

	#schedule = () => {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.refresh(), 250);
	};

	start(onNew: (kind: 'order' | 'call') => void) {
		this.#onNew = onNew;
		this.refresh();
		const filter = `bar_id=eq.${this.#barId}`;
		let ch = this.#sb.channel(`bar:${this.#barId}`);
		for (const table of ['orders', 'order_items', 'waiter_calls', 'table_sessions', 'tables']) {
			ch = ch.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table, filter },
				this.#schedule
			);
		}
		this.#channel = ch.subscribe((status) => {
			this.connected = status === 'SUBSCRIBED';
			if (status === 'SUBSCRIBED') this.#schedule();
		});
		this.#poll = setInterval(() => this.refresh(), 20000);
		document.addEventListener('visibilitychange', this.#onVisible);
		window.addEventListener('online', this.#schedule);
	}

	#onVisible = () => {
		if (document.visibilityState === 'visible') this.#schedule();
	};

	stop() {
		if (this.#channel) this.#sb.removeChannel(this.#channel);
		if (this.#poll) clearInterval(this.#poll);
		if (this.#timer) clearTimeout(this.#timer);
		document.removeEventListener('visibilitychange', this.#onVisible);
		window.removeEventListener('online', this.#schedule);
	}

	// ---------- Acciones (con actualización optimista) ----------

	async setOrderStatus(orderId: string, status: OrderStatus) {
		for (const s of this.sessions) {
			const o = s.orders.find((x) => x.id === orderId);
			if (o) o.status = status;
		}
		const { error } = await this.#sb.from('orders').update({ status }).eq('id', orderId);
		this.#schedule();
		return error;
	}

	async resolveCall(callId: string) {
		this.calls = this.calls.filter((c) => c.id !== callId);
		const { error } = await this.#sb
			.from('waiter_calls')
			.update({ resolved: true })
			.eq('id', callId);
		this.#schedule();
		return error;
	}

	async resolveCallsOf(tableId: string) {
		const ids = this.calls.filter((c) => c.table_id === tableId).map((c) => c.id);
		if (!ids.length) return null;
		this.calls = this.calls.filter((c) => c.table_id !== tableId);
		const { error } = await this.#sb.from('waiter_calls').update({ resolved: true }).in('id', ids);
		this.#schedule();
		return error;
	}

	async closeSession(sessionId: string) {
		this.sessions = this.sessions.filter((s) => s.id !== sessionId);
		const { error } = await this.#sb.rpc('close_session', { p_session_id: sessionId });
		this.#schedule();
		return error;
	}
}
