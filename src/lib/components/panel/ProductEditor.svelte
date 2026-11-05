<script lang="ts">
	import { ImagePlus, Plus, Trash2, X } from '@lucide/svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import { TAG_LABELS } from '#lib/format.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';
	import {
		saveProduct,
		uploadImage,
		type EditCategory,
		type EditProduct
	} from '#lib/panel/menu.js';
	import type { SupabaseClient } from '@supabase/supabase-js';

	let {
		open = $bindable(false),
		product,
		categories,
		supabase,
		barId,
		onsaved,
		ondelete
	}: {
		open: boolean;
		product: EditProduct | null;
		categories: EditCategory[];
		supabase: SupabaseClient;
		barId: string;
		onsaved: () => void;
		ondelete: (p: EditProduct) => void;
	} = $props();

	let p = $state<EditProduct | null>(null);
	let saving = $state(false);
	let uploading = $state(false);

	$effect(() => {
		if (open && product) p = structuredClone($state.snapshot(product)) as EditProduct;
	});

	async function onFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file || !p) return;
		uploading = true;
		try {
			p.image_url = await uploadImage(supabase, barId, file);
		} catch (err) {
			toast(friendlyError(err), 'error');
		}
		uploading = false;
	}

	function toggleTag(tag: string) {
		if (!p) return;
		p.tags = p.tags.includes(tag) ? p.tags.filter((t) => t !== tag) : [...p.tags, tag];
	}

	function addGroup(preset?: 'size' | 'extras') {
		if (!p) return;
		p.option_groups.push(
			preset === 'size'
				? {
						name: 'Tamaño',
						min_select: 1,
						max_select: 1,
						options: [
							{ name: 'Chico', price_delta: 0, available: true },
							{ name: 'Grande', price_delta: 0, available: true }
						]
					}
				: {
						name: preset === 'extras' ? 'Extras' : '',
						min_select: 0,
						max_select: 3,
						options: [{ name: '', price_delta: 0, available: true }]
					}
		);
	}

	async function save(e?: SubmitEvent) {
		e?.preventDefault();
		if (!p || saving) return;
		if (!p.name.trim()) return toast('Poné un nombre', 'error');
		saving = true;
		try {
			await saveProduct(supabase, barId, $state.snapshot(p) as EditProduct);
			toast('Guardado');
			open = false;
			onsaved();
		} catch (err) {
			toast(friendlyError(err), 'error');
		}
		saving = false;
	}

	const input =
		'mt-1.5 w-full rounded-2xl border-line bg-paper text-[16px] focus:border-accent focus:ring-accent';
</script>

