<script lang="ts">
	import { Minus, Plus, Trash2 } from '@lucide/svelte';

	let {
		value,
		onchange,
		min = 1,
		max = 50,
		size = 'md',
		allowRemove = false
	}: {
		value: number;
		onchange: (v: number) => void;
		min?: number;
		max?: number;
		size?: 'sm' | 'md';
		/** Con 1 unidad, el "−" se convierte en tacho. */
		allowRemove?: boolean;
	} = $props();

	const btn = $derived(size === 'sm' ? 'size-9' : 'size-11');
</script>

<div class="inline-flex items-center rounded-full bg-paper ring-1 ring-line">
	<button
		type="button"
		class="{btn} grid place-items-center rounded-full disabled:opacity-30"
		aria-label={allowRemove && value <= 1 ? 'Quitar' : 'Uno menos'}
		disabled={!allowRemove && value <= min}
		onclick={() => onchange(value - 1)}
	>
		{#if allowRemove && value <= 1}<Trash2 size={18} />{:else}<Minus size={18} />{/if}
	</button>
	<span class="min-w-8 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
	<button
		type="button"
		class="{btn} grid place-items-center rounded-full disabled:opacity-30"
		aria-label="Uno más"
		disabled={value >= max}
		onclick={() => onchange(value + 1)}
	>
		<Plus size={18} />
	</button>
</div>
