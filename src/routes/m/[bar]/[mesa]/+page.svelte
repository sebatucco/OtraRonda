<script lang="ts">
	import { price, TAG_LABELS } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const { bar, table, menu } = $derived(data);

	let active = $state('');

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
			?.scrollIntoView({ inline: 'center', block: 'nearest' });
	});
</script>

<svelte:head>
	<title>{bar.name} · Mesa {table.label}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div style="--accent: {bar.accent_color}" class="min-h-dvh pb-32">
	<header class="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				{#if bar.logo_url}
					<img src={bar.logo_url} alt="" class="size-11 rounded-full object-cover" />
				{/if}
				<h1 class="text-2xl font-extrabold">{bar.name}</h1>
			</div>
			<span class="rounded-full bg-accent px-3.5 py-1.5 text-sm font-bold text-white">
				Mesa {table.label}
			</span>
		</div>
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

	<main class="px-5">
		{#each menu as cat (cat.id)}
			<section id={cat.id} data-category class="scroll-mt-20 pt-6">
				<h2 class="mb-3 text-xl font-extrabold">{cat.name}</h2>
				<ul class="flex flex-col gap-3">
					{#each cat.products as p (p.id)}
						<li
							class={[
								'flex gap-4 rounded-card bg-card p-4 ring-1 ring-line',
								!p.available && 'opacity-50'
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
									alt={p.name}
									loading="lazy"
									decoding="async"
									class="size-24 shrink-0 rounded-2xl object-cover"
								/>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</main>

	<!-- Próximo paso: hoja de producto, carrito y envío del pedido (RPC place_order). -->
</div>
