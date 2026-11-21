/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { create } from 'zustand';

/**
 * Everything the app keeps on the device to work without the server:
 * - "responses": the last answer of the server to each query, replayed when the server cannot be reached
 * - "chapters": the chapters the user saved to the device (their images live in the Cache API, they never expire)
 */

const DB_NAME = 'tsundoku-offline';
const RESPONSES_STORE = 'responses';
const CHAPTERS_STORE = 'chapters';
const PROGRESS_STORE = 'progress';
const PAGE_CACHE_NAME = 'offline-chapter-pages';
// chapter pages are requested by their path, which is unique per manga, chapter and page
const CHAPTER_PAGE_PATH = /\/chapter\/[0-9]+\/page\/[0-9]+/;

const MAX_STORED_RESPONSES = 400;
const MAX_RESPONSE_CHARACTERS = 4_000_000;
const PRUNE_EVERY_N_WRITES = 25;
// pages of a chapter that the server still has to get from its source: gently, so the source is not flooded
const PAGE_DOWNLOAD_CONCURRENCY = 3;
// pages of a chapter that is downloaded on the server: they are read from its disk, the source is not asked at all
const PAGE_DOWNLOAD_CONCURRENCY_FROM_SERVER_DISK = 8;

export const getPageDownloadConcurrency = (isDownloadedOnServer: boolean | undefined): number =>
    isDownloadedOnServer ? PAGE_DOWNLOAD_CONCURRENCY_FROM_SERVER_DISK : PAGE_DOWNLOAD_CONCURRENCY;

/** What is needed to list a saved chapter and open it in the reader while the server cannot be asked. */
export type SavedChapterInfo = {
    mangaTitle?: string;
    chapterName?: string;
    sourceOrder?: number;
};

export type SavedChapter = SavedChapterInfo & {
    chapterId: number;
    mangaId: number;
    pagePaths: string[];
    bytes: number;
    savedAt: number;
};

type StoredResponse = { key: string; result: unknown; savedAt: number };

export type ReadingProgress = { isRead?: boolean | null; lastPageRead?: number | null; lastPageOffset?: number | null };

/** the latest reading progress of a chapter that was made without the server and is not sent to it yet */
export type QueuedProgress = {
    chapterId: number;
    patch: ReadingProgress;
    // the tracker of the manga is updated when the progress is sent
    trackProgressMangaId?: number;
    queuedAt: number;
};

const useSavedChaptersStore = create<{ chapters: Record<number, SavedChapter> }>(() => ({ chapters: {} }));

let dbPromise: Promise<IDBDatabase> | undefined;

const openDb = (): Promise<IDBDatabase> => {
    dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(RESPONSES_STORE)) {
                db.createObjectStore(RESPONSES_STORE, { keyPath: 'key' }).createIndex('savedAt', 'savedAt');
            }
            if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
                db.createObjectStore(CHAPTERS_STORE, { keyPath: 'chapterId' });
            }
            if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
                db.createObjectStore(PROGRESS_STORE, { keyPath: 'chapterId' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = undefined;
            reject(request.error);
        };
    });

    return dbPromise;
};

