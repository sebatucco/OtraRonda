<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		ArrowDown,
		ArrowUp,
		Pencil,
		Plus,
		Sparkles,
		Star,
		Trash2,
		ExternalLink
	} from '@lucide/svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import Thumb from '#lib/components/menu/Thumb.svelte';
	import ProductEditor from '#lib/components/panel/ProductEditor.svelte';
	import { usePanel } from '#lib/panel/context.js';
	import { loadMenu, swapPositions, type EditCategory, type EditProduct } from '#lib/panel/menu.js';
	import { price } from '#lib/format.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';

	const panel = usePanel();
	const sb = panel.supabase;
	const bar = $derived(panel.bar);

	let menu = $state<EditCategory[]>([]);
	let loading = $state(true);
	let editorOpen = $state(false);
	let editing = $state<EditProduct | null>(null);

	async function reload() {
		try {
			menu = await loadMenu(sb, bar.id);
		} catch (err) {
			toast(friendlyError(err), 'error');
		}
		loading = false;
	}
	onMount(reload);

	const fail = (err: unknown) => {
		toast(friendlyError(err), 'error');
		reload();
	};

	async function addCategory() {
		const name = prompt('Nombre de la categoría (ej: Cervezas, Tragos, Para picar)')?.trim();
		if (!name) return;
		const position = (menu.at(-1)?.position ?? 0) + 1;
		const { error } = await sb.from('categories').insert({ bar_id: bar.id, name, position });
		if (error) return fail(error);
		reload();
	}

	async function renameCategory(c: EditCategory) {
		const name = prompt('Nuevo nombre', c.name)?.trim();
		if (!name || name === c.name) return;
		c.name = name;
		const { error } = await sb.from('categories').update({ name }).eq('id', c.id);
		if (error) fail(error);
	}

	async function deleteCategory(c: EditCategory) {
		const msg = c.products.length
			? `¿Borrar "${c.name}" y sus ${c.products.length} productos?`
			: `¿Borrar "${c.name}"?`;
		if (!confirm(msg)) return;
		const { error } = await sb.from('categories').delete().eq('id', c.id);
		if (error) return fail(error);
		menu = menu.filter((x) => x.id !== c.id);
	}

	async function moveCategory(i: number, dir: -1 | 1) {
		const a = menu[i];
		const b = menu[i + dir];
		if (!a || !b) return;
		try {
			await swapPositions(sb, 'categories', a, b);
		} catch (err) {
			return fail(err);
		}
		reload();
	}

	async function moveProduct(c: EditCategory, i: number, dir: -1 | 1) {
		const a = c.products[i];
		const b = c.products[i + dir];
		if (!a?.id || !b?.id) return;
		try {
			await swapPositions(
				sb,
				'products',
				a as { id: string; position: number },
				b as { id: string; position: number }
			);
		} catch (err) {
			return fail(err);
		}
		reload();
	}

	/** "Agotado con un toque": se refleja al instante en todos los celulares. */
	async function setAvailable(p: EditProduct, available: boolean) {
		p.available = available;
		const { error } = await sb.from('products').update({ available }).eq('id', p.id!);
		if (error) fail(error);
		else toast(available ? `${p.name}: disponible` : `${p.name}: agotado`);
	}

	/** Destacados: aparecen en el carrusel "Recomendados de la casa" arriba de la carta. */
	async function setFeatured(p: EditProduct, featured: boolean) {
		p.featured = featured;
		const { error } = await sb.from('products').update({ featured }).eq('id', p.id!);
		if (error) fail(error);
		else toast(featured ? `${p.name}: ahora es recomendado ⭐` : `${p.name}: ya no es recomendado`);
	}

	function newProduct(c: EditCategory) {
		editing = {
			category_id: c.id,
			name: '',
			description: '',
			price: 0,
			image_url: null,
			tags: [],
			available: true,
			featured: false,
			active: true,
			position: (c.products.at(-1)?.position ?? 0) + 1,
			option_groups: []
		};
		editorOpen = true;
	}

	function edit(p: EditProduct) {
		editing = p;
		editorOpen = true;
	}

	async function deleteProduct(p: EditProduct) {
		if (!p.id || !confirm(`¿Borrar "${p.name}"?`)) return;
		const { error } = await sb.from('products').delete().eq('id', p.id);
		if (error) return fail(error);
		editorOpen = false;
		reload();
	}

	const totalProducts = $derived(menu.reduce((n, c) => n + c.products.length, 0));
	const soldOut = $derived(
		menu.reduce((n, c) => n + c.products.filter((p) => !p.available).length, 0)
	);
</script>

