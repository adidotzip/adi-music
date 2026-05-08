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
		class?: string
	}

	let { track, currentTimeMs, class: className }: Props = $props()
	const player = usePlayer()

	let result: SyncedLyricsResult | undefined = $state()
	let loading = $state(false)
	let scrollerElement: HTMLElement | undefined = $state()
	let reloadCount = $state(0)
	let isUserScrolling = $state(false)
	let isProgrammaticScroll = false
	let userScrollTimeout: ReturnType<typeof setTimeout>
	
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

	// Premium hardware-accelerated smooth scrolling
	const scrollToActiveLine = (smooth = true) => {
		if (!scrollerElement || activeLineIndex < 0) return

		const activeEl = scrollerElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) return

		const targetScroll =
			activeEl.offsetTop -
			scrollerElement.offsetHeight / 2 +
			activeEl.offsetHeight / 2

		isProgrammaticScroll = true
		scrollerElement.scrollTo({
			top: targetScroll,
			behavior: smooth ? 'smooth' : 'auto'
		})
	}

	$effect(() => {
		if (activeLineIndex !== previousActiveIndex) {
			previousActiveIndex = activeLineIndex
			if (!isUserScrolling) {
				scrollToActiveLine()
			}
		}
	})

	const retry = () => {
		reloadCount += 1
	}

	const handleScroll = () => {
		if (isProgrammaticScroll) {
			isProgrammaticScroll = false
			return
		}

		isUserScrolling = true
		clearTimeout(userScrollTimeout)
		userScrollTimeout = setTimeout(() => {
			isUserScrolling = false
		}, 3000)
	}
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state z-10 m-auto flex max-w-80 flex-col items-center text-center">
		<div class="mb-6 flex size-24 items-center justify-center rounded-full bg-secondaryContainer/30">
			<Icon type={icon} class="color-onSecondaryContainer size-12 opacity-50" />
		</div>
		<div class="text-headline-sm font-bold tracking-tight">{title}</div>
		<div class="mt-3 text-body-lg text-onSecondaryContainer/60">{description}</div>
		{#if icon === 'alertCircle'}
			<Button kind="outlined" class="mt-8 rounded-full px-8" onclick={retry}>Retry</Button>
		{/if}
	</div>
{/snippet}

<section 
	class={["lyrics-shell w-full", className]}
	aria-live="polite" 
	style="--primary-color: {track?.primaryColor ? `rgb(${((track.primaryColor >> 16) & 0xFF)}, ${((track.primaryColor >> 8) & 0xFF)}, ${(track.primaryColor & 0xFF)})` : 'var(--color-primary)'}"
>
	<div class="ambient-glow-background"></div>
	
	{#if !track}
		{@render emptyState('musicNote', 'No Track', 'Play a track to see lyrics.')}
	{:else if loading}
		<div class="lyrics-header">
			<div class="min-w-0">
				<div class="skeleton mb-2 h-7 w-36 rounded-md"></div>
				<div class="skeleton h-5 w-28 rounded-md opacity-70"></div>
			</div>
		</div>
		<div class="lyrics-scroller overflow-hidden px-6 pt-12">
			{#each Array(6) as _, i}
				<div 
					class="skeleton mb-10 h-14 rounded-xl opacity-20"
					style="width: {60 + Math.random() * 30}%; transform: translateX({i % 2 === 0 ? '0' : '5%'})"
				></div>
			{/each}
		</div>
	{:else if result?.status === 'found'}
		<div class="lyrics-scroller" bind:this={scrollerElement} onscroll={handleScroll}>
			<div class="lyrics-spacer"></div>
			<div class="lyrics-content mx-auto w-full max-w-200">
			{#each processedLines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				{@const activeWordIdx = getActiveWordIndex(line, currentTimeMs)}
				{@const distance = Math.abs(lineIndex - activeLineIndex)}

				<button
					type="button"
					class="lyric-line interactable"
					class:active={isActiveLine}
					class:past={lineIndex < activeLineIndex}
					class:secondary-line={line.isSecondaryLine}
					data-line-index={lineIndex}
					style="--distance: {distance}"
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
			</div>
			<div class="lyrics-spacer"></div>
		</div>
	{:else if result?.status === 'instrumental'}
		{@render emptyState('musicNote', 'Instrumental', 'This track is instrumental.')}
	{:else if result?.status === 'not-found'}
		{@render emptyState('musicNote', 'Not Found', 'Could not find lyrics for this track.')}
	{:else}
		{@render emptyState('alertCircle', 'Failed', 'Failed to load lyrics.')}
	{/if}
	{#if isUserScrolling}
		<button
			class="return-to-active-btn"
			onclick={() => {
				isUserScrolling = false;
				scrollToActiveLine();
			}}
		>
			<Icon type="chevronDown" class="mr-2 size-5" />
			Return to current line
		</button>
	{/if}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.lyrics-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		position: relative;
		overflow: hidden;
		background: transparent;
		animation: fade-in 0.8s var(--ease-standard);
	}

	.ambient-glow-background {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			140% 140% at 50% 0%,
			color-mix(in srgb, var(--primary-color) 25%, transparent) 0%,
			transparent 100%
		),
		radial-gradient(
			120% 120% at 50% 100%,
			color-mix(in srgb, var(--primary-color) 15%, transparent) 0%,
			transparent 100%
		);
		filter: blur(80px);
		z-index: 0;
		pointer-events: none;
		transition: background 1.5s ease;
		animation: subtle-drift 20s infinite alternate ease-in-out;
		will-change: opacity, transform;
	}

	@keyframes subtle-drift {
		0% { opacity: 0.5; transform: scale(1) translateY(0); }
		100% { opacity: 0.8; transform: scale(1.15) translateY(-3%); }
	}

	.lyrics-scroller {
		flex: 1;
		overflow-y: auto;
		padding: 0 1rem;
		@media (min-width: 640px) { padding: 0 2rem; }
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
		-webkit-mask-image: linear-gradient(
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
		height: 45vh;
	}

	.return-to-active-btn {
		position: absolute;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		display: flex;
		align-items: center;
		padding: 0.75rem 1.25rem;
		background: var(--color-primary);
		color: var(--color-onPrimary);
		border: none;
		border-radius: 2rem;
		font-weight: 600;
		font-size: 0.875rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		cursor: pointer;
		transition: transform 0.2s var(--ease-standard), background 0.2s var(--ease-standard);
		animation: fade-in 0.3s ease-out;
	}

	.return-to-active-btn:hover {
		transform: translateX(-50%) scale(1.05);
		background: color-mix(in srgb, var(--color-primary) 90%, white);
	}

	.return-to-active-btn:active {
		transform: translateX(-50%) scale(0.95);
	}

	/* --- CLEAN, PERFORMANCE-OPTIMIZED TYPOGRAPHY --- */

	.lyric-line {
		display: block;
		width: 100%;
		text-align: center;
		background: transparent;
		border: none;
		padding: 1rem 0;
		margin: 0.5rem 0;
		contain: content;
		
		font-family: var(--font-sans);
		font-size: 1.75rem;
		@media (min-width: 640px) { font-size: 2rem; }
		@media (min-width: 1024px) { font-size: 2.5rem; }
		
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.03em;
		white-space: pre-wrap;
		user-select: none; 
		
		color: var(--color-onSurfaceVariant);
		opacity: calc(0.3 / (1 + var(--distance) * 0.2));
		transform: scale(calc(1 - var(--distance) * 0.025));
		transform-origin: center;
		cursor: pointer;

		will-change: transform, opacity;
		transition:
			opacity 0.8s var(--ease-standard),
			transform 0.8s var(--ease-standard),
			filter 0.8s var(--ease-standard);
	}

	.lyric-line.secondary-line {
		font-size: 1.25rem;
		@media (min-width: 640px) { font-size: 1.5rem; }
		@media (min-width: 1024px) { font-size: 1.75rem; }
		margin-top: -0.5rem;
		font-weight: 600;
	}

	.lyric-line:hover {
		opacity: 0.6;
		transform: scale(0.98);
	}

	.lyric-line.active {
		color: var(--color-onSurface);
		opacity: 1;
		transform: scale(1.05);
		font-weight: 800;
		text-shadow: 0 0 24px color-mix(in srgb, var(--primary-color) 40%, transparent);
	}

	.lyric-line.secondary-line.active {
		opacity: 0.9;
		transform: scale(1.02);
	}

	.lyric-line.past {
		opacity: 0.15;
		transform: scale(0.92);
		filter: blur(1px);
	}

	/* Karaoke Fills */
	.lyric-word {
		display: inline-block;
		color: transparent;
		background-color: var(--color-onSurfaceVariant);
		background-image: linear-gradient(var(--color-onSurface), var(--color-onSurface));
		background-size: 0% 100%;
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
		background-size: var(--word-progress, 0%) 100%;
		-webkit-text-fill-color: transparent;
	}

	.skeleton {
		animation: ambient-shimmer 3s infinite ease-in-out;
		background: linear-gradient(
			90deg,
			var(--color-surfaceContainerHighest) 0%,
			var(--color-surfaceContainerHigh) 50%,
			var(--color-surfaceContainerHighest) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes ambient-shimmer {
		0% { background-position: -200% 0; }
		100% { background-position: 200% 0; }
	}
</style>
