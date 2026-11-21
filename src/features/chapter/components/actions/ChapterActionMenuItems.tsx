/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { openInAppWebView } from '@/features/webview/components/WebViewModal.tsx';
import { STABLE_EMPTY_ARRAY, STABLE_EMPTY_OBJECT } from '@/base/Base.constants.ts';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import Delete from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import RemoveDone from '@mui/icons-material/RemoveDone';
import Done from '@mui/icons-material/Done';
import BookmarkRemove from '@mui/icons-material/BookmarkRemove';
import BookmarkAdd from '@mui/icons-material/BookmarkAdd';
import DoneAll from '@mui/icons-material/DoneAll';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { useLingui } from '@lingui/react/macro';
import type { SelectableCollectionReturnType } from '@/base/collection/hooks/useSelectableCollection.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import { MenuItem } from '@/base/components/menu/MenuItem.tsx';
import {
    createGetMenuItemTitle,
    createIsMenuItemDisabled,
    createShouldShowMenuItem,
} from '@/base/components/menu/Menu.utils.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import type { ChapterCard } from '@/features/chapter/components/cards/ChapterCard.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import type { GetChaptersMangaQuery } from '@/lib/graphql/generated/graphql.ts';
import { GET_CHAPTERS_MANGA } from '@/lib/graphql/chapter/ChapterQuery.ts';
import { CHAPTER_ACTION_TO_TRANSLATION, FALLBACK_CHAPTER } from '@/features/chapter/Chapter.constants.ts';
import type {
    ChapterAction,
    ChapterBookmarkInfo,
    ChapterDownloadInfo,
    ChapterIdInfo,
    ChapterMangaInfo,
    ChapterReadInfo,
    ChapterRealUrlInfo,
} from '@/features/chapter/Chapter.types.ts';
import { IconWebView } from '@/assets/icons/IconWebView.tsx';
import { IconBrowser } from '@/assets/icons/IconBrowser.tsx';
import CancelIcon from '@mui/icons-material/Cancel';
import OfflinePinOutlined from '@mui/icons-material/OfflinePinOutlined';
import CloudOff from '@mui/icons-material/CloudOff';
import { useSavedChapters } from '@/features/offline/OfflineStorage.ts';
import { OfflineChapters } from '@/features/offline/OfflineChapters.ts';

type BaseProps = { onClose: () => void; selectable?: boolean };

type TChapter = ChapterIdInfo &
    ChapterMangaInfo &
    ChapterDownloadInfo &
    ChapterBookmarkInfo &
    ChapterReadInfo &
    ChapterRealUrlInfo;

type SingleModeProps = {
    chapter: TChapter;
    handleSelection?: SelectableCollectionReturnType<TChapter['id']>['handleSelection'];
    canBeDownloaded: boolean;
};

type SelectModeProps = {
    selectedChapters: ComponentProps<typeof ChapterCard>['chapter'][];
};

type Props =
    | (BaseProps & SingleModeProps & PropertiesNever<SelectModeProps>)
    | (BaseProps & PropertiesNever<SingleModeProps> & SelectModeProps);

