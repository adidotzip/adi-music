import { formatArtists, formatNameOrUnknown } from '$lib/helpers/utils/text.ts'
import type { TrackData } from '$lib/library/get/value.ts'

const LYRICSPLUS_LYRICS_ENDPOINT = 'https://lyricsplus.prjktla.workers.dev/v2/lyrics/get'
const LRCLIB_GET_ENDPOINT = 'https://lrclib.net/api/get'
const LRCLIB_SEARCH_ENDPOINT = 'https://lrclib.net/api/search'
const LRCLIB_DURATION_TOLERANCE_SECONDS = 4

export interface SyncedLyricsWord {
	string: string
	time: number
}

export interface SyncedLyricsLine {
	startTime: number
	endTime: number
	words: SyncedLyricsWord[]
}

export type SyncedLyricsSource = 'lyricsplus' | 'lrclib'

export type SyncedLyricsResult =
	| {
			status: 'found'
			source: SyncedLyricsSource
			lines: SyncedLyricsLine[]
	  }
	| { status: 'not-found' | 'instrumental' | 'error' }

interface UnknownRecord {
	[key: string]: unknown
}

interface LrclibLyricsResponse {
	trackName?: string
	artistName?: string
	albumName?: string
	duration?: number
	instrumental?: boolean
	syncedLyrics?: string | null
}

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value)

/**
 * Normalization helpers for remote lyrics providers
 */
const normalizeWord = (value: unknown): SyncedLyricsWord | undefined => {
	if (!isRecord(value) || typeof value.string !== 'string' || !isFiniteNumber(value.time)) {
		return
	}
	return { string: value.string, time: value.time }
}

const normalizeLine = (value: unknown): SyncedLyricsLine | undefined => {
	if (!(isRecord(value) && isFiniteNumber(value.startTime) && isFiniteNumber(value.endTime))) {
		return
	}
	if (!Array.isArray(value.words)) {
		return
	}

	const words = value.words.map(normalizeWord).filter((word): word is SyncedLyricsWord => !!word)
	if (words.length === 0) {
		return
	}

	return {
		startTime: value.startTime,
		endTime: value.endTime,
		words,
	}
}

/**
 * LRCLIB Parsing Logic
 */
const timestampPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
const whitespacePattern = /\s+/

const parseTimestamp = (minutes: string, seconds: string, fraction: string | undefined): number => {
	// LRCLIB often provides 2 digits (.75). We pad it to 3 to treat as milliseconds (.750).
	const msString = (fraction ?? '0').padEnd(3, '0').slice(0, 3)
	return (
		Number.parseInt(minutes, 10) * 60_000 +
		Number.parseInt(seconds, 10) * 1000 +
		Number.parseInt(msString, 10)
	)
}

export const parseLrc = (lyrics: string, durationMs: number): SyncedLyricsLine[] => {
	const timestampedLines = lyrics
		.split('\n')
		.flatMap((rawLine) => {
			const matches = [...rawLine.matchAll(timestampPattern)]
			if (matches.length === 0) {
				return []
			}

			const text = rawLine.replace(timestampPattern, '').trim()
			if (!text) {
				return []
			}

			return matches.map((match) => ({
				startTime: parseTimestamp(match[1], match[2], match[3] as string | undefined),
				text,
			}))
		})
		.sort((a, b) => a.startTime - b.startTime)

	return timestampedLines.map((line, index) => {
		const nextLine = timestampedLines[index + 1]
		// End time is the start of the next line, or duration/offset if last line
		const endTime = nextLine ? nextLine.startTime : Math.max(durationMs, line.startTime + 2000)

		const wordsList = line.text.split(whitespacePattern).filter(Boolean)
		const totalDuration = endTime - line.startTime
		const wordDuration = totalDuration / (wordsList.length || 1)

		return {
			startTime: line.startTime,
			endTime,
			words: wordsList.map((word, i) => ({
				string: word + (i === wordsList.length - 1 ? '' : ' '),
				time: Math.round(line.startTime + i * wordDuration),
			})),
		}
	})
}

