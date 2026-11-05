<script lang="ts">
	import Sheet from '#lib/components/Sheet.svelte';
	import Stepper from '#lib/components/Stepper.svelte';
	import { price } from '#lib/format.js';
	import type { Cart } from '#lib/cart.svelte.js';

	let {
		open = $bindable(false),
		cart,
		currency,
		tableLabel,
		sending,
		name = $bindable(''),
		note = $bindable(''),
		onsend
	}: {
		open: boolean;
		cart: Cart;
		currency: string;
		tableLabel: string;
		sending: boolean;
		name: string;
		note: string;
		onsend: () => void;
	} = $props();
</script>

<Sheet bind:open title="Tu pedido">
	{#if cart.items.length === 0}
		<p class="py-10 text-center text-ink-soft">Todavía no agregaste nada.</p>
	{:else}
		<ul class="divide-y divide-line">
			{#each cart.items as item (item.key)}
				<li class="flex items-center gap-3 py-3">
					<div class="min-w-0 flex-1">
						<p class="leading-snug font-semibold">{item.name}</p>
						{#if item.option_names.length}
							<p class="text-sm text-ink-soft">{item.option_names.join(' · ')}</p>
						{/if}
						{#if item.note}
							<p class="text-sm text-ink-soft italic">“{item.note}”</p>
						{/if}
						<p class="mt-1 text-sm font-bold tabular-nums">
							{price(item.unit_price * item.quantity, currency)}
						</p>
					</div>
					<Stepper
						size="sm"
						allowRemove
						value={item.quantity}
						onchange={(v) => cart.setQuantity(item.key, v)}
					/>
				</li>
			{/each}
		</ul>

		<div class="mt-4 grid gap-3">
			<label class="block">
				<span class="text-sm font-bold"
					>Tu nombre <span class="font-normal text-ink-soft">(así el mozo sabe de quién es)</span
					></span
				>
				<input
					bind:value={name}
					maxlength="40"
					autocomplete="given-name"
					placeholder="Ej: Ana"
					class="mt-1.5 w-full rounded-2xl border-line bg-paper text-[16px] focus:border-accent focus:ring-accent"
				/>
			</label>
			<label class="block">
				<span class="text-sm font-bold"
					>Nota para el bar <span class="font-normal text-ink-soft">(opcional)</span></span
				>
				<input
					bind:value={note}
					maxlength="300"
					placeholder="Ej: traer todo junto"
					class="mt-1.5 w-full rounded-2xl border-line bg-paper text-[16px] focus:border-accent focus:ring-accent"
				/>
			</label>
		</div>
	{/if}

	{#snippet footer()}
		{#if cart.items.length}
			<div class="mb-3 flex items-baseline justify-between">
				<span class="text-ink-soft">Total</span>
				<span class="text-xl font-extrabold tabular-nums">{price(cart.total, currency)}</span>
			</div>
			<button
				type="button"
				class="flex h-14 w-full items-center justify-center rounded-full bg-accent text-lg font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
				disabled={sending}
				onclick={onsend}
			>
				{sending ? 'Enviando…' : `Enviar pedido a la mesa ${tableLabel}`}
			</button>
		{/if}
	{/snippet}
</Sheet>
