<script lang="ts">
	let {
		checked,
		onchange,
		label,
		disabled = false
	}: {
		checked: boolean;
		onchange: (v: boolean) => void;
		label: string;
		disabled?: boolean;
	} = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	{disabled}
	onclick={() => onchange(!checked)}
	class={[
		'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
		checked ? 'bg-ok' : 'bg-line'
	]}
>
	<span
		class={[
			'inline-block size-6 rounded-full bg-white shadow transition-transform',
			checked ? 'translate-x-7' : 'translate-x-1'
		]}
	></span>
</button>
