<script lang="ts" module>
	import type { SyncedLyricsLine } from '$lib/lyrics/synced-lyrics.ts'

	// Define our unified item type for the scrolling list
	type LyricItem = 
		| (SyncedLyricsLine & { type: 'line'; isSecondaryLine: boolean; words: any[] })
		| { type: 'break'; startTime: number; endTime: number; id: string };

	const getActiveLineIndex = (
		items: readonly LyricItem[],
		currentTimeMs: number,
	): number => {
		let index = -1
		for (let i = 0; i < items.length; i += 1) {
			if (currentTimeMs >= items[i].startTime) {
				index = i
			} else {
				break
			}
		}
		return index
	}
</script>

<script lang="ts">
	import { spring } from 'svelte/motion'
	import Button from '$lib/components/Button.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import { formatArtists, getItemLanguage } from '$lib/helpers/utils/text.ts'
	import type { TrackData } from '$lib/library/get/value.ts'
	import {
		fetchSyncedLyrics,
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
	let containerElement: HTMLElement | undefined = $state()
	let contentElement: HTMLElement | undefined = $state()
	let reloadCount = $state(0)
	let isUserScrolling = $state(false)
	let userScrollTimeout: ReturnType<typeof setTimeout>

	// ─── Motion & Physics ───────────────────────────────────────────────────
	// Slightly tighter damping for that snappy Apple Music feel
	const scrollOffset = spring(0, {
		stiffness: 0.08,
		damping: 0.6, 
	})

	// ─── RAF-driven smooth time ───────────────────────────────────────────────
	let smoothTimeMs = $state(0)
	let lastPropTime = $state(0)
	let lastRafTimestamp: number | undefined

	$effect(() => {
		lastPropTime = currentTimeMs
		if (lastRafTimestamp === undefined) {
			smoothTimeMs = currentTimeMs
		}
		lastRafTimestamp = undefined
	})

	$effect(() => {
		let running = true
		const tick = (now: number) => {
			if (!running) return
			if (lastRafTimestamp === undefined) {
				lastRafTimestamp = now
				smoothTimeMs = lastPropTime
			} else {
				const elapsed = now - lastRafTimestamp
				lastRafTimestamp = now
				if (player.playing) {
					smoothTimeMs += elapsed
				} else {
					smoothTimeMs = lastPropTime
				}
			}
			requestAnimationFrame(tick)
		}
		const rafId = requestAnimationFrame(tick)
		return () => {
			running = false
			cancelAnimationFrame(rafId)
		}
	})

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])

	// ─── Process Lyrics & Inject Breaks ─────────────────────────────────────
	const processedItems = $derived.by(() => {
		const items: LyricItem[] = []
		
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i]

			// Inject 3-dots break if gap is > 3.5 seconds
			if (i > 0) {
				const prevLine = lines[i - 1]
				const gap = line.startTime - prevLine.endTime
				if (gap > 3500) {
					items.push({
						type: 'break',
						startTime: prevLine.endTime,
						endTime: line.startTime,
						id: `break-${i}`
					})
				}
			}

			// Parse secondary words inside ()
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
				// Clean up the brackets for display if desired, or leave them
				return { ...word, isSecondary: isWordSecondary }
			})
			
			const lineText = words.map((w) => w.string).join('').trim()
			const isSecondaryLine = lineText.startsWith('(') && lineText.endsWith(')')
			
			items.push({ 
				type: 'line', 
				...line, 
				words, 
				isSecondaryLine 
			})
		}
		return items
	})

	const activeLineIndex = $derived(getActiveLineIndex(processedItems, smoothTimeMs))

	const getActiveWordIndex = (line: any, timeMs: number): number => {
		for (let i = line.words.length - 1; i >= 0; i -= 1) {
			if (timeMs >= line.words[i].time) return i
		}
		return -1
	}

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

	const updateScrollPosition = (immediate = false) => {
		if (!containerElement || !contentElement || activeLineIndex < 0) return
		const activeEl = contentElement.querySelector<HTMLElement>(
			`[data-line-index="${activeLineIndex}"]`,
		)
		if (!activeEl) return

		const containerHeight = containerElement.offsetHeight
		const lineTop = activeEl.offsetTop
		const lineHeight = activeEl.offsetHeight

		// Target position to keep line vertically centered
		const target = (containerHeight / 2) - lineTop - (lineHeight / 2)

		scrollOffset.set(target, { hard: immediate })
	}

	$effect(() => {
		if (!isUserScrolling) {
			updateScrollPosition()
		}
	})

	$effect(() => {
		const handleResize = () => updateScrollPosition(true)
		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	})

	const handleUserInteraction = () => {
		isUserScrolling = true
		clearTimeout(userScrollTimeout)
		userScrollTimeout = setTimeout(() => {
			isUserScrolling = false
		}, 4000)
	}

	let lastTouchY = 0
	const handleTouchStart = (e: TouchEvent) => {
		lastTouchY = e.touches[0].clientY
		handleUserInteraction()
	}

	const handleTouchMove = (e: TouchEvent) => {
		const touchY = e.touches[0].clientY
		const deltaY = lastTouchY - touchY
		lastTouchY = touchY
		scrollOffset.update(v => v - deltaY, { hard: true })
	}

	const retry = () => { reloadCount += 1 }
