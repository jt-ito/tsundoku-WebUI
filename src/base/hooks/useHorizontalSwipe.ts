/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { TouchEvent } from 'react';
import { useRef } from 'react';

const MIN_DISTANCE = 70;
const MAX_DURATION_MS = 700;
// the gesture has to be clearly more horizontal than vertical, so scrolling is never taken for a swipe
const HORIZONTAL_RATIO = 2;

/**
 * Touch handlers that call `onSwipeLeft` / `onSwipeRight` for a quick, mostly horizontal swipe.
 * Swipes that start inside an element matching `ignoreSelector` (e.g. a horizontally scrollable tab bar) are ignored.
 */
export const useHorizontalSwipe = ({
    onSwipeLeft,
    onSwipeRight,
    ignoreSelector,
}: {
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    ignoreSelector?: string;
}): { onTouchStart: (event: TouchEvent) => void; onTouchEnd: (event: TouchEvent) => void } => {
    const start = useRef<{ x: number; y: number; time: number } | null>(null);

    return {
        onTouchStart: (event) => {
            const isIgnored = !!ignoreSelector && !!(event.target as Element).closest(ignoreSelector);
            const { 0: touch } = event.touches;
            start.current =
                event.touches.length === 1 && !isIgnored
                    ? { x: touch.clientX, y: touch.clientY, time: Date.now() }
                    : null;
        },
        onTouchEnd: (event) => {
            const from = start.current;
            start.current = null;
            if (!from) {
                return;
            }

            const { 0: touch } = event.changedTouches;
            const dx = touch.clientX - from.x;
            const dy = touch.clientY - from.y;
            const isSwipe =
                Math.abs(dx) >= MIN_DISTANCE &&
                Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_RATIO &&
                Date.now() - from.time <= MAX_DURATION_MS;
            if (!isSwipe) {
                return;
            }

            (dx < 0 ? onSwipeLeft : onSwipeRight)();
        },
    };
};
