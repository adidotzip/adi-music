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

	// Premium Fluid Scroll Animation Logic
	let animationFrameId: number | undefined

	const scrollToActiveLine = (smooth = true) => {
		if (!scrollerElement || activeLineIndex < 0) return

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
			const duration = 850 
			let startTime: number | null = null

			const animate = (timestamp: DOMHighResTimeStamp) => {
				if (!startTime) startTime = timestamp
				const timeElapsed = timestamp - startTime
				let progress = Math.min(timeElapsed / duration, 1)

				const ease = 1 - Math.pow(1 - progress, 4)

				if (scrollerElement) {
					scrollerElement.scrollTop = startScroll + distance * ease
				}

				if (progress < 1) {
					animationFrameId = requestAnimationFrame(animate)
				}
			}

			if (animationFrameId) cancelAnimationFrame(animationFrameId)
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

	const retry = () => {
		reloadCount += 1
	}
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state z-10 m-auto flex max-w-80 flex-col items-center text-center">
		<Icon type={icon} class="color-onSecondaryContainer mb-4 size-24 opacity-54" />
		<div class="text-title-md font-bold">{title}</div>
		<div class="mt-2 text-body-md text-onSecondaryContainer/72">{description}</div>
		{#if icon === 'alertCircle'}
			<Button kind="outlined" class="mt-6" onclick={retry}>{m.reload()}</Button>
		{/if}
	</div>
{/snippet}

<section 
	class="lyrics-shell card" 
	aria-live="polite" 
	style="--primary-color: {track?.primaryColor ? `rgb(${((track.primaryColor >> 16) & 0xFF)}, ${((track.primaryColor >> 8) & 0xFF)}, ${(track.primaryColor & 0xFF)})` : 'var(--color-primary, #D0BCFF)'}"
>
	<div class="ambient-glow-background"></div>
	
	{#if !track}
		{@render emptyState('musicNote', 'No Track', 'Play a track to see lyrics.')}
	{:else if loading}
		<div class="lyrics-header">
			<div class="min-w-0">
				<div class="skeleton bg-surfaceContainerHighest mb-2 h-7 w-36 rounded-md"></div>
				<div class="skeleton bg-surfaceContainerHighest h-5 w-28 rounded-md opacity-70"></div>
			</div>
		</div>
		<div class="lyrics-scroller overflow-hidden px-6 pt-12">
			{#each Array(6) as _, i}
				<div 
					class="skeleton bg-surfaceContainerHighest mb-10 h-14 rounded-xl opacity-20"
					style="width: {60 + Math.random() * 30}%; transform: translateX({i % 2 === 0 ? '0' : '5%'})"
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
			<div class="source-badge">
				{sourceLabel}
			</div>
		</div>

		<div class="lyrics-scroller" bind:this={scrollerElement}>
			<div class="lyrics-spacer"></div>
			{#each processedLines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				{@const activeWordIdx = getActiveWordIndex(line, currentTimeMs)}

				<button
					type="button"
					class="lyric-line interactable"
					class:active={isActiveLine}
					class:past={lineIndex < activeLineIndex}
					class:secondary-line={line.isSecondaryLine}
					data-line-index={lineIndex}
					onclick={() => {
						player.seek(line.startTime / 1000);
					}}
				>
					{#each line.words as word, wordIndex}
						{@const isPastWord = isActiveLine && wordIndex < activeWordIdx}
						{@const isCurrentWord = isActiveLine && wordIndex === activeWordIdx}
						{@const nextTime = line.words[wordIndex + 1]?.time ?? line.endTime}
						{@const duration = Math.max(nextTime - word.time, 1)}
						{@const wordProgress = isCurrentWord 
							? Math.min(Math.max((currentTimeMs - word.time) / duration, 0), 1) * 100 
							: (isPastWord ? 100 : 0)}
						
						<span 
							class="lyric-word" 
							class:active-word={isCurrentWord}
							class:secondary-word={word.isSecondary && !line.isSecondaryLine}
							style="--word-progress: {wordProgress}%"
						>{word.string}</span>{' '}
					{/each}
				</button>
			{/each}
			<div class="lyrics-spacer"></div>
		</div>
	{:else if result?.status === 'instrumental'}
		{@render emptyState('musicNote', 'Instrumental', 'This track is instrumental.')}
	{:else if result?.status === 'not-found'}
		{@render emptyState('musicNote', 'Not Found', 'Could not find lyrics for this track.')}
	{:else}
		{@render emptyState('alertCircle', 'Failed', 'Failed to load lyrics.')}
	{/if}
</section>

<style lang="postcss">
	.lyrics-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 850px;
		position: relative;
		overflow: hidden;
		background: var(--color-surface, #000000); 
		border-radius: 1.75rem; 
		box-shadow: 0 12px 48px rgba(0,0,0,0.4);
	}

	.ambient-glow-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			100% 100% at 50% -10%,
			color-mix(in srgb, var(--primary-color) 30%, transparent) 0%,
			transparent 80%
		),
		radial-gradient(
			80% 120% at 50% 120%,
			color-mix(in srgb, var(--primary-color) 20%, transparent) 0%,
			transparent 100%
		);
		filter: blur(40px); 
		z-index: 0;
		pointer-events: none;
		transition: background 1.5s ease;
		animation: subtle-drift 12s infinite alternate ease-in-out;
		will-change: opacity, transform;
	}

	@keyframes subtle-drift {
		0% { opacity: 0.7; transform: scale(1) translateY(0); }
		100% { opacity: 1; transform: scale(1.05) translateY(-2%); }
	}

	.lyrics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 2.5rem;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--color-surface, #000) 80%, transparent) 10%,
			transparent 100%
		);
	}

	.source-badge {
		background: color-mix(in srgb, var(--primary-color) 15%, var(--color-surfaceContainerHighest, #222));
		color: var(--primary-color);
		padding: 0.375rem 0.875rem;
		border-radius: 999px; 
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		backdrop-filter: blur(12px);
		border: 1px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 2.5rem;
		scroll-behavior: auto; 
		z-index: 5;
		
		scrollbar-width: none; 
		-ms-overflow-style: none;
		
		mask-image: linear-gradient(
			to bottom, 
			transparent 0%, 
			black 20%, 
			black 80%, 
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to bottom, 
			transparent 0%, 
			black 20%, 
			black 80%, 
			transparent 100%
		);
		will-change: scroll-position;
	}

	.lyrics-scroller::-webkit-scrollbar {
		display: none;
	}

	.lyrics-spacer {
		height: 45vh;
	}

	/* --- PREMIUM APPLE-STYLE TYPOGRAPHY --- */

	.lyric-line {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 1rem 0;
		margin: 0.5rem 0;
		
		font-family: var(--font-family-sans, system-ui, -apple-system, sans-serif);
		font-size: 2.25rem;
		@media (min-width: 640px) { font-size: 2.5rem; }
		@media (min-width: 1024px) { font-size: 3.25rem; }
		
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.03em;
		white-space: pre-wrap;
		user-select: none; 
		
		color: var(--color-onSurfaceVariant, #a0a0a0);
		opacity: 0.25;
		filter: blur(3px);
		transform: scale(0.9) translate3d(0, 15px, 0); 
		transform-origin: center left;
		cursor: pointer;

		will-change: transform, opacity, filter;

		transition:
			opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1),
			transform 0.8s cubic-bezier(0.25, 1, 0.5, 1),
			filter 0.8s cubic-bezier(0.25, 1, 0.5, 1);
	}

	/* Secondary Lines Styling */
	.lyric-line.secondary-line {
		font-size: 1.5rem;
		@media (min-width: 640px) { font-size: 1.75rem; }
		@media (min-width: 1024px) { font-size: 2.25rem; }
		padding-left: 2rem;
		margin-top: -0.25rem; /* Tucks the backing vocals closer to the main line */
	}

	.lyric-line:hover {
		opacity: 0.6;
		filter: blur(1px);
		transform: scale(0.95) translate3d(0, 5px, 0);
	}

	.lyric-line.active {
		color: var(--color-onSurface, #ffffff);
		opacity: 1;
		filter: blur(0px);
		transform: scale(1) translate3d(0, 0, 0);
		font-weight: 800;
		text-shadow: 0 12px 40px color-mix(in srgb, var(--primary-color) 35%, transparent);
	}

	.lyric-line.secondary-line.active {
		opacity: 0.85; /* Keep backing vocals slightly muted even when active */
		text-shadow: 0 8px 30px color-mix(in srgb, var(--primary-color) 25%, transparent);
	}

	.lyric-line.past {
		opacity: 0.15;
		filter: blur(5px);
		transform: scale(0.85) translate3d(0, -20px, 0);
	}

	/* Elegant Text Fills */
	.lyric-word {
		display: inline-block;
		color: transparent;
		background-color: var(--color-onSurfaceVariant, #555);
		background-image: linear-gradient(var(--color-onSurface, #fff), var(--color-onSurface, #fff));
		background-size: 0% 100%;
		background-repeat: no-repeat;
		
		background-clip: text;
		-webkit-background-clip: text;
		transform-origin: bottom left;
	}

	/* Secondary Word Styling for inline lyrics */
	.lyric-word.secondary-word {
		font-size: 0.8em;
		opacity: 0.8;
	}

	.lyric-line.active .lyric-word {
		background-size: var(--word-progress, 0%) 100%;
		-webkit-text-fill-color: transparent;
	}

	/* Skeleton Loaders */
	.skeleton {
		animation: ambient-shimmer 2.5s infinite ease-in-out;
		background: linear-gradient(
			90deg,
			var(--color-surfaceContainerHighest, #222) 0%,
			var(--color-surfaceContainer, #333) 50%,
			var(--color-surfaceContainerHighest, #222) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes ambient-shimmer {
		0% { background-position: -200% 0; }
		100% { background-position: 200% 0; }
	}
</style>
