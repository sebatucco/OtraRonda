<script lang="ts">
	import Sheet from '#lib/components/Sheet.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import { price, TAG_LABELS } from '#lib/format.js';
	import type { Product } from '#lib/types.js';
	import type { CartItem } from '#lib/cart.svelte.js';

	let {
		open = $bindable(false),
		product,
		currency,
		canOrder,
		onadd
	}: {
		open: boolean;
		product: Product | null;
		currency: string;
		canOrder: boolean;
		onadd: (item: Omit<CartItem, 'key'>) => void;
	} = $props();

	let quantity = $state(1);
	let note = $state('');
	/** group_id -> option_ids elegidas */
	let picked = $state<Record<string, string[]>>({});

	// Al abrir otro producto: reiniciar y preseleccionar la primera opción de los grupos obligatorios de 1.
	$effect(() => {
		if (!open || !product) return;
		quantity = 1;
		note = '';
		const init: Record<string, string[]> = {};
		for (const g of product.option_groups) {
			const first = g.options.find((o) => o.available);
			init[g.id] = g.min_select === 1 && g.max_select === 1 && first ? [first.id] : [];
		}
		picked = init;
	});

	const groups = $derived(product?.option_groups ?? []);
	const selectedOptions = $derived(
		groups.flatMap((g) => g.options.filter((o) => picked[g.id]?.includes(o.id)))
	);
	const unitPrice = $derived(
		(product?.price ?? 0) + selectedOptions.reduce((s, o) => s + o.price_delta, 0)
	);
	const missing = $derived(groups.find((g) => (picked[g.id]?.length ?? 0) < g.min_select));

	function toggle(groupId: string, optionId: string, single: boolean, max: number) {
		const cur = picked[groupId] ?? [];
		if (single) picked[groupId] = [optionId];
		else if (cur.includes(optionId)) picked[groupId] = cur.filter((id) => id !== optionId);
		else if (cur.length < max) picked[groupId] = [...cur, optionId];
	}

	function add() {
		if (!product || missing) return;
		onadd({
			product_id: product.id,
			name: product.name,
			unit_price: unitPrice,
			quantity,
			option_ids: selectedOptions.map((o) => o.id),
			option_names: selectedOptions.map((o) => o.name),
			note: note.trim() || undefined
		});
		open = false;
	}

	function groupHint(min: number, max: number) {
		if (min === 1 && max === 1) return 'Elegí 1';
		if (min > 0) return `Elegí entre ${min} y ${max}`;
		return max === 1 ? 'Opcional' : `Opcional · hasta ${max}`;
	}
</script>

<Sheet bind:open title={product?.name}>
	{#if product}
		{#if product.image_url}
			<img
				src={product.image_url}
				alt={product.name}
				class="mb-4 aspect-[4/3] w-full rounded-2xl object-cover"
			/>
		{/if}
		{#if product.description}
			<p class="text-ink-soft">{product.description}</p>
		{/if}
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<span class="text-lg font-bold">{price(product.price, currency)}</span>
			{#each product.tags as tag (tag)}
				<span class="rounded-full bg-paper px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
					{TAG_LABELS[tag] ?? tag}
				</span>
			{/each}
		</div>

		{#if canOrder}
			{#each groups as g (g.id)}
				{@const single = g.max_select === 1}
				<fieldset class="mt-6">
					<legend class="flex w-full items-baseline justify-between gap-2">
						<span class="font-bold">{g.name}</span>
						<span
							class={[
								'text-sm font-semibold',
								missing?.id === g.id ? 'text-accent' : 'text-ink-soft'
							]}>{groupHint(g.min_select, g.max_select)}</span
						>
					</legend>
					<div class="mt-2 flex flex-col gap-2">
						{#each g.options as o (o.id)}
							{@const checked = picked[g.id]?.includes(o.id) ?? false}
							<label
								class={[
									'flex min-h-13 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors',
									checked ? 'bg-accent/8 ring-2 ring-accent' : 'ring-line',
									!o.available && 'pointer-events-none opacity-40'
								]}
							>
								<input
									type={single ? 'radio' : 'checkbox'}
									name={g.id}
									class={['size-5 text-accent focus:ring-accent', single ? '' : 'rounded']}
									{checked}
									disabled={!o.available}
									onchange={() => toggle(g.id, o.id, single, g.max_select)}
								/>
								<span class="flex-1">{o.name}{!o.available ? ' · agotado' : ''}</span>
								{#if o.price_delta}
									<span class="font-semibold text-ink-soft"
										>{o.price_delta > 0 ? '+' : '−'}{price(Math.abs(o.price_delta), currency)}</span
									>
								{/if}
							</label>
						{/each}
					</div>
				</fieldset>
			{/each}

			<label class="mt-6 block">
				<span class="font-bold">¿Alguna aclaración?</span>
				<textarea
					bind:value={note}
					maxlength="200"
					rows="2"
					placeholder="Ej: sin hielo, bien cocido…"
					class="mt-2 w-full rounded-2xl border-line bg-paper text-[16px] focus:border-accent focus:ring-accent"
				></textarea>
			</label>
		{/if}
	{/if}

	{#snippet footer()}
		{#if product && canOrder}
			<div class="flex items-center gap-3">
				<Stepper value={quantity} onchange={(v) => (quantity = v)} />
				<button
					type="button"
					class="flex h-13 flex-1 items-center justify-between gap-2 rounded-full bg-accent px-5 font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
					disabled={!product.available || !!missing}
					onclick={add}
				>
					<span>{product.available ? 'Agregar' : 'Agotado'}</span>
					<span class="tabular-nums">{price(unitPrice * quantity, currency)}</span>
				</button>
			</div>
		{/if}
	{/snippet}
</Sheet>
