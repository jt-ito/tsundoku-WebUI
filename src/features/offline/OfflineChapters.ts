/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { plural, t } from '@lingui/core/macro';
import { closeSnackbar } from 'notistack';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import type { SavedChapterInfo } from '@/features/offline/OfflineStorage.ts';
import { getPageDownloadConcurrency, OfflineStorage } from '@/features/offline/OfflineStorage.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { GET_MANGA_READER } from '@/lib/graphql/manga/MangaQuery.ts';
import { GET_CHAPTERS_READER, GET_MANGAS_CHAPTER_IDS_WITH_STATE } from '@/lib/graphql/chapter/ChapterQuery.ts';
import { OfflineMode } from '@/features/offline/OfflineMode.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { ChapterOrderBy, DownloadState, SortOrder } from '@/lib/graphql/generated/graphql-base.types.ts';
import type {
    GetChaptersReaderQuery,
    GetChaptersReaderQueryVariables,
    GetMangaReaderQuery,
    GetMangasChapterIdsWithStateQuery,
    GetMangasChapterIdsWithStateQueryVariables,
} from '@/lib/graphql/generated/graphql.ts';

type ChapterToSave = { id: number; mangaId: number; isDownloaded?: boolean };

const WAIT_FOR_SERVER_POLL_MS = 3_000;

/**
 * Saves chapters on the device, so they can be read without the server (see "OfflineStorage").
 */
export class OfflineChapters {
    /**
     * What the reader asks the server for when a chapter is opened. Asking now stores the answers on the device
     * (see "OfflineResponseLink"), so the reader opens the chapter offline as well.
     */
    private static async storeReaderData(
        mangaId: number,
    ): Promise<{ mangaTitle?: string; chapters: Map<number, SavedChapterInfo> }> {
        const { data: mangaData } = await requestManager.getManga<GetMangaReaderQuery>(GET_MANGA_READER, mangaId, {
            fetchPolicy: 'network-only',
        }).response;
        const { data: chaptersData } = await requestManager.getChapters<
            GetChaptersReaderQuery,
            GetChaptersReaderQueryVariables
        >(
            GET_CHAPTERS_READER,
            {
                condition: { mangaId },
                order: [{ by: ChapterOrderBy.SourceOrder, byType: SortOrder.Desc }],
            },
            { fetchPolicy: 'network-only' },
        ).response;

        // what the Downloads page shows for a saved chapter when the server cannot be asked about it
        const mangaTitle = mangaData?.manga.title;
        const chapters = new Map<number, SavedChapterInfo>(
            (chaptersData?.chapters.nodes ?? []).map(({ id, name, sourceOrder }) => [
                id,
                { mangaTitle, chapterName: name, sourceOrder },
            ]),
        );

        return { mangaTitle, chapters };
    }

    /**
     * Saves chapters on the device once the server has downloaded them, reading them from the server instead of asking
     * the source a second time. The ones that finish are saved as they do; a chapter that fails on the server, or that
     * leaves the download queue without being downloaded, is left out. It stops when the server cannot be reached
     * (what is still waiting then is not saved) or when the page is closed.
     */
    static async saveWhenDownloaded(chapters: ChapterToSave[]): Promise<void> {
        const waiting = new Map(chapters.map((chapter) => [chapter.id, chapter]));
        // a chapter that is not in the queue and not downloaded is gone: it takes two looks to be sure
        const missingLooks = new Map<number, number>();

        while (waiting.size) {
            // oxlint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
                setTimeout(resolve, WAIT_FOR_SERVER_POLL_MS);
            });
            if (OfflineMode.isOffline()) {
                return;
            }

            let nodes: GetMangasChapterIdsWithStateQuery['chapters']['nodes'];
            try {
                // oxlint-disable-next-line no-await-in-loop
                const { data } = await requestManager.getChapters<
                    GetMangasChapterIdsWithStateQuery,
                    GetMangasChapterIdsWithStateQueryVariables
                >(
                    GET_MANGAS_CHAPTER_IDS_WITH_STATE,
                    { filter: { id: { in: [...waiting.keys()] } } },
                    { fetchPolicy: 'network-only' },
                ).response;
                nodes = data?.chapters.nodes ?? [];
            } catch {
                continue;
            }

