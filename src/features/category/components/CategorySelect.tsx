/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState, useEffect, useMemo } from 'react';
import Button from '@mui/material/Button';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import FormGroup from '@mui/material/FormGroup';
import { Link } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import type { AwaitableComponentProps } from 'awaitable-component';
import { useLingui } from '@lingui/react/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { Categories, DEFAULT_CATEGORY_ID } from '@/features/category/services/Categories.ts';
import { CheckboxInput } from '@/base/components/inputs/CheckboxInput.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { updateMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { STABLE_EMPTY_ARRAY } from '@/base/Base.constants.ts';
import type {
    GetCategoriesBaseQuery,
    GetCategoriesBaseQueryVariables,
    GetMangaCategoriesQuery,
    GetMangaCategoriesQueryVariables,
    GetMangaCategoryIdsQuery,
    GetMangaCategoryIdsQueryVariables,
} from '@/lib/graphql/generated/graphql.ts';
import { GET_CATEGORIES_BASE } from '@/lib/graphql/category/CategoryQuery.ts';
import { GET_MANGA_CATEGORIES, GET_MANGA_CATEGORY_IDS } from '@/lib/graphql/manga/MangaQuery.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';

type BaseProps = AwaitableComponentProps<{ addToCategories?: number[]; removeFromCategories?: number[] }>;

type SingleMangaModeProps = {
    mangaId: number;
    addToLibrary?: boolean;
};

type MultiMangaModeProps = {
    mangaIds: number[];
};

export type CategorySelectProps =
    | (BaseProps & SingleMangaModeProps & PropertiesNever<MultiMangaModeProps>)
    | (BaseProps & PropertiesNever<SingleMangaModeProps> & MultiMangaModeProps);

// how many of the selected manga are in a category
type Membership = 'all' | 'some' | 'none';

const LIBRARY_CONDITION = { condition: { inLibrary: true } };

const useGetMangaCategoryIds = (mangaId: number | undefined): number[] => {
    const { data: mangaResult } = requestManager.useGetManga<GetMangaCategoriesQuery, GetMangaCategoriesQueryVariables>(
        GET_MANGA_CATEGORIES,
        mangaId ?? -1,
        { skip: mangaId === undefined },
    );

    return useMemo(() => {
        if (mangaId === undefined || !mangaResult) {
            return [];
        }

        return Categories.getIds(mangaResult.manga.categories.nodes);
    }, [mangaResult?.manga.categories.nodes, mangaId]);
};

