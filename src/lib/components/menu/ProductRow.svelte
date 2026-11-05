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
		showThumb,
		canOrder,
		onopen,
		onadd
	}: {
		product: Product;
		currency: string;
		inCart: number;
		showThumb: boolean;
		canOrder: boolean;
		onopen: () => void;
		onadd: () => void;
	} = $props();
</script>

<div class={['relative', !p.available && 'opacity-50']}>
	<button
		type="button"
		onclick={onopen}
		class={[
			'flex w-full gap-4 rounded-card bg-card p-3.5 text-left ring-1 transition active:scale-[0.99]',
			inCart ? 'ring-2 ring-accent' : 'ring-line',
			!showThumb && 'pr-16'
		]}
	>
		<div class="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
			<h3 class="text-[17px] leading-snug font-semibold">{p.name}</h3>
			{#if p.description}
				<p class="line-clamp-2 text-[15px] leading-snug text-ink-soft">{p.description}</p>
			{/if}
			<div class="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
				<span class="mr-1 font-bold tabular-nums">{price(p.price, currency)}</span>
				{#if !p.available}
					<span class="text-sm font-semibold text-ink-soft">Agotado</span>
				{/if}
				{#each p.tags as tag (tag)}<Tag {tag} />{/each}
			</div>
		</div>
		{#if showThumb}
			<Thumb src={p.image_url} name={p.name} class="size-26 shrink-0 rounded-2xl text-base" />
		{/if}
	</button>

	{#if canOrder && p.available}
		<button
			type="button"
			aria-label={inCart ? `Agregar otro ${p.name} (hay ${inCart})` : `Agregar ${p.name}`}
			onclick={onadd}
			class={[
				'absolute grid size-10 place-items-center rounded-full font-extrabold shadow-md ring-2 ring-card transition active:scale-90',
				showThumb ? 'right-1.5 bottom-1.5' : 'top-1/2 right-3.5 -translate-y-1/2',
				inCart ? 'bg-accent text-white' : 'bg-card text-ink'
			]}
		>
			{#if inCart}{inCart}{:else}<Plus size={20} strokeWidth={2.75} />{/if}
		</button>
	{/if}
</div>