<div class="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-8">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-3xl font-extrabold">Menú</h1>
			<p class="text-ink-soft">
				{totalProducts} productos{soldOut ? ` · ${soldOut} agotados` : ''}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<a
				href={resolve('/panel/(app)/menu/importar')}
				class="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 font-bold text-paper"
				><Sparkles size={18} /> Importar de una foto</a
			>
			<button
				type="button"
				class="inline-flex h-11 items-center gap-2 rounded-full px-4 font-bold ring-1 ring-line"
				onclick={addCategory}><Plus size={18} /> Categoría</button
			>
		</div>
	</div>

	{#if loading}
		<p class="py-20 text-center text-ink-soft">Cargando…</p>
	{:else if menu.length === 0}
		<div class="mt-8 rounded-card bg-card px-6 py-12 text-center ring-1 ring-line">
			<p class="text-lg font-bold">Tu carta está vacía</p>
			<p class="mx-auto mt-1 max-w-sm text-ink-soft">
				Sacale una foto a tu carta actual y la armamos en segundos, o empezá creando una categoría.
			</p>
			<div class="mt-5 flex justify-center gap-2">
				<a
					href={resolve('/panel/(app)/menu/importar')}
					class="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-bold text-white"
					><Sparkles size={18} /> Importar de una foto</a
				>
				<button
					type="button"
					class="h-12 rounded-full px-5 font-bold ring-1 ring-line"
					onclick={addCategory}>Crear categoría</button
				>
			</div>
		</div>
	{:else}
		<div class="mt-6 flex flex-col gap-6">
			{#each menu as c, ci (c.id)}
				<section class="rounded-card bg-card ring-1 ring-line">
					<header class="flex items-center gap-2 border-b border-line px-4 py-3">
						<h2 class="min-w-0 flex-1 truncate text-lg font-extrabold">{c.name}</h2>
						<button
							type="button"
							class="grid size-9 place-items-center text-ink-soft disabled:opacity-30"
							aria-label="Subir"
							disabled={ci === 0}
							onclick={() => moveCategory(ci, -1)}><ArrowUp size={18} /></button
						>
						<button
							type="button"
							class="grid size-9 place-items-center text-ink-soft disabled:opacity-30"
							aria-label="Bajar"
							disabled={ci === menu.length - 1}
							onclick={() => moveCategory(ci, 1)}><ArrowDown size={18} /></button
						>
						<button
							type="button"
							class="grid size-9 place-items-center text-ink-soft"
							aria-label="Renombrar"
							onclick={() => renameCategory(c)}><Pencil size={18} /></button
						>
						<button
							type="button"
							class="grid size-9 place-items-center text-red-700"
							aria-label="Borrar categoría"
							onclick={() => deleteCategory(c)}><Trash2 size={18} /></button
						>
					</header>
					<ul class="divide-y divide-line">
						{#each c.products as p, pi (p.id)}
							<li class={['flex items-center gap-3 px-4 py-3', !p.active && 'opacity-50']}>
								<button
									type="button"
									class="flex min-w-0 flex-1 items-center gap-3 text-left"
									onclick={() => edit(p)}
								>
									<Thumb
										src={p.image_url}
										name={p.name}
										class="size-12 shrink-0 rounded-xl text-[0.7rem]"
									/>
									<span class="min-w-0">
										<span class="block truncate font-semibold">{p.name}</span>
										<span class="block text-sm text-ink-soft">
											{price(p.price, bar.currency)}{p.option_groups.length
												? ' · con opciones'
												: ''}{!p.active ? ' · oculto' : ''}
										</span>
									</span>
								</button>
								<div class="hidden flex-col sm:flex">
									<button
										type="button"
										class="grid size-6 place-items-center text-ink-soft disabled:opacity-30"
										aria-label="Subir"
										disabled={pi === 0}
										onclick={() => moveProduct(c, pi, -1)}><ArrowUp size={14} /></button
									>
									<button
										type="button"
										class="grid size-6 place-items-center text-ink-soft disabled:opacity-30"
										aria-label="Bajar"
										disabled={pi === c.products.length - 1}
										onclick={() => moveProduct(c, pi, 1)}><ArrowDown size={14} /></button
									>
								</div>
								<button
									type="button"
									class={[
										'grid size-10 place-items-center rounded-full',
										p.featured ? 'text-amber-500' : 'text-ink-soft/40'
									]}
									aria-label={p.featured ? 'Quitar de recomendados' : 'Destacar en recomendados'}
									aria-pressed={p.featured}
									title="Recomendado de la casa"
									onclick={() => setFeatured(p, !p.featured)}
								>
									<Star size={20} class={p.featured ? 'fill-amber-400' : ''} />
								</button>
								<span class="flex flex-col items-center gap-0.5">
									<Toggle
										label="Disponible"
										checked={p.available}
										onchange={(v) => setAvailable(p, v)}
									/>
									<span class={['text-[11px] font-bold', p.available ? 'text-ok' : 'text-red-700']}
										>{p.available ? 'Hay' : 'Agotado'}</span
									>
								</span>
							</li>
						{/each}
					</ul>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-4 py-3 font-bold text-accent"
						onclick={() => newProduct(c)}
					>
						<Plus size={18} /> Agregar producto
					</button>
				</section>
			{/each}
		</div>
		<a
			href={resolve('/panel/(app)/mesas')}
			class="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-soft"
		>
			<ExternalLink size={16} /> Para ver cómo lo ven tus clientes, abrí el QR de una mesa en “Mesas y
			QR”.
		</a>
	{/if}
</div>

<ProductEditor
	bind:open={editorOpen}
	product={editing}
	categories={menu}
	supabase={sb}
	barId={bar.id}
	onsaved={reload}
	ondelete={deleteProduct}
/>
