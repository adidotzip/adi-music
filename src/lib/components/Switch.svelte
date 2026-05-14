<script lang="ts">
	import { Switch as M3Switch } from 'm3-svelte'

	interface Props {
		checked: boolean
		disabled?: boolean
		class?: string
		onchange?: (checked: boolean) => void
	}

	let { checked = $bindable(), disabled, class: className, onchange }: Props = $props()
</script>

<label class={className}>
	<M3Switch
		{disabled}
		bind:checked
		{onchange}
	/>
</label>
