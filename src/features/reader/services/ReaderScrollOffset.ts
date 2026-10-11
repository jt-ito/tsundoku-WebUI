/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { coerceIn } from '@/lib/HelperFunctions.ts';

const USER_INPUT_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
// the page images change their height while they load, so the spot is restored again for a while, until the reader
// scrolls by itself
const RESUME_TIMEOUT_MS = 8000;

type PendingResume = { chapterId: number; pageIndex: number; offset: number };

let pending: PendingResume | null = null;
let timeout: ReturnType<typeof setTimeout> | undefined;

const clearPendingResume = () => {
    pending = null;
    clearTimeout(timeout);
    USER_INPUT_EVENTS.forEach((event) => window.removeEventListener(event, clearPendingResume));
};

const scrollToPendingResume = (page: HTMLElement, scrollElement: HTMLElement) => {
    if (!pending) {
        return;
    }

    const pageRect = page.getBoundingClientRect();
    const containerRect = scrollElement.getBoundingClientRect();
    // eslint-disable-next-line no-param-reassign
    scrollElement.scrollTop += pageRect.top - containerRect.top + pending.offset * pageRect.height;
};

/**
 * Where in its page the reader is scrolled (0 = top of the page, 1 = bottom of it), to resume reading in webtoon style
 * reading modes at the exact spot instead of at the top of the page.
 */
export const ReaderScrollOffset = {
    /** How far the top edge of the scroll container is into the page, as a fraction of the page height. */
    getOffset: (page: HTMLElement, scrollElement: HTMLElement): number => {
        const pageRect = page.getBoundingClientRect();
        if (pageRect.height <= 0) {
            return 0;
        }

        return coerceIn((scrollElement.getBoundingClientRect().top - pageRect.top) / pageRect.height, 0, 1);
    },

    /** Remembers the spot to scroll to once the page is rendered, an offset of 0 clears it. */
    setPendingResume: (chapterId: number, pageIndex: number, offset: number): void => {
        clearPendingResume();
        if (offset <= 0) {
            return;
        }

        pending = { chapterId, pageIndex, offset };
        USER_INPUT_EVENTS.forEach((event) => window.addEventListener(event, clearPendingResume, { passive: true }));
        timeout = setTimeout(clearPendingResume, RESUME_TIMEOUT_MS);
    },

    applyPendingResume: (chapterId: number, pageIndex: number, page: HTMLElement, scrollElement: HTMLElement): void => {
        if (pending?.chapterId === chapterId && pending.pageIndex === pageIndex) {
            scrollToPendingResume(page, scrollElement);
        }
    },

    reapplyPendingResume: (
        chapterId: number,
        pages: (HTMLElement | null)[],
        scrollElement: HTMLElement | null,
    ): void => {
        if (!pending || pending.chapterId !== chapterId || !scrollElement) {
            return;
        }

        const page = pages[pending.pageIndex];
        if (page) {
            scrollToPendingResume(page, scrollElement);
        }
    },
};
