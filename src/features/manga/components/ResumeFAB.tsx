/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Link } from 'react-router-dom';
import PlayArrow from '@mui/icons-material/PlayArrow';
import { useLingui } from '@lingui/react/macro';
import { StyledFab } from '@/base/components/buttons/StyledFab.tsx';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import type {
    ChapterMangaInfo,
    ChapterNameInfo,
    ChapterNumberInfo,
    ChapterReadInfo,
    ChapterScanlatorInfo,
    ChapterSourceOrderInfo,
} from '@/features/chapter/Chapter.types.ts';
import { ContinueReadingTooltip } from '@/features/manga/components/ContinueReadingTooltip.tsx';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { ReaderService } from '@/features/reader/services/ReaderService.ts';

export function ResumeFab({
    chapter,
    isStarted,
}: {
    /** reading of the manga was already started: "Continue" instead of "Start" */
    isStarted: boolean;
    chapter: ChapterMangaInfo &
        ChapterSourceOrderInfo &
        ChapterReadInfo &
        ChapterNumberInfo &
        ChapterNameInfo &
        ChapterScanlatorInfo;
}) {
    const { t } = useLingui();

    const { sourceOrder, name, chapterNumber, scanlator } = chapter;

    return (
        <ContinueReadingTooltip
            chapterNumber={chapterNumber}
            name={name}
            sourceOrder={sourceOrder}
            scanlator={scanlator}
            isStarted={isStarted}
        >
            <StyledFab
                component={Link}
                variant="extended"
                color="primary"
                to={AppRoutes.reader.path(chapter.mangaId, chapter.sourceOrder)}
                state={Chapters.getReaderOpenChapterLocationState(chapter)}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ReaderService.openReader(chapter);
                }}
            >
                <PlayArrow />
                {isStarted ? t`Continue` : t`Start`}
            </StyledFab>
        </ContinueReadingTooltip>
    );
}
