<script lang="ts">
	import { Slider as M3Slider } from 'm3-svelte'

	interface Props {
		value: number
		min?: number
		max?: number
		step?: number | 'any'
		disabled?: boolean
		class?: string
		onchange?: (value: number) => void
	}

	let {
		value = $bindable(),
		min = 0,
		max = 100,
		step = 'any',
		disabled,
		class: className,
		onchange,
	}: Props = $props()
</script>

<M3Slider
	bind:value
	{min}
	{max}
	step={step === 'any' ? 'any' : step}
	{disabled}
	class={className}
	{onchange}
/>
