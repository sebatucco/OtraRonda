<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browserClient } from '#lib/supabase.js';
	import { friendlyError } from '#lib/errors.js';

	let name = $state('');
	let slug = $state('');
	let slugTouched = $state(false);
	let tables = $state(10);
	let saving = $state(false);
	let error = $state('');

	const slugify = (s: string) =>
		s
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40);

	$effect(() => {
		if (!slugTouched) slug = slugify(name);
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		error = '';
		const sb = browserClient();
		const { data: barId, error: err } = await sb.rpc('create_bar', {
			p_name: name,
			p_slug: slugify(slug)
		});
		if (err) {
			saving = false;
			error = /duplicate|23505|unique/i.test(err.message)
				? 'Ese link ya lo usa otro bar. Probá con otro.'
				: friendlyError(err);
			return;
		}
		if (tables > 0) await sb.rpc('create_tables', { p_bar_id: barId, p_count: tables });
		await goto(resolve('/panel/(app)/menu'), { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Tu bar · Otra Ronda</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
	<div>
		<p class="text-sm font-semibold tracking-widest text-accent uppercase">Paso 1 de 2</p>
		<h1 class="mt-2 text-3xl font-extrabold">Contanos de tu bar</h1>
		<p class="mt-2 text-ink-soft">Después cargás la carta (o la sacamos de una foto).</p>
	</div>

	<form class="flex flex-col gap-5" onsubmit={submit}>
		<label class="block">
			<span class="text-sm font-bold">Nombre del bar</span>
			<input
				required
				maxlength="80"
				bind:value={name}
				placeholder="La Esquina"
				class="mt-1.5 h-13 w-full rounded-2xl border-line bg-card text-[16px] focus:border-accent focus:ring-accent"
			/>
		</label>

		<label class="block">
			<span class="text-sm font-bold">Link de tu carta</span>
			<div
				class="mt-1.5 flex h-13 items-center overflow-hidden rounded-2xl border border-line bg-card focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
			>
				<span class="pl-4 text-ink-soft">…/m/</span>
				<input
					required
					pattern="[a-z0-9]+(-[a-z0-9]+)*"
					bind:value={slug}
					oninput={() => (slugTouched = true)}
					class="h-full flex-1 border-0 bg-transparent pl-0.5 text-[16px] focus:ring-0"
				/>
			</div>
			<span class="mt-1 block text-sm text-ink-soft">Solo minúsculas, números y guiones.</span>
		</label>

		<label class="block">
			<span class="text-sm font-bold">¿Cuántas mesas tenés?</span>
			<input
				type="number"
				min="0"
				max="200"
				bind:value={tables}
				class="mt-1.5 h-13 w-full rounded-2xl border-line bg-card text-[16px] focus:border-accent focus:ring-accent"
			/>
			<span class="mt-1 block text-sm text-ink-soft"
				>Las numeramos del 1 en adelante. Después podés renombrarlas (Barra, Patio 2…).</span
			>
		</label>

		{#if error}<p class="font-semibold text-red-700">{error}</p>{/if}

		<button
			class="h-14 rounded-full bg-accent text-lg font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
			disabled={saving}
		>
			{saving ? 'Creando…' : 'Crear mi bar'}
		</button>
	</form>
</main>
