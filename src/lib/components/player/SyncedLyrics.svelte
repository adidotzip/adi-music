<script lang="ts" module>
	import type { SyncedLyricsLine } from '$lib/lyrics/synced-lyrics.ts'

	const getActiveLineIndex = (
		lines: readonly SyncedLyricsLine[],
		currentTimeMs: number,
	): number => {
		let index = -1
		for (let i = 0; i < lines.length; i += 1) {
			if (currentTimeMs >= lines[i].startTime) {
				index = i
			} else {
				break // Since lines are sorted, we can stop early
			}
		}
		return index
	}
</script>

<script lang="ts">
	import Button from '$lib/components/Button.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import Spinner from '$lib/components/Spinner.svelte'
	import { formatArtists, getItemLanguage } from '$lib/helpers/utils/text.ts'
	import type { TrackData } from '$lib/library/get/value.ts'
	import {
		fetchSyncedLyrics,
		type SyncedLyricsLine,
		type SyncedLyricsResult,
	} from '$lib/lyrics/synced-lyrics.ts'

	interface Props {
		track: TrackData | undefined
		currentTimeMs: number
	}

	let { track, currentTimeMs }: Props = $props()
	const player = usePlayer()

	let result: SyncedLyricsResult | undefined = $state()
	let loading = $state(false)
	let scrollerElement: HTMLElement | undefined = $state()
	let reloadCount = $state(0)

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])
	const activeLineIndex = $derived(getActiveLineIndex(lines, currentTimeMs))
	const sourceLabel = $derived(foundResult?.source === 'youlyplus' ? 'YoulyPlus' : 'LRCLIB')

	const getActiveWordIndex = (line: SyncedLyricsLine): number => {
		// Optimization: Find index using reverse loop or findLastIndex
		for (let i = line.words.length - 1; i >= 0; i -= 1) {
			if (currentTimeMs >= line.words[i].time) {
				return i
			}
		}
		return -1
	}

	// Fetching logic
	$effect(() => {
		if (!track) {
			result = undefined
			loading = false
			return
		}

		const requestedReloadCount = reloadCount

		const controller = new AbortController()
		loading = true

		fetchSyncedLyrics(track, controller.signal)
			.then((nextResult) => {
				if (!controller.signal.aborted && requestedReloadCount === reloadCount) {
					result = nextResult
				}
			})
			.catch((error: unknown) => {
				if (error instanceof Error && error.name === 'AbortError') {
					return
				}
				result = { status: 'error' }
			})
			.finally(() => {
				if (!controller.signal.aborted && requestedReloadCount === reloadCount) {
					loading = false
				}
			})

		return () => controller.abort()
	})

	// Auto-scroll logic
	$effect(() => {
		const index = activeLineIndex
		if (index < 0 || !scrollerElement) {
			return
		}

		const activeEl = scrollerElement.querySelector(`[data-line-index="${index}"]`)
		if (activeEl) {
			activeEl.scrollIntoView({
				block: 'center',
				behavior: 'smooth',
			})
		}
	})

	const retry = () => {
		reloadCount += 1
	}
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="m-auto flex max-w-80 flex-col items-center text-center">
		<Icon type={icon} class="color-onSecondaryContainer mb-4 size-24 opacity-54" />
		<div class="text-title-md">{title}</div>
		<div class="mt-2 text-body-md text-onSecondaryContainer/72">{description}</div>
		{#if icon === 'alertCircle'}
			<Button kind="outlined" class="mt-6" onclick={retry}>{m.reload()}</Button>
		{/if}
	</div>
{/snippet}

<section class="lyrics-shell card" aria-live="polite">
	{#if !track}
		{@render emptyState('musicNote', m.lyricsNoTrack(), m.lyricsNoTrackExplanation())}
	{:else if loading}
		<div class="m-auto flex flex-col items-center gap-4 text-center">
			<Spinner />
			<div class="text-body-md text-onSecondaryContainer/72">{m.lyricsLoading()}</div>
		</div>
	{:else if result?.status === 'found'}
		<div class="lyrics-header">
			<div class="min-w-0" lang={getItemLanguage(track.language)}>
				<div class="truncate text-title-md">{track.name}</div>
				<div class="truncate text-body-sm text-onSecondaryContainer/72">
					{formatArtists(track.artists)}
				</div>
			</div>
			<div
				class="rounded-full bg-surfaceContainerHighest px-3 py-1 text-label-sm text-onSurfaceVariant"
			>
				{sourceLabel}
			</div>
		</div>

		<div class="lyrics-scroller" bind:this={scrollerElement}>
			<div class="lyrics-spacer"></div>
			{#each lines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				{@const activeWordIdx = getActiveWordIndex(line)}

				<button
					type="button"
					class="lyric-line interactable"
					class:active={isActiveLine}
					class:past={lineIndex < activeLineIndex}
					data-line-index={lineIndex}
					onclick={() => player.seek(line.startTime / 1000)}
				>
					{#each line.words as word, wordIndex}
						<span class="lyric-word" class:active-word={isActiveLine && wordIndex <= activeWordIdx}>
							{word.string}
						</span>
					{/each}
				</button>
			{/each}
			<div class="lyrics-spacer"></div>
		</div>
	{:else if result?.status === 'instrumental'}
		{@render emptyState('musicNote', m.lyricsInstrumental(), m.lyricsInstrumentalExplanation())}
	{:else if result?.status === 'not-found'}
		{@render emptyState('musicNote', m.lyricsNotFound(), m.lyricsNotFoundExplanation())}
	{:else}
		{@render emptyState('alertCircle', m.lyricsFailed(), m.lyricsFailedExplanation())}
	{/if}
</section>

<style lang="postcss">
	/* Styles remain largely the same, but ensure active-word logic is clear */
	.lyric-word {
		transition: color 200ms ease;
	}

	.active .lyric-word.active-word {
		background: linear-gradient(90deg, var(--color-primary), var(--color-tertiary));
		background-clip: text;
		-webkit-text-fill-color: transparent;
		/* Adds a "glow" to the currently singing word */
		text-shadow: 0 0 15px var(--alpha(var(--color-primary) / 30%));
	}
</style>
