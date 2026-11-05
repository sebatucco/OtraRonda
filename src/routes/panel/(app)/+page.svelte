<script lang="ts">
	import { onMount } from 'svelte';
	import { BellRing, ReceiptText, CircleDollarSign } from '@lucide/svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import OrderCard from '#lib/components/panel/OrderCard.svelte';
	import { usePanel } from '#lib/panel/context.js';
	import type { TableState } from '#lib/panel/live.svelte.js';
	import { price } from '#lib/format.js';
	import { ago } from '#lib/time.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';
	import type { OrderStatus } from '#lib/types.js';

	const panel = usePanel();
	const live = panel.live;
	const bar = $derived(panel.bar);
	const approveFirst = $derived(bar.order_mode === 'approve_first');

	let now = $state(Date.now());
	onMount(() => {
		const id = setInterval(() => (now = Date.now()), 30000);
		return () => clearInterval(id);
	});

	let tab = $state<'mesas' | 'pedidos'>('pedidos');
	let openTableId = $state<string | null>(null);
	let detailOpen = $state(false);
	const detail = $derived(live.views.find((v) => v.table.id === openTableId) ?? null);

	function openTable(id: string) {
		openTableId = id;
		detailOpen = true;
	}

	async function setStatus(id: string, s: OrderStatus) {
		const err = await live.setOrderStatus(id, s);
		if (err) toast(friendlyError(err), 'error');
	}

	async function closeTable() {
		if (!detail?.session) return;
		if (!confirm(`¿Cerrar la mesa ${detail.table.label}? (ya cobrada)`)) return;
		const err = await live.closeSession(detail.session.id);
		if (err) toast(friendlyError(err), 'error');
		else {
			toast(`Mesa ${detail.table.label} cerrada`);
			detailOpen = false;
		}
	}

	const STYLE: Record<TableState, { label: string; cls: string }> = {
		new: {
			label: 'Pedido nuevo',
			cls: 'bg-accent text-white ring-accent shadow-[0_0_0_5px_color-mix(in_oklab,var(--color-accent)_25%,transparent)]'
		},
		call: { label: 'Llaman al mozo', cls: 'bg-amber-400 text-amber-950 ring-amber-500' },
		bill: { label: 'Pide la cuenta', cls: 'bg-sky-500 text-white ring-sky-600' },
		busy: { label: 'Ocupada', cls: 'bg-card text-ink ring-ok ring-2' },
		free: { label: 'Libre', cls: 'bg-card text-ink-soft ring-line' }
	};

	const counts = $derived({
		busy: live.views.filter((v) => v.state !== 'free').length,
		free: live.views.filter((v) => v.state === 'free').length
	});
</script>

