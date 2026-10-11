/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { requestManager } from '@/lib/requests/RequestManager.ts';
import { STABLE_EMPTY_ARRAY } from '@/base/Base.constants.ts';

/** How many installed extensions have an update (from what is already loaded, it does not fetch anything). */
export const useExtensionUpdateCount = (): number => {
    const { data } = requestManager.useGetExtensionList({ fetchPolicy: 'cache-only' });

    const extensions = data?.extensions.nodes ?? STABLE_EMPTY_ARRAY;

    return extensions.filter((extension) => extension.hasUpdate && !extension.isObsolete).length;
};
