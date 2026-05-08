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
	import { Spring } from 'svelte/motion'
	import Button from '$lib/components/Button.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
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
	const mainStore = useMainStore()

	let result: SyncedLyricsResult | undefined = $state()
	let loading = $state(false)
	let scrollerElement: HTMLElement | undefined = $state()
	let reloadCount = $state(0)
	
	let previousActiveIndex = -1
	let isUserScrolling = $state(false)

	const scrollSpring = new Spring(0, {
		stiffness: 0.1,
		damping: 0.4
	})

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])

	// Pre-process lines to detect secondary vocals/lyrics enclosed in ()
	const processedLines = $derived(
		lines.map((line) => {
			let inSecondary = false
			const words = line.words.map((word) => {
				let isWordSecondary = inSecondary
				if (word.string.includes('(')) {
					inSecondary = true
					isWordSecondary = true
				}
				if (word.string.includes(')')) {
					inSecondary = false
					isWordSecondary = true
				}
				return {
					...word,
					isSecondary: isWordSecondary,
				}
			})

			// Check if the entire line is wrapped in parentheses
			const lineText = words.map((w) => w.string).join('').trim()
			const isSecondaryLine = lineText.startsWith('(') && lineText.endsWith(')')

			return {
				...line,
				words,
				isSecondaryLine,
			}
		}),
	)

	const activeLineIndex = $derived(getActiveLineIndex(processedLines, currentTimeMs))

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
			isUserScrolling = false
			return
		}

		isUserScrolling = false
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
				if (error instanceof Error && error.name === 'AbortError') return
				result = { status: 'error' }
			})
			.finally(() => {
				if (!controller.signal.aborted && requestedReloadCount === reloadCount) {
					loading = false
				}
			})

		return () => controller.abort()
	})

	// Premium hardware-accelerated smooth scrolling
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

		if (mainStore.isReducedMotion || !smooth) {
			scrollerElement.scrollTo({ top: targetScroll, behavior: 'auto' })
			scrollSpring.set(targetScroll, { hard: true })
		} else {
			scrollSpring.target = targetScroll
		}
	}

	$effect(() => {
		if (scrollerElement && !isUserScrolling) {
			scrollerElement.scrollTop = scrollSpring.current
		}
	})

	$effect(() => {
		if (activeLineIndex !== previousActiveIndex) {
			previousActiveIndex = activeLineIndex
			scrollToActiveLine()
		}
	})

	const handleManualScroll = () => {
		isUserScrolling = true
	}

	const resumeAutoScroll = () => {
		isUserScrolling = false
		scrollToActiveLine(true)
	}

	const retry = () => {
		reloadCount += 1
	}
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state z-10 m-auto flex max-w-80 flex-col items-center text-center">
		<div class="mb-6 flex size-24 items-center justify-center rounded-3xl bg-secondaryContainer text-onSecondaryContainer">
			<Icon type={icon} class="size-12 opacity-54" />
		</div>
		<div class="text-headline-sm font-bold tracking-tight">{title}</div>
		<div class="mt-3 text-body-lg text-onSurfaceVariant/80">{description}</div>
		{#if icon === 'alertCircle'}
			<Button kind="filled" class="mt-8 rounded-full px-8" onclick={retry}>
				{m.retry?.() ?? 'Try Again'}
			</Button>
		{/if}
	</div>
{/snippet}

<section 
	class="lyrics-shell"
	aria-live="polite" 
	style="--track-primary-color: {track?.primaryColor ? `rgb(${((track.primaryColor >> 16) & 0xFF)}, ${((track.primaryColor >> 8) & 0xFF)}, ${(track.primaryColor & 0xFF)})` : 'var(--color-primary)'}"
>
	<div class="ambient-glow-background"></div>
	
	{#if !track}
		{@render emptyState('musicNote', 'No Track', 'Play a track to see lyrics.')}
	{:else if loading}
		<div class="lyrics-header">
			<div class="min-w-0">
				<div class="skeleton mb-2 h-7 w-48 rounded-lg opacity-40"></div>
				<div class="skeleton h-5 w-32 rounded-md opacity-20"></div>
			</div>
		</div>
		<div class="lyrics-scroller overflow-hidden px-10 pt-12">
			{#each [75, 60, 85, 70, 90, 65, 80, 55] as width, i}
				<div 
					class="skeleton mb-12 h-16 rounded-2xl"
					style="width: {width}%; opacity: {0.3 - (i * 0.03)};"
				></div>
			{/each}
		</div>
	{:else if result?.status === 'found'}
		<div class="lyrics-header">
			<div class="min-w-0" lang={getItemLanguage(track.language)}>
				<div class="text-onSurface truncate text-title-lg font-bold tracking-tight">{track.name}</div>
				<div class="text-onSurfaceVariant truncate text-body-md font-medium">
					{formatArtists(track.artists)}
				</div>
			</div>
		</div>

		<div
			class="lyrics-scroller"
			bind:this={scrollerElement}
			onwheel={handleManualScroll}
			ontouchstart={handleManualScroll}
			role="region"
			aria-label={m.lyrics?.() ?? 'Lyrics'}
		>
			<div class="lyrics-spacer"></div>
			{#each processedLines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				{@const isPastLine = lineIndex < activeLineIndex}
				{@const distance = Math.abs(lineIndex - activeLineIndex)}

				<button
					type="button"
					class="lyric-line interactable"
					class:active={isActiveLine}
					class:past={isPastLine}
					class:secondary-line={line.isSecondaryLine}
					data-line-index={lineIndex}
					style="--line-distance: {distance}"
					onclick={() => {
						player.seek(line.startTime / 1000);
						resumeAutoScroll();
					}}
				>
					{#if isActiveLine}
						{@const activeWordIdx = getActiveWordIndex(line, currentTimeMs)}
						{#each line.words as word, wordIndex}
							{@const nextTime = line.words[wordIndex + 1]?.time ?? line.endTime}
							{@const duration = Math.max(nextTime - word.time, 1)}
							{@const isPastWord = wordIndex < activeWordIdx}
							{@const isCurrentWord = wordIndex === activeWordIdx}
							{@const wordProgress = isCurrentWord
								? Math.min(Math.max((currentTimeMs - word.time) / duration, 0), 1) * 100
								: (isPastWord ? 100 : 0)}

							<span
								class="lyric-word"
								class:secondary-word={word.isSecondary && !line.isSecondaryLine}
								style="--word-progress: {wordProgress}%"
							>{word.string}</span>{' '}
						{/each}
					{:else}
						{#each line.words as word}
							<span
								class="lyric-word"
								class:secondary-word={word.isSecondary && !line.isSecondaryLine}
								style="--word-progress: {isPastLine ? '100%' : '0%'}"
							>{word.string}</span>{' '}
						{/each}
					{/if}
				</button>
			{/each}
			<div class="lyrics-spacer"></div>
		</div>

		{#if isUserScrolling}
			<div class="lyrics-controls">
				<Button
					kind="filled"
					class="rounded-full shadow-lg"
					onclick={resumeAutoScroll}
				>
					<Icon type="chevronDown" class="mr-2 size-5" />
					Return to current line
				</Button>
			</div>
		{/if}
	{:else if result?.status === 'instrumental'}
		{@render emptyState('musicNote', 'Instrumental', 'This track is instrumental.')}
	{:else if result?.status === 'not-found'}
		{@render emptyState('musicNote', 'No lyrics available', 'We couldn’t find lyrics for this track.')}
	{:else}
		{@render emptyState('alertCircle', 'Something went wrong', 'Failed to load lyrics. Please try again.')}
	{/if}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.lyrics-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		position: relative;
		overflow: hidden;
		background: var(--color-surface);
		border-radius: var(--radius-3xl);
	}

	.ambient-glow-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			120% 120% at 50% 0%,
			color-mix(in srgb, var(--track-primary-color) 15%, transparent) 0%,
			transparent 80%
		),
		radial-gradient(
			100% 100% at 80% 100%,
			color-mix(in srgb, var(--track-primary-color) 10%, transparent) 0%,
			transparent 100%
		);
		z-index: 0;
		pointer-events: none;
		transition: background 1.5s var(--ease-standard);
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2.5rem;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			var(--color-surface) 0%,
			color-mix(in srgb, var(--color-surface) 80%, transparent) 50%,
			transparent 100%
		);
		backdrop-filter: blur(8px);
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 2.5rem;
		z-index: 5;
		
		scrollbar-width: none; 
		-ms-overflow-style: none;
		
		mask-image: linear-gradient(
			to bottom, 
			transparent 0%, 
			black 15%, 
			black 85%, 
			transparent 100%
		);
	}

	.lyrics-scroller::-webkit-scrollbar {
		display: none;
	}

	.lyrics-spacer {
		height: 40vh;
	}

	.lyric-line {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 1.25rem 0;
		margin: 0.5rem 0;
		
		font-family: var(--font-sans);
		font-size: 2.25rem;
		@media (width >= --theme(--breakpoint-sm)) { font-size: 2.75rem; }
		@media (width >= --theme(--breakpoint-lg)) { font-size: 3.5rem; }
		
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: -0.02em;
		white-space: pre-wrap;
		user-select: none; 
		
		color: var(--color-onSurface);
		opacity: calc(clamp(0.1, 1 - (var(--line-distance) * 0.25), 1));
		transform: scale(calc(clamp(0.85, 1 - (var(--line-distance) * 0.03), 1)));
		transform-origin: center left;
		cursor: pointer;

		will-change: transform, opacity;
		transition:
			opacity 0.8s var(--ease-standard),
			transform 0.8s var(--ease-standard),
			font-weight 0.4s var(--ease-standard);
	}

	.lyric-line.secondary-line {
		font-size: 1.5rem;
		@media (width >= --theme(--breakpoint-sm)) { font-size: 1.875rem; }
		@media (width >= --theme(--breakpoint-lg)) { font-size: 2.25rem; }
		padding-left: 2rem;
		margin-top: -0.5rem;
	}

	.lyric-line:hover {
		opacity: 0.8 !important;
	}

	.lyric-line.active {
		opacity: 1 !important;
		transform: scale(1.05) !important;
		font-weight: 800;
		text-shadow: 0 4px 24px color-mix(in srgb, var(--track-primary-color) 30%, transparent);
	}

	.lyric-line.secondary-line.active {
		transform: scale(1.02) !important;
	}

	/* Karaoke Fills */
	.lyric-word {
		display: inline-block;
		color: transparent;
		background-color: color-mix(in srgb, var(--color-onSurface) 20%, transparent);
		background-image: linear-gradient(var(--color-onSurface), var(--color-onSurface));
		background-size: var(--word-progress, 0%) 100%;
		background-repeat: no-repeat;
		
		background-clip: text;
		-webkit-background-clip: text;
		
		transition: background-size 100ms linear;
		will-change: background-size;
	}

	.lyric-word.secondary-word {
		font-size: 0.85em;
		opacity: 0.8;
	}

	.lyric-line.active .lyric-word {
		-webkit-text-fill-color: transparent;
		background-color: color-mix(in srgb, var(--color-onSurface) 40%, transparent);
	}

	.lyrics-controls {
		position: absolute;
		bottom: 2rem;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		z-index: 20;
		animation: fade-in 0.3s var(--ease-standard);
	}

	.skeleton {
		animation: skeleton-shimmer 2s infinite linear;
		background: linear-gradient(
			90deg,
			var(--color-surfaceContainerHighest) 0%,
			var(--color-surfaceContainer) 50%,
			var(--color-surfaceContainerHighest) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes skeleton-shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
