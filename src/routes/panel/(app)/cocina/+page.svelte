<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Maximize } from '@lucide/svelte';
	import { usePanel } from '#lib/panel/context.js';
	import { clock, minutesSince, urgency, WARN_MIN, LATE_MIN, type Urgency } from '#lib/time.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';
	import type { LiveOrder } from '#lib/panel/live.svelte.js';
	import type { OrderStatus } from '#lib/types.js';

	/*
	 * Modo cocina (KDS): fondo oscuro, letra grande, el color de cada ticket indica cuánto espera.
	 * Se toca el ticket entero (manos ocupadas o mojadas): Nuevo → Preparando → Listo.
	 * El orden no se reacomoda solo: el más viejo siempre arriba a la izquierda.
	 */
	const panel = usePanel();
	const live = panel.live;

	let now = $state(Date.now());
	onMount(() => {
		const id = setInterval(() => (now = Date.now()), 15000);
		return () => clearInterval(id);
	});

	const HEAD: Record<Urgency, string> = {
		ok: 'bg-emerald-600',
		warn: 'bg-amber-400 text-black',
		late: 'bg-red-600'
	};

	const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
		pending: { to: 'preparing', label: 'Tocá para empezar' },
		accepted: { to: 'preparing', label: 'Tocá para empezar' },
		preparing: { to: 'served', label: 'Tocá cuando esté listo' }
	};

	async function advance(o: LiveOrder) {
		const next = NEXT[o.status];
		if (!next) return;
		navigator.vibrate?.(20);
		const err = await live.setOrderStatus(o.id, next.to);
		if (err) toast(friendlyError(err), 'error');
		else if (next.to === 'served') toast(`Mesa ${live.tableLabel(o.table_id)}: listo ✔`);
	}

	const counts = $derived({
		total: live.queue.length,
		late: live.queue.filter((o) => urgency(o.created_at, now) === 'late').length
	});

	function fullscreen() {
		document.documentElement.requestFullscreen?.().catch(() => {});
	}
</script>

<div class="min-h-dvh bg-[#0f0d0c] text-[#f5f1ea]">
	<header
		class="sticky top-0 z-10 flex items-center gap-4 border-b border-white/10 bg-[#0f0d0c]/95 px-4 py-3 backdrop-blur"
	>
		<a
			href={resolve('/panel/(app)')}
			class="grid size-11 place-items-center rounded-full bg-white/10"
			aria-label="Salir del modo cocina"><ArrowLeft size={22} /></a
		>
		<h1 class="font-display text-2xl font-extrabold">Cocina</h1>
		<span class="text-lg font-bold text-white/70 tabular-nums">
			{counts.total} en curso{#if counts.late}<span class="text-red-400">
					· {counts.late} demorados</span
				>{/if}
		</span>
		<span class="ml-auto hidden items-center gap-3 text-sm font-semibold text-white/60 sm:flex">
			<span class="flex items-center gap-1.5"
				><i class="size-3 rounded-full bg-emerald-600"></i>-{WARN_MIN} min</span
			>
			<span class="flex items-center gap-1.5"
				><i class="size-3 rounded-full bg-amber-400"></i>{WARN_MIN}–{LATE_MIN}</span
			>
			<span class="flex items-center gap-1.5"
				><i class="size-3 rounded-full bg-red-600"></i>+{LATE_MIN}</span
			>
		</span>
		<button
			type="button"
			class="ml-auto grid size-11 place-items-center rounded-full bg-white/10 sm:ml-0"
			aria-label="Pantalla completa"
			onclick={fullscreen}><Maximize size={20} /></button
		>
	</header>

	{#if live.queue.length === 0}
		<p class="py-32 text-center text-2xl font-bold text-white/50">Sin pedidos pendientes 👌</p>
	{:else}
		<ul class="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3 p-3">
			{#each live.queue as o (o.id)}
				{@const level = urgency(o.created_at, now)}
				{@const isNew = o.status === 'pending'}
				<li>
					<button
						type="button"
						onclick={() => advance(o)}
						class={[
							'flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[#1f1b19] text-left active:scale-[0.99]',
							isNew && 'ring-4 ring-accent'
						]}
					>
						<div class={['flex items-baseline justify-between gap-2 px-4 py-2.5', HEAD[level]]}>
							<span class="font-display text-3xl leading-none font-extrabold"
								>Mesa {live.tableLabel(o.table_id)}</span
							>
							<span class="text-xl font-extrabold tabular-nums"
								>{minutesSince(o.created_at, now)}′</span
							>
						</div>
						<div
							class="flex items-center justify-between px-4 pt-2 text-sm font-semibold text-white/60"
						>
							<span>{o.customer_name ?? '—'} · {clock(o.created_at)}</span>
							{#if isNew}<span
									class="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-white"
									>NUEVO</span
								>
							{:else if o.status === 'preparing'}<span
									class="rounded-full bg-white/15 px-2 py-0.5 text-xs font-extrabold"
									>PREPARANDO</span
								>{/if}
						</div>
						<ul class="flex flex-1 flex-col gap-2 px-4 py-3">
							{#each o.order_items as i (i.id)}
								<li class="text-xl leading-snug">
									<span class="font-extrabold tabular-nums">{i.quantity}×</span>
									<span class="font-bold">{i.name}</span>
									{#if i.options?.length}
										<span class="block pl-8 text-lg font-bold text-amber-300"
											>{i.options.map((x) => x.name).join(' · ')}</span
										>
									{/if}
									{#if i.note}
										<span
											class="mt-1 ml-8 inline-block rounded-lg bg-yellow-300 px-2 py-0.5 text-lg font-extrabold text-black"
											>⚠ {i.note}</span
										>
									{/if}
								</li>
							{/each}
						</ul>
						{#if o.note}
							<p
								class="mx-4 mb-3 rounded-lg bg-yellow-300 px-3 py-2 text-lg font-extrabold text-black"
							>
								📝 {o.note}
							</p>
						{/if}
						<p
							class="border-t border-white/10 px-4 py-2.5 text-center text-sm font-bold text-white/50"
						>
							{NEXT[o.status]?.label}
						</p>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