<Sheet bind:open title={p?.id ? 'Editar producto' : 'Nuevo producto'} wide>
	{#if p}
		<form id="product-form" class="flex flex-col gap-5" onsubmit={save}>
			<div class="flex gap-4">
				<label
					class="relative grid size-28 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl bg-paper ring-1 ring-line"
				>
					{#if p.image_url}
						<img src={p.image_url} alt="" class="size-full object-cover" />
					{:else}
						<span class="flex flex-col items-center gap-1 text-xs font-bold text-ink-soft"
							><ImagePlus size={24} />{uploading ? 'Subiendo…' : 'Foto'}</span
						>
					{/if}
					<input type="file" accept="image/*" class="sr-only" onchange={onFile} />
				</label>
				<div class="flex min-w-0 flex-1 flex-col gap-3">
					<label class="block">
						<span class="text-sm font-bold">Nombre</span>
						<input bind:value={p.name} required maxlength="80" class={input} />
					</label>
					<label class="block">
						<span class="text-sm font-bold">Precio</span>
						<input
							type="number"
							min="0"
							step="0.01"
							inputmode="decimal"
							bind:value={p.price}
							required
							class={input}
						/>
					</label>
				</div>
			</div>
			{#if p.image_url}
				<button
					type="button"
					class="-mt-3 self-start text-sm font-semibold text-ink-soft"
					onclick={() => p && (p.image_url = null)}>Quitar foto</button
				>
			{/if}

			<label class="block">
				<span class="text-sm font-bold">Descripción</span>
				<textarea bind:value={p.description} rows="2" maxlength="400" class={input}></textarea>
			</label>

			<label class="block">
				<span class="text-sm font-bold">Categoría</span>
				<select bind:value={p.category_id} class={input}>
					{#each categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
				</select>
			</label>

			<div>
				<span class="text-sm font-bold">Etiquetas</span>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each Object.entries(TAG_LABELS) as [tag, label] (tag)}
						<button
							type="button"
							onclick={() => toggleTag(tag)}
							class={[
								'rounded-full px-3 py-1.5 text-sm font-semibold ring-1',
								p.tags.includes(tag) ? 'bg-ink text-paper ring-ink' : 'ring-line'
							]}>{label}</button
						>
					{/each}
				</div>
			</div>

			<div class="flex items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
				<span
					><span class="font-bold">Disponible</span><br /><span class="text-sm text-ink-soft"
						>Apagalo cuando se agote</span
					></span
				>
				<Toggle label="Disponible" checked={p.available} onchange={(v) => p && (p.available = v)} />
			</div>
			<div class="flex items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
				<span
					><span class="font-bold">Visible en la carta</span><br /><span
						class="text-sm text-ink-soft">Ocultalo sin borrarlo</span
					></span
				>
				<Toggle label="Visible" checked={p.active} onchange={(v) => p && (p.active = v)} />
			</div>

			<!-- Opciones -->
			<div>
				<h3 class="font-bold">Opciones</h3>
				<p class="text-sm text-ink-soft">
					Tamaños, gustos, extras… con precio adicional si querés.
				</p>
				<div class="mt-3 flex flex-col gap-3">
					{#each p.option_groups as g, gi (gi)}
						<div class="rounded-2xl p-4 ring-1 ring-line">
							<div class="flex items-end gap-2">
								<label class="block flex-1">
									<span class="text-xs font-bold text-ink-soft">Nombre del grupo</span>
									<input bind:value={g.name} placeholder="Tamaño, Gusto, Extras…" class={input} />
								</label>
								<button
									type="button"
									class="grid size-11 place-items-center rounded-full text-red-700"
									aria-label="Quitar grupo"
									onclick={() => p?.option_groups.splice(gi, 1)}><Trash2 size={18} /></button
								>
							</div>
							<div class="mt-3 flex flex-wrap gap-3 text-sm">
								<label class="flex items-center gap-2 font-semibold">
									<input
										type="checkbox"
										class="rounded text-accent focus:ring-accent"
										checked={g.min_select > 0}
										onchange={(e) => (g.min_select = e.currentTarget.checked ? 1 : 0)}
									/> Obligatorio
								</label>
								<label class="flex items-center gap-2 font-semibold">
									Máximo a elegir
									<input
										type="number"
										min="1"
										max="20"
										bind:value={g.max_select}
										class="w-16 rounded-xl border-line bg-paper py-1 text-[16px]"
									/>
								</label>
							</div>
							<ul class="mt-3 flex flex-col gap-2">
								{#each g.options as o, oi (oi)}
									<li class="flex items-center gap-2">
										<input
											bind:value={o.name}
											placeholder="Opción"
											class="min-w-0 flex-1 rounded-xl border-line bg-paper text-[16px]"
										/>
										<span class="text-ink-soft">+$</span>
										<input
											type="number"
											step="0.01"
											inputmode="decimal"
											bind:value={o.price_delta}
											class="w-24 rounded-xl border-line bg-paper text-[16px]"
										/>
										<button
											type="button"
											class="grid size-9 place-items-center text-ink-soft"
											aria-label="Quitar opción"
											onclick={() => g.options.splice(oi, 1)}><X size={18} /></button
										>
									</li>
								{/each}
							</ul>
							<button
								type="button"
								class="mt-2 text-sm font-bold text-accent"
								onclick={() => g.options.push({ name: '', price_delta: 0, available: true })}
								>+ Agregar opción</button
							>
						</div>
					{/each}
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						class="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line"
						onclick={() => addGroup('size')}><Plus size={14} class="inline" /> Tamaño</button
					>
					<button
						type="button"
						class="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line"
						onclick={() => addGroup('extras')}><Plus size={14} class="inline" /> Extras</button
					>
					<button
						type="button"
						class="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line"
						onclick={() => addGroup()}><Plus size={14} class="inline" /> Otro grupo</button
					>
				</div>
			</div>
		</form>
	{/if}

	{#snippet footer()}
		<div class="flex items-center gap-3">
			{#if p?.id}
				<button
					type="button"
					class="h-13 rounded-full px-4 font-bold text-red-700"
					onclick={() => p && ondelete(p)}>Borrar</button
				>
			{/if}
			<button
				form="product-form"
				class="h-13 flex-1 rounded-full bg-accent font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
				disabled={saving || uploading}>{saving ? 'Guardando…' : 'Guardar'}</button
			>
		</div>
	{/snippet}
</Sheet>
