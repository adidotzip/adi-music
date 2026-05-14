<script lang="ts">
	import { TextField as M3TextField } from 'm3-svelte'

	interface TextFieldProps {
		value?: string
		name: string
		type?: 'text' | 'password' | 'number' | 'email' | 'url' | 'tel' | 'search'
		label?: string
		placeholder?: string
		minLength?: number
		maxLength?: number
		required?: boolean
		class?: ClassValue
	}

	let {
		name,
		value = $bindable(''),
		type = 'text',
		label,
		placeholder,
		minLength,
		maxLength,
		required,
		class: className,
	}: TextFieldProps = $props()

	const validationIssue = $derived.by(() => {
		const valueLength = (value ?? '').length
		if (required && valueLength < 1) {
			return m.validationRequired()
		}

		if (minLength !== undefined && valueLength < minLength) {
			return m.validationMinLength({ min: minLength })
		}

		if (maxLength !== undefined && valueLength > maxLength) {
			return m.validationMaxLength({ max: maxLength })
		}

		return null
	})
</script>

<div class={[className, 'text-field-container']}>
	<M3TextField
		{label}
		{placeholder}
		{required}
		{type}
		{name}
		error={!!validationIssue}
		bind:value
	/>
	{#if validationIssue}
		<span class="m3-font-body-small text-error px-4 mt-1">{validationIssue}</span>
	{/if}
</div>