const normalizeSearchText = (value: string): string =>
	value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/&/g, ' and ')
		.replace(/\b(feat|ft|featuring)\.?\b/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()

const getDurationSeconds = (track: TrackData): number => Math.round(track.duration)

const isDurationClose = (actualDuration: number | undefined, expectedDuration: number): boolean =>
	!(actualDuration && expectedDuration) ||
	Math.abs(Math.round(actualDuration) - expectedDuration) <= LRCLIB_DURATION_TOLERANCE_SECONDS

const getLrclibResponse = (value: unknown): LrclibLyricsResponse | undefined => {
	if (!isRecord(value)) {
		return
	}

	return {
		trackName: typeof value.trackName === 'string' ? value.trackName : undefined,
		artistName: typeof value.artistName === 'string' ? value.artistName : undefined,
		albumName: typeof value.albumName === 'string' ? value.albumName : undefined,
		duration: isFiniteNumber(value.duration) ? value.duration : undefined,
		instrumental: typeof value.instrumental === 'boolean' ? value.instrumental : undefined,
		syncedLyrics: typeof value.syncedLyrics === 'string' ? value.syncedLyrics : null,
	}
}

const getLrclibFoundResult = (
	data: LrclibLyricsResponse,
	durationSeconds: number,
): SyncedLyricsResult => {
	if (data.instrumental) {
		return { status: 'instrumental' }
	}
	if (!data.syncedLyrics) {
		return { status: 'not-found' }
	}

	const lines = parseLrc(data.syncedLyrics, durationSeconds * 1000)
	return lines.length > 0 ? { status: 'found', source: 'lrclib', lines } : { status: 'not-found' }
}

const scoreLrclibSearchResult = (
	data: LrclibLyricsResponse,
	track: TrackData,
	durationSeconds: number,
): number => {
	if (!(data.syncedLyrics && isDurationClose(data.duration, durationSeconds))) {
		return Number.NEGATIVE_INFINITY
	}

	const expectedTrackName = normalizeSearchText(track.name)
	const expectedArtistName = normalizeSearchText(formatArtists(track.artists))
	const expectedAlbumName = normalizeSearchText(formatNameOrUnknown(track.album, ''))
	const resultTrackName = normalizeSearchText(data.trackName ?? '')
	const resultArtistName = normalizeSearchText(data.artistName ?? '')
	const resultAlbumName = normalizeSearchText(data.albumName ?? '')

	let score = 0
	if (resultTrackName === expectedTrackName) {
		score += 8
	} else if (
		resultTrackName.includes(expectedTrackName) ||
		expectedTrackName.includes(resultTrackName)
	) {
		score += 4
	}

	if (expectedArtistName && resultArtistName === expectedArtistName) {
		score += 5
	} else if (
		expectedArtistName &&
		(resultArtistName.includes(expectedArtistName) ||
			expectedArtistName.includes(resultArtistName))
	) {
		score += 2
	}

	if (expectedAlbumName && resultAlbumName === expectedAlbumName) {
		score += 3
	}
	if (data.duration) {
		score += Math.max(
			0,
			LRCLIB_DURATION_TOLERANCE_SECONDS - Math.abs(data.duration - durationSeconds),
		)
	}

	return score
}

// API Fetcher
const getLyricsPlusLines = (data: unknown, durationSeconds: number): SyncedLyricsLine[] => {
	if (!isRecord(data)) {
		return []
	}

	if (Array.isArray(data.lines)) {
		return data.lines.map(normalizeLine).filter((line): line is SyncedLyricsLine => !!line)
	}

	if (Array.isArray(data.lyrics)) {
		return data.lyrics
			.map((line): SyncedLyricsLine | undefined => {
				if (
					!isRecord(line) ||
					typeof line.text !== 'string' ||
					!isFiniteNumber(line.time) ||
					!isFiniteNumber(line.duration)
				) {
					return
				}

				const wordsList = line.text.split(whitespacePattern).filter(Boolean)
				const totalDuration = line.duration
				const wordDuration = totalDuration / (wordsList.length || 1)

				return {
					startTime: line.time,
					endTime: line.time + line.duration,
					words: wordsList.map((word, i) => ({
						string: word + (i === wordsList.length - 1 ? '' : ' '),
						time: Math.round(line.time + i * wordDuration),
					})),
				}
			})
			.filter((line): line is SyncedLyricsLine => !!line)
	}

	const lyricsText =
		typeof data.syncedLyrics === 'string'
			? data.syncedLyrics
			: typeof data.lyrics === 'string'
			? data.lyrics
			: null

	if (lyricsText) {
		return parseLrc(lyricsText, durationSeconds * 1000)
	}

	if (isRecord(data.data)) {
		return getLyricsPlusLines(data.data, durationSeconds)
	}

	return []
}

const fetchLyricsPlusLyrics = async (
	track: TrackData,
	signal: AbortSignal,
): Promise<SyncedLyricsLine[]> => {
	try {
		const url = new URL(LYRICSPLUS_LYRICS_ENDPOINT)
		url.searchParams.set('title', track.name)
		url.searchParams.set('artist', formatArtists(track.artists))
		url.searchParams.set('source', 'apple')

		const maybeIsrc = (track as { isrc?: unknown }).isrc
		if (typeof maybeIsrc === 'string' && maybeIsrc.trim()) {
			url.searchParams.set('isrc', maybeIsrc)
		}

		const response = await fetch(url, { signal })
		if (!response.ok) {
			return []
		}

		const data: unknown = await response.json()
		return getLyricsPlusLines(data, getDurationSeconds(track))
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw error
		}
		return []
	}
}

