<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ImagePlus } from '@lucide/svelte';
	import Toggle from '#lib/components/Toggle.svelte';
	import { usePanel } from '#lib/panel/context.js';
	import { uploadImage } from '#lib/panel/menu.js';
	import { friendlyError } from '#lib/errors.js';
	import { toast } from '#lib/toast.svelte.js';

	const panel = usePanel();
	const sb = panel.supabase;
	const isOwner = $derived(panel.role === 'owner');

	let form = $state({ ...panel.bar });
	let saving = $state(false);
	let uploading = $state(false);

	const COLORS = [
		'#E8572A',
		'#D93F55',
		'#B5338A',
		'#6D4AE0',
		'#2563EB',
		'#0F8F7A',
		'#3F8A2E',
		'#C98A12',
		'#1C1917'
	];

	async function onLogo(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		uploading = true;
		try {
			form.logo_url = await uploadImage(sb, form.id, file, { max: 400 });
		} catch (err) {
			toast(friendlyError(err), 'error');
		}
		uploading = false;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		const { error } = await sb
			.from('bars')
			.update({
				name: form.name.trim(),
				logo_url: form.logo_url,
				accent_color: form.accent_color.toUpperCase(),
				order_mode: form.order_mode,
				ordering_enabled: form.ordering_enabled
			})
			.eq('id', form.id);
		saving = false;
		if (error) return toast(friendlyError(error), 'error');
		toast('Guardado');
		await invalidateAll();
	}

	const input =
		'mt-1.5 h-13 w-full rounded-2xl border-line bg-paper text-[16px] focus:border-accent focus:ring-accent';
</script>

<div class="mx-auto max-w-2xl px-4 py-5 md:px-8 md:py-8" style="--accent: {form.accent_color}">
	<h1 class="text-3xl font-extrabold">Ajustes</h1>
	{#if !isOwner}
		<p class="mt-2 text-ink-soft">Solo el dueño del bar puede cambiar los ajustes.</p>
	{/if}

	<form class="mt-6 flex flex-col gap-6" onsubmit={save}>
		<fieldset disabled={!isOwner} class="flex flex-col gap-6">
			<section class="rounded-card bg-card p-5 ring-1 ring-line">
				<h2 class="text-lg font-extrabold">Tu marca</h2>
				<div class="mt-4 flex items-center gap-4">
					<label
						class="grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-paper ring-1 ring-line"
					>
						{#if form.logo_url}
							<img src={form.logo_url} alt="Logo" class="size-full object-cover" />
						{:else}
							<span class="flex flex-col items-center text-[11px] font-bold text-ink-soft"
								><ImagePlus size={22} />{uploading ? '…' : 'Logo'}</span
							>
						{/if}
						<input type="file" accept="image/*" class="sr-only" onchange={onLogo} />
					</label>
					<label class="block flex-1">
						<span class="text-sm font-bold">Nombre del bar</span>
						<input bind:value={form.name} required maxlength="80" class={input} />
					</label>
				</div>
				<div class="mt-5">
					<span class="text-sm font-bold">Color</span>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						{#each COLORS as c (c)}
							<button
								type="button"
								aria-label="Color {c}"
								class={[
									'size-10 rounded-full ring-offset-2 ring-offset-card',
									form.accent_color.toUpperCase() === c && 'ring-2 ring-ink'
								]}
								style="background: {c}"
								onclick={() => (form.accent_color = c)}
							></button>
						{/each}
						<input
							type="color"
							bind:value={form.accent_color}
							class="size-10 cursor-pointer rounded-full border-0 bg-transparent p-0"
							aria-label="Otro color"
						/>
					</div>
					<div class="mt-4 flex items-center gap-3 rounded-2xl bg-paper p-3">
						<span class="rounded-full bg-accent px-3 py-1 text-sm font-bold text-white">Mesa 5</span
						>
						<span class="flex-1 font-display font-extrabold">{form.name || 'Tu bar'}</span>
						<span class="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white"
							>Ver pedido</span
						>
					</div>
				</div>
			</section>

			<section class="rounded-card bg-card p-5 ring-1 ring-line">
				<h2 class="text-lg font-extrabold">Pedidos</h2>
				<div class="mt-4 flex items-center justify-between gap-4">
					<span>
						<span class="font-bold">Recibir pedidos por QR</span><br />
						<span class="text-sm text-ink-soft"
							>Apagalo para mostrar solo la carta (por ejemplo, si la cocina está saturada).</span
						>
					</span>
					<Toggle
						label="Recibir pedidos"
						checked={form.ordering_enabled}
						onchange={(v) => (form.ordering_enabled = v)}
					/>
				</div>
				<div class="mt-5">
					<span class="font-bold">Cuando llega un pedido</span>
					<div class="mt-2 grid gap-2">
						<label
							class={[
								'flex cursor-pointer gap-3 rounded-2xl p-4 ring-1',
								form.order_mode === 'open' ? 'ring-2 ring-accent' : 'ring-line'
							]}
						>
							<input
								type="radio"
								bind:group={form.order_mode}
								value="open"
								class="mt-1 text-accent focus:ring-accent"
							/>
							<span
								><span class="font-bold">Entra directo</span><br /><span
									class="text-sm text-ink-soft"
									>Suena en el panel y se marca “Visto”. Lo más rápido.</span
								></span
							>
						</label>
						<label
							class={[
								'flex cursor-pointer gap-3 rounded-2xl p-4 ring-1',
								form.order_mode === 'approve_first' ? 'ring-2 ring-accent' : 'ring-line'
							]}
						>
							<input
								type="radio"
								bind:group={form.order_mode}
								value="approve_first"
								class="mt-1 text-accent focus:ring-accent"
							/>
							<span
								><span class="font-bold">El mozo lo aprueba</span><br /><span
									class="text-sm text-ink-soft"
									>Cada pedido se acepta o rechaza. Útil si te preocupan pedidos en broma.</span
								></span
							>
						</label>
					</div>
				</div>
			</section>
		</fieldset>

		{#if isOwner}
			<button
				class="h-14 rounded-full bg-accent text-lg font-bold text-white shadow-sm disabled:opacity-60"
				disabled={saving || uploading}
			>
				{saving ? 'Guardando…' : 'Guardar cambios'}
			</button>
		{/if}
	</form>

	<form method="POST" action="/auth/salir" class="mt-10 md:hidden">
		<button class="font-semibold text-ink-soft">Cerrar sesión</button>
	</form>
</div>
