<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Otra Ronda — pedí desde la mesa</title>
	<meta
		name="description"
		content="Menú QR por mesa para bares: tus clientes piden desde el celular y vos ves qué mesa pidió qué, en tiempo real."
	/>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
	<p class="text-sm font-semibold tracking-widest text-accent uppercase">Otra Ronda</p>
	<h1 class="text-5xl leading-[1.05] font-extrabold sm:text-6xl">
		Escaneá.<br />Pedí.<br /><span class="text-accent">Otra ronda.</span>
	</h1>
	<p class="max-w-md text-lg text-ink-soft">
		Menú QR por mesa para bares. Tus clientes piden desde el celular, sin descargar nada, y vos ves
		qué mesa pidió qué en tiempo real.
	</p>
	<div class="flex flex-wrap gap-3">
		<a
			href={resolve('/m/[bar]/[mesa]', { bar: 'la-esquina', mesa: 'demo-mesa-1' })}
			class="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm active:scale-[0.98]"
		>
			Ver menú de demo
		</a>
		<a
			href={resolve('/panel/(app)')}
			class="rounded-full border border-line px-6 py-3 font-semibold"
		>
			Soy un bar
		</a>
	</div>
</main>
