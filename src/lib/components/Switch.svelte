<script lang="ts">
	import { Switch as M3Switch } from 'm3-svelte'

	interface Props {
		checked: boolean
	}

	let { checked = $bindable(false) }: Props = $props()
</script>

<label>
	<M3Switch icons="checked">
		<input type="checkbox" bind:checked style="opacity: 0; position: absolute; pointer-events: none;" />
	</M3Switch>
</label>
