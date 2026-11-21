/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo, useState } from 'react';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import type {
    MangaDescriptionInfo,
    MangaGenreInfo,
    MangaIdInfo,
    MangaLocationState,
    MangaMetaInfo,
    MangaSourceIdInfo,
} from '@/features/manga/Manga.types.ts';
import { SearchLink } from '@/features/manga/components/details/SearchLink.tsx';
import { MangaNotes } from '@/features/manga/components/details/MangaNotes.tsx';
import { useGetMangaMetadata } from '@/features/manga/services/MangaMetadata.ts';
import uniq from 'lodash/fp/uniq';
import { MarkdownViewer } from '@/lib/mui-tiptap/MarkdownViewer.tsx';
import { useNavigate } from 'react-router-dom';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { GET_SOURCE_BROWSE } from '@/lib/graphql/source/SourceQuery.ts';
import type { GetSourceBrowseQuery, GetSourceBrowseQueryVariables } from '@/lib/graphql/generated/graphql.ts';
import type { IPos } from '@/features/source/Source.types.ts';
import { SourceContentType } from '@/features/source/Source.types.ts';
import { findFilterForTag } from '@/features/source/services/SourceFilterSearch.ts';
import { useReloadIncompleteSourceFilters } from '@/features/source/hooks/useReloadIncompleteSourceFilters.ts';

const OPEN_CLOSE_BUTTON_HEIGHT = '35px';
const DESCRIPTION_COLLAPSED_SIZE = 100;

export const DescriptionGenre = ({
    manga,
    mode,
}: {
    manga: MangaDescriptionInfo & MangaGenreInfo & MangaIdInfo & MangaMetaInfo & MangaSourceIdInfo;
    mode: MangaLocationState['mode'];
}) => {
    const { description, genre: mangaGenres, sourceId } = manga;
    const { notes } = useGetMangaMetadata(manga);
    const hasNotes = notes.trim().length > 0;
    const hasCollapsibleContent = !!description || hasNotes;
    const [descriptionElement, setDescriptionElement] = useState<HTMLDivElement | null>(null);
    const [descriptionHeight, setDescriptionHeight] = useState<number>();
    useResizeObserver(
        descriptionElement,
        useCallback(() => setDescriptionHeight(descriptionElement?.clientHeight), [descriptionElement]),
    );

    const [isCollapsed, setIsCollapsed] = useLocalStorage('isDescriptionGenreCollapsed', true);

    const collapsedSize = hasCollapsibleContent
        ? Math.min(DESCRIPTION_COLLAPSED_SIZE, descriptionHeight ?? DESCRIPTION_COLLAPSED_SIZE)
        : 0;
    const genres = useMemo(() => uniq(mangaGenres.filter(Boolean)), [mangaGenres]);

    const navigate = useNavigate();

    // A genre is searched in the source the manga is from, wherever the page was opened from (the library, the updates,
    // the history or the source itself), like Mihon does. The other places (the global search, the migration) keep their
    // own search.
    const canSearchSource = sourceId !== undefined && (mode === 'source' || mode === 'default' || mode === undefined);
    const {
        data: sourceData,
        error: sourceError,
        refetch: refetchSource,
    } = requestManager.useGetSource<GetSourceBrowseQuery, GetSourceBrowseQueryVariables>(GET_SOURCE_BROWSE, sourceId, {
        skip: !canSearchSource,
    });
    // a source that cannot be opened (e.g. its extension was uninstalled) leaves the search of the library
    const isSourceMode = canSearchSource && !sourceError;

    // A genre that is a filter of the source is searched with that filter, like the source's own filter screen does.
    // Searching its name as text only finds the titles that have the word in them.
    const sourceFilters = sourceData?.source.filters;
    // some extensions have only a part of their filters at first, the genres come a moment later
    useReloadIncompleteSourceFilters(isSourceMode ? sourceFilters : undefined, refetchSource);
    const filterByGenre = useMemo(() => {
        const filters = new Map<string, IPos>();
        if (!sourceFilters) {
            return filters;
        }

        genres.forEach((genre) => {
            const filter = findFilterForTag(sourceFilters, genre);
            if (filter) {
                filters.set(genre, filter);
            }
        });

        return filters;
    }, [genres, sourceFilters]);

    return (
        <>
            {hasCollapsibleContent ? (
                <Stack sx={{ position: 'relative' }}>
                    <Collapse collapsedSize={collapsedSize} in={!isCollapsed}>
                        <Stack
                            ref={setDescriptionElement}
                            sx={{
                                gap: 1,
                                mb: OPEN_CLOSE_BUTTON_HEIGHT,
                            }}
                        >
                            <MangaNotes manga={manga} showDivider={!!description} />
                            {description && <MarkdownViewer markdown={description} />}
                        </Stack>
                    </Collapse>
                    <Stack
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        sx={{
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            cursor: 'pointer',
                            position: 'absolute',
                            width: '100%',
                            height: OPEN_CLOSE_BUTTON_HEIGHT,
                            bottom: 0,
                            background: (theme) =>
                                `linear-gradient(transparent -15px, ${theme.palette.background.default})`,
                        }}
                    >
                        <IconButton sx={{ color: (theme) => (theme.palette.mode === 'light' ? 'black' : 'text') }}>
                            {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                        </IconButton>
                    </Stack>
                </Stack>
            ) : (
                <MangaNotes manga={manga} showDivider={false} />
            )}
            <Stack
                sx={{
                    flexDirection: 'row',
                    flexWrap: isCollapsed ? 'no-wrap' : 'wrap',
                    gap: 1,
                    overflowX: isCollapsed ? 'auto' : null,
                }}
            >
                {genres.map((genre) => {
                    const filter = filterByGenre.get(genre);
                    if (!filter) {
                        return (
                            <SearchLink
                                key={genre}
                                query={genre}
                                sourceId={sourceId}
                                mode={isSourceMode ? 'source' : mode}
                            >
                                <Chip label={genre} variant="outlined" onClick={() => {}} />
                            </SearchLink>
                        );
                    }

                    return (
                        <Chip
                            key={genre}
                            label={genre}
                            variant="outlined"
                            onClick={() =>
                                navigate(AppRoutes.sources.children.browse.path(sourceId), {
                                    state: AppRoutes.sources.children.browse.state({
                                        contentType: SourceContentType.SEARCH,
                                        filters: [filter],
                                    }),
                                })
                            }
                        />
                    );
                })}
            </Stack>
        </>
    );
};
