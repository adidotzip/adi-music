import { snackbar } from '$lib/components/snackbar/snackbar.ts'
import type { FileEntity } from '$lib/helpers/file-system.ts'
import { dbImportTrack } from '$lib/library/scan-actions/scanner/import-track.ts'
import { getArtworkRelatedData } from '$lib/library/scan-actions/scanner/parse/format-artwork.ts'
import { LEGACY_NO_NATIVE_DIRECTORY, UNKNOWN_ITEM, type UnknownTrack } from '$lib/library/types.ts'
import { m } from '$paraglide/messages'
import { getSongDetails } from './api.ts'

export async function downloadAndAddTrack(songId: string): Promise<number | undefined> {
	try {
		snackbar({
			id: `downloading-${songId}`,
			message: m.downloadingSong(),
			duration: false,
			controls: false,
		})
		const details = await getSongDetails(songId)

		// Download the media file
		const mediaUrl =
			details.media_urls['320_KBPS'] ||
			details.media_urls['160_KBPS'] ||
			details.media_urls['96_KBPS'] ||
			details.media_url
		const mediaResponse = await fetch(mediaUrl)
		if (!mediaResponse.ok) throw new Error('Failed to download media')
		const mediaBlob = await mediaResponse.blob()
		const fileName = `${details.song} - ${details.primary_artists}.mp4`
		const file = new File([mediaBlob], fileName, { type: mediaBlob.type })

		// Download artwork
		let imageBlob: Blob | undefined
		if (details.image || details.images?.['500x500']) {
			const imageUrl = details.images?.['500x500'] || details.image
			const imageResponse = await fetch(imageUrl)
			if (imageResponse.ok) {
				imageBlob = await imageResponse.blob()
			}
		}

		let artworkData = {}
		if (imageBlob) {
			artworkData = (await getArtworkRelatedData(imageBlob)) || {}
		}

		const artists = details.primary_artists
			? details.primary_artists.split(',').map((a) => a.trim())
			: [UNKNOWN_ITEM]

		const trackData: UnknownTrack = {
			name: details.song,
			album: details.album || UNKNOWN_ITEM,
			artists,
			year: details.year ? details.year.toString() : UNKNOWN_ITEM,
			duration: parseDuration(details.duration),
			genre: [],
			trackNo: 1,
			trackOf: 1,
			discNo: 1,
			discOf: 1,
			language: details.language,
			file: file as unknown as FileEntity,
			fileName,
			directory: LEGACY_NO_NATIVE_DIRECTORY,
			scannedAt: Date.now(),
			uuid: crypto.randomUUID(),
			...artworkData,
		}

		const trackId = await dbImportTrack(trackData, undefined)
		snackbar.dismiss(`downloading-${songId}`)
		snackbar({ id: `downloaded-${songId}`, message: m.downloadComplete(), duration: 3000 })
		return trackId
	} catch (e) {
		snackbar.dismiss(`downloading-${songId}`)
		snackbar({ id: `error-${songId}`, message: m.downloadError(), duration: 3000 })
		console.error('Download failed:', e)
		return undefined
	}
}

function parseDuration(durationStr: string | number): number {
	if (typeof durationStr === 'number') return durationStr
	if (!durationStr) return 0
	// Convert "2:24" to seconds
	const parts = durationStr.split(':')
	if (parts.length === 2) {
		return Number.parseInt(parts[0] || '0', 10) * 60 + Number.parseInt(parts[1] || '0', 10)
	}
	return Number.parseInt(durationStr, 10) || 0
}
