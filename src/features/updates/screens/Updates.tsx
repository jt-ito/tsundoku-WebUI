/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import UpdateIcon from '@mui/icons-material/Update';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { useQueryParam, NumberParam } from 'use-query-params';
import type { GroupedVirtuosoHandle } from 'react-virtuoso';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { SearchParam } from '@/base/Base.types.ts';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { UpdateChecker } from '@/features/updates/components/UpdateChecker.tsx';
import { SyncButton } from '@/features/sync/components/SyncButton.tsx';
import { StyledGroupedVirtuoso } from '@/base/components/virtuoso/StyledGroupedVirtuoso.tsx';
import { StyledGroupHeader } from '@/base/components/virtuoso/StyledGroupHeader.tsx';
import { StyledGroupItemWrapper } from '@/base/components/virtuoso/StyledGroupItemWrapper.tsx';
import { dateTimeFormatter, epochToDate, getDateString } from '@/base/utils/DateHelper.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { VirtuosoUtil } from '@/lib/virtuoso/Virtuoso.util.tsx';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { ChapterUpdateCard } from '@/features/updates/components/ChapterUpdateCard.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { useAppTitleAndAction } from '@/features/navigation-bar/hooks/useAppTitleAndAction.ts';
import { GROUPED_VIRTUOSO_Z_INDEX } from '@/lib/virtuoso/Virtuoso.constants.ts';
import mapValues from 'lodash/fp/mapValues';
import difference from 'lodash/fp/difference';
import uniqBy from 'lodash/fp/uniqBy';
import { OffsetComponentWithContainer } from '@/base/OffsetComponent.tsx';
import { useElementSize } from '@mantine/hooks';
import type { ChapterUpdateListFieldsFragment } from '@/lib/graphql/generated/graphql.ts';

// per account: another account's updates must never be painted while this one's are loading
const getUpdatesCacheKey = () => `updates.cachedEntries.${AuthManager.getActiveUserId() ?? 'default'}`;
// when a whole page collapses into manga that are already listed (one manga with many new chapters), the next pages
// are fetched in bigger steps so the next manga shows up sooner
const UPDATES_SKIP_PAGE_SIZE = 450;
// one page's worth - just enough to paint the screen instantly, the live query replaces it right after
const UPDATES_CACHE_LIMIT = 150;

const readCachedUpdates = (): ChapterUpdateListFieldsFragment[] => {
    try {
        return JSON.parse(localStorage.getItem(getUpdatesCacheKey()) ?? '[]');
    } catch {
        return [];
    }
};

const writeCachedUpdates = (entries: readonly ChapterUpdateListFieldsFragment[]) => {
    try {
        localStorage.setItem(getUpdatesCacheKey(), JSON.stringify(entries.slice(0, UPDATES_CACHE_LIMIT)));
    } catch {
        // storage full/unavailable (e.g. private browsing) - the cache is a nice-to-have, not required
    }
};

