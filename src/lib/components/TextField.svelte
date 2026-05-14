<script lang="ts">
	import { TextField as M3TextField } from 'm3-svelte'

	interface Props {
		value: string
		label?: string
		placeholder?: string
		type?: string
		disabled?: boolean
		class?: string
		onchange?: (value: string) => void
	}

	let {
		value = $bindable(),
		label,
		placeholder,
		type = 'text',
		disabled,
		class: className,
		onchange,
	}: Props = $props()
</script>

<M3TextField
	{label}
	{placeholder}
	{type}
	{disabled}
	bind:value
	class={className}
	oninput={(e) => onchange?.((e.target as HTMLInputElement).value)}
/>
