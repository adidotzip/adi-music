import { jioSaavnService, type JioSaavnSong } from '$lib/services/jiosaavn'
import type { TrackData } from '$lib/library/get/value'

function hashCode(str: string) {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash |= 0 // Convert to 32bit integer
	}
	return hash
}

export function mapJioSaavnSongToTrack(song: JioSaavnSong): TrackData {
	const image = song.image[song.image.length - 1]?.link || ''
	const stableId = -Math.abs(hashCode(`jiosaavn-${song.id}`))
	return {
		id: stableId,
		uuid: `jiosaavn-${song.id}`,
		name: song.name,
		album: song.album || 'Unknown Album',
		artists: song.primaryArtists.split(',').map((a) => a.trim()),
		year: song.year || '',
		duration: song.duration || 0,
		genre: [],
		trackNo: 0,
		trackOf: 0,
		discNo: 0,
		discOf: 0,
		language: song.language,
		url: song.downloadUrl[song.downloadUrl.length - 1]?.link,
		source: 'jiosaavn',
		image: {
			optimized: true,
			small: image,
			full: image,
		},
		type: 'track',
		favorite: false,
		scannedAt: Date.now(),
	}
}
