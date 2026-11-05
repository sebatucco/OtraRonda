<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { price } from '#lib/format.js';
	import type { Product } from '#lib/types.js';
	import Thumb from './Thumb.svelte';
	import Tag from './Tag.svelte';

	let {
		product: p,
		currency,
		inCart,
		canOrder,
		showPhoto,
		onopen,
		onadd
	}: {
		product: Product;
		currency: string;
		inCart: number;
		canOrder: boolean;
		/** Sin fotos en la carta: tarjeta compacta de texto en vez de un recuadro vacío. */
		showPhoto: boolean;
		onopen: () => void;
		onadd: () => void;
	} = $props();
</script>

<div class={['relative shrink-0 snap-start', showPhoto ? 'w-[72%] max-w-64' : 'w-[62%] max-w-56']}>
	<button type="button" onclick={onopen} class="block h-full w-full text-left active:scale-[0.98]">
		{#if showPhoto}
			<Thumb
				src={p.image_url}
				name={p.name}
				eager
				class={['aspect-[4/3] w-full rounded-card text-3xl', inCart && 'ring-2 ring-accent']}
			/>
			<div class="mt-2 px-0.5">
				<h3 class="truncate leading-snug font-semibold">{p.name}</h3>
				<div class="mt-0.5 flex items-center gap-1.5">
					<span class="font-bold tabular-nums">{price(p.price, currency)}</span>
					{#each p.tags.slice(0, 1) as tag (tag)}<Tag {tag} />{/each}
				</div>
			</div>
		{:else}
			<div
				class={[
					'flex h-full min-h-36 flex-col rounded-card bg-accent/10 p-4 pr-14 ring-1',
					inCart ? 'ring-2 ring-accent' : 'ring-accent/20'
				]}
			>
				<h3 class="leading-snug font-bold">{p.name}</h3>
				{#if p.description}
					<p class="mt-1 line-clamp-2 text-sm leading-snug text-ink-soft">{p.description}</p>
				{/if}
				<div class="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
					<span class="font-bold tabular-nums">{price(p.price, currency)}</span>
					{#each p.tags.slice(0, 1) as tag (tag)}<Tag {tag} />{/each}
				</div>
			</div>
		{/if}
	</button>
	{#if canOrder && p.available}
		<button
			type="button"
			aria-label="Agregar {p.name}"
			onclick={onadd}
			class={[
				'absolute top-2.5 right-2.5 grid size-10 place-items-center rounded-full font-extrabold shadow-md transition active:scale-90',
				inCart ? 'bg-accent text-white' : 'bg-card text-ink'
			]}
		>
			{#if inCart}{inCart}{:else}<Plus size={20} strokeWidth={2.75} />{/if}
		</button>
	{/if}
</div>
