<script lang="ts">
	import { Select as M3Select } from 'm3-svelte'

	interface Props {
		value: string
		label?: string
		options: { value: string; text: string }[]
		disabled?: boolean
		class?: string
		onchange?: (value: string) => void
	}

	let {
		value = $bindable(),
		label,
		options,
		disabled,
		class: className,
		onchange,
	}: Props = $props()
</script>

<M3Select
	{label}
	{options}
	{disabled}
	bind:value
	class={className}
	{onchange}
/>
