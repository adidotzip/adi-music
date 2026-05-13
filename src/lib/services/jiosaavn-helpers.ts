import type { JioSaavnSong } from '$lib/services/jiosaavn'
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

function decodeHtml(html: string) {
	const txt = document.createElement('textarea')
	txt.innerHTML = html
	return txt.value
}

export function mapJioSaavnSongToTrack(song: JioSaavnSong): TrackData {
	const image = song.images['500x500'] || song.image
	const stableId = -Math.abs(hashCode(`jiosaavn-${song.id}`))
	return {
		id: stableId,
		uuid: `jiosaavn-${song.id}`,
		name: decodeHtml(song.title),
		album: decodeHtml(song.album),
		artists: song.more_info.singers.split(',').map((a) => decodeHtml(a.trim())),
		year: '',
		duration: 0,
		genre: [],
		trackNo: 0,
		trackOf: 0,
		discNo: 0,
		discOf: 0,
		language: song.more_info.language,
		url: song.more_info.vlink,
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
