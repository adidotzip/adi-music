import { getDatabase } from '$lib/db/database.ts'
import { formatArtists, formatNameOrUnknown } from '$lib/helpers/utils/text.ts'
import type { TrackData } from '$lib/library/get/value.ts'

const LYRICSPLUS_LYRICS_ENDPOINT = 'https://lyricsplus.prjktla.workers.dev/v2/lyrics/get'
const LRCLIB_GET_ENDPOINT = 'https://lrclib.net/api/get'
const LRCLIB_SEARCH_ENDPOINT = 'https://lrclib.net/api/search'
const UNISON_GET_ENDPOINT = 'https://unison.boidu.dev/lyrics'

const LRCLIB_DURATION_TOLERANCE_SECONDS = 4
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7
const CACHE_VERSION = 4 // Bumped for syllable-weighting & easing

export interface SyncedLyricsWord {
	string: string
	time: number
}

export interface SyncedLyricsLine {
	startTime: number
	endTime: number
	words: SyncedLyricsWord[]
}

export type SyncedLyricsSource = 'lyricsplus' | 'lrclib' | 'unison'
export type LyricsSyncMode = 'karaoke' | 'line'
export type TimingQuality = 'high' | 'medium' | 'low'

export type SyncedLyricsResult =
	| {
			status: 'found'
			source: SyncedLyricsSource
			lines: SyncedLyricsLine[]
			syncType: LyricsSyncMode
			confidence: number
			timingQuality: TimingQuality
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

interface UnisonLyricsResponse {
	success: boolean
	data?: {
		lyrics?: string
	}
}

// --- UTILITIES ---

const isDefined = <T>(value: T | undefined | null): value is T =>
	value !== undefined && value !== null

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value)

const deduplicateLines = (lines: SyncedLyricsLine[]): SyncedLyricsLine[] => {
	return lines.filter((line, index, arr) => {
		if (index === 0) return true
		const prevLine = arr[index - 1]
		return !(
			line.startTime === prevLine.startTime &&
			line.words[0]?.string === prevLine.words[0]?.string
		)
	})
}

const convertToLineOnly = (lines: SyncedLyricsLine[]): SyncedLyricsLine[] => {
	return lines.map((line) => ({
		...line,
		words: line.words.map((word) => ({ ...word, time: line.startTime })),
	}))
}

const normalizeWord = (value: unknown): SyncedLyricsWord | undefined => {
	if (!isRecord(value) || typeof value.string !== 'string' || !isFiniteNumber(value.time)) return
	return { string: value.string, time: value.time }
}

const normalizeLine = (value: unknown): SyncedLyricsLine | undefined => {
	if (!(isRecord(value) && isFiniteNumber(value.startTime) && isFiniteNumber(value.endTime))) return
	if (!Array.isArray(value.words)) return

	const words = value.words.map(normalizeWord).filter(isDefined)
	if (words.length === 0) return

	return { startTime: value.startTime, endTime: value.endTime, words }
}

// --- TIMING & WEIGHTING MAGIC ✨ ---

const estimateSyllables = (word: string): number => {
	const cleaned = word.toLowerCase().replace(/[^a-z]/g, '')
	if (!cleaned) return 1
	// Count vowel groups to approximate phonetic syllables
	const groups = cleaned.match(/[aeiouy]+/g)
	return Math.max(groups?.length ?? 1, 1)
}

const getWordWeight = (word: string): number => {
	const clean = word.toLowerCase()
	const pureText = clean.replace(/[^a-z0-9]/g, '')
	
	let weight = estimateSyllables(pureText) * 2 // Base phonetic weight

	// Repeated vowels = melisma/sustain stretch
	const repeatedVowels = clean.match(/([aeiouy])\1+/g)
	if (repeatedVowels) weight += repeatedVowels.length * 3

	// Common sustained vocal endings
	if (/(ay|ee|oo|ah|oh|uh)[^a-z0-9]*$/i.test(clean)) weight += 2

	// Tiny connector words shrink
	if (/^(a|an|the|to|of|in|on|at|it)$/i.test(pureText)) weight *= 0.5

	// Natural breath / pause timing
	if (/,$/.test(clean)) weight += 3
	else if (/[.!?;]$/.test(clean)) weight += 5 

	return Math.max(weight, 1)
}

// Easing function for buttery smooth word timing distribution
const easeOutSine = (x: number): number => Math.sin((x * Math.PI) / 2)

// --- PARSERS ---

const timestampPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
const whitespacePattern = /\s+/

const parseTimestamp = (minutes: string, seconds: string, fraction: string | undefined): number => {
	const msString = (fraction ?? '0').padEnd(3, '0').slice(0, 3)
	return Number.parseInt(minutes, 10) * 60_000 + Number.parseInt(seconds, 10) * 1000 + Number.parseInt(msString, 10)
}

export const parseLrc = (lyrics: string, durationMs: number): SyncedLyricsLine[] => {
	const timestampedLines = lyrics
		.split('\n')
		.flatMap((rawLine) => {
			const matches = [...rawLine.matchAll(timestampPattern)]
			if (matches.length === 0) return []
			const text = rawLine.replace(timestampPattern, '').trim()
			if (!text) return []
			return matches.map((match) => ({
				startTime: parseTimestamp(match[1], match[2], match[3] as string | undefined),
				text,
			}))
		})
		.sort((a, b) => a.startTime - b.startTime)

	const lines = timestampedLines.map((line, index) => {
		const nextLine = timestampedLines[index + 1]
		const endTime = nextLine ? nextLine.startTime : Math.max(durationMs, line.startTime + 2000)
		const wordsList = line.text.split(whitespacePattern).filter(Boolean)

		return {
			startTime: line.startTime,
			endTime,
			words: wordsList.map((word, i) => ({
				string: word + (i === wordsList.length - 1 ? '' : ' '),
				time: line.startTime, // Honest line-sync
			})),
		}
	})

	return deduplicateLines(lines)
}

