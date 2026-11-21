/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useState } from 'react';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import type { SourceFilters } from '@/features/source/Source.types.ts';

// the hint that extensions with filters that are loaded from the site add to the list until they are there
const INCOMPLETE_FILTERS_HINT = /load filters/i;
const RELOAD_DELAY_MS = 2_500;
const MAX_RELOADS = 8;

export const areSourceFiltersIncomplete = (filters: readonly SourceFilters[] | undefined): boolean =>
    !!filters?.some((filter) => filter.type === 'HeaderFilter' && INCOMPLETE_FILTERS_HINT.test(filter.name));

/**
 * Some extensions only have a part of their filters (the genres, types, ...) when a source is opened for the first time:
 * the rest is loaded from the site in the background and is there on the next request, together with a hint to
 * request again. The positions of the filters that the app sends refer to the list it has, so working with the short
 * list would change the wrong filter (or fail) once the server has the full one.
 *
 * Asks for the filters again until the list is complete (or a few times, if the site cannot be reached).
 *
 * @returns whether the list is incomplete
 */
export const useReloadIncompleteSourceFilters = (
    filters: readonly SourceFilters[] | undefined,
    reload: () => Promise<unknown>,
): boolean => {
    const isIncomplete = areSourceFiltersIncomplete(filters);
    const [reloadCount, setReloadCount] = useState(0);

    useEffect(() => {
        if (!isIncomplete) {
            setReloadCount(0);
            return undefined;
        }

        if (reloadCount >= MAX_RELOADS) {
            return undefined;
        }

        const timeout = setTimeout(() => {
            setReloadCount((count) => count + 1);
            reload().catch(defaultPromiseErrorHandler('useReloadIncompleteSourceFilters::reload'));
        }, RELOAD_DELAY_MS);

        return () => clearTimeout(timeout);
    }, [isIncomplete, reloadCount]);

    return isIncomplete;
};
