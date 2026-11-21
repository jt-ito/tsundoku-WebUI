/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import { Link } from 'react-router-dom';
import { memo } from 'react';
import type { ChapterHistoryListFieldsFragment } from '@/lib/graphql/generated/graphql.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { ChapterCardThumbnail } from '@/features/chapter/components/cards/ChapterCardThumbnail.tsx';
import { ChapterCardMetadata } from '@/features/chapter/components/cards/ChapterCardMetadata.tsx';
import { ChapterDownloadButton } from '@/features/chapter/components/buttons/ChapterDownloadButton.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';
import { DownloadLocationLabels } from '@/features/downloads/components/DownloadLocationLabels.tsx';
import { useIsChapterSaved } from '@/features/offline/OfflineStorage.ts';

/**
 * A chapter that was downloaded to the server and/or saved on this device, with the manga it belongs to.
 *
 * @param selected null: nothing is selected, a click opens the chapter. Else whether this chapter is selected, a click
 * selects it. Ctrl/cmd + click selects one chapter, shift + click everything from the last one that was clicked.
 */
export const DownloadedChapterCard = memo(
    ({
        chapter,
        selected,
        onSelect,
    }: {
        chapter: ChapterHistoryListFieldsFragment;
        selected: boolean | null;
        onSelect: (chapterId: number, selected: boolean, selectRange: boolean) => void;
    }) => {
        const { manga } = chapter;
        const isOnDevice = useIsChapterSaved(chapter.id);

        return (
            <Card>
                <CardActionArea
                    component={Link}
                    to={AppRoutes.reader.path(manga.id, chapter.sourceOrder)}
                    state={Chapters.getReaderOpenChapterLocationState(chapter)}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const isRangeClick = e.shiftKey;
                        if (selected !== null || isRangeClick || e.ctrlKey || e.metaKey) {
                            onSelect(chapter.id, isRangeClick || !selected, isRangeClick);
                            return;
                        }

                        ReaderService.openReader(chapter);
                    }}
                    sx={{
                        color: (theme) => theme.palette.text[chapter.isRead ? 'disabled' : 'primary'],
                        // shift + click would select the text between the two cards
                        userSelect: 'none',
                    }}
                >
                    <ListCardContent sx={{ justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', flexGrow: 1, gap: 1, alignItems: 'center', minWidth: 0 }}>
                            <ChapterCardThumbnail
                                mangaId={manga.id}
                                sourceId={manga.sourceId}
                                mangaTitle={manga.title}
                                thumbnailUrl={manga.thumbnailUrl}
                                thumbnailUrlLastFetched={manga.thumbnailUrlLastFetched}
                            />

                            <Stack sx={{ minWidth: 0, gap: 0.5 }}>
                                <ChapterCardMetadata
                                    title={manga.title}
                                    secondaryText={chapter.scanlator}
                                    ternaryText={chapter.name}
                                />
                                <DownloadLocationLabels isOnServer={chapter.isDownloaded} isOnDevice={isOnDevice} />
                            </Stack>
                        </Box>
                        {selected === null ? (
                            <ChapterDownloadButton chapterId={chapter.id} isDownloaded={chapter.isDownloaded} />
                        ) : (
                            <Checkbox checked={selected} />
                        )}
                    </ListCardContent>
                </CardActionArea>
            </Card>
        );
    },
);
