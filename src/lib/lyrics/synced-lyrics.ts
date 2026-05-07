import { formatArtists, formatNameOrUnknown } from '$lib/helpers/utils/text.ts'
import type { TrackData } from '$lib/library/get/value.ts'

const YOULYPLUS_LYRICS_ENDPOINT = 'https://youlyplus.prjktla.my.id/api/v2/lyrics'
const LRCLIB_GET_ENDPOINT = 'https://lrclib.net/api/get'

export interface SyncedLyricsWord {
	string: string
	time: number
}

export interface SyncedLyricsLine {
	startTime: number
	endTime: number
	words: SyncedLyricsWord[]
}

export type SyncedLyricsSource = 'youlyplus' | 'lrclib'

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

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value)

/**
 * Normalization helpers for YoulyPlus
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
	if (!Array.isArray(value.words)) return
	
	const words = value.words.map(normalizeWord).filter((word): word is SyncedLyricsWord => !!word)
	if (words.length === 0) return

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

const parseTimestamp = (minutes: string, seconds: string, fraction: string | undefined): number => {
	// LRCLIB often provides 2 digits (.75). We pad it to 3 to treat as milliseconds (.750).
	const msString = (fraction ?? '0').padEnd(3, '0').slice(0, 3)
	return parseInt(minutes) * 60_000 + parseInt(seconds) * 1000 + parseInt(msString)
}

const parseLrc = (lyrics: string, durationMs: number): SyncedLyricsLine[] => {
	const timestampedLines = lyrics
		.split('\n')
		.flatMap((rawLine) => {
			const matches = [...rawLine.matchAll(timestampPattern)]
			if (matches.length === 0) return []

			const text = rawLine.replace(timestampPattern, '').trim()
			if (!text) return []

			return matches.map((match) => ({
				startTime: parseTimestamp(match[1], match[2], match[3]),
				text,
			}))
		})
		.sort((a, b) => a.startTime - b.startTime)

	return timestampedLines.map((line, index) => {
		const nextLine = timestampedLines[index + 1]
		// End time is the start of the next line, or duration/offset if last line
		const endTime = nextLine ? nextLine.startTime : Math.max(durationMs, line.startTime + 2000)
		
		const wordsList = line.text.split(/\s+/).filter(Boolean)
		const totalDuration = endTime - line.startTime
		const wordDuration = totalDuration / (wordsList.length || 1)

		return {
			startTime: line.startTime,
			endTime,
			words: wordsList.map((word, i) => ({
				string: word + (i === wordsList.length - 1 ? '' : ' '),
				time: Math.round(line.startTime + (i * wordDuration)),
			})),
		}
	})
}

//API Fetcher
const fetchYoulyPlusLyrics = async (track: TrackData, signal: AbortSignal): Promise<SyncedLyricsLine[]> => {
	try {
		const url = new URL(YOULYPLUS_LYRICS_ENDPOINT)
		url.searchParams.set('id', String(track.id))

		const response = await fetch(url, { signal })
		if (!response.ok) return []

		const data = await response.json()
		if (isRecord(data) && Array.isArray(data.lines)) {
			return data.lines.map(normalizeLine).filter((l): l is SyncedLyricsLine => !!l)
		}
		return []
	} catch (e) {
		return []
	}
}

const fetchLrclibLyrics = async (track: TrackData, signal: AbortSignal): Promise<SyncedLyricsResult> => {
	const url = new URL(LRCLIB_GET_ENDPOINT)
	// Ensure track duration is passed as seconds for LRCLIB
	const durationSeconds = track.duration > 1000 ? Math.round(track.duration / 1000) : Math.round(track.duration)
	
	url.searchParams.set('track_name', track.name)
	url.searchParams.set('artist_name', formatArtists(track.artists))
	url.searchParams.set('album_name', formatNameOrUnknown(track.album, ''))
	url.searchParams.set('duration', String(durationSeconds))

	try {
		const response = await fetch(url, { signal })
		if (response.status === 404) return { status: 'not-found' }
		if (!response.ok) return { status: 'error' }

		const data = await response.json()
		if (data.instrumental) return { status: 'instrumental' }
		
		if (!data.syncedLyrics) return { status: 'not-found' }

		// Use milliseconds for the parser
		const lines = parseLrc(data.syncedLyrics, durationSeconds * 1000)
		
		return lines.length > 0 
			? { status: 'found', source: 'lrclib', lines } 
			: { status: 'not-found' }
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') throw error
		return { status: 'error' }
	}
}


export const fetchSyncedLyrics = async (track: TrackData, signal: AbortSignal): Promise<SyncedLyricsResult> => {
	try {

		const youlyLines = await fetchYoulyPlusLyrics(track, signal)
		if (youlyLines.length > 0) {
			return { status: 'found', source: 'youlyplus', lines: youlyLines }
		}


		return await fetchLrclibLyrics(track, signal)
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') throw error
		return { status: 'error' }
	}
}
