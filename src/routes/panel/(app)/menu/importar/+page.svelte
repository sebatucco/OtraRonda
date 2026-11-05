<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Camera, FileUp, Sparkles, Trash2 } from '@lucide/svelte';
	import { usePanel } from '#lib/panel/context.js';
	import { blobToBase64, compressImage } from '#lib/image.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';

	type Row = { include: boolean; name: string; description: string; price: number | null };
	type Cat = { name: string; products: Row[] };

	const panel = usePanel();
	const sb = panel.supabase;
	const bar = $derived(panel.bar);

	let step = $state<'pick' | 'reading' | 'review' | 'saving'>('pick');
	let preview = $state<string | null>(null);
	let cats = $state<Cat[]>([]);

	async function onFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		step = 'reading';
		try {
			let media_type = file.type;
			let data: string;
			if (file.type === 'application/pdf') {
				data = await blobToBase64(file);
				preview = null;
			} else {
				// Foto más chica = respuesta más rápida y barata, sin perder legibilidad.
				const blob = await compressImage(file, { max: 2000, type: 'image/jpeg', quality: 0.85 });
				media_type = 'image/jpeg';
				data = await blobToBase64(blob);
				preview = URL.createObjectURL(blob);
			}
			const res = await fetch(resolve('/panel/(app)/menu/importar'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ bar_id: bar.id, media_type, data })
			});
			const body = (await res.json().catch(() => ({}))) as {
				message?: string;
				categories?: { name: string; products: Omit<Row, 'include'>[] }[];
			};
			if (!res.ok) throw new Error(body.message ?? 'No pudimos leer la carta');
			cats = (body.categories ?? []).map((c) => ({
				name: c.name,
				products: c.products.map((p) => ({ ...p, description: p.description ?? '', include: true }))
			}));
			if (cats.length === 0) {
				toast('No encontramos productos en esa imagen. Probá con otra foto.', 'error');
				step = 'pick';
				return;
			}
			step = 'review';
		} catch (err) {
			toast(err instanceof Error ? err.message : friendlyError(err), 'error', 6000);
			step = 'pick';
		}
		(e.target as HTMLInputElement).value = '';
	}

	const selected = $derived(
		cats.reduce((n, c) => n + c.products.filter((p) => p.include).length, 0)
	);

	async function save() {
		step = 'saving';
		try {
			const { data: existing, error: e1 } = await sb
				.from('categories')
				.select('id, name, position')
				.eq('bar_id', bar.id);
			if (e1) throw e1;
			let pos = Math.max(0, ...(existing ?? []).map((c) => c.position as number));
			for (const c of cats) {
				const rows = c.products.filter((p) => p.include && p.name.trim());
				if (!rows.length) continue;
				let catId = existing?.find((x) => x.name.toLowerCase() === c.name.trim().toLowerCase())?.id;
				if (!catId) {
					const ins = await sb
						.from('categories')
						.insert({ bar_id: bar.id, name: c.name.trim(), position: ++pos })
						.select('id')
						.single();
					if (ins.error) throw ins.error;
					catId = ins.data.id;
				}
				const { error } = await sb.from('products').insert(
					rows.map((p, i) => ({
						bar_id: bar.id,
						category_id: catId,
						name: p.name.trim(),
						description: p.description.trim() || null,
						price: p.price ?? 0,
						position: 100 + i
					}))
				);
				if (error) throw error;
			}
			toast(`Listo: ${selected} productos agregados`);
			await goto(resolve('/panel/(app)/menu'));
		} catch (err) {
			toast(friendlyError(err), 'error');
			step = 'review';
		}
	}

	const input =
		'w-full rounded-xl border-line bg-paper text-[16px] focus:border-accent focus:ring-accent';
</script>

