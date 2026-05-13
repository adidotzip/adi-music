export const JIOSAAVN_API_URL = 'https://saavn.dev/api'

export interface JioSaavnSong {
	id: string
	name: string
	type: string
	year: string | null
	releaseDate: string | null
	duration: number | null
	label: string | null
	primaryArtists: string
	primaryArtistsId: string
	featuredArtists: string
	featuredArtistsId: string
	explicitContent: string
	playCount: string | null
	language: string
	hasLyrics: string
	url: string
	copyright: string | null
	image: { quality: string; link: string }[]
	downloadUrl: { quality: string; link: string }[]
}

export interface JioSaavnAlbum {
	id: string
	name: string
	year: string
	releaseDate: string
	songCount: string
	url: string
	primaryArtistsId: string
	primaryArtists: string
	featuredArtists: string
	featuredArtistsId: string
	artists: any[]
	image: { quality: string; link: string }[]
	songs?: JioSaavnSong[]
}

export interface JioSaavnPlaylist {
	id: string
	userId: string
	name: string
	songCount: string
	username: string
	firstname: string
	lastname: string
	followerCount: string
	lastUpdated: string
	url: string
	image: { quality: string; link: string }[]
	songs?: JioSaavnSong[]
}

export interface JioSaavnArtist {
	id: string
	name: string
	url: string
	image: { quality: string; link: string }[]
	followerCount: string
	isVerified: boolean
	dominantLanguage: string
	dominantType: string
	bio: any[]
	dob: string
	fb: string
	twitter: string
	wiki: string
	availableLanguages: string[]
	fanCount: string
	topSongs?: JioSaavnSong[]
	topAlbums?: JioSaavnAlbum[]
}

export interface JioSaavnSearchResults {
	songs: { results: JioSaavnSong[] }
	albums: { results: JioSaavnAlbum[] }
	artists: { results: JioSaavnArtist[] }
	playlists: { results: JioSaavnPlaylist[] }
}

export const jioSaavnService = {
	async searchAll(query: string): Promise<JioSaavnSearchResults> {
		const res = await fetch(`${JIOSAAVN_API_URL}/search?query=${encodeURIComponent(query)}`)
		const data = await res.json()
		return data.data
	},

	async searchSongs(query: string, page = 0, limit = 20): Promise<JioSaavnSong[]> {
		const res = await fetch(
			`${JIOSAAVN_API_URL}/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
		)
		const data = await res.json()
		return data.data.results
	},

	async getSongDetails(id: string): Promise<JioSaavnSong> {
		const res = await fetch(`${JIOSAAVN_API_URL}/songs/${id}`)
		const data = await res.json()
		return data.data[0]
	},

	async getAlbumDetails(id: string): Promise<JioSaavnAlbum> {
		const res = await fetch(`${JIOSAAVN_API_URL}/albums?id=${id}`)
		const data = await res.json()
		return data.data
	},

	async getPlaylistDetails(id: string): Promise<JioSaavnPlaylist> {
		const res = await fetch(`${JIOSAAVN_API_URL}/playlists?id=${id}`)
		const data = await res.json()
		return data.data
	},

	async getArtistDetails(id: string): Promise<JioSaavnArtist> {
		const res = await fetch(`${JIOSAAVN_API_URL}/artists?id=${id}`)
		const data = await res.json()
		return data.data
	},

	async getArtistSongs(id: string, page = 0): Promise<JioSaavnSong[]> {
		const res = await fetch(`${JIOSAAVN_API_URL}/artists/${id}/songs?page=${page}`)
		const data = await res.json()
		return data.data.results
	},

	async getArtistAlbums(id: string, page = 0): Promise<JioSaavnAlbum[]> {
		const res = await fetch(`${JIOSAAVN_API_URL}/artists/${id}/albums?page=${page}`)
		const data = await res.json()
		return data.data.results
	},
}
