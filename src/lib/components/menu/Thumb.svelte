<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	let {
		src,
		name,
		class: klass = '',
		eager = false
	}: { src: string | null; name: string; class?: ClassValue; eager?: boolean } = $props();

	let loaded = $state(false);
	let img = $state<HTMLImageElement>();
	// Si la foto ya estaba en caché antes de hidratar, onload no se dispara.
	$effect(() => {
		if (img?.complete) loaded = true;
	});
	const initial = $derived(name.trim().charAt(0).toUpperCase());
</script>

<!-- Foto con fundido al cargar; sin foto, un fondo con el color del bar y la inicial (nunca un hueco). -->
<div class={['relative overflow-hidden bg-accent/12', klass]}>
	{#if src}
		<img
			bind:this={img}
			{src}
			alt=""
			loading={eager ? 'eager' : 'lazy'}
			decoding="async"
			onload={() => (loaded = true)}
			class={[
				'size-full object-cover transition-opacity duration-300',
				loaded ? 'opacity-100' : 'opacity-0'
			]}
		/>
	{:else}
		<span
			class="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--color-accent)_28%,transparent),transparent_60%)] font-display text-[2.2em] font-extrabold text-accent/70"
			aria-hidden="true">{initial}</span
		>
	{/if}
</div>
