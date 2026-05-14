<script lang="ts">
	import { Menu, MenuItem, Icon } from 'm3-svelte'
	import type { MenuOptions } from './types.ts'

	interface Props {
		options: MenuOptions
		onClose: () => void
	}

	let { options }: Props = $props()
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onclick={() => options.onClose?.()}>
	<div class="min-w-48" onclick={(e) => e.stopPropagation()}>
		<Menu>
			{#each options.items as item}
				{#if item.type === 'item'}
					<MenuItem
						icon={item.icon}
						disabled={item.disabled}
						onclick={() => {
							item.onclick?.()
							options.onClose?.()
						}}
					>
						{item.label}
					</MenuItem>
				{/if}
			{/each}
		</Menu>
	</div>
</div>
