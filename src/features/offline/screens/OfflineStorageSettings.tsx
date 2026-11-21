/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo, useState } from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Delete from '@mui/icons-material/Delete';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { CARD_LIST_SX } from '@/base/components/lists/cardListSx.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { OfflineStorage, useSavedChapters } from '@/features/offline/OfflineStorage.ts';
import { OfflineChapters } from '@/features/offline/OfflineChapters.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GET_MANGA_READER } from '@/lib/graphql/manga/MangaQuery.ts';
import type { GetMangaReaderQuery } from '@/lib/graphql/generated/graphql.ts';
import { Confirmation } from '@/base/AppAwaitableComponent.ts';
import { makeToast } from '@/base/utils/Toast.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';

const formatBytes = (bytes: number | undefined): string => {
    if (bytes === undefined) {
        return '-';
    }

    const megabytes = bytes / (1024 * 1024);

    return megabytes >= 1024
        ? `${(megabytes / 1024).toFixed(1)} GB`
        : `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
};

const SavedMangaRow = ({ mangaId, chapterIds, bytes }: { mangaId: number; chapterIds: number[]; bytes: number }) => {
    const { t } = useLingui();
    const isMobile = MediaQuery.useIsMobileWidth();

    // the title was stored when the chapters were saved, so this also works without the server
    const { data } = requestManager.useGetManga<GetMangaReaderQuery>(GET_MANGA_READER, mangaId, {
        fetchPolicy: 'cache-first',
    });

    return (
        <ListItem
            disablePadding
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label={t`Remove from this device`}
                    onClick={() =>
                        OfflineChapters.remove(chapterIds).catch(
                            defaultPromiseErrorHandler('OfflineStorageSettings::remove'),
                        )
                    }
                >
                    <Delete />
                </IconButton>
            }
        >
            <ListItemButton disableRipple sx={{ cursor: 'default', pr: isMobile ? 7 : 8 }}>
                <ListItemText
                    primary={data?.manga.title ?? `${t`Manga`} ${mangaId}`}
                    secondary={`${plural(chapterIds.length, { one: '# chapter', other: '# chapters' })} · ${formatBytes(bytes)}`}
                    slotProps={{ primary: { noWrap: true } }}
                />
            </ListItemButton>
        </ListItem>
    );
};

export const OfflineStorageSettings = () => {
    const { t } = useLingui();

    useAppTitle(t`Offline storage`);

    const savedChapters = useSavedChapters();
    const [usage, setUsage] = useState<Awaited<ReturnType<typeof OfflineStorage.getUsage>>>();

    const [queuedProgressCount, setQueuedProgressCount] = useState(0);

    // what the app needs to open without the server: a secure connection (https), the service worker and the saved app
    const [isAppSaved, setIsAppSaved] = useState(false);
    const isSecure = window.isSecureContext;
    const hasServiceWorker = !!navigator.serviceWorker?.controller;
    useEffect(() => {
        if (typeof caches === 'undefined') {
            return;
        }

        caches
            .keys()
            .then((keys) => setIsAppSaved(keys.some((key) => key.includes('precache'))))
            .catch(() => {});
    }, []);

    useEffect(() => {
        OfflineStorage.getUsage()
            .then(setUsage)
            .catch(() => {});
        OfflineStorage.getQueuedProgress()
            .then((queued) => setQueuedProgressCount(queued.length))
            .catch(() => {});
    }, [savedChapters]);

    const savedManga = useMemo(() => {
        const byManga = new Map<number, { chapterIds: number[]; bytes: number }>();
        Object.values(savedChapters).forEach(({ chapterId, mangaId, bytes }) => {
            const entry = byManga.get(mangaId) ?? { chapterIds: [], bytes: 0 };
            entry.chapterIds.push(chapterId);
            entry.bytes += bytes;
            byManga.set(mangaId, entry);
        });

        return [...byManga.entries()];
    }, [savedChapters]);

    const savedBytes = Object.values(savedChapters).reduce((sum, { bytes }) => sum + bytes, 0);

    const removeAll = async () => {
        try {
            await Confirmation.show({
                title: t`Remove everything from this device?`,
                message: t`The saved chapters and the data kept for offline use are deleted from this device. Nothing changes on the server.`,
                actions: { confirm: { title: t`Remove` } },
            });
        } catch {
            return;
        }

        try {
            await OfflineStorage.removeAll();
            makeToast(t`Removed everything from this device`, 'success');
        } catch (e) {
            makeToast(t`Could not remove everything from this device`, 'error', getErrorMessage(e));
        }
    };

    const statusItems = (
        <ListItem>
            <ListItemText
                primary={t`Opens without the server`}
                secondary={
                    isSecure
                        ? `${t`Secure connection (https): yes`} · ${hasServiceWorker ? t`Service worker: active` : t`Service worker: not active yet, open the app once more while online`} · ${isAppSaved ? t`App saved: yes` : t`App saved: no`}`
                        : t`Secure connection (https): no. Browsers only allow saving the app and chapters on the device over https (or on localhost), so open the server through an https address.`
                }
            />
        </ListItem>
    );

    if (!OfflineStorage.isSupported()) {
        return (
            <List sx={CARD_LIST_SX}>
                {statusItems}
                <ListItem>
                    <ListItemText secondary={t`This browser cannot save chapters on the device`} />
                </ListItem>
            </List>
        );
    }

    return (
        <List sx={CARD_LIST_SX}>
            {statusItems}
            <ListItem>
                <ListItemText
                    primary={t`Saved on this device`}
                    secondary={`${plural(Object.keys(savedChapters).length, { one: '# chapter', other: '# chapters' })} · ${formatBytes(savedBytes)}${
                        usage?.quota
                            ? ` · ${t`${formatBytes(usage.used)} of ${formatBytes(usage.quota)} used by the app`}`
                            : ''
                    }`}
                />
            </ListItem>
            {queuedProgressCount > 0 && (
                <ListItem>
                    <ListItemText
                        primary={t`Waiting to be sent to the server`}
                        secondary={plural(queuedProgressCount, {
                            one: 'Reading progress of # chapter',
                            other: 'Reading progress of # chapters',
                        })}
                    />
                </ListItem>
            )}
            {savedManga.length === 0 && (
                <ListItem>
                    <ListItemText
                        secondary={t`Chapters you save from the options of a chapter can be read without the server.`}
                    />
                </ListItem>
            )}
            {savedManga.map(([mangaId, { chapterIds, bytes }]) => (
                <SavedMangaRow key={mangaId} mangaId={mangaId} chapterIds={chapterIds} bytes={bytes} />
            ))}
            <ListItemButton onClick={removeAll} disabled={!savedManga.length}>
                <ListItemText primary={t`Remove everything from this device`} />
            </ListItemButton>
        </List>
    );
};
