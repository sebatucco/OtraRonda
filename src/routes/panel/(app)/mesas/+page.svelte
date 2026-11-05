<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ExternalLink, Plus, Printer, RefreshCw, Pencil } from '@lucide/svelte';
	import QRCode from 'qrcode';
	import Toggle from '#lib/components/Toggle.svelte';
	import { usePanel } from '#lib/panel/context.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';

	type T = { id: string; label: string; token: string; active: boolean; position: number };

	const panel = usePanel();
	const sb = panel.supabase;
	const bar = $derived(panel.bar);

	let tables = $state<T[]>([]);
	let qrs = $state<Record<string, string>>({});
	let loading = $state(true);
	let count = $state(5);

	const menuUrl = (t: T) =>
		`${location.origin}${resolve('/m/[bar]/[mesa]', { bar: bar.slug, mesa: t.token })}`;

	async function reload() {
		const { data, error } = await sb
			.from('tables')
			.select('id, label, token, active, position')
			.eq('bar_id', bar.id)
			.order('position');
		loading = false;
		if (error) return toast(friendlyError(error), 'error');
		tables = data as T[];
		const out: Record<string, string> = {};
		for (const t of tables)
			out[t.id] = await QRCode.toString(menuUrl(t), {
				type: 'svg',
				margin: 0,
				errorCorrectionLevel: 'M'
			});
		qrs = out;
	}
	onMount(reload);

	/** Crea mesas numeradas siguiendo la última. */
	async function addTables() {
		const nums = tables.map((t) => Number(t.label)).filter((n) => Number.isInteger(n));
		const start = (nums.length ? Math.max(...nums) : 0) + 1;
		const pos = Math.max(0, ...tables.map((t) => t.position));
		const rows = Array.from({ length: count }, (_, i) => ({
			bar_id: bar.id,
			label: String(start + i),
			position: pos + i + 1
		}));
		const { error } = await sb.from('tables').insert(rows);
		if (error) return toast(friendlyError(error), 'error');
		toast(`${count} mesas agregadas`);
		reload();
	}

	async function addNamed() {
		const label = prompt('Nombre de la mesa (ej: Barra 1, Patio 3, VIP)')?.trim();
		if (!label) return;
		const { error } = await sb.from('tables').insert({
			bar_id: bar.id,
			label: label.slice(0, 20),
			position: Math.max(0, ...tables.map((t) => t.position)) + 1
		});
		if (error) return toast(friendlyError(error), 'error');
		reload();
	}

	async function rename(t: T) {
		const label = prompt('Nuevo nombre', t.label)?.trim();
		if (!label || label === t.label) return;
		const { error } = await sb
			.from('tables')
			.update({ label: label.slice(0, 20) })
			.eq('id', t.id);
		if (error) return toast(friendlyError(error), 'error');
		t.label = label;
	}

	async function setActive(t: T, active: boolean) {
		t.active = active;
		const { error } = await sb.from('tables').update({ active }).eq('id', t.id);
		if (error) toast(friendlyError(error), 'error');
	}

	async function rotate(t: T) {
		if (
			!confirm(`¿Generar un QR nuevo para la mesa ${t.label}? El QR impreso dejará de funcionar.`)
		)
			return;
		const { error } = await sb.rpc('rotate_table_token', { p_table_id: t.id });
		if (error) return toast(friendlyError(error), 'error');
		toast('QR nuevo generado. Imprimilo y reemplazá el anterior.');
		reload();
	}
</script>

<div class="mx-auto max-w-4xl px-4 py-5 md:px-8 md:py-8">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-extrabold">Mesas y QR</h1>
			<p class="text-ink-soft">Cada mesa tiene su QR único: así sabés qué mesa pidió qué.</p>
		</div>
		<a
			href={resolve('/panel/(app)/mesas/imprimir')}
			class="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-bold text-white shadow-sm"
			><Printer size={18} /> Imprimir todos los QR</a
		>
	</div>

	<div class="mt-6 flex flex-wrap items-center gap-2 rounded-card bg-card p-4 ring-1 ring-line">
		<span class="font-semibold">Agregar</span>
		<input
			type="number"
			min="1"
			max="50"
			bind:value={count}
			class="w-20 rounded-xl border-line bg-paper text-[16px]"
			aria-label="Cantidad"
		/>
		<span class="font-semibold">mesas numeradas</span>
		<button
			type="button"
			class="inline-flex h-11 items-center gap-1 rounded-full bg-ink px-4 font-bold text-paper"
			onclick={addTables}><Plus size={18} /> Agregar</button
		>
		<span class="text-ink-soft">o</span>
		<button
			type="button"
			class="h-11 rounded-full px-4 font-bold ring-1 ring-line"
			onclick={addNamed}>Mesa con nombre</button
		>
	</div>

	{#if loading}
		<p class="py-20 text-center text-ink-soft">Cargando…</p>
	{:else}
		<ul class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each tables as t (t.id)}
				<li
					class={[
						'flex flex-col gap-3 rounded-card bg-card p-4 ring-1 ring-line',
						!t.active && 'opacity-60'
					]}
				>
					<div class="flex items-start gap-3">
						<div
							class="size-24 shrink-0 rounded-xl bg-white p-2 ring-1 ring-line [&>svg]:size-full"
						>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG generado localmente por qrcode -->
							{@html qrs[t.id] ?? ''}
						</div>
						<div class="min-w-0 flex-1">
							<p class="font-display text-2xl font-extrabold">Mesa {t.label}</p>
							<a
								href={menuUrl(t)}
								target="_blank"
								rel="noopener external"
								class="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-accent"
								><ExternalLink size={14} /> Abrir carta</a
							>
						</div>
					</div>
					<div class="flex items-center justify-between gap-2">
						<span class="flex items-center gap-2 text-sm font-semibold">
							<Toggle label="Activa" checked={t.active} onchange={(v) => setActive(t, v)} />
							{t.active ? 'Activa' : 'Pausada'}
						</span>
						<span class="flex">
							<button
								type="button"
								class="grid size-10 place-items-center text-ink-soft"
								aria-label="Renombrar"
								onclick={() => rename(t)}><Pencil size={18} /></button
							>
							<button
								type="button"
								class="grid size-10 place-items-center text-ink-soft"
								aria-label="Generar QR nuevo"
								title="Generar QR nuevo"
								onclick={() => rotate(t)}><RefreshCw size={18} /></button
							>
						</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
