<script lang="ts">
	import { LoadingIndicator } from 'm3-svelte'

	interface Props {
		size?: number
		strokeWidth?: number
		class?: string
	}

	let { class: className }: Props = $props()
</script>

<LoadingIndicator class={className} />
