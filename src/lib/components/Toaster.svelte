<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '#lib/toast.svelte.js';
</script>

<div
	class="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex flex-col items-center px-4"
	aria-live="polite"
>
	{#each toasts as t (t.id)}
		<div
			in:fly={{ y: -16, duration: 200 }}
			out:fly={{ y: -16, duration: 150 }}
			class={[
				'pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-center text-[15px] font-semibold shadow-lg',
				t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-paper'
			]}
		>
			{t.text}
		</div>
	{/each}
</div>