const run = async <T>(
    storeName: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
    const db = await openDb();

    return new Promise((resolve, reject) => {
        const request = action(db.transaction(storeName, mode).objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const getPagePath = (url: string): string | null => {
    try {
        const { pathname } = new URL(url, window.location.origin);

        return CHAPTER_PAGE_PATH.test(pathname) ? pathname : null;
    } catch {
        return null;
    }
};

// the Cache API needs a url, this one never leaves the device
const getPageCacheRequest = (path: string): Request => new Request(`${window.location.origin}/__offline__${path}`);

export const useSavedChapters = (): Record<number, SavedChapter> => useSavedChaptersStore((state) => state.chapters);

export const useIsChapterSaved = (chapterId: number): boolean =>
    useSavedChaptersStore((state) => !!state.chapters[chapterId]);

export class OfflineStorage {
    private static writesSincePrune = 0;

    static isSupported(): boolean {
        return typeof indexedDB !== 'undefined' && typeof caches !== 'undefined';
    }

    static isChapterSaved(chapterId: number): boolean {
        return !!useSavedChaptersStore.getState().chapters[chapterId];
    }

    static async loadSavedChapters(): Promise<void> {
        try {
            const saved = await run<SavedChapter[]>(CHAPTERS_STORE, 'readonly', (store) => store.getAll());
            useSavedChaptersStore.setState({ chapters: Object.fromEntries(saved.map((s) => [s.chapterId, s])) });
        } catch {
            // no storage available: nothing is saved
        }
    }

    static async getResponse(key: string): Promise<any | undefined> {
        try {
            const stored = await run<StoredResponse | undefined>(RESPONSES_STORE, 'readonly', (store) =>
                store.get(key),
            );

            return stored?.result;
        } catch {
            return undefined;
        }
    }

    static async putResponse(key: string, result: unknown): Promise<void> {
        try {
            // a huge answer (e.g. a whole extension list) is not worth the space
            if (JSON.stringify(result).length > MAX_RESPONSE_CHARACTERS) {
                return;
            }

            await run(RESPONSES_STORE, 'readwrite', (store) =>
                store.put({ key, result, savedAt: Date.now() } satisfies StoredResponse),
            );

            OfflineStorage.writesSincePrune += 1;
            if (OfflineStorage.writesSincePrune >= PRUNE_EVERY_N_WRITES) {
                OfflineStorage.writesSincePrune = 0;
                await OfflineStorage.pruneResponses();
            }
        } catch {
            // storing is best effort
        }
    }

    /** keeps the most recently stored answers */
    private static async pruneResponses(): Promise<void> {
        const count = await run(RESPONSES_STORE, 'readonly', (store) => store.count());
        let toRemove = count - MAX_STORED_RESPONSES;
        if (toRemove <= 0) {
            return;
        }

        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(RESPONSES_STORE, 'readwrite');
            const cursorRequest = transaction.objectStore(RESPONSES_STORE).index('savedAt').openCursor();
            cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (cursor && toRemove > 0) {
                    cursor.delete();
                    toRemove -= 1;
                    cursor.continue();
                }
            };
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    static async clearResponses(): Promise<void> {
        try {
            await run(RESPONSES_STORE, 'readwrite', (store) => store.clear());
        } catch {
            // nothing stored
        }
    }

    /** Everything kept for the account that was signed in: its answers and the progress that was not sent yet. */
    static async clearAccountData(): Promise<void> {
        await OfflineStorage.clearResponses();
        try {
            await run(PROGRESS_STORE, 'readwrite', (store) => store.clear());
        } catch {
            // nothing queued
        }
    }

    /** Keeps the newest values per chapter: reading on offline overwrites the page, it does not add up. */
    static async queueProgress(
        chapterIds: number[],
        patch: ReadingProgress,
        trackProgressMangaId?: number,
    ): Promise<void> {
        await Promise.all(
            chapterIds.map(async (chapterId) => {
                const existing = await run<QueuedProgress | undefined>(PROGRESS_STORE, 'readonly', (store) =>
                    store.get(chapterId),
                );

                await run(PROGRESS_STORE, 'readwrite', (store) =>
                    store.put({
                        chapterId,
                        patch: { ...existing?.patch, ...patch },
                        trackProgressMangaId: trackProgressMangaId ?? existing?.trackProgressMangaId,
                        queuedAt: Date.now(),
                    } satisfies QueuedProgress),
                );
            }),
        );
    }

    /** oldest first, the order it was read in */
    static async getQueuedProgress(): Promise<QueuedProgress[]> {
        try {
            const queued = await run<QueuedProgress[]>(PROGRESS_STORE, 'readonly', (store) => store.getAll());

            return queued.sort((a, b) => a.queuedAt - b.queuedAt);
        } catch {
            return [];
        }
    }

    /** Only removes what was sent: progress made while it was sent stays queued. */
    static async removeQueuedProgress({ chapterId, queuedAt }: QueuedProgress): Promise<void> {
        const current = await run<QueuedProgress | undefined>(PROGRESS_STORE, 'readonly', (store) =>
            store.get(chapterId),
        );

        if (current?.queuedAt === queuedAt) {
            await run(PROGRESS_STORE, 'readwrite', (store) => store.delete(chapterId));
        }
    }

    /** @returns an object url of the saved page (to be revoked by the caller), or null if the page is not saved */
    static async getPageObjectUrl(url: string): Promise<string | null> {
        const path = getPagePath(url);
        if (!path || !OfflineStorage.isSupported()) {
            return null;
        }

        try {
            const cache = await caches.open(PAGE_CACHE_NAME);
            const response = await cache.match(getPageCacheRequest(path));

            return response ? URL.createObjectURL(await response.blob()) : null;
        } catch {
            return null;
        }
    }

    /**
     * @param pageUrls the urls of the pages of the chapter, as the server provides them
     * @param fetchPage downloads one page
     * @param onPageSaved called after each saved page
     */
    static async saveChapter(
        chapterId: number,
        mangaId: number,
        pageUrls: string[],
        fetchPage: (url: string) => Promise<Blob>,
        onPageSaved?: () => void,
        info?: SavedChapterInfo,
        concurrency: number = PAGE_DOWNLOAD_CONCURRENCY,
    ): Promise<void> {
        const cache = await caches.open(PAGE_CACHE_NAME);
        const pagePaths = pageUrls.map((url) => getPagePath(url)).filter((path): path is string => !!path);
        if (pagePaths.length !== pageUrls.length) {
            throw new Error('The chapter has pages that cannot be saved');
        }

        let bytes = 0;
        let nextIndex = 0;
        const worker = async () => {
            while (nextIndex < pageUrls.length) {
                const index = nextIndex;
                nextIndex += 1;

                // pages of one chapter are loaded a few at a time, a worker takes the next one when it is done
                // oxlint-disable-next-line no-await-in-loop
                const blob = await fetchPage(pageUrls[index]);
                bytes += blob.size;
                // oxlint-disable-next-line no-await-in-loop
                await cache.put(
                    getPageCacheRequest(pagePaths[index]),
                    new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }),
                );
                onPageSaved?.();
            }
        };

        try {
            await Promise.all(Array.from({ length: concurrency }, worker));
        } catch (error) {
            // no half saved chapters
            await Promise.all(pagePaths.map((path) => cache.delete(getPageCacheRequest(path))));
            throw error;
        }

        const saved: SavedChapter = { ...info, chapterId, mangaId, pagePaths, bytes, savedAt: Date.now() };
        await run(CHAPTERS_STORE, 'readwrite', (store) => store.put(saved));
        useSavedChaptersStore.setState((state) => ({ chapters: { ...state.chapters, [chapterId]: saved } }));

        // without this the browser may drop the pages when the device runs low on space
        navigator.storage?.persist?.().catch(() => {});
    }

    static async removeChapters(chapterIds: number[]): Promise<void> {
        const cache = await caches.open(PAGE_CACHE_NAME);
        const { chapters } = useSavedChaptersStore.getState();

        await Promise.all(
            chapterIds.map(async (chapterId) => {
                const saved = chapters[chapterId];
                if (!saved) {
                    return;
                }

                await Promise.all(saved.pagePaths.map((path) => cache.delete(getPageCacheRequest(path))));
                await run(CHAPTERS_STORE, 'readwrite', (store) => store.delete(chapterId));
            }),
        );

        useSavedChaptersStore.setState((state) => ({
            chapters: Object.fromEntries(
                Object.entries(state.chapters).filter(([id]) => !chapterIds.includes(Number(id))),
            ),
        }));
    }

    static async removeAll(): Promise<void> {
        await OfflineStorage.removeChapters(Object.keys(useSavedChaptersStore.getState().chapters).map(Number));
        await OfflineStorage.clearResponses();
        await caches.delete(PAGE_CACHE_NAME);
    }

    static async getUsage(): Promise<{ used: number | undefined; quota: number | undefined }> {
        try {
            const { usage, quota } = (await navigator.storage?.estimate?.()) ?? {};

            return { used: usage, quota };
        } catch {
            return { used: undefined, quota: undefined };
        }
    }
}

if (OfflineStorage.isSupported()) {
    OfflineStorage.loadSavedChapters().catch(() => {});
}
