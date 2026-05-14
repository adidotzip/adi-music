import type { TrackData } from '$lib/library/get/value'
import { UNKNOWN_ITEM } from '$lib/library/types'
import { cacheLibraryValue } from '$lib/library/get/value'

const BASE_URL = 'https://jiosaavn-apix.arcadopredator.workers.dev/api'

export interface JioSaavnImage {
	quality: string
	url: string
}

export interface JioSaavnArtist {
	id: string
	name: string
	role?: string
	image: JioSaavnImage[]
	type: string
	url: string
}

export interface JioSaavnAlbum {
	id: string
	name: string
	url: string
	image?: JioSaavnImage[]
    artists?: { primary: JioSaavnArtist[] }
    year?: string
}

export interface JioSaavnPlaylist {
    id: string
    name: string
    url: string
    image: JioSaavnImage[]
    songCount?: number
    firstname?: string
}

export interface JioSaavnSong {
	id: string
	name: string
	type: string
	year: string
	releaseDate: string | null
	duration: number
	label: string
	explicitContent: boolean
	playCount: number
	language: string
	hasLyrics: boolean
	lyricsId: string | null
	url: string
	copyright: string
	album: JioSaavnAlbum
	artists: {
		primary: JioSaavnArtist[]
		featured: JioSaavnArtist[]
		all: JioSaavnArtist[]
	}
	image: JioSaavnImage[]
	downloadUrl: { quality: string; url: string }[]
}

export interface JioSaavnSearchResponse<T> {
	success: boolean
	data: {
		total: number
		start: number
		results: T[]
	}
}

export interface JioSaavnGlobalSearchResponse {
	success: boolean
	data: {
		songs: { results: JioSaavnSong[] }
		albums: { results: JioSaavnAlbum[] }
		artists: { results: JioSaavnArtist[] }
		playlists: { results: JioSaavnPlaylist[] }
	}
}

// Online tracks use negative IDs
// Simple hash function to generate a stable negative integer from string ID
const hashStringToIndex = (str: string): number => {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash |= 0 // Convert to 32bit integer
	}
	return -Math.abs(hash)
}

export const mapJioSaavnSongToTrackData = (song: JioSaavnSong): TrackData => {
	const id = hashStringToIndex(song.id)
	const data: TrackData = {
		id,
		uuid: `online-${song.id}`,
		name: song.name,
		album: song.album.name || UNKNOWN_ITEM,
		artists: song.artists.primary.map(a => a.name),
		year: song.year || UNKNOWN_ITEM,
		duration: song.duration,
		genre: [],
		trackNo: 0,
		trackOf: 0,
		discNo: 0,
		discOf: 0,
		language: song.language,
		fileName: '',
		directory: -1, // Online
		scannedAt: Date.now(),
		file: (song.downloadUrl[song.downloadUrl.length - 1]?.url || '') as any,
		type: 'track',
		favorite: false,
		image: {
			optimized: true,
			small: (song.image[0]?.url || '') as any,
			full: (song.image[song.image.length - 1]?.url || '') as any,
		},
		source: 'jiosaavn',
	}
	cacheLibraryValue('tracks', id, data)
	return data
}

export class JioSaavnService {
	static async searchSongs(query: string, page = 0, limit = 20): Promise<JioSaavnSearchResponse<JioSaavnSong>> {
		const url = `${BASE_URL}/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
		const res = await fetch(url)
		return res.json()
	}

	static async searchAlbums(query: string, page = 0, limit = 20): Promise<JioSaavnSearchResponse<JioSaavnAlbum>> {
		const url = `${BASE_URL}/search/albums?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
		const res = await fetch(url)
		return res.json()
	}

	static async searchArtists(query: string, page = 0, limit = 20): Promise<JioSaavnSearchResponse<JioSaavnArtist>> {
		const url = `${BASE_URL}/search/artists?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
		const res = await fetch(url)
		return res.json()
	}

	static async searchPlaylists(query: string, page = 0, limit = 20): Promise<JioSaavnSearchResponse<JioSaavnPlaylist>> {
		const url = `${BASE_URL}/search/playlists?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
		const res = await fetch(url)
		return res.json()
	}

	static async searchAll(query: string): Promise<JioSaavnGlobalSearchResponse> {
		const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}`
		const res = await fetch(url)
		return res.json()
	}

	static async getSongDetails(id: string): Promise<JioSaavnSong[]> {
		const url = `${BASE_URL}/songs?id=${id}`
		const res = await fetch(url)
		const json = await res.json()
		return json.data
	}

	static async getAlbumDetails(id: string): Promise<any> {
		const url = `${BASE_URL}/albums?id=${id}`
		const res = await fetch(url)
		const json = await res.json()
		return json.data
	}

	static async getArtistDetails(id: string): Promise<any> {
		const url = `${BASE_URL}/artists?id=${id}`
		const res = await fetch(url)
		const json = await res.json()
		return json.data
	}

	static async getPlaylistDetails(id: string): Promise<any> {
		const url = `${BASE_URL}/playlists?id=${id}`
		const res = await fetch(url)
		const json = await res.json()
		return json.data
	}
}
