<script lang="ts">
	import { ListItem as M3ListItem } from 'm3-svelte'

	interface Props {
		headline: string
		supporting?: string
		leading?: Snippet
		trailing?: Snippet
		onclick?: () => void
		href?: string
		class?: string
		disabled?: boolean
	}

	let {
		headline,
		supporting,
		leading,
		trailing,
		onclick,
		href,
		class: className,
		disabled,
	}: Props = $props()
</script>

<M3ListItem
	{headline}
	{supporting}
	{leading}
	{trailing}
	{onclick}
	{href}
	class={className}
	{disabled}
/>