<div class="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-8">
	<a href={resolve('/panel/(app)/menu')} class="text-sm font-semibold text-ink-soft">← Menú</a>
	<h1 class="mt-2 flex items-center gap-2 text-3xl font-extrabold">
		<Sparkles class="text-accent" /> Importar la carta
	</h1>

	{#if step === 'pick'}
		<p class="mt-2 max-w-lg text-ink-soft">
			Sacale una foto a tu carta (o subí el PDF). La leemos, separamos categorías, productos y
			precios, y vos revisás todo antes de publicar.
		</p>
		<div class="mt-6 grid gap-3 sm:grid-cols-2">
			<label
				class="flex cursor-pointer flex-col items-center gap-2 rounded-card bg-accent px-6 py-10 font-bold text-white shadow-sm active:scale-[0.99]"
			>
				<Camera size={32} /> Sacar foto
				<input
					type="file"
					accept="image/*"
					capture="environment"
					class="sr-only"
					onchange={onFile}
				/>
			</label>
			<label
				class="flex cursor-pointer flex-col items-center gap-2 rounded-card bg-card px-6 py-10 font-bold ring-1 ring-line active:scale-[0.99]"
			>
				<FileUp size={32} /> Subir imagen o PDF
				<input type="file" accept="image/*,application/pdf" class="sr-only" onchange={onFile} />
			</label>
		</div>
		<p class="mt-4 text-sm text-ink-soft">
			Tip: una página por foto, de frente y con buena luz. Podés importar varias veces y se van
			sumando.
		</p>
	{:else if step === 'reading'}
		<div class="mt-10 flex flex-col items-center gap-4 text-center">
			{#if preview}<img
					src={preview}
					alt=""
					class="max-h-64 rounded-2xl object-contain opacity-70"
				/>{/if}
			<p class="animate-pulse text-lg font-bold">Leyendo tu carta…</p>
			<p class="text-ink-soft">Suele tardar entre 10 y 30 segundos.</p>
		</div>
	{:else}
		<p class="mt-2 text-ink-soft">Revisá nombres y precios. Destildá lo que no quieras agregar.</p>
		<div class="mt-6 flex flex-col gap-5 pb-28">
			{#each cats as c, ci (ci)}
				<section class="rounded-card bg-card p-4 ring-1 ring-line">
					<div class="flex items-center gap-2">
						<input
							bind:value={c.name}
							class="{input} font-display text-lg font-extrabold"
							aria-label="Categoría"
						/>
						<button
							type="button"
							class="grid size-10 place-items-center text-red-700"
							aria-label="Quitar categoría"
							onclick={() => cats.splice(ci, 1)}><Trash2 size={18} /></button
						>
					</div>
					<ul class="mt-3 flex flex-col gap-3">
						{#each c.products as p, pi (pi)}
							<li
								class={[
									'grid grid-cols-[auto_1fr_7rem] items-start gap-2',
									!p.include && 'opacity-40'
								]}
							>
								<input
									type="checkbox"
									bind:checked={p.include}
									class="mt-3 size-5 rounded text-accent focus:ring-accent"
									aria-label="Incluir"
								/>
								<div class="flex flex-col gap-1">
									<input bind:value={p.name} class={input} aria-label="Nombre" />
									<input
										bind:value={p.description}
										placeholder="Descripción (opcional)"
										class="{input} text-sm"
										aria-label="Descripción"
									/>
								</div>
								<input
									type="number"
									step="0.01"
									inputmode="decimal"
									bind:value={p.price}
									placeholder="Precio"
									class={[input, p.price === null && 'ring-2 ring-amber-400']}
									aria-label="Precio"
								/>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>

		<div
			class="fixed inset-x-0 bottom-16 z-10 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-60"
		>
			<div class="mx-auto flex max-w-3xl items-center justify-between gap-3">
				<button type="button" class="font-semibold text-ink-soft" onclick={() => (step = 'pick')}
					>Otra foto</button
				>
				<button
					type="button"
					class="h-13 rounded-full bg-accent px-6 font-bold text-white shadow-sm disabled:opacity-60"
					disabled={step === 'saving' || selected === 0}
					onclick={save}
				>
					{step === 'saving' ? 'Agregando…' : `Agregar ${selected} productos`}
				</button>
			</div>
		</div>
	{/if}
</div>
