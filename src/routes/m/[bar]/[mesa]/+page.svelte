<script lang="ts">
	import { onMount } from 'svelte';
	import { BellRing, ReceiptText, ShoppingBag, ListChecks } from '@lucide/svelte';
	import { price, TAG_LABELS } from '#lib/format.js';
	import { Cart, type CartItem } from '#lib/cart.svelte.js';
	import { browserClient } from '#lib/supabase.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';
	import { readJSON, writeJSON } from '#lib/storage.js';
	import type { Product, TableStatus } from '#lib/types.js';
	import ProductSheet from '#lib/components/menu/ProductSheet.svelte';
	import CartSheet from '#lib/components/menu/CartSheet.svelte';
	import TableSheet from '#lib/components/menu/TableSheet.svelte';
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
	let lastRound = $state<CartItem[]>([]);

	const supabase = () => browserClient();

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
	}

	function openProduct(p: Product) {
		selected = p;
		productOpen = true;
	}

	function addToCart(item: Omit<CartItem, 'key'>) {
		cart.add(item);
		navigator.vibrate?.(15);
		toast(`Agregado: ${item.quantity > 1 ? `${item.quantity}× ` : ''}${item.name}`);
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
		const available = new Set(
			menu.flatMap((c) => c.products.filter((p) => p.available).map((p) => p.id))
		);
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
</svelte:head>

<div style="--accent: {bar.accent_color}">
	<div class="min-h-dvh pb-36">
		<header class="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
			<div class="flex items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-3">
					{#if bar.logo_url}
						<img src={bar.logo_url} alt="" class="size-11 shrink-0 rounded-full object-cover" />
					{/if}
					<h1 class="truncate text-2xl font-extrabold">{bar.name}</h1>
				</div>
				<span class="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-sm font-bold text-white">
					Mesa {table.label}
				</span>
			</div>
			{#if !canOrder}
				<p class="mt-3 rounded-2xl bg-card px-4 py-3 text-[15px] text-ink-soft ring-1 ring-line">
					Por ahora los pedidos se toman con el mozo. Podés ver la carta igual.
				</p>
			{/if}
		</header>

		<nav
			class="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur"
			aria-label="Categorías"
		>
			<ul class="flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 py-3">
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
		</nav>

		<main class="mx-auto max-w-xl px-5">
			{#if menu.length === 0}
				<p class="py-16 text-center text-ink-soft">La carta todavía está vacía.</p>
			{/if}
			{#each menu as cat (cat.id)}
				<section id={cat.id} data-category class="scroll-mt-20 pt-6">
					<h2 class="mb-3 text-xl font-extrabold">{cat.name}</h2>
					<ul class="flex flex-col gap-3">
						{#each cat.products as p (p.id)}
							{@const inCart = qtyInCart(p.id)}
							<li>
								<button
									type="button"
									onclick={() => openProduct(p)}
									class={[
										'relative flex w-full gap-4 rounded-card bg-card p-4 text-left ring-1 transition active:scale-[0.99]',
										!p.available && 'opacity-50',
										inCart ? 'ring-2 ring-accent' : 'ring-line'
									]}
								>
									<div class="flex min-w-0 flex-1 flex-col gap-1">
										<h3 class="text-[17px] leading-snug font-semibold">{p.name}</h3>
										{#if p.description}
											<p class="line-clamp-2 text-[15px] text-ink-soft">{p.description}</p>
										{/if}
										<div class="mt-auto flex flex-wrap items-center gap-2 pt-2">
											<span class="font-bold">{price(p.price, bar.currency)}</span>
											{#if !p.available}
												<span class="text-sm font-semibold text-ink-soft">Agotado</span>
											{/if}
											{#each p.tags as tag (tag)}
												<span
													class="rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-ink-soft"
												>
													{TAG_LABELS[tag] ?? tag}
												</span>
											{/each}
										</div>
									</div>
									{#if p.image_url}
										<img
											src={p.image_url}
											alt=""
											loading="lazy"
											decoding="async"
											class="size-24 shrink-0 rounded-2xl object-cover"
										/>
									{/if}
									{#if inCart}
										<span
											class="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-accent text-sm font-bold text-white shadow"
											>{inCart}</span
										>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
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
					class="flex h-14 min-w-0 flex-1 items-center justify-center gap-3 rounded-2xl bg-accent px-4 font-bold text-white shadow-sm transition active:scale-[0.98] disabled:bg-ink-soft/40"
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
		bind:name={customerName}
		bind:note={orderNote}
		onsend={sendOrder}
	/>
	<TableSheet
		bind:open={tableOpen}
		orders={status.orders}
		currency={bar.currency}
		approveFirst={bar.order_mode === 'approve_first'}
		billRequested={status.session_status === 'bill_requested'}
		canRepeat={canOrder && lastRound.length > 0}
		onrepeat={repeatLastRound}
	/>
</div>
