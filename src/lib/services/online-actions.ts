import { snackbar } from '$lib/components/snackbar/snackbar'
import { dbImportTrack } from '$lib/library/scan-actions/scanner/import-track'
import type { TrackData } from '$lib/library/get/value'

export async function importOnlineTrack(track: TrackData): Promise<number> {
	const { getDatabase } = await import('$lib/db/database.ts')
	const db = await getDatabase()
	const existingTrack = await db.getFromIndex('tracks', 'uuid', track.uuid)

	if (existingTrack) {
		// If we are importing a track that has offline audio, update it
		if (track.offlineAudio) {
			const dbTrack = { ...existingTrack, offlineAudio: track.offlineAudio }
			return await dbImportTrack(dbTrack as any, existingTrack.id)
		}
		return existingTrack.id
	}

	const dbTrack = { ...track }
	delete (dbTrack as any).id
	delete (dbTrack as any).type
	delete (dbTrack as any).favorite

	const newId = await dbImportTrack(dbTrack as any, undefined)
	return newId
}

export async function downloadTrack(track: TrackData): Promise<void> {
	if (!track.url) return

	const snackbarId = `download-${track.uuid}`
	snackbar({
		id: snackbarId,
		message: `Downloading ${track.name}...`,
		duration: false,
	})

	try {
		const res = await fetch(track.url)
		const blob = await res.blob()

		const offlineTrack = {
			...track,
			offlineAudio: blob,
		}

		await importOnlineTrack(offlineTrack)

		snackbar({
			id: snackbarId,
			message: `Finished downloading ${track.name}`,
			duration: 3000,
		})
	} catch (error) {
		snackbar({
			id: snackbarId,
			message: `Failed to download ${track.name}`,
			duration: 3000,
		})
	}
}
