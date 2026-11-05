<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { BellRing, ReceiptText, ShoppingBag, ListChecks, Search, Star } from '@lucide/svelte';
	import { normalize, price } from '#lib/format.js';
	import { Cart, type CartItem } from '#lib/cart.svelte.js';
	import { browserClient } from '#lib/supabase.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';
	import { readJSON, writeJSON } from '#lib/storage.js';
	import { needsChoice, quickItem, suggestions } from '#lib/menu-utils.js';
	import type { Product, TableStatus } from '#lib/types.js';
	import ProductSheet from '#lib/components/menu/ProductSheet.svelte';
	import CartSheet from '#lib/components/menu/CartSheet.svelte';
	import TableSheet from '#lib/components/menu/TableSheet.svelte';
	import ProductRow from '#lib/components/menu/ProductRow.svelte';
	import FeaturedCard from '#lib/components/menu/FeaturedCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const { bar, table, menu } = $derived(data);
	const canOrder = $derived(bar.ordering_enabled);

	// svelte-ignore state_referenced_locally
	const cart = new Cart(data.table.token);

	let active = $state('');
	let selected = $state<Product | null>(null);
	let productOpen = $state(false);
	let cartOpen = $state(false);
	let tableOpen = $state(false);
	let sending = $state(false);
	let customerName = $state('');
	let orderNote = $state('');
	let status = $state<TableStatus>({ session_status: null, orders: [] });
	let statusLoaded = $state(false);
	let lastRound = $state<CartItem[]>([]);
	let bump = $state(false);

	// Buscador
	let searching = $state(false);
	let query = $state('');
	let searchInput = $state<HTMLInputElement>();

	const supabase = () => browserClient();

	const allProducts = $derived(menu.flatMap((c) => c.products));
	const featured = $derived(allProducts.filter((p) => p.featured));
	/** Si el bar no cargó ni una foto, la carta va en modo texto (sin miniaturas vacías). */
	const hasPhotos = $derived(allProducts.some((p) => p.image_url));
	const results = $derived.by(() => {
		const q = normalize(query.trim());
		if (!q) return [];
		return allProducts.filter((p) => normalize(`${p.name} ${p.description ?? ''}`).includes(q));
	});
	const inCartIds = $derived(new Set(cart.items.map((i) => i.product_id)));
	const upsell = $derived(suggestions(menu, inCartIds));

	onMount(() => {
		customerName = readJSON<string>('or:name', '');
		lastRound = cart.lastRound;
		refreshStatus();
		// Polling liviano: solo con la pestaña visible y pedidos sin entregar.
		const timer = setInterval(() => {
			if (
				document.visibilityState === 'visible' &&
				status.orders.some((o) => o.status !== 'served')
			)
				refreshStatus();
		}, 6000);
		const onVisible = () => document.visibilityState === 'visible' && refreshStatus();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	async function refreshStatus() {
		const { data: s } = await supabase().rpc('table_status', { p_token: table.token });
		if (s) status = s as TableStatus;
		statusLoaded = true;
	}

	function openProduct(p: Product) {
		selected = p;
		productOpen = true;
	}

	function addToCart(item: Omit<CartItem, 'key'>) {
		cart.add(item);
		navigator.vibrate?.(15);
		bump = false;
		requestAnimationFrame(() => (bump = true));
		toast(`Agregado: ${item.quantity > 1 ? `${item.quantity}× ` : ''}${item.name}`);
	}

	/** Botón "+": agrega directo, salvo que haya que elegir algo (ej: tamaño). */
	function quickAdd(p: Product) {
		if (needsChoice(p)) openProduct(p);
		else addToCart(quickItem(p));
	}

	async function openSearch() {
		searching = true;
		await tick();
		searchInput?.focus();
	}

	function closeSearch() {
		searching = false;
		query = '';
	}

	async function sendOrder() {
		if (sending || cart.items.length === 0) return;
		sending = true;
		writeJSON('or:name', customerName.trim());
		const { error } = await supabase().rpc('place_order', {
			p_token: table.token,
			p_items: cart.toPayload(),
			p_customer_name: customerName.trim() || null,
			p_note: orderNote.trim() || null
		});
		sending = false;
		if (error) {
			toast(friendlyError(error), 'error', 5000);
			return;
		}
		cart.rememberAsLastRound();
		lastRound = cart.lastRound;
		cart.clear();
		orderNote = '';
		cartOpen = false;
		navigator.vibrate?.([20, 40, 20]);
		await refreshStatus();
		tableOpen = true;
		toast('¡Pedido enviado! 🍻');
	}

	/** Vuelve a cargar la última ronda al carrito, salvo lo que ya no esté disponible. */
	function repeatLastRound() {
		const available = new Set(allProducts.filter((p) => p.available).map((p) => p.id));
		const items = lastRound.filter((i) => available.has(i.product_id));
		if (items.length === 0) {
			toast('Lo de la última ronda no está disponible ahora.', 'error');
			return;
		}
		for (const item of items) {
			const { key, ...rest } = item;
			void key;
			cart.add(rest);
		}
		tableOpen = false;
		cartOpen = true;
		if (items.length < lastRound.length)
			toast('Algunas cosas se agotaron y no se agregaron.', 'error');
	}

	let calling = $state<'waiter' | 'bill' | null>(null);
	async function call(kind: 'waiter' | 'bill') {
		if (kind === 'bill' && !confirm('¿Pedimos la cuenta de la mesa?')) return;
		calling = kind;
		const { error } = await supabase().rpc('call_waiter', { p_token: table.token, p_kind: kind });
		calling = null;
		if (error) {
			toast(friendlyError(error), 'error');
			return;
		}
		navigator.vibrate?.(20);
		toast(kind === 'bill' ? 'Listo, ya te traen la cuenta.' : 'Listo, el mozo ya viene.');
		if (kind === 'bill') refreshStatus();
	}

	// Resalta la categoría visible mientras se hace scroll.
	$effect(() => {
		void searching;
		const sections = document.querySelectorAll<HTMLElement>('[data-category]');
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) active = e.target.id;
			},
			{ rootMargin: '-45% 0px -50% 0px' }
		);
		sections.forEach((s) => io.observe(s));
		return () => io.disconnect();
	});

	$effect(() => {
		document
			.getElementById(`chip-${active}`)
			?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
	});

	const openOrders = $derived(status.orders.filter((o) => o.status !== 'served').length);
	const qtyInCart = (id: string) =>
		cart.items.filter((i) => i.product_id === id).reduce((n, i) => n + i.quantity, 0);