<div class="px-4 py-5 md:px-8 md:py-8">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-extrabold">Salón</h1>
			<p class="text-ink-soft">
				{counts.busy} ocupadas · {counts.free} libres
			</p>
		</div>
		<div class="flex rounded-full bg-card p-1 ring-1 ring-line lg:hidden">
			{#each [['pedidos', `Pedidos${live.queue.length ? ` (${live.queue.length})` : ''}`], ['mesas', 'Mesas']] as [value, label] (value)}
				<button
					type="button"
					class={[
						'rounded-full px-4 py-2 text-sm font-bold',
						tab === value ? 'bg-ink text-paper' : 'text-ink-soft'
					]}
					onclick={() => (tab = value as 'mesas' | 'pedidos')}>{label}</button
				>
			{/each}
		</div>
	</div>

	<!-- Llamados: arriba de todo, imposibles de ignorar -->
	{#if live.calls.length}
		<ul class="mt-5 flex flex-col gap-2">
			{#each live.calls as c (c.id)}
				<li
					class={[
						'flex items-center gap-3 rounded-2xl px-4 py-3 font-bold',
						c.kind === 'waiter' ? 'bg-amber-400 text-amber-950' : 'bg-sky-500 text-white'
					]}
				>
					{#if c.kind === 'waiter'}<BellRing size={22} />{:else}<ReceiptText size={22} />{/if}
					<span class="flex-1"
						>Mesa {live.tableLabel(c.table_id)} · {c.kind === 'waiter'
							? 'llama al mozo'
							: 'pide la cuenta'} · {ago(c.created_at, now)}</span
					>
					<button
						type="button"
						class="rounded-full bg-white/90 px-4 py-2 text-sm text-ink"
						onclick={() => live.resolveCall(c.id)}>Atendido</button
					>
				</li>
			{/each}
		</ul>
	{/if}

	{#if !live.loaded}
		<p class="py-20 text-center text-ink-soft">Cargando el salón…</p>
	{:else}
		<div class="mt-6 grid gap-8 lg:grid-cols-[1fr_minmax(22rem,28rem)]">
			<!-- Mesas -->
			<section class={[tab !== 'mesas' && 'hidden lg:block']} aria-label="Mesas">
				<h2 class="mb-3 hidden text-lg font-extrabold lg:block">Mesas</h2>
				{#if live.views.length === 0}
					<p class="text-ink-soft">No tenés mesas activas. Creálas en “Mesas y QR”.</p>
				{/if}
				<ul class="grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-3">
					{#each live.views as v (v.table.id)}
						{@const s = STYLE[v.state]}
						<li>
							<button
								type="button"
								onclick={() => openTable(v.table.id)}
								class={[
									'flex aspect-square w-full flex-col justify-between rounded-card p-3 text-left ring-1 transition active:scale-[0.97]',
									s.cls
								]}
							>
								<span class="font-display text-2xl leading-none font-extrabold sm:text-3xl"
									>{v.table.label}</span
								>
								<span class="text-xs leading-tight font-bold">
									{s.label}
									{#if v.state !== 'free'}
										<span class="block font-semibold opacity-80"
											>{[
												v.total ? price(v.total, bar.currency) : '',
												v.since ? ago(v.since, now) : ''
											]
												.filter(Boolean)
												.join(' · ')}</span
										>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>

			<!-- Cola de pedidos -->
			<section class={[tab !== 'pedidos' && 'hidden lg:block']} aria-label="Pedidos en curso">
				<h2 class="mb-3 hidden text-lg font-extrabold lg:block">Pedidos en curso</h2>
				{#if live.queue.length === 0}
					<div class="rounded-card bg-card px-6 py-12 text-center ring-1 ring-line">
						<p class="text-lg font-bold">Todo al día 🍻</p>
						<p class="mt-1 text-ink-soft">Los pedidos nuevos aparecen acá y suenan.</p>
					</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#each live.queue as o (o.id)}
							<OrderCard
								order={o}
								tableLabel={live.tableLabel(o.table_id)}
								currency={bar.currency}
								{approveFirst}
								{now}
								onstatus={setStatus}
							/>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>

<Sheet bind:open={detailOpen} title={detail ? `Mesa ${detail.table.label}` : ''} wide>
	{#if detail}
		{#if detail.calls.length}
			<div class="mb-4 flex flex-wrap items-center gap-2">
				{#each detail.calls as c (c.id)}
					<span
						class={[
							'rounded-full px-3 py-1 text-sm font-bold',
							c.kind === 'waiter' ? 'bg-amber-400 text-amber-950' : 'bg-sky-500 text-white'
						]}>{c.kind === 'waiter' ? 'Llama al mozo' : 'Pide la cuenta'}</span
					>
				{/each}
				<button
					type="button"
					class="text-sm font-bold text-accent"
					onclick={() => live.resolveCallsOf(detail.table.id)}>Marcar atendido</button
				>
			</div>
		{/if}

		{#if detail.orders.length === 0}
			<p class="py-10 text-center text-ink-soft">
				{detail.session ? 'Mesa abierta, sin pedidos todavía.' : 'Mesa libre.'}
			</p>
		{:else}
			<div class="flex flex-col gap-3">
				{#each detail.orders as o (o.id)}
					<OrderCard
						order={o}
						tableLabel={detail.table.label}
						currency={bar.currency}
						{approveFirst}
						{now}
						showTable={false}
						onstatus={setStatus}
					/>
				{/each}
			</div>
		{/if}
	{/if}

	{#snippet footer()}
		{#if detail?.session}
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-sm text-ink-soft">Total de la mesa</p>
					<p class="text-2xl font-extrabold tabular-nums">{price(detail.total, bar.currency)}</p>
				</div>
				<button
					type="button"
					class="inline-flex h-13 items-center gap-2 rounded-full bg-ink px-6 font-bold text-paper active:scale-[0.98]"
					onclick={closeTable}
				>
					<CircleDollarSign size={20} /> Cobrada · cerrar mesa
				</button>
			</div>
		{/if}
	{/snippet}
</Sheet>
