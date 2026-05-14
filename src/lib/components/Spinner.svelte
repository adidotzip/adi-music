<script lang="ts">
	interface Props {
		class?: ClassValue
		size?: number
		container?: boolean
		ariaLabel?: string
	}

	const { class: className, size = 40, container = false, ariaLabel }: Props = $props()
</script>

<svg
	class={['m3-loading-indicator', container && 'container', className]}
	width={size}
	height={size}
	viewBox="0 0 48 48"
	role="progressbar"
	aria-label={ariaLabel}
	aria-valuemin="0"
	aria-valuemax="100"
>
	<g class="m3-loading-indicator-shapes">
		<circle class="shape shape-1" cx="24" cy="8" r="5.5" />
		<circle class="shape shape-2" cx="40" cy="24" r="5.5" />
		<circle class="shape shape-3" cx="24" cy="40" r="5.5" />
		<circle class="shape shape-4" cx="8" cy="24" r="5.5" />
	</g>
</svg>

<style lang="postcss">
	@reference '../../app.css';
	.m3-loading-indicator {
		color: var(--color-primary);
		overflow: visible;
	}

	.container {
		padding: --spacing(1);
		border-radius: 9999px;
		background: var(--color-primaryContainer);
		color: var(--color-onPrimaryContainer);
	}

	.m3-loading-indicator-shapes {
		transform-origin: center;
		animation: m3-loading-indicator-rotate 1.6s cubic-bezier(0.2, 0, 0, 1) infinite;
	}

	.shape {
		fill: currentcolor;
		transform-box: fill-box;
		transform-origin: center;
		animation: m3-loading-indicator-pulse 1.6s cubic-bezier(0.2, 0, 0, 1) infinite;
	}

	.shape-2 {
		animation-delay: 0.1s;
	}

	.shape-3 {
		animation-delay: 0.2s;
	}

	.shape-4 {
		animation-delay: 0.3s;
	}

	@keyframes m3-loading-indicator-rotate {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes m3-loading-indicator-pulse {
		0%,
		100% {
			transform: scale(0.72);
			opacity: 0.62;
		}

		50% {
			transform: scale(1.18);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.m3-loading-indicator-shapes,
		.shape {
			animation-duration: 3.2s;
		}
	}
</style>
