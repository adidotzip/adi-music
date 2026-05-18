import type { Album, Artist, Playlist, Track } from '$lib/library/types'

const API_BASE_URL = 'https://jiosaavn-apix.arcadopredator.workers.dev/api'

export const generateStableId = (id: string): number => {
	let hash = 0
	for (let i = 0; i < id.length; i++) {
		const char = id.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash |= 0 // Convert to 32bit integer
	}
	// Return a stable negative ID
	return -Math.abs(hash)
}

export interface JioSaavnSong {
	id: string
	name: string
	type: string
	year: string
	duration: number
	language: string
	url: string
	image: { quality: string; url: string }[]
	album: { id: string; name: string; url: string }
	artists: {
		primary: { id: string; name: string; role: string; type: string; image: any[] }[]
		featured: { id: string; name: string; role: string; type: string; image: any[] }[]
		all: { id: string; name: string; role: string; type: string; image: any[] }[]
	}
	downloadUrl: { quality: string; url: string }[]
}

export interface JioSaavnAlbum {
	id: string
	name: string
	type: string
	year: string
	url: string
	image: { quality: string; url: string }[]
	artists: {
		primary: { id: string; name: string; role: string; type: string; image: any[] }[]
	}
}

export interface JioSaavnArtist {
	id: string
	name: string
	type: string
	url: string
	image: { quality: string; url: string }[]
}

export interface JioSaavnPlaylist {
	id: string
	name: string
	type: string
	url: string
	image: { quality: string; url: string }[]
}

const mapJioSaavnSongToTrack = (song: JioSaavnSong): Track => {
	const id = generateStableId(song.id)
	return {
		id,
		uuid: song.id,
		name: song.name,
		album: song.album.name,
		artists: song.artists.primary.map((a) => a.name),
		year: song.year,
		duration: song.duration,
		genre: [],
		trackNo: 0,
		trackOf: 0,
		discNo: 0,
		discOf: 0,
		language: song.language,
		scannedAt: Date.now(),
		url: song.downloadUrl[song.downloadUrl.length - 1].url,
		source: 'jiosaavn'
	} as Track
}

const mapJioSaavnAlbumToAlbum = (album: JioSaavnAlbum): Album => {
	return {
		id: generateStableId(album.id),
		uuid: album.id,
		name: album.name,
		artists: album.artists.primary.map((a) => a.name),
		year: album.year,
		source: 'jiosaavn'
	} as any
}

const mapJioSaavnArtistToArtist = (artist: JioSaavnArtist): Artist => {
	return {
		id: generateStableId(artist.id),
		uuid: artist.id,
		name: artist.name,
		source: 'jiosaavn'
	} as any
}

const mapJioSaavnPlaylistToPlaylist = (playlist: JioSaavnPlaylist): Playlist => {
	return {
		id: generateStableId(playlist.id),
		uuid: playlist.id,
		name: playlist.name,
		description: '',
		createdAt: Date.now(),
		source: 'jiosaavn'
	} as any
}

export const searchSongs = async (query: string): Promise<Track[]> => {
	const response = await fetch(`${API_BASE_URL}/search/songs?query=${encodeURIComponent(query)}`)
	const json = await response.json()
	if (json.success && json.data.results) {
		return json.data.results.map(mapJioSaavnSongToTrack)
	}
	return []
}

export const searchAlbums = async (query: string): Promise<Album[]> => {
	const response = await fetch(`${API_BASE_URL}/search/albums?query=${encodeURIComponent(query)}`)
	const json = await response.json()
	if (json.success && json.data.results) {
		return json.data.results.map(mapJioSaavnAlbumToAlbum)
	}
	return []
}

export const searchArtists = async (query: string): Promise<Artist[]> => {
	const response = await fetch(`${API_BASE_URL}/search/artists?query=${encodeURIComponent(query)}`)
	const json = await response.json()
	if (json.success && json.data.results) {
		return json.data.results.map(mapJioSaavnArtistToArtist)
	}
	return []
}

export const searchPlaylists = async (query: string): Promise<Playlist[]> => {
	const response = await fetch(`${API_BASE_URL}/search/playlists?query=${encodeURIComponent(query)}`)
	const json = await response.json()
	if (json.success && json.data.results) {
		return json.data.results.map(mapJioSaavnPlaylistToPlaylist)
	}
	return []
}

export const getSongDetails = async (id: string): Promise<Track | undefined> => {
	const response = await fetch(`${API_BASE_URL}/songs/${id}`)
	const json = await response.json()
	if (json.success && json.data && json.data[0]) {
		return mapJioSaavnSongToTrack(json.data[0])
	}
	return undefined
}