</script>

{#snippet emptyState(icon: 'musicNote' | 'alertCircle', title: string, description: string)}
	<div class="empty-state z-10 m-auto flex max-w-80 flex-col items-center text-center">
		</div>
{/snippet}

<section class={["lyrics-shell w-full", className]} aria-live="polite">
	{#if player.artworkSrc}
		<div class="lyrics-background">
			<img src={player.artworkSrc} alt="" class="bg-image" />
			<div class="bg-overlay"></div>
		</div>
	{/if}

	{#if !track}
		{@render emptyState('musicNote', 'No Track', 'Play a track to see lyrics.')}
	{:else if loading}
		{:else if result?.status === 'found'}
		<div
			class="lyrics-container"
			role="region"
			aria-label="Lyrics"
			bind:this={containerElement}
			onwheel={(e) => {
				handleUserInteraction()
				scrollOffset.update(v => v - e.deltaY, { hard: true })
			}}
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
		>
			<div
				class="lyrics-content mx-auto w-full max-w-200"
				bind:this={contentElement}
				style="transform: translateY({$scrollOffset}px)"
			>
				{#each processedItems as item, itemIndex (item.type === 'break' ? item.id : itemIndex)}
					{@const isActiveLine = itemIndex === activeLineIndex}
					{@const distance = Math.abs(itemIndex - activeLineIndex)}

					{#if item.type === 'break'}
						<div
							class="lyric-item lyric-break"
							class:active={isActiveLine}
							class:past={itemIndex < activeLineIndex}
							data-line-index={itemIndex}
							style="--distance: {distance}"
						>
							<div class="dots-container">
								<span class="dot"></span>
								<span class="dot"></span>
								<span class="dot"></span>
							</div>
						</div>
					{:else}
						{@const activeWordIdx = isActiveLine ? getActiveWordIndex(item, smoothTimeMs) : -1}
						
						<button
							type="button"
							class="lyric-item lyric-line interactable"
							class:active={isActiveLine}
							class:past={itemIndex < activeLineIndex}
							class:secondary-line={item.isSecondaryLine}
							data-line-index={itemIndex}
							style="--distance: {distance}"
							onclick={() => {
								player.seek(item.startTime / 1000)
								isUserScrolling = false
								updateScrollPosition()
							}}
						>
							{#each item.words as word, wordIndex}
								{@const isPastWord = isActiveLine && wordIndex < activeWordIdx}
								{@const isCurrentWord = isActiveLine && wordIndex === activeWordIdx}
								{@const nextTime = item.words[wordIndex + 1]?.time ?? item.endTime}
								{@const duration = Math.max(nextTime - word.time, 1)}
								{@const wordProgress = isCurrentWord
									? Math.min(Math.max((smoothTimeMs - word.time) / duration, 0), 1) * 100
									: isPastWord ? 100 : 0}

								<span
									class="lyric-word"
									class:past-word={isPastWord}
									class:secondary-word={word.isSecondary}
									style="--word-progress: {wordProgress}%"
								>{word.string}</span>
							{/each}
						</button>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</section>

<style lang="postcss">
	@reference "../../../app.css";

	/* ... Maintain your shell and bg-image styles ... */
	
	.lyrics-content {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		padding: 0 1.5rem;
		padding-bottom: calc(env(safe-area-inset-bottom) + 50vh);
		will-change: transform;
	}

	/* Unified item spacing and transition basis */
	.lyric-item {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		margin: 0;
		padding: 1.25rem 0; /* Tighter padding, visual gap handled by scale */
		transform-origin: left center;
		will-change: transform, opacity, filter;
		
		/* The Apple Music math: farther away = smaller, blurrier, more transparent */
		opacity: calc(0.25 / (1 + var(--distance) * 0.5));
		transform: scale(calc(1 - var(--distance) * 0.05));
		filter: blur(calc(var(--distance) * 2.5px));
		
		transition:
			opacity 0.7s cubic-bezier(0.25, 1, 0.5, 1),
			transform 0.7s cubic-bezier(0.25, 1, 0.5, 1),
			filter 0.7s cubic-bezier(0.25, 1, 0.5, 1);
	}

	/* Text specifics */
	.lyric-line {
		font-family: var(--font-sans);
		font-size: 2.25rem;
		@media (min-width: 640px) { font-size: 2.75rem; }
		@media (min-width: 1024px) { font-size: 3.5rem; }
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.03em;
		white-space: pre-wrap;
		color: #fff;
		cursor: pointer;
	}

	.lyric-item.active {
		opacity: 1;
		transform: scale(1);
		filter: blur(0);
	}

	.lyric-item.past {
		/* Past lines fade out faster than upcoming lines */
		opacity: calc(0.15 / (1 + var(--distance) * 0.75));
	}


	.lyric-line.secondary-line {
		font-size: 1.75rem;
		@media (min-width: 1024px) { font-size: 2.5rem; }
		font-weight: 700;
		color: rgba(255, 255, 255, 0.7);
	}

	.lyric-word.secondary-word {
		font-size: 0.85em; /* Scale down words inside parens inline */
		color: rgba(255, 255, 255, 0.75);
	}


	.lyric-word {
		display: inline-block;
		position: relative;
		margin-right: 0.15em;
	}

	.lyric-line.active .lyric-word {
		background: linear-gradient(
			to right,
			#ffffff calc(var(--word-progress) - 10%),
			rgba(255, 255, 255, 0.3) calc(var(--word-progress) + 10%)
		);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		transition: none;
	}

	/* Ensure active secondary words dim slightly less intensely than main words */
	.lyric-line.active .lyric-word.secondary-word {
		background: linear-gradient(
			to right,
			rgba(255, 255, 255, 0.85) calc(var(--word-progress) - 10%),
			rgba(255, 255, 255, 0.2) calc(var(--word-progress) + 10%)
		);
		-webkit-background-clip: text;
		background-clip: text;
	}


	.lyric-break {
		display: flex;
		align-items: center;
		padding: 2.5rem 0;
	}

	.dots-container {
		display: flex;
		gap: 0.5rem;
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.4);
		transition: background-color 0.3s ease;
	}

	/* When the break is active, animate the dots pulsing left to right */
	.lyric-break.active .dot {
		background-color: rgba(255, 255, 255, 0.9);
		animation: pulse-dot 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1);
	}

	.lyric-break.active .dot:nth-child(1) { animation-delay: 0s; }
	.lyric-break.active .dot:nth-child(2) { animation-delay: 0.2s; }
	.lyric-break.active .dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes pulse-dot {
		0%, 100% { transform: scale(1); opacity: 0.5; }
		50% { transform: scale(1.3); opacity: 1; text-shadow: 0 0 10px white; }
	}
</style>
