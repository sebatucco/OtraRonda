<script lang="ts">
	import { TAG_LABELS, TAG_STYLES } from '#lib/format.js';

	let { tag }: { tag: string } = $props();
</script>

<span
	class={[
		'rounded-full px-2 py-0.5 text-xs font-bold',
		TAG_STYLES[tag] ?? 'bg-paper text-ink-soft'
	]}>{TAG_LABELS[tag] ?? tag}</span
>
