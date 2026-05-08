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
	
	let previousActiveIndex = -1
	let isUserScrolling = false
	let userScrollTimeout: number | undefined

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])
	const activeLineIndex = $derived(getActiveLineIndex(lines, currentTimeMs))
	const sourceLabel = $derived(
		foundResult?.source === 'lyricsplus' ? 'LyricsPlus' : 'LRCLIB',
	)

	const getActiveWordIndex = (line: SyncedLyricsLine, timeMs: number): number => {
		for (let i = line.words.length - 1; i >= 0; i -= 1) {
			if (timeMs >= line.words[i].time) {
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

	// Optimized Auto-scroll logic using requestAnimationFrame
	let animationFrameId: number | undefined

	const scrollToActiveLine = (smooth = true) => {
		if (!scrollerElement || activeLineIndex < 0 || isUserScrolling) return

		const activeEl = scrollerElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) return

		const targetScroll =
			activeEl.offsetTop -
			scrollerElement.clientHeight / 2 +
			activeEl.clientHeight / 2

		if (Math.abs(scrollerElement.scrollTop - targetScroll) < 1) return

		if (smooth) {
			const startScroll = scrollerElement.scrollTop
			const distance = targetScroll - startScroll
			const duration = 600
			let startTime: number | null = null

			const animate = (currentTime: number) => {
				if (!startTime) startTime = currentTime
				const timeElapsed = currentTime - startTime
				const progress = Math.min(timeElapsed / duration, 1)

				// Cubic ease-out
				const ease = 1 - Math.pow(1 - progress, 3)

				if (scrollerElement && !isUserScrolling) {
					scrollerElement.scrollTop = startScroll + distance * ease
				}

				if (progress < 1 && !isUserScrolling) {
					animationFrameId = requestAnimationFrame(animate)
				}
			}

			cancelAnimationFrame(animationFrameId!)
			animationFrameId = requestAnimationFrame(animate)
		} else {
			scrollerElement.scrollTop = targetScroll
		}
	}

	$effect(() => {
		if (activeLineIndex !== previousActiveIndex) {
			previousActiveIndex = activeLineIndex
			scrollToActiveLine()
		}
	})

	$effect(() => {
		return () => {
			if (animationFrameId) cancelAnimationFrame(animationFrameId)
		}
	})

	const handleScroll = () => {
		isUserScrolling = true
		clearTimeout(userScrollTimeout)
		userScrollTimeout = window.setTimeout(() => {
			isUserScrolling = false
		}, 2500)
	}

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

<section class="lyrics-shell card" aria-live="polite" style="--primary-color: {track?.primaryColor ? `rgb(${((track.primaryColor >> 16) & 0xFF)}, ${((track.primaryColor >> 8) & 0xFF)}, ${(track.primaryColor & 0xFF)})` : 'var(--color-surfaceContainerLow)'}">
	<div class="dynamic-background"></div>
	{#if !track}
		{@render emptyState('musicNote', m.lyricsNoTrack(), m.lyricsNoTrackExplanation())}
	{:else if loading}
		<div class="lyrics-header opacity-50">
			<div class="min-w-0">
				<div class="skeleton mb-2 h-6 w-32 rounded bg-surfaceContainerHighest"></div>
				<div class="skeleton h-4 w-24 rounded bg-surfaceContainerHighest"></div>
			</div>
		</div>
		<div class="lyrics-scroller overflow-hidden px-6 pt-12">
			{#each Array(6) as _, i}
				<div 
					class="skeleton mb-8 h-12 rounded-lg bg-surfaceContainerHighest opacity-20"
					style="width: {70 + Math.random() * 20}%;"
				></div>
			{/each}
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

		<div
			class="lyrics-scroller"
			bind:this={scrollerElement}
			onscroll={handleScroll}
			onwheel={handleScroll}
			ontouchstart={handleScroll}
		>
			<div class="lyrics-spacer"></div>
			{#each lines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				{@const activeWordIdx = getActiveWordIndex(line, currentTimeMs)}

				<button
					type="button"
					class="lyric-line interactable"
					class:active={isActiveLine}
					class:past={lineIndex < activeLineIndex}
					data-line-index={lineIndex}
					onclick={() => player.seek(line.startTime / 1000)}
				>
					{#each line.words as word, wordIndex}
						{@const isPastWord = isActiveLine && wordIndex < activeWordIdx}
						{@const isCurrentWord = isActiveLine && wordIndex === activeWordIdx}
						{@const nextTime = line.words[wordIndex + 1]?.time ?? line.endTime}
						{@const duration = nextTime - word.time || 200}
						{@const wordProgress = isCurrentWord 
							? Math.min(Math.max((currentTimeMs - word.time) / duration, 0), 1) * 100
							: (isPastWord ? 100 : 0)}
						
						<span 
							class="lyric-word" 
							class:active-word={isActiveLine && wordIndex <= activeWordIdx}
							style="--word-progress: {wordProgress}%"
						>{word.string}</span>{' '}
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
		max-height: 800px;
		position: relative;
		overflow: hidden;
		background: var(--color-surface);
	}

	.dynamic-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			circle at 20% 30%,
			var(--primary-color) 0%,
			transparent 50%
		),
		radial-gradient(
			circle at 80% 70%,
			var(--primary-color) 0%,
			transparent 50%
		);
		opacity: 0.15;
		filter: blur(80px);
		z-index: 0;
		pointer-events: none;
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		z-index: 10;
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		background: var(--color-surfaceContainerLow, #1a1a1a) 80%;
		border-bottom: 1px solid var(--color-outlineVariant, rgba(255, 255, 255, 0.1));
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 1.5rem;
		scroll-behavior: smooth;
		perspective: 1000px;
		
		scrollbar-width: none; 
		-ms-overflow-style: none;
		
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
		padding: 1.25rem 0;
		margin: 0.5rem 0;
		font-size: 1.75rem;
		@media (min-width: 640px) {
			font-size: 2.25rem;
		}
		@media (min-width: 1024px) {
			font-size: 2.75rem;
		}
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.04em;
		white-space: pre-wrap;
		color: var(--color-onSurface, #ffffff);

		opacity: 0.2;
		transform: scale(0.95);
		transform-origin: center left;
		cursor: pointer;

		will-change: transform, opacity, filter;

		transition:
			opacity 0.6s cubic-bezier(0.2, 0, 0, 1),
			transform 0.6s cubic-bezier(0.2, 0, 0, 1),
			filter 0.6s cubic-bezier(0.2, 0, 0, 1);
		filter: blur(1.5px);
	}

	.lyric-line:hover {
		opacity: 0.5;
	}

	.lyric-line.active {
		opacity: 1;
		transform: scale(1.05);
		filter: blur(0);
	}

	/* Cleaned up specificity & added butter-smooth word transitions */
	.lyric-word {
		display: inline-block;
		opacity: 0.3;
		transition:
			opacity 0.4s cubic-bezier(0.2, 0, 0, 1),
			transform 0.4s cubic-bezier(0.2, 0, 0, 1),
			filter 0.4s cubic-bezier(0.2, 0, 0, 1);
		filter: blur(1px);
	}

	.lyric-line.active .lyric-word {
		background: linear-gradient(
			to right,
			var(--color-onSurface, #ffffff) 0%,
			var(--color-onSurface, #ffffff) var(--word-progress, 0%),
			rgba(255, 255, 255, 0.3) var(--word-progress, 0%)
		);
		background-size: 100% 100%;
		background-repeat: no-repeat;
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		opacity: 1;
		filter: none;
		transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1);
	}

	.lyric-line.active .lyric-word.active-word {
		transform: scale(1.05);
		filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.15));
	}

	.lyric-line.past {
		opacity: 0.15;
		filter: blur(1px);
	}

	.skeleton {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 0.2;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
