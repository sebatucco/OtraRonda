<script lang="ts">
	import { MailCheck } from '@lucide/svelte';
	import { browserClient } from '#lib/supabase.js';
	import { friendlyError } from '#lib/errors.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let email = $state('');
	let sending = $state(false);
	let sent = $state(false);
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		sending = true;
		error = '';
		const { error: err } = await browserClient().auth.signInWithOtp({
			email: email.trim(),
			options: { emailRedirectTo: `${location.origin}/auth/callback?next=/panel` }
		});
		sending = false;
		if (err) error = friendlyError(err);
		else sent = true;
	}
</script>

<svelte:head>
	<title>Entrar · Otra Ronda</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
	<p class="text-sm font-semibold tracking-widest text-accent uppercase">Otra Ronda</p>

	{#if sent}
		<div class="flex flex-col gap-4">
			<MailCheck size={44} class="text-accent" />
			<h1 class="text-3xl font-extrabold">Revisá tu email</h1>
			<p class="text-ink-soft">
				Te mandamos un link a <strong class="text-ink">{email}</strong>. Abrilo desde este mismo
				dispositivo y entrás directo. Sin contraseñas.
			</p>
			<button
				type="button"
				class="self-start font-semibold text-accent"
				onclick={() => (sent = false)}
			>
				Usar otro email
			</button>
		</div>
	{:else}
		<h1 class="text-3xl font-extrabold">Entrá al panel de tu bar</h1>
		{#if data.linkError}
			<p class="rounded-2xl bg-red-50 px-4 py-3 text-red-800">
				El link expiró o ya se usó. Pedí uno nuevo.
			</p>
		{/if}
		<form class="flex flex-col gap-3" onsubmit={submit}>
			<label class="block">
				<span class="text-sm font-bold">Email</span>
				<input
					type="email"
					required
					bind:value={email}
					autocomplete="email"
					inputmode="email"
					placeholder="vos@tubar.com"
					class="mt-1.5 h-13 w-full rounded-2xl border-line bg-card text-[16px] focus:border-accent focus:ring-accent"
				/>
			</label>
			{#if error}<p class="text-sm font-semibold text-red-700">{error}</p>{/if}
			<button
				class="h-13 rounded-full bg-accent font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
				disabled={sending}
			>
				{sending ? 'Enviando…' : 'Mandame el link'}
			</button>
		</form>
		<p class="text-sm text-ink-soft">
			¿Es tu primera vez? Usá el mismo botón: creamos tu cuenta y en un minuto armás tu bar.
		</p>
	{/if}
</main>
