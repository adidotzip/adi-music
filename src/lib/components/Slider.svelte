<script lang="ts">
	import { Slider as M3Slider } from 'm3-svelte'

	interface Props {
		min?: number
		max?: number
		step?: number | 'any'
		value: number
		disabled?: boolean
		vertical?: boolean
		onSeekStart?: () => void
		onSeekEnd?: () => void
	}

	let {
		min = 0,
		max = 100,
		step = 'any',
		value = $bindable(0),
		disabled,
		vertical = false,
		onSeekStart,
		onSeekEnd,
	}: Props = $props()
</script>

<div class={['slider-wrapper', vertical ? 'h-full' : 'w-full']}>
	<M3Slider
		{min}
		{max}
		{step}
		{disabled}
		{vertical}
		bind:value
		onpointerdown={onSeekStart}
		onpointerup={onSeekEnd}
	/>
</div>

<style>
	.slider-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
