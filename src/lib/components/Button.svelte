<script module lang="ts">
	import { ripple } from '../attachments/ripple.ts'
	import { tooltip } from '../attachments/tooltip.ts'

	export type AllowedButtonElement = 'button' | 'a'
	// Added 'elevated' as it is a core M3 button style
	export type ButtonKind = 'filled' | 'toned' | 'outlined' | 'flat' | 'elevated' | 'blank'
	

	export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

	export type ButtonHref<As extends AllowedButtonElement> = As extends 'a' ? string : never

	export interface ButtonProps<As extends AllowedButtonElement> {
		as?: As
		kind?: ButtonKind
		size?: ButtonSize
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
	const {
		as = 'button' as As,
		kind = 'filled',
		size = 'md',
		disabled = false,
		// svelte-ignore state_referenced_locally possible false positive?
		href = (as === 'a' ? '' : undefined) as ButtonHref<As>,
		type = 'button',
		children,
		ariaLabel,
		tooltip: tooltipMessage,
		...restProps
	}: ButtonProps<As> = $props()

	const KIND_CLASS_MAP = {
		filled: 'filled-button',
		toned: 'tonal-button',
		outlined: 'outlined-button',
		flat: 'flat-button',
		elevated: 'elevated-button',
		blank: '',
	} as const

	const SIZE_CLASS_MAP = {
		sm: 'h-8 px-4 text-label-md',
		md: 'h-10 px-6 text-label-lg',
		lg: 'h-12 px-8 text-title-sm',
		xl: 'h-14 px-10 text-title-md',
	} as const
</script>

<svelte:element
	this={(disabled ? 'button' : as) as AllowedButtonElement}
	{@attach ripple({ stopPropagation: true })}
	{@attach tooltip(tooltipMessage)}
	{...restProps}
	{type}
	aria-label={ariaLabel}
	{href}
	disabled={disabled === true ? true : undefined}
	class={[
		'interactable',
		KIND_CLASS_MAP[kind],
		kind !== 'blank' && SIZE_CLASS_MAP[size],
		kind !== 'blank' &&
			'base-button flex items-center justify-center gap-2 rounded-full active:rounded-2xl active:scale-[0.96]',
		restProps.class,
	]}
>
	{#if children}
		{@render children()}
	{/if}
</svelte:element>

<style lang="postcss">
	@reference '../../app.css';

	.base-button {

		transition: 
			background-color 0.2s ease, 
			color 0.2s ease,
			border-color 0.2s ease,
			border-radius 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2), 
			transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2);    
	}

	.filled-button {
		background: var(--color-primary);
		color: var(--color-onPrimary);
	}

	.tonal-button {
		background: var(--color-secondaryContainer);
		color: var(--color-onSecondaryContainer);
	}

	.outlined-button {
		color: var(--color-primary);
		border: 1px solid var(--color-outline);
	}

	.flat-button {
		color: var(--color-primary);
	}


	.elevated-button {
		background: var(--color-surfaceContainerLow);
		color: var(--color-primary);
		box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15);
	}

	.base-button[disabled] {
		cursor: default;
		background-color: --alpha(var(--color-onSurface) / 12%);
		border-color: --alpha(var(--color-onSurface) / 38%);
		color: --alpha(var(--color-onSurface) / 38%);
		pointer-events: none;
		/* Reset shape morphing and scale on disabled elements */
		transform: none; 
		border-radius: 9999px; 
	}
</style>
