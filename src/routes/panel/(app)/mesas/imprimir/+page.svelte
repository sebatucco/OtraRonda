<script lang="ts">
	import { resolve } from '$app/paths';
	import { Printer } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let style = $state<'tent' | 'sticker'>('tent');
</script>

<div class="px-4 py-5 md:px-8 md:py-8 print:p-0">
	<div class="flex flex-wrap items-end justify-between gap-3 print:hidden">
		<div>
			<a href={resolve('/panel/(app)/mesas')} class="text-sm font-semibold text-ink-soft">← Mesas</a
			>
			<h1 class="mt-2 text-3xl font-extrabold">Imprimir QR</h1>
			<p class="text-ink-soft">
				{data.tables.length} mesas activas. En el diálogo de impresión podés elegir “Guardar como PDF”.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<select
				bind:value={style}
				class="h-12 rounded-full border-line bg-card pr-10 pl-4 font-semibold"
			>
				<option value="tent">Cartel de mesa (6 por hoja)</option>
				<option value="sticker">Sticker chico (12 por hoja)</option>
			</select>
			<button
				type="button"
				class="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-bold text-white"
				onclick={() => window.print()}><Printer size={18} /> Imprimir</button
			>
		</div>
	</div>

	<div
		class={[
			'sheet mt-6 grid gap-4 print:mt-0 print:gap-0',
			style === 'tent'
				? 'grid-cols-2 sm:grid-cols-3 print:grid-cols-2'
				: 'grid-cols-3 sm:grid-cols-4 print:grid-cols-3'
		]}
	>
		{#each data.tables as t (t.id)}
			<div
				class={[
					'card flex flex-col items-center justify-between rounded-2xl bg-white text-center text-[#1c1917] ring-1 ring-line print:rounded-none print:ring-[#ddd]',
					style === 'tent' ? 'gap-3 p-6 print:h-[93mm]' : 'gap-1.5 p-3 print:h-[67mm]'
				]}
				style="--accent: {data.bar.accent_color}"
			>
				<p class={['font-display font-extrabold', style === 'tent' ? 'text-xl' : 'text-sm']}>
					{data.bar.name}
				</p>
				<div class={[style === 'tent' ? 'w-[60%]' : 'w-[70%]', '[&>svg]:h-auto [&>svg]:w-full']}>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generado en el servidor por qrcode -->
					{@html t.svg}
				</div>
				<div>
					<p
						class={[
							'font-display leading-none font-extrabold text-accent',
							style === 'tent' ? 'text-5xl' : 'text-2xl'
						]}
					>
						Mesa {t.label}
					</p>
					<p class={['mt-1 font-semibold', style === 'tent' ? 'text-base' : 'text-xs']}>
						Escaneá con la cámara y pedí desde acá
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	@media print {
		@page {
			size: A4;
			margin: 8mm;
		}
		:global(body) {
			background: white !important;
		}
		.card {
			break-inside: avoid;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
