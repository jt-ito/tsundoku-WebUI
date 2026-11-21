/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { TriState } from '@/lib/graphql/generated/graphql-base.types.ts';
import type { IPos, SourceFilters } from '@/features/source/Source.types.ts';

// "Slice of Life", "slice-of-life" and " Slice of life " are the same tag
const normalize = (name: string): string => name.toLowerCase().replaceAll(/[-_]+/g, ' ').replaceAll(/\s+/g, ' ').trim();

// a text box for tags ("Tags (separated by commas)"), not the one for the tags to leave out
const isTagTextFilter = (name: string): boolean =>
    /(tags?|genres?)/i.test(name) && !/exclude|blacklist|ignore|hide|without/i.test(name);

const findInFilters = (
    filters: readonly SourceFilters[],
    tag: string,
    parentPositions: number[],
    isTextAllowed = false,
): IPos | undefined => {
    for (const [index, filter] of filters.entries()) {
        const positions = [...parentPositions, index];

        switch (filter.type) {
            case 'GroupFilter': {
                const found = findInFilters(filter.filters as SourceFilters[], tag, positions, isTextAllowed);
                if (found) {
                    return found;
                }
                break;
            }
            case 'CheckBoxFilter':
                if (normalize(filter.name) === tag) {
                    return { type: 'checkBoxState', positions, state: true };
                }
                break;
            case 'TriStateFilter':
                if (normalize(filter.name) === tag) {
                    return { type: 'triState', positions, state: TriState.Include };
                }
                break;
            case 'SelectFilter': {
                const valueIndex = filter.values.findIndex((value) => normalize(value) === tag);
                if (valueIndex !== -1) {
                    return { type: 'selectState', positions, state: valueIndex };
                }
                break;
            }
            case 'TextFilter':
                if (isTextAllowed && isTagTextFilter(filter.name)) {
                    return { type: 'textState', positions, state: tag };
                }
                break;
            default:
                break;
        }
    }

    return undefined;
};

/**
 * Finds the filter of a source that is the tag (a genre, a type, ...) of a manga, as the change to make to the filters
 * to search for it: the checkbox or tri state with its name (in a group, in a group of groups, or on its own), or the
 * value of a select with its name. The first one in the list of the source.
 *
 * Failing that, a text box for tags gets the tag. Without any such filter the tag can only be searched as text, which
 * looks for a title with that word.
 */
export const findFilterForTag = (filters: readonly SourceFilters[], tag: string): IPos | undefined => {
    const normalizedTag = normalize(tag);

    if (!normalizedTag) {
        return undefined;
    }

    // a checkbox, tri state or select of the tag comes first; a text box for tags (e.g. nhentai.net) is the last resort
    return findInFilters(filters, normalizedTag, []) ?? findInFilters(filters, tag.trim(), [], true);
};
