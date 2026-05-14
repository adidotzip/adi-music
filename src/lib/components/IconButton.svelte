<script lang="ts" module>
	import { Button as M3Button } from 'm3-svelte'
	import type { IconType } from './icon/Icon.svelte'
	import Icon from './icon/Icon.svelte'
	import type { AllowedButtonElement, ButtonProps } from './Button.svelte'

	interface IconButtonProps<As extends AllowedButtonElement> extends ButtonProps<As> {
		tooltip: string
		icon?: IconType
		children?: Snippet
	}
</script>

<script lang="ts" generics="As extends AllowedButtonElement = 'button'">
	const { icon, children, tooltip, ...rest }: IconButtonProps<As> = $props()

	const KIND_MAP = {
		filled: 'filled',
		toned: 'tonal',
		outlined: 'outlined',
		flat: 'text',
		blank: 'text',
	} as const

	const variant = KIND_MAP[rest.kind ?? 'blank']
</script>

<M3Button
	{variant}
	iconType="full"
	{...rest}
	title={tooltip}
>
	{#if children}
		{@render children()}
	{:else if icon}
		<Icon type={icon} />
	{/if}
</M3Button>