export const ChapterActionMenuItems = ({
    chapter,
    handleSelection,
    canBeDownloaded = false,
    selectedChapters = STABLE_EMPTY_ARRAY,
    onClose,
    selectable = true,
}: Props) => {
    const { t } = useLingui();

    const isSingleMode = !!chapter;
    const { isDownloaded, isRead, isBookmarked } = chapter ?? STABLE_EMPTY_OBJECT;

    const mangaChaptersResponse = requestManager.useGetMangaChapters<GetChaptersMangaQuery>(
        GET_CHAPTERS_MANGA,
        chapter?.mangaId ?? -1,
        {
            skip: !chapter,
            fetchPolicy: 'cache-only',
        },
    );
    const allChapters = mangaChaptersResponse.data?.chapters.nodes ?? STABLE_EMPTY_ARRAY;

    const {
        settings: { deleteChaptersWithBookmark },
    } = useMetadataServerSettings();

    const getMenuItemTitle = createGetMenuItemTitle(isSingleMode, CHAPTER_ACTION_TO_TRANSLATION);
    const shouldShowMenuItem = createShouldShowMenuItem(isSingleMode);
    const isMenuItemDisabled = createIsMenuItemDisabled(isSingleMode);

    const {
        downloadingChapters,
        downloadableChapters,
        downloadedChapters,
        unbookmarkedChapters,
        bookmarkedChapters,
        unreadChapters,
        readChapters,
    } = useMemo(
        () => ({
            downloadingChapters: Chapters.getDownloading(selectedChapters),
            downloadableChapters: Chapters.getDownloadable(selectedChapters),
            downloadedChapters: Chapters.getDownloaded(selectedChapters),
            unbookmarkedChapters: Chapters.getNonBookmarked(selectedChapters),
            bookmarkedChapters: Chapters.getBookmarked(selectedChapters),
            unreadChapters: Chapters.getNonRead(selectedChapters),
            readChapters: Chapters.getRead(selectedChapters),
        }),
        [selectedChapters],
    );

    const savedChapters = useSavedChapters();
    const isChapterSaved = !!chapter && !!savedChapters[chapter.id];
    const chaptersToSave = (isSingleMode ? [chapter] : selectedChapters).filter(({ id }) => !savedChapters[id]);
    const savedChapterIds = (isSingleMode ? [chapter] : selectedChapters)
        .filter(({ id }) => !!savedChapters[id])
        .map(({ id }) => id);

    const handleSelect = () => {
        handleSelection?.(chapter.id, true);
        onClose();
    };

    const performAction = (action: ChapterAction | 'mark_prev_as_read', chapters: TChapter[]) => {
        const isMarkPrevAsRead = action === 'mark_prev_as_read';
        const actualAction: ChapterAction = isMarkPrevAsRead ? 'mark_as_read' : action;

        if (actualAction === 'delete' && chapter) {
            const isDeletable = Chapters.isDeletable(chapter, deleteChaptersWithBookmark);
            if (!isDeletable) {
                onClose();
                return;
            }
        }

        const getChapters = (): SingleModeProps['chapter'][] => {
            // select mode
            if (!chapter) {
                return chapters;
            }

            if (!isMarkPrevAsRead) {
                return [chapter];
            }

            const index = allChapters.findIndex(({ id: chapterId }) => chapterId === chapter.id);

            const isFirstChapter = index + 1 > allChapters.length - 1;
            if (isFirstChapter) {
                return [];
            }

            const previousChapters = allChapters.slice(index + 1);

            return Chapters.getNonRead(previousChapters);
        };

        const chaptersToUpdate = getChapters();

        if (!chaptersToUpdate.length) {
            onClose();
            return;
        }

        Chapters.performAction(actualAction, Chapters.getIds(chaptersToUpdate), {
            chapters: chaptersToUpdate,
            wasManuallyMarkedAsRead: true,
            trackProgressMangaId: chaptersToUpdate[0]?.mangaId,
        }).catch(defaultPromiseErrorHandler('ChapterActionMenuItems::performAction'));
        onClose();
    };

    return (
        <>
            {isSingleMode && selectable && (
                <MenuItem onClick={handleSelect} Icon={CheckBoxOutlineBlank} title={t`Select`} />
            )}
            {isSingleMode && (
                <>
                    <MenuItem
                        Icon={IconBrowser}
                        disabled={!chapter!.realUrl}
                        onClick={() => {
                            window.open(chapter!.realUrl!, '_blank', 'noopener,noreferrer');
                            onClose();
                        }}
                        title={t`Open in browser`}
                    />
                    <MenuItem
                        Icon={IconWebView}
                        disabled={!chapter!.realUrl}
                        onClick={() => {
                            openInAppWebView(requestManager.getWebviewUrl(chapter!.realUrl!));
                            onClose();
                        }}
                        title={t`Open in WebView`}
                    />
                </>
            )}
            {shouldShowMenuItem(canBeDownloaded) && (
                <MenuItem
                    Icon={Download}
                    disabled={isMenuItemDisabled(!downloadableChapters.length)}
                    onClick={() => performAction('download', downloadableChapters)}
                    title={getMenuItemTitle('download', downloadableChapters.length)}
                />
            )}
            {shouldShowMenuItem(Chapters.isDownloading(chapter?.id ?? FALLBACK_CHAPTER.id)) && (
                <MenuItem
                    Icon={CancelIcon}
                    disabled={isMenuItemDisabled(!downloadingChapters.length)}
                    onClick={() => performAction('download_cancel', downloadingChapters)}
                    title={getMenuItemTitle('download_cancel', downloadingChapters.length)}
                />
            )}
            {shouldShowMenuItem(isDownloaded) && (
                <MenuItem
                    Icon={Delete}
                    disabled={isMenuItemDisabled(!downloadedChapters.length)}
                    onClick={() =>
                        performAction('delete', Chapters.getDeletable(downloadedChapters, deleteChaptersWithBookmark))
                    }
                    title={getMenuItemTitle('delete', downloadedChapters.length)}
                />
            )}
            {shouldShowMenuItem(!isChapterSaved) && (
                <MenuItem
                    Icon={OfflinePinOutlined}
                    disabled={isMenuItemDisabled(!chaptersToSave.length)}
                    onClick={() => {
                        OfflineChapters.save(chaptersToSave).catch(
                            defaultPromiseErrorHandler('ChapterActionMenuItems::saveToDevice'),
                        );
                        onClose();
                    }}
                    title={isSingleMode ? t`Save on this device` : t`Save selected on this device`}
                />
            )}
            {shouldShowMenuItem(isChapterSaved) && (
                <MenuItem
                    Icon={CloudOff}
                    disabled={isMenuItemDisabled(!savedChapterIds.length)}
                    onClick={() => {
                        OfflineChapters.remove(savedChapterIds).catch(
                            defaultPromiseErrorHandler('ChapterActionMenuItems::removeFromDevice'),
                        );
                        onClose();
                    }}
                    title={isSingleMode ? t`Remove from this device` : t`Remove selected from this device`}
                />
            )}
            {shouldShowMenuItem(!isBookmarked) && (
                <MenuItem
                    Icon={BookmarkAdd}
                    disabled={isMenuItemDisabled(!unbookmarkedChapters.length)}
                    onClick={() => performAction('bookmark', unbookmarkedChapters)}
                    title={getMenuItemTitle('bookmark', unbookmarkedChapters.length)}
                />
            )}
            {shouldShowMenuItem(isBookmarked) && (
                <MenuItem
                    Icon={BookmarkRemove}
                    disabled={isMenuItemDisabled(!bookmarkedChapters.length)}
                    onClick={() => performAction('unbookmark', bookmarkedChapters)}
                    title={getMenuItemTitle('unbookmark', bookmarkedChapters.length)}
                />
            )}
            {shouldShowMenuItem(!isRead) && (
                <MenuItem
                    Icon={Done}
                    disabled={isMenuItemDisabled(!unreadChapters.length)}
                    onClick={() => performAction('mark_as_read', unreadChapters)}
                    title={getMenuItemTitle('mark_as_read', unreadChapters.length)}
                />
            )}
            {shouldShowMenuItem(isRead) && (
                <MenuItem
                    Icon={RemoveDone}
                    disabled={isMenuItemDisabled(!readChapters.length)}
                    onClick={() => performAction('mark_as_unread', readChapters)}
                    title={getMenuItemTitle('mark_as_unread', readChapters.length)}
                />
            )}
            {isSingleMode && (
                <MenuItem
                    onClick={() => performAction('mark_prev_as_read', [])}
                    Icon={DoneAll}
                    title={t`Mark previous as read`}
                />
            )}
        </>
    );
};