export function CategorySelect(props: CategorySelectProps) {
    const { t } = useLingui();

    const {
        onDismiss,
        onSubmit,
        isVisible,
        onExitComplete,
        mangaId,
        mangaIds: passedMangaIds,
        addToLibrary = false,
    } = props;

    const isSingleSelectionMode = mangaId !== undefined;
    const mangaIds = passedMangaIds ?? [mangaId];

    const [doNotShowAddToLibraryDialogAgain, setDoNotShowAddToLibraryDialogAgain] = useState(false);

    const singleMangaCategoryIds = useGetMangaCategoryIds(mangaId);
    // the same query the library category filter uses: the categories of every manga of the library
    const { data: libraryCategoriesData, loading: isLibraryCategoriesLoading } = requestManager.useGetMangas<
        GetMangaCategoryIdsQuery,
        GetMangaCategoryIdsQueryVariables
    >(GET_MANGA_CATEGORY_IDS, LIBRARY_CONDITION, { skip: isSingleSelectionMode });

    const { data } = requestManager.useGetCategories<GetCategoriesBaseQuery, GetCategoriesBaseQueryVariables>(
        GET_CATEGORIES_BASE,
    );
    const categoriesData = data?.categories.nodes ?? STABLE_EMPTY_ARRAY;

    // a manga can be linked into the categories of other accounts (shared libraries): only the ones listed here are this account's
    const ownCategoryIds = useMemo(() => new Set(categoriesData.map((category) => category.id)), [categoriesData]);

    // for every category, how many of the selected manga are in it. The Default category holds the manga that were put
    // into it on purpose and the ones that are in no other category
    const { categoryCounts, defaultCount, explicitDefaultCount } = useMemo(() => {
        const counts = new Map<number, number>();
        let inDefault = 0;
        let explicitInDefault = 0;

        const countManga = (categoryIdsOfManga: number[]) => {
            const ownIds = categoryIdsOfManga.filter((categoryId) => ownCategoryIds.has(categoryId));
            const isLinkedToDefault = ownIds.includes(DEFAULT_CATEGORY_ID);
            const otherIds = ownIds.filter((categoryId) => categoryId !== DEFAULT_CATEGORY_ID);

            otherIds.forEach((categoryId) => counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1));
            explicitInDefault += isLinkedToDefault ? 1 : 0;
            inDefault += isLinkedToDefault || !otherIds.length ? 1 : 0;
        };

        if (isSingleSelectionMode) {
            // a manga that is not in the library yet (added right now) is in no category
            countManga(singleMangaCategoryIds);
        } else {
            const selectedMangaIds = new Set(mangaIds);
            const mangasOfLibrary = libraryCategoriesData?.mangas.nodes ?? STABLE_EMPTY_ARRAY;
            const selectedMangas = mangasOfLibrary.filter((manga) => selectedMangaIds.has(manga.id));
            selectedMangas.forEach((manga) => countManga(manga.categories.nodes.map((category) => category.id)));
            // selected manga the library data does not know are in no category
            inDefault += mangaIds.length - selectedMangas.length;
        }

        return { categoryCounts: counts, defaultCount: inDefault, explicitDefaultCount: explicitInDefault };
    }, [isSingleSelectionMode, singleMangaCategoryIds, libraryCategoriesData, ownCategoryIds, mangaIds.join(',')]);

    const toMembership = (count: number): Membership => {
        if (!count) {
            return 'none';
        }

        return count >= mangaIds.length ? 'all' : 'some';
    };

    const getMembership = (categoryId: number): Membership =>
        toMembership(categoryId === DEFAULT_CATEGORY_ID ? defaultCount : (categoryCounts.get(categoryId) ?? 0));

    const allCategories = useMemo(() => Categories.getUserCreated(categoriesData), [categoriesData]);

    // the default category is "in none of the categories": it is listed when the account has it, and picking it clears the others
    const userCreatedIds = useMemo(() => Categories.getIds(allCategories), [allCategories]);

    const defaultCategoryIds = useMemo(
        () => (addToLibrary ? Categories.getIds(Categories.getDefaults(allCategories)) : []),
        [allCategories, addToLibrary],
    );

    // what the user changed: a category the selected manga are in starts checked, clicking it unchecks it (and the other way round)
    const [choices, setChoices] = useState<Record<number, boolean>>({});
    const membershipKey = [...categoryCounts.entries(), defaultCount, explicitDefaultCount].join(';');

    useEffect(() => {
        const initialChoices: Record<number, boolean> = Object.fromEntries(
            defaultCategoryIds.map((categoryId) => [categoryId, true]),
        );
        // a manga that is added to the library goes into the categories that are set up for that, not into the Default one too
        if (defaultCategoryIds.length) {
            initialChoices[DEFAULT_CATEGORY_ID] = false;
        }

        setChoices(initialChoices);
    }, [membershipKey, defaultCategoryIds]);

    const getCategoryState = (categoryId: number): boolean | 'mixed' => {
        const choice = choices[categoryId];
        if (choice !== undefined) {
            return choice;
        }

        const membership = getMembership(categoryId);
        if (membership === 'some') {
            return 'mixed';
        }

        return membership === 'all';
    };

    // While the Default category is deleted, the category marked as the default one (or else the first one) takes its place.
    const fallbackCategoryIds = useMemo(() => {
        if (ownCategoryIds.has(DEFAULT_CATEGORY_ID) || !allCategories.length) {
            return [];
        }

        const markedCategoryIds = Categories.getIds(Categories.getDefaults(allCategories));
        if (markedCategoryIds.length) {
            return markedCategoryIds;
        }

        return [[...allCategories].sort((a, b) => a.order - b.order)[0].id];
    }, [ownCategoryIds, allCategories]);

    // Nothing else is checked: the manga would be in no category, so they are in the Default category, or in the one that
    // takes its place, and it cannot be unchecked (check another category first)
    const areAllCategoriesOff = userCreatedIds.every((categoryId) => getCategoryState(categoryId) === false);
    const isForced = (categoryId: number): boolean =>
        areAllCategoriesOff && (categoryId === DEFAULT_CATEGORY_ID || fallbackCategoryIds.includes(categoryId));

    const getCheckedState = (categoryId: number): boolean | 'mixed' =>
        isForced(categoryId) ? true : getCategoryState(categoryId);

    const toggleCategory = (categoryId: number) => {
        if (isForced(categoryId)) {
            return;
        }

        const state = getCheckedState(categoryId);
        setChoices((prev) => ({ ...prev, [categoryId]: state !== true }));
    };

    const handleCancel = () => {
        setChoices({});
        onDismiss();
    };

    const handleOk = () => {
        const addToCategories: number[] = [];
        const removeFromCategories: number[] = [];

        userCreatedIds.forEach((categoryId) => {
            const checkedState = getCheckedState(categoryId);
            const membership = getMembership(categoryId);

            if (checkedState === true && membership !== 'all') {
                addToCategories.push(categoryId);
            }

            if (checkedState === false && membership !== 'none') {
                removeFromCategories.push(categoryId);
            }
        });

        // The Default category is only linked while the manga are in other categories too (the manga without a category
        // are in it anyway): then the link keeps them in it.
        if (ownCategoryIds.has(DEFAULT_CATEGORY_ID)) {
            const defaultState = getCheckedState(DEFAULT_CATEGORY_ID);
            const isInOtherCategories = userCreatedIds.some((categoryId) => getCheckedState(categoryId) !== false);
            const explicitMembership = toMembership(explicitDefaultCount);

            if (defaultState === true && isInOtherCategories) {
                if (explicitMembership !== 'all') {
                    addToCategories.push(DEFAULT_CATEGORY_ID);
                }
            } else if (defaultState !== 'mixed' && explicitMembership !== 'none') {
                removeFromCategories.push(DEFAULT_CATEGORY_ID);
            }
        }

        onSubmit({
            addToCategories,
            removeFromCategories,
        });

        if (doNotShowAddToLibraryDialogAgain) {
            updateMetadataServerSettings('showAddToLibraryCategorySelectDialog', false).catch((e) =>
                makeToast(t`Could not save the default search settings to the server`, 'error', getErrorMessage(e)),
            );
        }

        const isUpdateRequired = !!addToCategories.length || !!removeFromCategories.length;
        if (!isUpdateRequired) {
            return;
        }

        if (addToLibrary) {
            // categories get updated in MangaDetails
            return;
        }

        Mangas.performAction('change_categories', mangaIds, {
            changeCategoriesPatch: {
                addToCategories,
                removeFromCategories,
            },
        }).catch(defaultPromiseErrorHandler('CategorySelect::handleOk'));
    };

    return (
        <Dialog
            sx={{
                '.MuiDialog-paper': {
                    maxHeight: 435,
                    width: '80%',
                },
            }}
            maxWidth="xs"
            open={isVisible}
            onTransitionExited={onExitComplete}
            onClose={handleCancel}
        >
            <DialogTitle>{t`Set categories`}</DialogTitle>
            <DialogContent dividers>
                <FormGroup>
                    {categoriesData.length === 0 && <span>{t`You don't have any categories yet.`}</span>}
                    {categoriesData.map((category) => {
                        const checkedState = getCheckedState(category.id);

                        return (
                            <CheckboxInput
                                key={category.id}
                                label={category.name}
                                checked={checkedState === true}
                                // some of the selected manga are in it: the first click puts all of them in it
                                indeterminate={checkedState === 'mixed'}
                                onChange={() => toggleCategory(category.id)}
                            />
                        );
                    })}
                </FormGroup>
            </DialogContent>
            <DialogActions>
                <Stack sx={{ width: '100%' }}>
                    {addToLibrary && (
                        <CheckboxInput
                            sx={{ margin: 0 }}
                            size="small"
                            label={t`Don't show this dialog again`}
                            onChange={(e) => setDoNotShowAddToLibraryDialogAgain(e.target.checked)}
                        />
                    )}
                    <Stack
                        direction="row"
                        sx={{
                            justifyContent: 'space-between',
                            alignItems: 'end',
                            width: '100%',
                        }}
                    >
                        <Button component={Link} to={AppRoutes.settings.children.categories.path} onClick={onDismiss}>
                            {allCategories.length ? t`Edit` : t`Create`}
                        </Button>
                        <Stack direction="row">
                            <Button autoFocus onClick={handleCancel} color="primary">
                                {t`Cancel`}
                            </Button>
                            {!!allCategories.length && (
                                <Button
                                    onClick={handleOk}
                                    color="primary"
                                    disabled={!isSingleSelectionMode && isLibraryCategoriesLoading}
                                >
                                    {t`Ok`}
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}
