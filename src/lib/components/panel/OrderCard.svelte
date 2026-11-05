<script lang="ts">
	import { Check, X, HandPlatter, ChefHat } from '@lucide/svelte';
	import { price } from '#lib/format.js';
	import { ago, clock, urgency } from '#lib/time.js';
	import type { LiveOrder } from '#lib/panel/live.svelte.js';
	import type { OrderStatus } from '#lib/types.js';

	let {
		order,
		tableLabel,
		currency,
		approveFirst,
		now,
		showTable = true,
		onstatus
	}: {
		order: LiveOrder;
		tableLabel: string;
		currency: string;
		approveFirst: boolean;
		now: number;
		showTable?: boolean;
		onstatus: (id: string, s: OrderStatus) => void;
	} = $props();

	const isNew = $derived(order.status === 'pending');
	const level = $derived(order.status === 'served' ? 'ok' : urgency(order.created_at, now));
	const BAR = { ok: 'border-l-emerald-500', warn: 'border-l-amber-400', late: 'border-l-red-500' };

	const LABEL: Record<OrderStatus, string> = {
		pending: 'Nuevo',
		accepted: 'Visto',
		preparing: 'En preparación',
		served: 'Entregado',
		rejected: 'Rechazado',
		cancelled: 'Cancelado'
	};
</script>

<article
	class={[
		'rounded-card border-l-[6px] bg-card p-4 ring-1',
		order.status === 'served' ? 'border-l-line' : BAR[level],
		isNew
			? 'shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-accent)_15%,transparent)] ring-2 ring-accent'
			: 'ring-line',
		order.status === 'served' && 'opacity-70'
	]}
>
	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			{#if showTable}
				<p class="font-display text-2xl leading-none font-extrabold">Mesa {tableLabel}</p>
			{/if}
			<p class="mt-1 text-sm text-ink-soft">
				{order.customer_name ?? 'Sin nombre'} · {clock(order.created_at)} ·
				<span
					class={[
						level === 'late' && 'font-bold text-red-600',
						level === 'warn' && 'font-bold text-amber-600'
					]}>{ago(order.created_at, now)}</span
				>
			</p>
		</div>
		<span
			class={[
				'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
				isNew ? 'animate-pulse bg-accent text-white' : 'bg-paper text-ink-soft'
			]}>{LABEL[order.status]}</span
		>
	</header>

	<ul class="mt-3 flex flex-col gap-1.5">
		{#each order.order_items as i (i.id)}
			<li class="leading-snug">
				<span class="font-bold tabular-nums">{i.quantity}×</span>
				<span class="font-semibold">{i.name}</span>
				{#if i.options?.length}
					<span class="font-semibold text-accent">· {i.options.map((o) => o.name).join(', ')}</span>
				{/if}
				{#if i.note}
					<span
						class="mt-1 ml-6 inline-block rounded-lg bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-900"
						>⚠ {i.note}</span
					>
				{/if}
			</li>
		{/each}
	</ul>
	{#if order.note}
		<p class="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">📝 {order.note}</p>
	{/if}

	<footer class="mt-3 flex flex-wrap items-center justify-between gap-2">
		<span class="font-bold tabular-nums">{price(Number(order.total), currency)}</span>
		<div class="ml-auto flex gap-2">
			{#if order.status === 'pending'}
				{#if approveFirst}
					<button
						type="button"
						class="grid size-11 place-items-center rounded-full bg-paper text-red-700 ring-1 ring-line"
						aria-label="Rechazar"
						onclick={() => confirm('¿Rechazar este pedido?') && onstatus(order.id, 'rejected')}
					>
						<X size={20} />
					</button>
				{/if}
				<button
					type="button"
					class="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-white active:scale-[0.97]"
					onclick={() => onstatus(order.id, 'accepted')}
				>
					<Check size={18} />{approveFirst ? 'Aceptar' : 'Visto'}
				</button>
			{:else if order.status === 'accepted'}
				<button
					type="button"
					class="inline-flex h-11 items-center gap-2 rounded-full bg-paper px-3.5 font-bold ring-1 ring-line"
					aria-label="En preparación"
					onclick={() => onstatus(order.id, 'preparing')}
				>
					<ChefHat size={18} /><span class="hidden sm:inline">Preparando</span>
				</button>
				<button
					type="button"
					class="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 font-bold text-paper active:scale-[0.97]"
					onclick={() => onstatus(order.id, 'served')}
				>
					<HandPlatter size={18} />Entregado
				</button>
			{:else if order.status === 'preparing'}
				<button
					type="button"
					class="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-bold text-paper active:scale-[0.97]"
					onclick={() => onstatus(order.id, 'served')}
				>
					<HandPlatter size={18} />Entregado
				</button>
			{/if}
		</div>
	</footer>
</article>
