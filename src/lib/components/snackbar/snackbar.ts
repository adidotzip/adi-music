import { snackbar as m3Snackbar } from 'm3-svelte'

export const snackbar = (
	message: string,
	actionLabel?: string,
	onAction?: () => void,
) => {
	m3Snackbar(message, actionLabel, onAction)
}
