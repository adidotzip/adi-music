import type { SyncedLyricsLine } from '$lib/lyrics/synced-lyrics.ts'

export type LyricItem =
    | (SyncedLyricsLine & { type: 'line'; isSecondaryLine: boolean; words: any[] })
    | { type: 'break'; startTime: number; endTime: number; id: string };

export const getActiveLineIndex = (
    items: readonly LyricItem[],
    currentTimeMs: number,
): number => {
    let index = -1
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        if (item && currentTimeMs >= item.startTime) {
            index = i
        } else {
            break
        }
    }
    return index
}
