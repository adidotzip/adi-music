<script lang="ts" module>
	import type { ComponentProps, Snippet } from 'svelte'

	export type AllowedButtonElement = 'button' | 'a'
	export type ButtonKind = 'filled' | 'toned' | 'outlined' | 'flat' | 'blank'

	export type ButtonHref<As extends AllowedButtonElement> = As extends 'a' ? string : never

	export interface ButtonProps<As extends AllowedButtonElement> {
		as?: As
		kind?: ButtonKind
		type?: 'button' | 'submit' | 'reset'
		target?: string
		disabled?: boolean
		href?: ButtonHref<As>
		class?: ClassValue
		tabindex?: number
		ariaLabel?: string
		tooltip?: string
		children?: Snippet
		onclick?: (event: MouseEvent) => void
		onpointerdown?: (event: PointerEvent) => void
	}
</script>

<script lang="ts" generics="As extends AllowedButtonElement = 'button'">
	import { Button as M3Button } from 'm3-svelte'
	const {
		as = 'button' as As,
		kind = 'filled',
		disabled = false,
		href = (as === 'a' ? '' : undefined) as ButtonHref<As>,
		type = 'button',
		children,
		ariaLabel,
		tooltip: tooltipMessage,
		class: className,
		onclick,
		onpointerdown,
		...restProps
	}: ButtonProps<As> = $props()

	const KIND_MAP: Record<ButtonKind, ComponentProps<typeof M3Button>['variant']> = {
		filled: 'filled',
		toned: 'tonal',
		outlined: 'outlined',
		flat: 'text',
		blank: 'text', // Fallback for blank
	}
</script>

{#if kind === 'blank'}
	<svelte:element
		this={as}
		{href}
		{type}
		disabled={disabled || undefined}
		class={className}
		aria-label={ariaLabel}
		{onclick}
		{onpointerdown}
		{...restProps}
	>
		{@render children?.()}
	</svelte:element>
{:else}
	<M3Button
		variant={KIND_MAP[kind]}
		{disabled}
		{href}
		{onclick}
		aria-label={ariaLabel}
		class={className}
	>
		{@render children?.()}
	</M3Button>
{/if}
