<script lang="ts">
	import { VariableTabs } from 'm3-svelte'

	interface Props {
		items: { name: string; value: string }[]
		tab: string
		secondary?: boolean
		class?: string
		onchange?: (tab: string) => void
	}

	let {
		items,
		tab = $bindable(),
		secondary,
		class: className,
		onchange,
	}: Props = $props()
</script>

<VariableTabs
	{items}
	bind:tab
	{secondary}
	class={className}
	{onchange}
/>
