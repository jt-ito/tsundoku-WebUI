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
import { useLingui } from '@lingui/react/macro';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { ChapterCardMetadata } from '@/features/chapter/components/cards/ChapterCardMetadata.tsx';
import { ListCardContent } from '@/base/components/lists/cards/ListCardContent';
import { DownloadLocationLabels } from '@/features/downloads/components/DownloadLocationLabels.tsx';
import type { SavedChapter } from '@/features/offline/OfflineStorage.ts';

/**
 * A chapter saved on this device, listed from what was kept with it: used when the server cannot be asked about the
 * chapters (see "DownloadedChapters"). Selects like "DownloadedChapterCard".
 */
export const SavedChapterCard = memo(
    ({
        saved,
        selected,
        onSelect,
    }: {
        saved: SavedChapter;
        selected: boolean | null;
        onSelect: (chapterId: number, selected: boolean, selectRange: boolean) => void;
    }) => {
        const { t } = useLingui();

        return (
            <Card>
                <CardActionArea
                    component={Link}
                    to={AppRoutes.reader.path(saved.mangaId, saved.sourceOrder ?? 0)}
                    onClick={(e: React.MouseEvent) => {
                        const isRangeClick = e.shiftKey;
                        const isSelectClick = selected !== null || isRangeClick || e.ctrlKey || e.metaKey;
                        // without the position of the chapter in the manga it cannot be opened, only selected
                        if (!isSelectClick && saved.sourceOrder !== undefined) {
                            return;
                        }

                        e.preventDefault();
                        e.stopPropagation();
                        if (isSelectClick) {
                            onSelect(saved.chapterId, isRangeClick || !selected, isRangeClick);
                        }
                    }}
                    sx={{ userSelect: 'none' }}
                >
                    <ListCardContent sx={{ justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', flexGrow: 1, minWidth: 0 }}>
                            <Stack sx={{ minWidth: 0, gap: 0.5 }}>
                                <ChapterCardMetadata
                                    title={saved.mangaTitle ?? `${t`Manga`} ${saved.mangaId}`}
                                    ternaryText={saved.chapterName ?? `${t`Chapter`} ${saved.chapterId}`}
                                />
                                <DownloadLocationLabels isOnServer={false} isOnDevice />
                            </Stack>
                        </Box>
                        {selected !== null && <Checkbox checked={selected} />}
                    </ListCardContent>
                </CardActionArea>
            </Card>
        );
    },
);
