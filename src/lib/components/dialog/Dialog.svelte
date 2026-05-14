<script lang="ts">
	import { Dialog as M3Dialog, Button } from 'm3-svelte'

	interface Props {
		open: boolean
		headline: string
		children?: Snippet
		buttons?: Snippet
		class?: string
	}

	let { open = $bindable(), headline, children, buttons, class: className }: Props = $props()
</script>

<M3Dialog
	bind:open
	{headline}
	class={className}
>
	{#if children}
		{@render children()}
	{/if}

	{#snippet buttons()}
		{#if buttons}
			{@render buttons()}
		{/if}
	{/snippet}
</M3Dialog>
