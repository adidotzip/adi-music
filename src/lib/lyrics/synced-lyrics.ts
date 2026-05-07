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

const normalizeWord = (value: unknown): SyncedLyricsWord | undefined => {
	if (!isRecord(value) || typeof value.string !== 'string' || !isFiniteNumber(value.time)) {
		return
	}

	return {
		string: value.string,
		time: value.time,
	}
}

const normalizeLine = (value: unknown): SyncedLyricsLine | undefined => {
	if (!(isRecord(value) && isFiniteNumber(value.startTime) && isFiniteNumber(value.endTime))) {
		return
	}

	if (!Array.isArray(value.words)) {
		return
	}

	const words = value.words.map(normalizeWord).filter((word) => word !== undefined)
	if (words.length === 0) {
		return
	}

	return {
		startTime: value.startTime,
		endTime: value.endTime,
		words,
	}
}

const normalizeYoulyPlusResponse = (value: unknown): SyncedLyricsLine[] => {
	if (!(isRecord(value) && Array.isArray(value.lines))) {
		return []
	}

	return value.lines.map(normalizeLine).filter((line) => line !== undefined)
}

const fetchYoulyPlusLyrics = async (
	track: TrackData,
	signal: AbortSignal,
): Promise<SyncedLyricsLine[]> => {
	const url = new URL(YOULYPLUS_LYRICS_ENDPOINT)
	url.searchParams.set('id', String(track.id))

	const response = await fetch(url, { signal })
	if (!response.ok) {
		return []
	}

	return normalizeYoulyPlusResponse(await response.json())
}

interface LrclibResponse {
	instrumental?: boolean
	plainLyrics?: string | null
	syncedLyrics?: string | null
}

const normalizeLrclibResponse = (value: unknown): LrclibResponse | undefined => {
	if (!isRecord(value)) {
		return
	}

	return {
		instrumental: typeof value.instrumental === 'boolean' ? value.instrumental : undefined,
		plainLyrics: typeof value.plainLyrics === 'string' ? value.plainLyrics : null,
		syncedLyrics: typeof value.syncedLyrics === 'string' ? value.syncedLyrics : null,
	}
}

const timestampPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g

const parseTimestamp = (minutes: string, seconds: string, fraction: string | undefined): number => {
	const paddedFraction = (fraction ?? '0').padEnd(3, '0').slice(0, 3)

	return Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(paddedFraction)
}

const splitLyricText = (text: string): string[] => {
	const words = text.match(/\S+\s*/g)

	return words && words.length > 0 ? words : [text]
}

const parseLrc = (lyrics: string, durationMs: number): SyncedLyricsLine[] => {
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

			return matches.flatMap((match) => {
				const minutes = match[1]
				const seconds = match[2]
				if (!(minutes && seconds)) {
					return []
				}

				return {
					startTime: parseTimestamp(minutes, seconds, match[3]),
					text,
				}
			})
		})
		.sort((a, b) => a.startTime - b.startTime)

	return timestampedLines.map((line, index) => {
		const nextLine = timestampedLines[index + 1]
		const endTime = nextLine?.startTime ?? Math.max(durationMs, line.startTime + 3000)
		const words = splitLyricText(line.text)
		const wordDuration = Math.max((endTime - line.startTime) / words.length, 1)

		return {
			startTime: line.startTime,
			endTime,
			words: words.map((word, wordIndex) => ({
				string: word,
				time: Math.round(line.startTime + wordDuration * wordIndex),
			})),
		}
	})
}

const fetchLrclibLyrics = async (
	track: TrackData,
	signal: AbortSignal,
): Promise<SyncedLyricsResult> => {
	const url = new URL(LRCLIB_GET_ENDPOINT)
	url.searchParams.set('track_name', track.name)
	url.searchParams.set('artist_name', formatArtists(track.artists))
	url.searchParams.set('album_name', formatNameOrUnknown(track.album, ''))
	url.searchParams.set('duration', String(Math.round(track.duration)))

	const response = await fetch(url, { signal })
	if (response.status === 404) {
		return { status: 'not-found' }
	}

	if (!response.ok) {
		return { status: 'error' }
	}

	const lrclibResponse = normalizeLrclibResponse(await response.json())
	if (!lrclibResponse) {
		return { status: 'error' }
	}

	if (lrclibResponse.instrumental) {
		return { status: 'instrumental' }
	}

	const lines = lrclibResponse.syncedLyrics
		? parseLrc(lrclibResponse.syncedLyrics, track.duration * 1000)
		: []

	if (lines.length === 0) {
		return { status: 'not-found' }
	}

	return {
		status: 'found',
		source: 'lrclib',
		lines,
	}
}

export const fetchSyncedLyrics = async (
	track: TrackData,
	signal: AbortSignal,
): Promise<SyncedLyricsResult> => {
	try {
		const lines = await fetchYoulyPlusLyrics(track, signal)
		if (lines.length > 0) {
			return {
				status: 'found',
				source: 'youlyplus',
				lines,
			}
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw error
		}
	}

	return fetchLrclibLyrics(track, signal)
}