</script>

<svelte:head>
	<title>{bar.name} · Mesa {table.label}</title>
	<meta name="robots" content="noindex" />
	{#if bar.cover_url}<link rel="preload" as="image" href={bar.cover_url} />{/if}
</svelte:head>

{#snippet row(p: Product)}
	<ProductRow
		product={p}
		currency={bar.currency}
		inCart={qtyInCart(p.id)}
		showThumb={hasPhotos}
		{canOrder}
		onopen={() => openProduct(p)}
		onadd={() => quickAdd(p)}
	/>
{/snippet}

<div style="--accent: {bar.accent_color}">
	<div class="min-h-dvh pb-36">
		<!-- Portada -->
		<header class="relative isolate overflow-hidden">
			{#if bar.cover_url}
				<img
					src={bar.cover_url}
					alt=""
					fetchpriority="high"
					class="absolute inset-0 -z-10 size-full object-cover"
				/>
				<div
					class="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-black/10"
				></div>
			{:else}
				<div
					class="absolute inset-0 -z-10 bg-accent bg-[radial-gradient(circle_at_85%_-10%,rgba(255,255,255,.35),transparent_45%),radial-gradient(circle_at_0%_120%,rgba(0,0,0,.35),transparent_55%)]"
				></div>
			{/if}
			<div
				class={[
					'flex flex-col justify-end px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-6 text-white',
					bar.cover_url ? 'min-h-56' : 'min-h-40'
				]}
			>
				<div class="flex items-end justify-between gap-3">
					<div class="flex min-w-0 items-center gap-3">
						{#if bar.logo_url}
							<img
								src={bar.logo_url}
								alt=""
								class="size-14 shrink-0 rounded-full object-cover ring-2 ring-white/80"
							/>
						{/if}
						<div class="min-w-0">
							<p class="text-sm font-semibold text-white/80">Bienvenidos a</p>
							<h1 class="truncate text-3xl leading-tight font-extrabold drop-shadow-sm">
								{bar.name}
							</h1>
						</div>
					</div>
					<span
						class="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-sm font-extrabold text-ink shadow-sm"
					>
						Mesa {table.label}
					</span>
				</div>
			</div>
		</header>

		{#if !canOrder}
			<p class="mx-5 mt-4 rounded-2xl bg-card px-4 py-3 text-[15px] text-ink-soft ring-1 ring-line">
				Por ahora los pedidos se toman con el mozo. Podés ver la carta igual.
			</p>
		{/if}

		<!-- Buscador + categorías -->
		<nav
			class="sticky top-0 z-10 -mt-px border-b border-line bg-paper/90 backdrop-blur"
			aria-label="Categorías"
		>
			{#if searching}
				<div class="flex items-center gap-2 px-4 py-2.5">
					<div
						class="flex h-11 flex-1 items-center gap-2 rounded-full bg-card px-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent"
					>
						<Search size={18} class="shrink-0 text-ink-soft" />
						<input
							bind:this={searchInput}
							bind:value={query}
							type="text"
							inputmode="search"
							enterkeyhint="search"
							placeholder="Buscar en la carta…"
							class="h-full w-full border-0 bg-transparent p-0 text-[16px] focus:ring-0"
						/>
					</div>
					<button type="button" class="px-2 font-semibold text-ink-soft" onclick={closeSearch}>
						Cerrar
					</button>
				</div>
			{:else}
				<ul class="flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-4 py-3">
					<li>
						<button
							type="button"
							aria-label="Buscar"
							onclick={openSearch}
							class="grid size-10 place-items-center rounded-full bg-card ring-1 ring-line"
						>
							<Search size={18} />
						</button>
					</li>
					{#each menu as cat (cat.id)}
						<li>
							<a
								id="chip-{cat.id}"
								href="#{cat.id}"
								class={[
									'block rounded-full px-4 py-2 text-[15px] font-semibold whitespace-nowrap transition-colors',
									active === cat.id ? 'bg-ink text-paper' : 'bg-card text-ink-soft ring-1 ring-line'
								]}
							>
								{cat.name}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</nav>

		<main class="mx-auto max-w-xl">
			{#if searching}
				<section class="px-5 pt-5">
					{#if !query.trim()}
						<p class="py-10 text-center text-ink-soft">Escribí qué tenés ganas de pedir.</p>
					{:else if results.length === 0}
						<p class="py-10 text-center text-ink-soft">
							No encontramos “{query}”. Probá con otra palabra.
						</p>
					{:else}
						<ul class="flex flex-col gap-3">
							{#each results as p (p.id)}<li>{@render row(p)}</li>{/each}
						</ul>
					{/if}
				</section>
			{:else}
				{#if menu.length === 0}
					<p class="py-16 text-center text-ink-soft">La carta todavía está vacía.</p>
				{/if}

				<!-- Destacados -->
				{#if featured.length}
					<section class="pt-6" aria-label="Recomendados de la casa">
						<h2 class="flex items-center gap-2 px-5 text-xl font-extrabold">
							<Star size={20} class="fill-accent text-accent" /> Recomendados de la casa
						</h2>
						<div
							class="mt-3 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-3 overflow-x-auto px-5 pb-2"
						>
							{#each featured as p (p.id)}
								<FeaturedCard
									product={p}
									currency={bar.currency}
									inCart={qtyInCart(p.id)}
									{canOrder}
									showPhoto={hasPhotos}
									onopen={() => openProduct(p)}
									onadd={() => quickAdd(p)}
								/>
							{/each}
						</div>
					</section>
				{/if}

				{#each menu as cat (cat.id)}
					<section id={cat.id} data-category class="scroll-mt-20 px-5 pt-7">
						<h2 class="mb-3 text-xl font-extrabold">{cat.name}</h2>
						<ul class="flex flex-col gap-3">
							{#each cat.products as p (p.id)}<li>{@render row(p)}</li>{/each}
						</ul>
					</section>
				{/each}
			{/if}
		</main>
	</div>

	<!-- Barra de acciones: siempre a mano con el pulgar -->
	<div
		class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
	>
		<div class="mx-auto flex max-w-xl items-center gap-2">
			<button
				type="button"
				class="grid h-14 w-16 shrink-0 place-items-center rounded-2xl bg-card text-[11px] font-bold ring-1 ring-line disabled:opacity-50"
				disabled={calling !== null}
				onclick={() => call('waiter')}
			>
				<BellRing size={20} />Mozo
			</button>
			<button
				type="button"
				class="grid h-14 w-16 shrink-0 place-items-center rounded-2xl bg-card text-[11px] font-bold ring-1 ring-line disabled:opacity-50"
				disabled={calling !== null}
				onclick={() => call('bill')}
			>
				<ReceiptText size={20} />Cuenta
			</button>
			<button
				type="button"
				class="relative grid h-14 w-16 shrink-0 place-items-center rounded-2xl bg-card text-[11px] font-bold ring-1 ring-line"
				onclick={() => (tableOpen = true)}
			>
				<ListChecks size={20} />Mi mesa
				{#if openOrders}
					<span
						class="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-accent text-[11px] text-white"
						>{openOrders}</span
					>
				{/if}
			</button>
			{#if canOrder}
				<button
					type="button"
					class={[
						'flex h-14 min-w-0 flex-1 items-center justify-center gap-3 rounded-2xl bg-accent px-4 font-bold text-white shadow-sm transition active:scale-[0.98] disabled:bg-ink-soft/40',
						bump && 'animate-bump'
					]}
					onanimationend={() => (bump = false)}
					aria-label={cart.count ? `Ver pedido: ${cart.count} productos` : 'Pedido vacío'}
					disabled={cart.count === 0}
					onclick={() => (cartOpen = true)}
				>
					<span class="relative shrink-0">
						<ShoppingBag size={22} />
						{#if cart.count}
							<span
								class="absolute -top-2 -right-2.5 grid size-5 place-items-center rounded-full bg-white text-[11px] font-extrabold text-accent"
								>{cart.count}</span
							>
						{/if}
					</span>
					<span class="truncate tabular-nums">
						{cart.count ? price(cart.total, bar.currency) : 'Pedido'}
					</span>
				</button>
			{/if}
		</div>
	</div>

	<ProductSheet
		bind:open={productOpen}
		product={selected}
		currency={bar.currency}
		{canOrder}
		onadd={addToCart}
	/>
	<CartSheet
		bind:open={cartOpen}
		{cart}
		currency={bar.currency}
		tableLabel={table.label}
		{sending}
		suggestions={upsell}
		onquickadd={(p) => addToCart(quickItem(p))}
		bind:name={customerName}
		bind:note={orderNote}
		onsend={sendOrder}
	/>
	<TableSheet
		bind:open={tableOpen}
		loading={!statusLoaded}
		orders={status.orders}
		currency={bar.currency}
		approveFirst={bar.order_mode === 'approve_first'}
		billRequested={status.session_status === 'bill_requested'}
		canRepeat={canOrder && lastRound.length > 0}
		onrepeat={repeatLastRound}
	/>
</div>
