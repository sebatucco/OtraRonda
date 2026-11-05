<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { X } from '@lucide/svelte';

	let {
		open = $bindable(false),
		title,
		children,
		footer,
		wide = false
	}: {
		open: boolean;
		title?: string;
		children: Snippet;
		footer?: Snippet;
		/** En pantallas grandes se muestra como panel lateral ancho. */
		wide?: boolean;
	} = $props();

	let panel = $state<HTMLElement>();

	$effect(() => {
		if (!open) return;
		const prev = document.activeElement as HTMLElement | null;
		const overflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		queueMicrotask(() => panel?.focus());
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open = false);
		window.addEventListener('keydown', onKey);
		return () => {
			document.body.style.overflow = overflow;
			window.removeEventListener('keydown', onKey);
			prev?.focus?.();
		};
	});
</script>

{#if open}
	<div class="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
		<button
			type="button"
			aria-label="Cerrar"
			class="absolute inset-0 bg-black/45"
			transition:fade={{ duration: 150 }}
			onclick={() => (open = false)}
		></button>
		<div
			bind:this={panel}
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			transition:fly={{ y: 400, duration: 260, opacity: 1 }}
			class={[
				'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card shadow-2xl outline-none sm:rounded-[1.75rem]',
				wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
			]}
		>
			<div class="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line sm:hidden"></div>
			<header class="flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-2">
				{#if title}<h2 class="pt-1 text-xl font-extrabold">{title}</h2>{/if}
				<button
					type="button"
					class="-mr-1 ml-auto grid size-10 shrink-0 place-items-center rounded-full bg-paper"
					aria-label="Cerrar"
					onclick={() => (open = false)}
				>
					<X size={20} />
				</button>
			</header>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
				{@render children()}
			</div>
			{#if footer}
				<footer
					class="shrink-0 border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
				>
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}
