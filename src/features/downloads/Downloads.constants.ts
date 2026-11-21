/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { DownloadedChaptersSort } from '@/features/downloads/Downloads.types.ts';

export const DOWNLOAD_AHEAD = {
    min: 2,
    max: 10,
    default: 2,
    step: 1,
};

export const DOWNLOADED_CHAPTERS_SORT_TO_TRANSLATION: Record<DownloadedChaptersSort, MessageDescriptor> = {
    [DownloadedChaptersSort.RECENTLY_READ]: msg`Recently read`,
    [DownloadedChaptersSort.NEWEST_CHAPTERS]: msg`Newest chapters`,
    [DownloadedChaptersSort.OLDEST_CHAPTERS]: msg`Oldest chapters`,
    [DownloadedChaptersSort.RECENTLY_ADDED]: msg`Recently added`,
    [DownloadedChaptersSort.MANGA_TITLE]: msg`Manga title`,
};
