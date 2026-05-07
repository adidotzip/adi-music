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

	const { track, currentTimeMs }: Props = $props()
	const player = usePlayer()

	let result: SyncedLyricsResult | undefined = $state()
	let loading = $state(false)
	let scrollerElement: HTMLElement | undefined = $state()

	const foundResult = $derived(result?.status === 'found' ? result : undefined)
	const lines = $derived(foundResult?.lines ?? [])
	const activeLineIndex = $derived(getActiveLineIndex(lines, currentTimeMs))
	const sourceLabel = $derived(foundResult?.source === 'youlyplus' ? 'YoulyPlus' : 'LRCLIB')

	const getActiveWordIndex = (line: SyncedLyricsLine): number => {
		let index = -1

		for (let i = 0; i < line.words.length; i += 1) {
			const word = line.words[i]
			if (word && currentTimeMs >= word.time) {
				index = i
			} else {
				break
			}
		}

		return index
	}

	$effect(() => {
		const activeTrack = track
		result = undefined

		if (!activeTrack) {
			loading = false
			return
		}

		const controller = new AbortController()
		loading = true

		void fetchSyncedLyrics(activeTrack, controller.signal)
			.then((nextResult) => {
				if (!controller.signal.aborted) {
					result = nextResult
				}
			})
			.catch((error: unknown) => {
				if (!controller.signal.aborted) {
					console.error('Failed to load synced lyrics:', error)
					result = { status: 'error' }
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					loading = false
				}
			})

		return () => {
			controller.abort()
		}
	})

	$effect(() => {
		const lineIndex = activeLineIndex
		if (!scrollerElement || lineIndex < 0) {
			return
		}

		const activeElement = scrollerElement.querySelector<HTMLElement>(
			`[data-line-index="${lineIndex}"]`,
		)
		activeElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
	})

	const retry = (): void => {
		if (!track) {
			return
		}

		const activeTrack = track
		const controller = new AbortController()
		loading = true
		result = undefined

		void fetchSyncedLyrics(activeTrack, controller.signal)
			.then((nextResult) => {
				result = nextResult
			})
			.catch((error: unknown) => {
				console.error('Failed to load synced lyrics:', error)
				result = { status: 'error' }
			})
			.finally(() => {
				loading = false
			})
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
			<div class="rounded-full bg-surfaceContainerHighest px-3 py-1 text-label-sm text-onSurfaceVariant">
				{sourceLabel}
			</div>
		</div>

		<div class="lyrics-scroller" bind:this={scrollerElement}>
			<div class="lyrics-spacer"></div>
			{#each result.lines as line, lineIndex (lineIndex)}
				{@const isActiveLine = lineIndex === activeLineIndex}
				<button
					type="button"
					class="interactable lyric-line"
					class:active={isActiveLine}
					class:past={lineIndex < activeLineIndex}
					data-line-index={lineIndex}
					onclick={() => {
						player.seek(line.startTime / 1000)
					}}
					aria-current={isActiveLine ? 'true' : undefined}
				>
					{#each line.words as word, wordIndex (wordIndex)}
						<span
							class="lyric-word"
							class:active-word={isActiveLine && wordIndex <= getActiveWordIndex(line)}
						>
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
	@reference '../../../app.css';

	.lyrics-shell {
		position: relative;
		display: flex;
		min-height: 0;
		height: 100%;
		width: 100%;
		overflow: hidden;
		background:
			linear-gradient(
				135deg,
				--alpha(var(--color-secondaryContainer) / 86%),
				--alpha(var(--color-surfaceContainerHigh) / 74%)
			),
			var(--color-secondaryContainer);
		color: var(--color-onSecondaryContainer);
		backdrop-filter: blur(--spacing(5));
	}

	.lyrics-shell::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(
				circle at 20% 0%,
				--alpha(var(--color-primary) / 22%),
				transparent 32%
			),
			radial-gradient(
				circle at 80% 20%,
				--alpha(var(--color-tertiary) / 16%),
				transparent 30%
			);
	}

	.lyrics-header {
		position: absolute;
		z-index: 1;
		top: --spacing(4);
		left: --spacing(4);
		right: --spacing(4);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: --spacing(3);
		border-radius: var(--radius-2xl);
		background: --alpha(var(--color-surfaceContainer) / 72%);
		padding: --spacing(3) --spacing(4);
		backdrop-filter: blur(--spacing(3));
	}

	.lyrics-scroller {
		position: relative;
		z-index: 1;
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: --spacing(3);
		overflow-y: auto;
		padding: --spacing(4);
		scrollbar-gutter: stable;
		mask-image: linear-gradient(transparent, black 18%, black 82%, transparent);
	}

	.lyrics-spacer {
		min-height: 36%;
	}

	.lyric-line {
		width: 100%;
		border-radius: var(--radius-2xl);
		padding: --spacing(4);
		text-align: start;
		color: --alpha(var(--color-onSecondaryContainer) / 46%);
		font-weight: 700;
		line-height: 1.25;
		transition:
			background 180ms ease,
			color 180ms ease,
			opacity 180ms ease,
			transform 180ms ease,
			filter 180ms ease;
	}

	.lyric-line.past {
		opacity: 0.62;
	}

	.lyric-line.active {
		background: --alpha(var(--color-surfaceContainerHighest) / 70%);
		color: var(--color-onSecondaryContainer);
		filter: drop-shadow(0 --spacing(2) --spacing(5) --alpha(var(--color-primary) / 24%));
		transform: scale(1.025);
	}

	.lyric-word {
		background: linear-gradient(90deg, var(--color-primary), var(--color-tertiary));
		background-clip: text;
		-webkit-text-fill-color: currentColor;
		transition:
			-webkit-text-fill-color 140ms ease,
			text-shadow 140ms ease,
			transform 140ms ease;
	}

	.lyric-word.active-word {
		-webkit-text-fill-color: transparent;
		text-shadow: 0 0 --spacing(4) --alpha(var(--color-primary) / 28%);
	}

	@media (width >= --theme(--breakpoint-sm)) {
		.lyric-line {
			font-size: --spacing(7);
		}
	}
</style>

<script lang="ts" module>
	const getActiveLineIndex = (lines: readonly SyncedLyricsLine[], currentTimeMs: number): number => {
		let fallbackIndex = -1

		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i]
			if (!line) {
				continue
			}

			if (currentTimeMs >= line.startTime) {
				fallbackIndex = i
			}

			if (currentTimeMs >= line.startTime && currentTimeMs < line.endTime) {
				return i
			}
		}

		return fallbackIndex
	}
</script>