            const downloaded: ChapterToSave[] = [];
            nodes.forEach(({ id, isDownloaded }) => {
                const chapter = waiting.get(id);
                if (!chapter) {
                    return;
                }

                if (isDownloaded) {
                    waiting.delete(id);
                    downloaded.push({ ...chapter, isDownloaded: true });
                    return;
                }

                const status = Chapters.getDownloadStatusFromCache(id);
                const isGone = !status || status.state === DownloadState.Error;
                const looks = isGone ? (missingLooks.get(id) ?? 0) + 1 : 0;
                missingLooks.set(id, looks);
                if (looks >= 2) {
                    waiting.delete(id);
                }
            });
            // a chapter the server no longer knows
            [...waiting.keys()]
                .filter((id) => !nodes.some((node) => node.id === id))
                .forEach((id) => waiting.delete(id));

            if (downloaded.length) {
                // oxlint-disable-next-line no-await-in-loop
                await OfflineChapters.save(downloaded);
            }
        }
    }

    static async save(chapters: ChapterToSave[]): Promise<void> {
        const toSave = chapters.filter(({ id }) => !OfflineStorage.isChapterSaved(id));
        if (!toSave.length) {
            return;
        }

        if (!OfflineStorage.isSupported()) {
            makeToast(t`This browser cannot save chapters on the device`, 'error');
            return;
        }

        const progressToast = makeToast(
            plural(toSave.length, {
                one: 'Saving the chapter on this device...',
                other: 'Saving # chapters on this device...',
            }),
            { variant: 'info', persist: true },
        );

        let savedCount = 0;
        try {
            const mangaIds = [...new Set(toSave.map(({ mangaId }) => mangaId))];
            const readerData = new Map(
                await Promise.all(
                    mangaIds.map(async (mangaId) => [mangaId, await OfflineChapters.storeReaderData(mangaId)] as const),
                ),
            );

            // one chapter after the other: the server and the connection are not meant for a flood of requests
            for (const { id, mangaId, isDownloaded } of toSave) {
                // A chapter that is downloaded on the server is read from the server's disk (its page list and its
                // images), the source is not asked again; only the chapters that are not are fetched from it by the server.
                // oxlint-disable-next-line no-await-in-loop
                const { data } = await requestManager.getChapterPagesFetch(id).response;
                const pageUrls = data?.fetchChapterPages?.pages ?? [];

                // oxlint-disable-next-line no-await-in-loop
                await OfflineStorage.saveChapter(
                    id,
                    mangaId,
                    pageUrls,
                    (url) => requestManager.fetchImageBlob(url),
                    undefined,
                    readerData.get(mangaId)?.chapters.get(id),
                    getPageDownloadConcurrency(isDownloaded),
                );
                savedCount += 1;
            }

            makeToast(
                plural(savedCount, {
                    one: 'Chapter saved on this device',
                    other: '# chapters saved on this device',
                }),
                'success',
            );
        } catch (e) {
            makeToast(
                savedCount
                    ? t`Saved ${savedCount} of ${toSave.length} chapters, the rest could not be saved`
                    : t`Could not save the chapter on this device`,
                'error',
                getErrorMessage(e),
            );
        } finally {
            closeSnackbar(progressToast);
        }
    }

    static async remove(chapterIds: number[]): Promise<void> {
        const toRemove = chapterIds.filter((id) => OfflineStorage.isChapterSaved(id));
        if (!toRemove.length) {
            return;
        }

        try {
            await OfflineStorage.removeChapters(toRemove);
            makeToast(
                plural(toRemove.length, {
                    one: 'Chapter removed from this device',
                    other: '# chapters removed from this device',
                }),
                'success',
            );
        } catch (e) {
            makeToast(t`Could not remove the chapters from this device`, 'error', getErrorMessage(e));
        }
    }
}
