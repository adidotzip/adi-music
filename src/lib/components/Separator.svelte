<script lang="ts">
	import { Divider } from 'm3-svelte'

	interface Props {
		vertical?: boolean
		class?: string
	}

	let { vertical, class: className }: Props = $props()
</script>

<Divider inset={false} {vertical} class={className} />
