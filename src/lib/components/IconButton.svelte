<script lang="ts" module>
	import type { AllowedButtonElement, ButtonProps } from './Button.svelte'
	import Icon, { type IconType } from './icon/Icon.svelte'

	interface IconButtonProps<As extends AllowedButtonElement> extends ButtonProps<As> {
		tooltip: string
		icon?: IconType
		children?: Snippet
	}
</script>

<script lang="ts" generics="As extends AllowedButtonElement = 'button'">
	import { Button as M3Button } from 'm3-svelte'
	const { icon, children, tooltip, ...rest }: IconButtonProps<As> = $props()
</script>

<M3Button
	{...rest}
	variant="text"
	iconType="full"
	class={rest.class}
	aria-label={tooltip}
>
	{#if children}
		{@render children()}
	{:else if icon}
		<Icon type={icon} />
	{/if}
</M3Button>
