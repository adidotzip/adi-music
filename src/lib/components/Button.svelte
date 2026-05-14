<script lang="ts" module>
	import { Button as M3Button } from 'm3-svelte'
	import type { AllowedButtonElement, ButtonProps } from './Button.svelte'

	export type { AllowedButtonElement, ButtonProps }
</script>

<script lang="ts" generics="As extends AllowedButtonElement = 'button'">
	const {
		as = 'button' as As,
		kind = 'filled',
		disabled = false,
		href,
		type = 'button',
		children,
		ariaLabel,
		tooltip,
		onclick,
		onpointerdown,
		...restProps
	}: ButtonProps<As> = $props()

	const KIND_MAP = {
		filled: 'filled',
		toned: 'tonal',
		outlined: 'outlined',
		flat: 'text',
		blank: 'text',
	} as const

	const variant = KIND_MAP[kind]
</script>

<M3Button
	{variant}
	{disabled}
	{type}
	{href}
	{onclick}
	{onpointerdown}
	aria-label={ariaLabel}
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</M3Button>
