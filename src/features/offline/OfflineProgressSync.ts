/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { plural } from '@lingui/core/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { OfflineMode } from '@/features/offline/OfflineMode.ts';
import { OfflineStorage } from '@/features/offline/OfflineStorage.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';

/**
 * Sends the reading progress that was made without the server (see "RequestManager.updateChapters") to it.
 *
 * Runs when the server can be reached again and when the app starts, in case it was closed before that happened.
 */
export class OfflineProgressSync {
    private static isSyncing = false;

    static async sync(): Promise<void> {
        if (OfflineProgressSync.isSyncing || OfflineMode.isOffline()) {
            return;
        }

        OfflineProgressSync.isSyncing = true;
        let syncedCount = 0;

        try {
            const queued = await OfflineStorage.getQueuedProgress();

            // in the order it was read in, so the newest progress of a manga is the one that stays
            for (const entry of queued) {
                try {
                    // oxlint-disable-next-line no-await-in-loop
                    await requestManager.updateChapters(
                        [entry.chapterId],
                        { ...entry.patch, trackProgressMangaId: entry.trackProgressMangaId },
                        { errorPolicy: 'all' },
                    ).response;
                } catch {
                    // the server cannot be reached (again): what is left stays queued
                    break;
                }

                // an answer with an error (e.g. the chapter does not exist anymore) will not work later either
                // oxlint-disable-next-line no-await-in-loop
                await OfflineStorage.removeQueuedProgress(entry);
                syncedCount += 1;
            }
        } finally {
            OfflineProgressSync.isSyncing = false;
        }

        if (syncedCount) {
            makeToast(
                plural(syncedCount, {
                    one: 'Reading progress of one chapter was sent to the server',
                    other: 'Reading progress of # chapters was sent to the server',
                }),
                'success',
            );
        }
    }

    // one function, so starting twice (e.g. React strict mode) does not register it twice
    private static readonly syncAndReport = () =>
        OfflineProgressSync.sync().catch(defaultPromiseErrorHandler('OfflineProgressSync::sync'));

    static start(): void {
        OfflineMode.addRecoveryListener(OfflineProgressSync.syncAndReport);
        OfflineProgressSync.syncAndReport();
    }
}
