/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import CloudOff from '@mui/icons-material/CloudOff';
import Delete from '@mui/icons-material/Delete';
import DeleteSweep from '@mui/icons-material/DeleteSweep';
import OfflinePinIcon from '@mui/icons-material/OfflinePin';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { Select } from '@/base/components/inputs/Select.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { SelectableCollectionSelectAll } from '@/base/collection/components/SelectableCollectionSelectAll.tsx';
import { SelectionFAB } from '@/base/collection/components/SelectionFAB.tsx';
import { useSelectableCollection } from '@/base/collection/hooks/useSelectableCollection.ts';
import { MenuItem as IconMenuItem } from '@/base/components/menu/MenuItem.tsx';
import { Confirmation } from '@/base/AppAwaitableComponent.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { STABLE_EMPTY_ARRAY } from '@/base/Base.constants.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { DownloadedChaptersSort } from '@/features/downloads/Downloads.types.ts';
import { DOWNLOADED_CHAPTERS_SORT_TO_TRANSLATION } from '@/features/downloads/Downloads.constants.ts';
import { DownloadedChapterCard } from '@/features/downloads/components/DownloadedChapterCard.tsx';
import { SavedChapterCard } from '@/features/downloads/components/SavedChapterCard.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { OfflineChapters } from '@/features/offline/OfflineChapters.ts';
import { useSavedChapters } from '@/features/offline/OfflineStorage.ts';
import { i18n } from '@/i18n';

type RemoveTarget = 'server' | 'device' | 'both';

/**
 * Everything that was downloaded before: to the server (it keeps the chapter) and/or saved on this device (to read
 * without the server), each chapter labeled with where it is. The queue of the downloads that are still to come is the
 * other tab.
 *
 * Chapters can be selected (the "Select" button, the checkbox for all of them, ctrl/cmd + click for one, shift + click
 * for a range) and removed from the server, from this device, or from both.
 */
