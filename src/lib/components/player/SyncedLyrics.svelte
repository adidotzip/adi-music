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
				break
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
	const sourceLabel = $derived(
		foundResult?.source === 'lyricsplus' ? 'LyricsPlus' : 'LRCLIB',
	)

	const getActiveWordIndex = (line: SyncedLyricsLine): number => {
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
	<div class="empty-state m-auto flex max-w-80 flex-col items-center text-center">
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
				class="source-badge rounded-full bg-surfaceContainerHighest px-3 py-1 text-label-sm text-onSurfaceVariant"
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
						<span 
							class="lyric-word" 
							class:active-word={isActiveLine && wordIndex <= activeWordIdx}
						>{word.string}</span>
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
	.lyrics-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 800px; /* Adjust based on your layout */
		position: relative;
		overflow: hidden;
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		z-index: 10;
		background: linear-gradient(to bottom, var(--color-surface, #121212) 60%, transparent);
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 1.5rem;
		scroll-behavior: smooth;
		
		/* Hides scrollbar for a cleaner Apple-like UI */
		scrollbar-width: none; 
		-ms-overflow-style: none;
		
		/* Smooth fade mask at the top and bottom edges */
		mask-image: linear-gradient(
			to bottom, 
			transparent 0%, 
			black 10%, 
			black 90%, 
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom, 
			transparent 0%, 
			black 10%, 
			black 90%, 
			transparent 100%
		);
	}

	.lyrics-scroller::-webkit-scrollbar {
		display: none;
	}

	/* Ensures the first and last lines can perfectly hit the center of the scroll view */
	.lyrics-spacer {
		height: 45vh; 
	}

	/* --- APPLE MUSIC STYLE TYPOGRAPHY & ANIMATIONS --- */
	
	.lyric-line {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 1rem 0;
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.03em;
		white-space: pre-wrap;
		color: var(--color-onSurface, #ffffff);
		
		/* Inactive state (dimmed, scaled down, slightly blurred) */
		opacity: 0.25;
		transform: scale(0.95);
		transform-origin: left center;
		filter: blur(1.5px);
		cursor: pointer;
		
		/* Apple's signature springy transition */
		transition: opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
					transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1),
					filter 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.lyric-line:hover {
		opacity: 0.5;
	}

	/* Active Line gets full emphasis */
	.lyric-line.active {
		opacity: 1;
		transform: scale(1);
		filter: blur(0);
	}

	/* Karaoke Word Highlighting */
	.lyric-word {
		display: inline-block;
		transition: opacity 0.2s ease, text-shadow 0.2s ease, color 0.2s ease;
	}

	/* Words in the currently active line are dimmed until they are sung */
	.lyric-line.active .lyric-word {
		opacity: 0.4;
	}

	/* Sung words glow brightly */
	.lyric-line.active .lyric-word.active-word {
		opacity: 1;
		text-shadow: 0 0 20px var(--alpha(var(--color-onSurface) / 30%));
		
		/* Optional: If you want a gradient fill instead of solid text */
		/* background: linear-gradient(90deg, var(--color-primary), var(--color-tertiary));
		background-clip: text;
		-webkit-text-fill-color: transparent; */
	}
</style>
