<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import {
		LayoutGrid,
		BookOpen,
		QrCode,
		Settings,
		Volume2,
		VolumeX,
		LogOut,
		Wifi,
		WifiOff
	} from '@lucide/svelte';
	import { browserClient } from '#lib/supabase.js';
	import { LiveBar } from '#lib/panel/live.svelte.js';
	import { setPanel } from '#lib/panel/context.js';
	import { chime, isUnlocked, unlock } from '#lib/panel/sound.js';
	import { readJSON, writeJSON } from '#lib/storage.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const supabase = browserClient();
	// svelte-ignore state_referenced_locally
	const live = new LiveBar(supabase, data.bar.id);

	setPanel({
		supabase,
		live,
		get bar() {
			return data.bar;
		},
		get role() {
			return data.role;
		}
	});

	let soundWanted = $state(true);
	let soundReady = $state(false);
	let wakeLock: WakeLockSentinel | null = null;

	async function enableSound() {
		soundReady = await unlock();
		soundWanted = true;
		writeJSON('or:sound', true);
		if (soundReady) chime('order');
		try {
			wakeLock = await navigator.wakeLock?.request('screen'); // tablet siempre encendida
		} catch {
			/* no soportado */
		}
	}

	function toggleSound() {
		if (!soundWanted || !soundReady) enableSound();
		else {
			soundWanted = false;
			writeJSON('or:sound', false);
		}
	}

	onMount(() => {
		soundWanted = readJSON('or:sound', true);
		soundReady = isUnlocked();
		live.start((kind) => {
			navigator.vibrate?.([200, 100, 200]);
			if (soundWanted) chime(kind);
		});
		const onVisible = async () => {
			if (document.visibilityState === 'visible' && wakeLock?.released && soundReady) {
				try {
					wakeLock = await navigator.wakeLock.request('screen');
				} catch {
					/* ignore */
				}
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			live.stop();
			wakeLock?.release();
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	// Mientras haya algo sin atender, sigue sonando cada 8 s (las quejas #1: "no escuché el pedido").
	$effect(() => {
		if (!live.alerting || !soundWanted || !soundReady) return;
		const id = setInterval(() => chime(live.calls.length ? 'call' : 'order'), 8000);
		return () => clearInterval(id);
	});

	// Título de la pestaña con contador.
	$effect(() => {
		const n = live.pendingCount + live.calls.length;
		document.title = n ? `(${n}) ${data.bar.name} · Panel` : `${data.bar.name} · Panel`;
	});

	async function switchBar(id: string) {
		document.cookie = `or_bar=${id}; path=/; max-age=31536000; samesite=lax`;
		await invalidateAll();
		location.reload();
	}

	const nav = [
		{ href: resolve('/panel/(app)'), label: 'Salón', icon: LayoutGrid, exact: true },
		{ href: resolve('/panel/(app)/menu'), label: 'Menú', icon: BookOpen },
		{ href: resolve('/panel/(app)/mesas'), label: 'Mesas y QR', icon: QrCode },
		{ href: resolve('/panel/(app)/ajustes'), label: 'Ajustes', icon: Settings }
	];
	const isActive = (href: string, exact = false) =>
		exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
</svelte:head>

<div style="--accent: {data.bar.accent_color}" class="min-h-dvh pb-24 md:pb-0 md:pl-60">
	<!-- Barra lateral (tablet/escritorio) -->
	<aside
		class="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-card px-4 py-5 md:flex print:hidden"
	>
		<p class="px-2 text-xs font-bold tracking-widest text-accent uppercase">Otra Ronda</p>
		{#if data.bars.length > 1}
			<select
				class="mt-2 rounded-xl border-line bg-paper font-display text-lg font-extrabold"
				value={data.bar.id}
				onchange={(e) => switchBar(e.currentTarget.value)}
			>
				{#each data.bars as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
			</select>
		{:else}
			<p class="mt-1 truncate px-2 font-display text-xl font-extrabold">{data.bar.name}</p>
		{/if}

		<nav class="mt-6 flex flex-col gap-1">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class={[
						'flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold',
						isActive(item.href, item.exact) ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper'
					]}
				>
					<item.icon size={20} />
					{item.label}
					{#if item.exact && live.pendingCount + live.calls.length > 0}
						<span class="ml-auto rounded-full bg-accent px-2 text-sm text-white"
							>{live.pendingCount + live.calls.length}</span
						>
					{/if}
				</a>
			{/each}
		</nav>

		<div class="mt-auto flex flex-col gap-2 text-sm">
			<button
				type="button"
				class="flex items-center gap-2 rounded-xl px-2 py-2 font-semibold hover:bg-paper"
				onclick={toggleSound}
			>
				{#if soundWanted && soundReady}<Volume2 size={16} /> Sonido activado{:else}<VolumeX
						size={16}
					/> Sonido apagado{/if}
			</button>
			<span class="flex items-center gap-2 px-2 text-ink-soft">
				{#if live.connected}<Wifi size={16} class="text-ok" /> En vivo{:else}<WifiOff
						size={16}
						class="text-amber-600"
					/> Reconectando…{/if}
			</span>
			<p class="truncate px-2 text-ink-soft">{data.email}</p>
			<form method="POST" action="/auth/salir">
				<button class="flex items-center gap-2 px-2 font-semibold text-ink-soft"
					><LogOut size={16} /> Salir</button
				>
			</form>
		</div>
	</aside>

	<!-- Encabezado (celular) -->
	<header
		class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:hidden print:hidden"
	>
		<p class="truncate font-display text-lg font-extrabold">{data.bar.name}</p>
		<span class="flex items-center gap-2 text-sm text-ink-soft">
			{#if live.connected}<Wifi size={16} class="text-ok" />{:else}<WifiOff
					size={16}
					class="text-amber-600"
				/>{/if}
			<button
				type="button"
				class="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line"
				aria-label={soundWanted && soundReady ? 'Silenciar' : 'Activar sonido'}
				onclick={toggleSound}
			>
				{#if soundWanted && soundReady}<Volume2 size={18} />{:else}<VolumeX size={18} />{/if}
			</button>
		</span>
	</header>

	{#if soundWanted && !soundReady}
		<button
			type="button"
			onclick={enableSound}
			class="flex w-full items-center justify-center gap-2 bg-ink px-4 py-3 font-bold text-paper print:hidden"
		>
			<Volume2 size={20} /> Activar sonido de pedidos
		</button>
	{/if}

	{#if live.lastError}
		<p class="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900 print:hidden">
			Problema de conexión. Seguimos intentando…
		</p>
	{/if}

	{@render children()}

	<!-- Navegación inferior (celular) -->
	<nav
		class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
	>
		{#each nav as item (item.href)}
			<a
				href={item.href}
				class={[
					'relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold',
					isActive(item.href, item.exact) ? 'text-accent' : 'text-ink-soft'
				]}
			>
				<item.icon size={22} />
				{item.label}
				{#if item.exact && live.pendingCount + live.calls.length > 0}
					<span
						class="absolute top-1 left-1/2 ml-2 grid size-5 place-items-center rounded-full bg-accent text-[11px] text-white"
						>{live.pendingCount + live.calls.length}</span
					>
				{/if}
			</a>
		{/each}
	</nav>
</div>