export const DownloadedChapters = () => {
    const { t } = useLingui();

    const {
        settings: { deleteChaptersWithBookmark },
    } = useMetadataServerSettings();

    const [sort, setSort] = useLocalStorage<DownloadedChaptersSort>(
        'downloaded-chapters-sort',
        DownloadedChaptersSort.RECENTLY_READ,
    );

    const savedChapters = useSavedChapters();
    const savedChapterIds = useMemo(
        () =>
            Object.keys(savedChapters)
                .map(Number)
                .sort((a, b) => a - b),
        [savedChapters],
    );

    const { data, loading, error, fetchMore, refetch } = requestManager.useGetDownloadedChapters(
        sort,
        savedChapterIds,
        { fetchPolicy: 'cache-and-network' },
    );
    const chapters = data?.chapters.nodes ?? STABLE_EMPTY_ARRAY;
    const hasNextPage = !!data?.chapters.pageInfo.hasNextPage;

    // the server cannot order by the title of the manga, so this order is made of what was loaded (all of it, see below)
    const sortedChapters = useMemo(
        () =>
            sort === DownloadedChaptersSort.MANGA_TITLE
                ? chapters.toSorted(
                      (a, b) => a.manga.title.localeCompare(b.manga.title) || b.sourceOrder - a.sourceOrder,
                  )
                : chapters,
        [chapters, sort],
    );

    const loadMore = useCallback(() => {
        if (!hasNextPage || loading) {
            return;
        }

        fetchMore({ variables: { offset: chapters.length } }).catch(
            defaultPromiseErrorHandler('DownloadedChapters::loadMore'),
        );
    }, [hasNextPage, loading, chapters.length]);

    useEffect(() => {
        if (sort === DownloadedChaptersSort.MANGA_TITLE) {
            loadMore();
        }
    }, [sort, loadMore]);

    // without the server the chapters saved on the device are listed from what was kept with them
    const savedChaptersList = useMemo(
        () => Object.values(savedChapters).toSorted((a, b) => b.savedAt - a.savedAt),
        [savedChapters],
    );
    const isShowingSavedOnly = !!error && !!savedChaptersList.length;

    const visibleChapterIds = useMemo(
        () =>
            isShowingSavedOnly
                ? savedChaptersList.map(({ chapterId }) => chapterId)
                : sortedChapters.map(({ id }) => id),
        [isShowingSavedOnly, savedChaptersList, sortedChapters],
    );

    const {
        selectedItemIds,
        areAllItemsSelected,
        areNoItemsSelected,
        handleSelection,
        handleSelectAll,
        clearSelection,
    } = useSelectableCollection(visibleChapterIds.length, { itemIds: visibleChapterIds, currentKey: 'default' });
    // the "Select" button shows the checkboxes before the first chapter is selected
    const [isSelectMode, setIsSelectMode] = useState(false);
    const isSelecting = isSelectMode || !areNoItemsSelected;
    const selectedIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

    const onSelect = useCallback(
        (chapterId: number, selected: boolean, selectRange: boolean) =>
            handleSelection(chapterId, selected, { selectRange }),
        [handleSelection],
    );

    const stopSelecting = () => {
        clearSelection();
        setIsSelectMode(false);
    };

    // what the selection can be removed from: the server keeps a chapter only if it was downloaded there (and the
    // setting for bookmarked chapters allows it), the device only if it was saved on it
    const serverChapterIds = useMemo(
        () =>
            isShowingSavedOnly
                ? STABLE_EMPTY_ARRAY
                : Chapters.getIds(
                      Chapters.getDeletable(
                          sortedChapters.filter((chapter) => chapter.isDownloaded && selectedIdSet.has(chapter.id)),
                          deleteChaptersWithBookmark,
                      ),
                  ),
        [isShowingSavedOnly, sortedChapters, selectedIdSet, deleteChaptersWithBookmark],
    );
    const deviceChapterIds = useMemo(
        () => selectedItemIds.filter((chapterId) => !!savedChapters[chapterId]),
        [selectedItemIds, savedChapters],
    );

    const removeSelected = async (target: RemoveTarget) => {
        const serverIds = target === 'device' ? [] : serverChapterIds;
        const deviceIds = target === 'server' ? [] : deviceChapterIds;
        if (!serverIds.length && !deviceIds.length) {
            return;
        }

        try {
            await Confirmation.show({
                title: t`Are you sure?`,
                message: [
                    serverIds.length
                        ? plural(serverIds.length, {
                              one: '# download will be deleted from the server.',
                              other: '# downloads will be deleted from the server.',
                          })
                        : '',
                    deviceIds.length
                        ? plural(deviceIds.length, {
                              one: '# chapter will be removed from this device.',
                              other: '# chapters will be removed from this device.',
                          })
                        : '',
                ]
                    .filter(Boolean)
                    .join(' '),
                actions: { confirm: { title: t`Remove` } },
            });
        } catch {
            return;
        }

        try {
            if (serverIds.length) {
                // already confirmed above
                await Chapters.delete(serverIds, true);
            }
            if (deviceIds.length) {
                await OfflineChapters.remove(deviceIds);
            }
        } catch {
            // the toasts of the actions tell what failed
        }

        stopSelecting();
        refetch().catch(defaultPromiseErrorHandler('DownloadedChapters::refetch'));
    };

    const header = (
        <Stack
            direction="row"
            sx={{
                px: 2,
                pt: 1.5,
                pb: 0.5,
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
            }}
        >
            <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="downloaded-chapters-sort-label">{t`Sort by`}</InputLabel>
                <Select<DownloadedChaptersSort>
                    labelId="downloaded-chapters-sort-label"
                    label={t`Sort by`}
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                >
                    {Object.values(DownloadedChaptersSort).map((option) => (
                        <MenuItem key={option} value={option}>
                            {
                                /* lingui-extract-ignore */
                                i18n.t(DOWNLOADED_CHAPTERS_SORT_TO_TRANSLATION[option])
                            }
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                {isSelecting ? (
                    <>
                        <Typography variant="body2" color="text.secondary">
                            {plural(selectedItemIds.length, { one: '# selected', other: '# selected' })}
                        </Typography>
                        {!!visibleChapterIds.length && (
                            <SelectableCollectionSelectAll
                                areAllItemsSelected={areAllItemsSelected}
                                areNoItemsSelected={areNoItemsSelected}
                                onChange={(checked) => handleSelectAll(checked, checked ? visibleChapterIds : [])}
                            />
                        )}
                        <Button size="small" color="inherit" onClick={stopSelecting}>
                            {t`Cancel`}
                        </Button>
                    </>
                ) : (
                    !!visibleChapterIds.length && (
                        <Button
                            size="small"
                            color="inherit"
                            startIcon={<CheckBoxOutlineBlank />}
                            onClick={() => setIsSelectMode(true)}
                        >
                            {t`Select`}
                        </Button>
                    )
                )}
                <Button
                    component={Link}
                    to={AppRoutes.settings.children.offline.path}
                    size="small"
                    color="inherit"
                    startIcon={<OfflinePinIcon />}
                >
                    {t`Offline storage`}
                </Button>
            </Stack>
        </Stack>
    );

    const removeMenu = !!selectedItemIds.length && (
        <SelectionFAB title={plural(selectedItemIds.length, { one: '# chapter', other: '# chapters' })}>
            {(handleClose) => (
                <>
                    <IconMenuItem
                        Icon={Delete}
                        disabled={!serverChapterIds.length}
                        onClick={() => {
                            handleClose();
                            removeSelected('server').catch(defaultPromiseErrorHandler('DownloadedChapters::server'));
                        }}
                        title={t`Remove from the server (${serverChapterIds.length})`}
                    />
                    <IconMenuItem
                        Icon={CloudOff}
                        disabled={!deviceChapterIds.length}
                        onClick={() => {
                            handleClose();
                            removeSelected('device').catch(defaultPromiseErrorHandler('DownloadedChapters::device'));
                        }}
                        title={t`Remove from this device (${deviceChapterIds.length})`}
                    />
                    <IconMenuItem
                        Icon={DeleteSweep}
                        disabled={!serverChapterIds.length && !deviceChapterIds.length}
                        onClick={() => {
                            handleClose();
                            removeSelected('both').catch(defaultPromiseErrorHandler('DownloadedChapters::both'));
                        }}
                        title={t`Remove from the server and this device`}
                    />
                </>
            )}
        </SelectionFAB>
    );

    if (loading && !data && !isShowingSavedOnly) {
        return (
            <>
                {header}
                <LoadingPlaceholder />
            </>
        );
    }

    if (isShowingSavedOnly) {
        return (
            <>
                {header}
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
                    {t`The server cannot be reached: showing what is saved on this device.`}
                </Typography>
                <Virtuoso
                    useWindowScroll
                    data={savedChaptersList}
                    computeItemKey={(_index, saved) => saved.chapterId}
                    itemContent={(_index, saved) => (
                        <StyledGroupItemWrapper>
                            <SavedChapterCard
                                saved={saved}
                                selected={isSelecting ? selectedIdSet.has(saved.chapterId) : null}
                                onSelect={onSelect}
                            />
                        </StyledGroupItemWrapper>
                    )}
                />
                {removeMenu}
            </>
        );
    }

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t`Unable to load data`}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('DownloadedChapters::refetch'))}
            />
        );
    }

    return (
        <>
            {header}
            {!sortedChapters.length ? (
                <EmptyViewAbsoluteCentered message={t`Nothing downloaded yet`} />
            ) : (
                <Virtuoso
                    useWindowScroll
                    data={sortedChapters}
                    endReached={loadMore}
                    computeItemKey={(_index, chapter) => chapter.id}
                    itemContent={(_index, chapter) => (
                        <StyledGroupItemWrapper>
                            <DownloadedChapterCard
                                chapter={chapter}
                                selected={isSelecting ? selectedIdSet.has(chapter.id) : null}
                                onSelect={onSelect}
                            />
                        </StyledGroupItemWrapper>
                    )}
                />
            )}
            {removeMenu}
        </>
    );
};