export const parseTtml = (ttml: string): SyncedLyricsLine[] => {
	const lines: SyncedLyricsLine[] = []
	const parser = new DOMParser()
	const doc = parser.parseFromString(ttml, 'text/xml')

	const parseTime = (timeStr: string | null): number => {
		if (!timeStr) return 0
		const parts = timeStr.split(':')
		if (parts.length === 3) return ((Number.parseInt(parts[0], 10) * 3600 + Number.parseInt(parts[1], 10) * 60 + Number.parseFloat(parts[2])) * 1000)
		if (parts.length === 2) return ((Number.parseInt(parts[0], 10) * 60 + Number.parseFloat(parts[1])) * 1000)
		return Number.parseFloat(timeStr) * 1000
	}

	const paragraphs = doc.querySelectorAll('p')
	paragraphs.forEach((p) => {
		const startTime = parseTime(p.getAttribute('begin'))
		const endTime = parseTime(p.getAttribute('end'))
		const spans = p.querySelectorAll('span')
		const words: SyncedLyricsWord[] = []

		if (spans.length > 0) {
			spans.forEach((span, i) => {
				words.push({
					// Smarter trailing space logic
					string: (span.textContent || '').trim() + (i === spans.length - 1 ? '' : ' '),
					time: parseTime(span.getAttribute('begin'))
				})
			})
		} else {
			const content = p.textContent || ''
			if (content.trim()) words.push({ string: content.trim(), time: startTime })
		}

		if (words.length > 0) lines.push({ startTime, endTime, words })
	})

	return deduplicateLines(lines)
}

// --- FETCHERS ---

const normalizeSearchText = (value: string): string =>
	value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['']/g, '').replace(/&/g, ' and ').replace(/\b(feat|ft|featuring)\.?\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()

const getDurationSeconds = (track: TrackData): number => Math.round(track.duration)

const getLyricsPlusResult = (data: unknown, durationSeconds: number): { lines: SyncedLyricsLine[]; syncType: LyricsSyncMode; timingQuality: TimingQuality } | null => {
	if (!isRecord(data)) return null

	if (Array.isArray(data.lines)) {
		const lines = data.lines.map(normalizeLine).filter(isDefined)
		return { lines: deduplicateLines(lines), syncType: 'karaoke', timingQuality: 'high' }
	}

	if (Array.isArray(data.lyrics)) {
		const lines = data.lyrics
			.map((line): SyncedLyricsLine | undefined => {
				if (!isRecord(line) || typeof line.text !== 'string' || !isFiniteNumber(line.time) || !isFiniteNumber(line.duration)) return
				const wordsList = line.text.split(whitespacePattern).filter(Boolean)
				
				const totalWeight = wordsList.reduce((sum, word) => sum + getWordWeight(word), 0) || 1
				let accumulatedWeight = 0
				
				return {
					startTime: line.time,
					endTime: line.time + line.duration,
					words: wordsList.map((word, i) => {
						// Apply Easing to Interpolated Timings
						const startProgress = accumulatedWeight / totalWeight
						accumulatedWeight += getWordWeight(word)
						
						const timeOffset = easeOutSine(startProgress) * line.duration
						return {
							string: word + (i === wordsList.length - 1 ? '' : ' '),
							time: line.time + timeOffset, 
						}
					}),
				}
			})
			.filter(isDefined)
		
		return { lines: deduplicateLines(lines), syncType: 'karaoke', timingQuality: 'medium' }
	}

	const lyricsText = typeof data.syncedLyrics === 'string' ? data.syncedLyrics : typeof data.lyrics === 'string' ? data.lyrics : null
	if (lyricsText) return { lines: parseLrc(lyricsText, durationSeconds * 1000), syncType: 'line', timingQuality: 'low' }
	
	if (isRecord(data.data)) return getLyricsPlusResult(data.data, durationSeconds)
	return null
}

const fetchUnisonLyrics = async (track: TrackData, signal: AbortSignal): Promise<SyncedLyricsResult> => {
	try {
		const url = new URL(UNISON_GET_ENDPOINT)
		url.searchParams.set('song', track.name)
		url.searchParams.set('artist', formatArtists(track.artists))
		url.searchParams.set('duration', String(getDurationSeconds(track)))

		const response = await fetch(url, { signal })
		if (!response.ok) return { status: 'not-found' }

		const payload = (await response.json()) as UnisonLyricsResponse
		if (!payload.success || !payload.data?.lyrics) return { status: 'not-found' }

		const isTtml = payload.data.lyrics.trim().startsWith('<tt')
		const lines = isTtml ? parseTtml(payload.data.lyrics) : parseLrc(payload.data.lyrics, getDurationSeconds(track) * 1000)

		if (lines.length > 0) {
			return {
				status: 'found',
				source: 'unison',
				lines,
				syncType: isTtml ? 'karaoke' : 'line',
				timingQuality: isTtml ? 'high' : 'low',
				confidence: isTtml ? 0.95 : 0.6
			}
		}
		return { status: 'not-found' }
	} catch (error) {
		if (process.env.NODE_ENV === 'development') console.error('Unison Fetch Error:', error)
		return { status: 'error' }
	}
}