const fetchLrclibExactLyrics = async (
	track: TrackData,
	durationSeconds: number,
	signal: AbortSignal,
): Promise<SyncedLyricsResult> => {
	const url = new URL(LRCLIB_GET_ENDPOINT)

	url.searchParams.set('track_name', track.name)
	url.searchParams.set('artist_name', formatArtists(track.artists))
	url.searchParams.set('album_name', formatNameOrUnknown(track.album, ''))
	url.searchParams.set('duration', String(durationSeconds))

	const response = await fetch(url, { signal })
	if (response.status === 404) {
		return { status: 'not-found' }
	}
	if (!response.ok) {
		return { status: 'error' }
	}

	const data = getLrclibResponse(await response.json())
	return data ? getLrclibFoundResult(data, durationSeconds) : { status: 'not-found' }
}

const fetchLrclibSearchLyrics = async (
	track: TrackData,
	durationSeconds: number,
	signal: AbortSignal,
): Promise<SyncedLyricsResult> => {
	const url = new URL(LRCLIB_SEARCH_ENDPOINT)

	url.searchParams.set('track_name', track.name)
	url.searchParams.set('artist_name', formatArtists(track.artists))
	url.searchParams.set('duration', String(durationSeconds))

	const response = await fetch(url, { signal })
	if (response.status === 404) {
		return { status: 'not-found' }
	}
	if (!response.ok) {
		return { status: 'error' }
	}

	const data: unknown = await response.json()
	if (!Array.isArray(data)) {
		return { status: 'not-found' }
	}

	const bestMatch = data
		.map(getLrclibResponse)
		.filter((item): item is LrclibLyricsResponse => !!item)
		.map((item) => ({ item, score: scoreLrclibSearchResult(item, track, durationSeconds) }))
		.filter(({ score }) => Number.isFinite(score))
		.sort((a, b) => b.score - a.score)[0]?.item

	if (!bestMatch) {
		return { status: 'not-found' }
	}
	return getLrclibFoundResult(bestMatch, durationSeconds)
}

const fetchLrclibLyrics = async (
	track: TrackData,
	signal: AbortSignal,
): Promise<SyncedLyricsResult> => {
	const durationSeconds = getDurationSeconds(track)

	try {
		const exactResult = await fetchLrclibExactLyrics(track, durationSeconds, signal)
		if (exactResult.status === 'found' || exactResult.status === 'instrumental') {
			return exactResult
		}

		const searchResult = await fetchLrclibSearchLyrics(track, durationSeconds, signal)
		return searchResult
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw error
		}
		return { status: 'error' }
	}
}

export const fetchSyncedLyrics = async (
	track: TrackData,
	signal: AbortSignal,
): Promise<SyncedLyricsResult> => {
	try {
		const lyricsPlusLines = await fetchLyricsPlusLyrics(track, signal)
		if (lyricsPlusLines.length > 0) {
			return { status: 'found', source: 'lyricsplus', lines: lyricsPlusLines }
		}

		return await fetchLrclibLyrics(track, signal)
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw error
		}
		return { status: 'error' }
	}
}