export const Updates: React.FC = () => {
    const { t } = useLingui();

    const [targetMangaId, setTargetMangaId] = useQueryParam(SearchParam.MANGA, NumberParam);
    const virtuosoRef = useRef<GroupedVirtuosoHandle>(null);

    useAppTitleAndAction(
        t`Updates`,
        <>
            <SyncButton />
            <UpdateChecker />
        </>,
    );

    // shown until the live query resolves, so a fresh app load isn't a blank/loading screen while it fetches
    const [cachedUpdateEntries] = useState(readCachedUpdates);

    const {
        data: chapterUpdateData,
        loading: isLoading,
        error,
        fetchMore,
        refetch,
    } = requestManager.useGetRecentlyUpdatedChapters(undefined, {
        fetchPolicy: 'cache-and-network',
    });
    const hasNextPage = !!chapterUpdateData?.chapters.pageInfo.hasNextPage;
    const allUpdateEntries = chapterUpdateData?.chapters.nodes ?? cachedUpdateEntries;

    useEffect(() => {
        if (chapterUpdateData?.chapters.nodes.length) {
            writeCachedUpdates(chapterUpdateData.chapters.nodes);
        }
    }, [chapterUpdateData]);

    const [prevUpdateEntriesCount, setPrevUpdateEntriesCount] = useState(0);
    // fetching more does not count as loading, without this the list looks stuck while the next pages come in
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const [firstUnreadUpdatesByGroup, otherUpdatesByMangaByGroup] = useMemo(() => {
        const groupedEntries = Chapters.groupByDate(allUpdateEntries, 'fetchedAt');

        const mangaIdByGroup = mapValues(
            (groupEntries) => uniqBy('mangaId', groupEntries).map((entry) => entry.mangaId),
            groupedEntries,
        );

        const entriesByMangaByGroup = mapValues(
            (entries) => Object.groupBy(entries!, (entry) => entry.mangaId),
            groupedEntries,
        );

        const firstUnreadEntryByMangaByGroup = mapValues(
            (entriesByManga) =>
                mapValues(
                    (mangaEntries) => [mangaEntries!.findLast((entry) => !entry.isRead) ?? mangaEntries![0]],
                    entriesByManga,
                ),
            entriesByMangaByGroup,
        );
        const firstUnreadEntryByGroup = mapValues(
            (firstUnreadEntryByManga) =>
                Object.values(firstUnreadEntryByManga)
                    .flat()
                    .toSorted((a, b) => {
                        const groupMangaIds = mangaIdByGroup[getDateString(epochToDate(Number(a.fetchedAt)))];

                        return groupMangaIds.indexOf(a.mangaId) - groupMangaIds.indexOf(b.mangaId);
                    }),
            firstUnreadEntryByMangaByGroup,
        );
        const remainingEntriesByMangaByGroup = mapValues(
            (entriesByManga) =>
                mapValues(
                    (mangaEntries) =>
                        difference(
                            mangaEntries!,
                            firstUnreadEntryByMangaByGroup[
                                getDateString(epochToDate(Number(mangaEntries![0].fetchedAt)))
                            ]![mangaEntries![0].mangaId],
                        ),
                    entriesByManga,
                ),
            entriesByMangaByGroup,
        );

        return [Object.entries(firstUnreadEntryByGroup), remainingEntriesByMangaByGroup];
    }, [allUpdateEntries]);

    const firstUnreadUpdatesGroupCounts = useMemo(
        () => firstUnreadUpdatesByGroup.map((updatesByGroup) => updatesByGroup[VirtuosoUtil.ITEMS].length),
        [firstUnreadUpdatesByGroup],
    );
    const firstUnreadUpdatesEntries = useMemo(
        () => firstUnreadUpdatesByGroup.flatMap((updatesByGroup) => updatesByGroup[VirtuosoUtil.ITEMS]),
        [firstUnreadUpdatesByGroup],
    );

    // jump to the manga a "new chapters" toast was clicked for, once its entry has loaded in
    useEffect(() => {
        if (targetMangaId == null) {
            return;
        }

        const index = firstUnreadUpdatesEntries.findIndex((entry) => entry.mangaId === targetMangaId);
        if (index === -1) {
            return;
        }

        virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
        setTargetMangaId(undefined);
    }, [targetMangaId, firstUnreadUpdatesEntries]);

    const computeFirstUnreadUpdateItemKey = VirtuosoUtil.useCreateGroupedComputeItemKey(
        firstUnreadUpdatesGroupCounts,
        useCallback((index) => firstUnreadUpdatesByGroup[index][VirtuosoUtil.GROUP], [firstUnreadUpdatesByGroup]),
        useCallback((index) => firstUnreadUpdatesEntries[index].id, [firstUnreadUpdatesEntries]),
    );

    const { ref: lastUpdateTimestampCompRef, height: lastUpdateTimestampCompHeight } = useElementSize();

    const { data: lastUpdateTimestampData } = requestManager.useGetLastGlobalUpdateTimestamp({
        /**
         * The {@link UpdateChecker} is responsible for updating the timestamp
         */
        fetchPolicy: 'cache-only',
    });
    const lastUpdateTimestamp = lastUpdateTimestampData?.lastUpdateTimestamp.timestamp;
    const date = lastUpdateTimestamp ? dateTimeFormatter.format(+lastUpdateTimestamp) : '-';

    const loadMore = useCallback(
        (pageSize?: number) => {
            if (!hasNextPage || isFetchingMore) {
                return;
            }

            setIsFetchingMore(true);
            fetchMore({ variables: { offset: allUpdateEntries.length, ...(pageSize ? { first: pageSize } : {}) } })
                .then(() => setPrevUpdateEntriesCount(firstUnreadUpdatesEntries.length))
                .finally(() => setIsFetchingMore(false));
        },
        [hasNextPage, isFetchingMore, allUpdateEntries.length, firstUnreadUpdatesEntries.length],
    );

    const filteredOutAllItemsOfFetchedPage =
        allUpdateEntries.length > 0 && prevUpdateEntriesCount === firstUnreadUpdatesEntries.length;
    useEffect(() => {
        if (filteredOutAllItemsOfFetchedPage && hasNextPage && !isLoading) {
            loadMore(UPDATES_SKIP_PAGE_SIZE);
        }
    }, [isLoading, hasNextPage, filteredOutAllItemsOfFetchedPage, loadMore]);

    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t`Unable to load data`}
                messageExtra={getErrorMessage(error)}
                retry={() => refetch().catch(defaultPromiseErrorHandler('Updates::refetch'))}
            />
        );
    }

    if (!isLoading && firstUnreadUpdatesEntries.length === 0) {
        return <EmptyViewAbsoluteCentered message={t`You don't have any updates yet.`} />;
    }

    return (
        <OffsetComponentWithContainer
            sx={{
                zIndex: GROUPED_VIRTUOSO_Z_INDEX,
            }}
            component={
                <Stack
                    ref={lastUpdateTimestampCompRef}
                    direction="row"
                    sx={{
                        alignItems: 'center',
                        gap: 0.75,
                        px: '10px',
                        py: 0.75,
                        backgroundColor: 'background.default',
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <UpdateIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                    <Typography
                        sx={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'text.secondary',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {t`Last update: ${date}`}
                    </Typography>
                </Stack>
            }
        >
            <StyledGroupedVirtuoso
                ref={virtuosoRef}
                persistKey="updates"
                heightToSubtract={lastUpdateTimestampCompHeight}
                components={{
                    Footer: () => (isLoading || isFetchingMore ? <LoadingPlaceholder usePadding /> : null),
                }}
                endReached={() => loadMore()}
                groupCounts={firstUnreadUpdatesGroupCounts}
                groupContent={(index) => (
                    <StyledGroupHeader isFirstItem={index === 0}>
                        <Typography
                            variant="h6"
                            component="h2"
                            sx={{ fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}
                        >
                            {firstUnreadUpdatesByGroup[index][VirtuosoUtil.GROUP]}
                        </Typography>
                    </StyledGroupHeader>
                )}
                computeItemKey={computeFirstUnreadUpdateItemKey}
                itemContent={(index) => (
                    <StyledGroupItemWrapper>
                        <ChapterUpdateCard
                            chapter={firstUnreadUpdatesEntries[index]}
                            otherChapters={
                                otherUpdatesByMangaByGroup[
                                    getDateString(epochToDate(Number(firstUnreadUpdatesEntries[index].fetchedAt)))
                                ][firstUnreadUpdatesEntries[index].mangaId]
                            }
                        />
                    </StyledGroupItemWrapper>
                )}
            />
        </OffsetComponentWithContainer>
    );
};
