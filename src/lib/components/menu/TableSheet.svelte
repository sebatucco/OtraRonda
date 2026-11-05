<script lang="ts">
	import Sheet from '#lib/components/Sheet.svelte';
	import { price } from '#lib/format.js';
	import { Check, ChefHat, Clock, Repeat } from '@lucide/svelte';
	import type { TableOrder } from '#lib/types.js';

	let {
		open = $bindable(false),
		loading = false,
		orders,
		currency,
		approveFirst,
		billRequested,
		canRepeat,
		onrepeat
	}: {
		open: boolean;
		loading?: boolean;
		orders: TableOrder[];
		currency: string;
		approveFirst: boolean;
		billRequested: boolean;
		canRepeat: boolean;
		onrepeat: () => void;
	} = $props();

	const total = $derived(orders.reduce((s, o) => s + Number(o.total), 0));

	const STATUS = $derived({
		pending: {
			label: approveFirst ? 'Esperando confirmación' : 'Enviado',
			icon: Clock,
			cls: 'bg-amber-100 text-amber-900'
		},
		accepted: { label: 'Recibido por el bar', icon: Check, cls: 'bg-sky-100 text-sky-900' },
		preparing: { label: 'En preparación', icon: ChefHat, cls: 'bg-violet-100 text-violet-900' },
		served: { label: 'Entregado', icon: Check, cls: 'bg-emerald-100 text-emerald-900' }
	});

	const time = (iso: string) =>
		new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
</script>

<Sheet bind:open title="Tu mesa">
	{#if billRequested}
		<p class="mb-4 rounded-2xl bg-sky-50 px-4 py-3 font-semibold text-sky-900">
			Pediste la cuenta. Ya te la traen.
		</p>
	{/if}

	{#if loading}
		<div class="flex flex-col gap-3" aria-label="Cargando">
			{#each [0, 1] as n (n)}
				<div class="animate-pulse rounded-2xl p-4 ring-1 ring-line">
					<div class="h-4 w-1/2 rounded-full bg-line"></div>
					<div class="mt-3 h-3 w-3/4 rounded-full bg-line"></div>
					<div class="mt-2 h-3 w-2/3 rounded-full bg-line"></div>
				</div>
			{/each}
		</div>
	{:else if orders.length === 0}
		<p class="py-10 text-center text-ink-soft">Todavía no hay pedidos en esta mesa.</p>
	{:else}
		<ol class="flex flex-col gap-3">
			{#each orders as o (o.id)}
				{@const s = STATUS[o.status]}
				<li class="rounded-2xl p-4 ring-1 ring-line">
					<div class="flex items-center justify-between gap-2">
						<span class="font-bold">{o.customer_name ?? 'Pedido'} · {time(o.created_at)}</span>
						<span
							class={[
								'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
								s.cls
							]}
						>
							<s.icon size={14} />
							{s.label}
						</span>
					</div>
					<ul class="mt-2 text-[15px] text-ink-soft">
						{#each o.items as i, n (n)}
							<li>
								{i.quantity}× {i.name}{i.options.length
									? ` (${i.options.map((x) => x.name).join(', ')})`
									: ''}
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ol>
	{/if}

	{#snippet footer()}
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-sm text-ink-soft">Total de la mesa</p>
				<p class="text-xl font-extrabold tabular-nums">{price(total, currency)}</p>
			</div>
			{#if canRepeat}
				<button
					type="button"
					class="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 font-bold text-paper active:scale-[0.98]"
					onclick={onrepeat}
				>
					<Repeat size={18} /> Otra ronda igual
				</button>
			{/if}
		</div>
	{/snippet}
</Sheet>
