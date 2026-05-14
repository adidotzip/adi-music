<script module lang="ts">
	import { tooltip } from '../attachments/tooltip.ts'

	export type AllowedButtonElement = 'button' | 'a'
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

	const M3_KIND_CLASS_MAP = {
		filled: 'm3-filled',
		toned: 'm3-tonal',
		outlined: 'm3-outlined',
		flat: 'm3-text',
		elevated: 'm3-elevated',
		blank: 'm3-blank',
	} as const

	const M3_SIZE_CLASS_MAP = {
		sm: 'm3-size-xs',
		md: 'm3-size-s',
		lg: 'm3-size-m',
		xl: 'm3-size-l',
	} as const
</script>

<svelte:element
	this={(disabled ? 'button' : as) as AllowedButtonElement}
	{@attach tooltip(tooltipMessage)}
	{...restProps}
	{type}
	aria-label={ariaLabel}
	{href}
	disabled={disabled === true ? true : undefined}
	class={[
		'interactable',
		'm3-button m3-layer',
		M3_KIND_CLASS_MAP[kind],
		kind !== 'blank' && M3_SIZE_CLASS_MAP[size],
		restProps.class,
	]}
>
	{#if children}
		{@render children()}
	{/if}
</svelte:element>

<style lang="postcss">
	@reference '../../app.css';

	.m3-button {
		--m3-elevation-1:
			0 1px 2px --alpha(var(--color-shadow) / 30%), 0 1px 3px 1px --alpha(var(--color-shadow) / 15%);
		--m3-elevation-2:
			0 1px 2px --alpha(var(--color-shadow) / 30%), 0 2px 6px 2px --alpha(var(--color-shadow) / 15%);
		--m3-button-shape: var(--m3-button-rest-shape);
		--m3-button-pressed-shape: --spacing(2);

		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		gap: --spacing(2);
		border: 0;
		border-radius: var(--m3-button-shape);
		background: transparent;
		color: inherit;
		cursor: pointer;
		text-decoration: none;
		user-select: none;
		outline-offset: --spacing(0.5);
		transition:
			border-radius 0.2s cubic-bezier(0.2, 0, 0, 1),
			box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1),
			background-color 0.2s cubic-bezier(0.2, 0, 0, 1),
			color 0.2s cubic-bezier(0.2, 0, 0, 1),
			outline-color 0.2s cubic-bezier(0.2, 0, 0, 1);
	}

	.m3-button::before {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: currentcolor;
		content: '';
		opacity: 0;
		transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
		pointer-events: none;
	}

	.m3-button:hover::before {
		opacity: 0.08;
	}

	.m3-button:active {
		border-radius: var(--m3-button-pressed-shape);
	}

	.m3-button:active::before {
		opacity: 0.12;
	}

	.m3-button:disabled {
		cursor: default;
		pointer-events: none;
	}

	.m3-button:disabled::before {
		opacity: 0;
	}

	.m3-button > :global(*) {
		flex-shrink: 0;
	}

	.m3-size-xs {
		--m3-button-rest-shape: --spacing(4);
		--m3-button-pressed-shape: --spacing(2);

		min-width: --spacing(16);
		height: --spacing(8);
		padding-inline: --spacing(3);
		font: inherit;
		@apply text-label-lg;
	}

	.m3-size-s {
		--m3-button-rest-shape: --spacing(5);
		--m3-button-pressed-shape: --spacing(2);

		min-width: --spacing(16);
		height: --spacing(10);
		padding-inline: --spacing(4);
		font: inherit;
		@apply text-label-lg;
	}

	.m3-size-m {
		--m3-button-rest-shape: --spacing(7);
		--m3-button-pressed-shape: --spacing(3);

		min-width: --spacing(20);
		height: --spacing(14);
		padding-inline: --spacing(6);
		font: inherit;
		@apply text-title-md;
	}

	.m3-size-l {
		--m3-button-rest-shape: --spacing(12);
		--m3-button-pressed-shape: --spacing(4);

		min-width: --spacing(24);
		height: --spacing(24);
		padding-inline: --spacing(12);
		font: inherit;
		@apply text-headline-sm;
	}

	.m3-filled:not(:disabled) {
		background: var(--color-primary);
		color: var(--color-onPrimary);
	}

	.m3-tonal:not(:disabled) {
		background: var(--color-secondaryContainer);
		color: var(--color-onSecondaryContainer);
	}

	.m3-outlined {
		outline: 1px solid var(--color-outlineVariant);
		outline-offset: -1px;
	}

	.m3-outlined:not(:disabled) {
		color: var(--color-onSurfaceVariant);
	}

	.m3-text:not(:disabled) {
		color: var(--color-primary);
	}

	.m3-elevated:not(:disabled) {
		background: var(--color-surfaceContainerLow);
		color: var(--color-primary);
		box-shadow: var(--m3-elevation-1);
	}

	.m3-elevated:hover:not(:disabled),
	.m3-filled:hover:not(:disabled),
	.m3-tonal:hover:not(:disabled) {
		box-shadow: var(--m3-elevation-2);
	}

	.m3-filled:disabled,
	.m3-tonal:disabled,
	.m3-elevated:disabled {
		background: --alpha(var(--color-onSurface) / 12%);
		color: --alpha(var(--color-onSurface) / 38%);
	}

	.m3-outlined:disabled {
		outline-color: --alpha(var(--color-onSurface) / 12%);
		color: --alpha(var(--color-onSurface) / 38%);
	}

	.m3-text:disabled {
		color: --alpha(var(--color-onSurface) / 38%);
	}

	.m3-blank {
		--m3-button-rest-shape: 9999px;
		--m3-button-pressed-shape: --spacing(3);
	}
</style>
