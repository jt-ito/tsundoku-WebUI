/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';

const isTextInput = (element: Element | null): element is HTMLElement =>
    !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA');

const isIOS = () =>
    /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * On iOS (browser and home-screen app) scrolling with the keyboard open, or the rubber band bounce at the top of the
 * page, detaches the caret (and the browser's own suggestions) from the field. Like native apps, dragging the page
 * closes the keyboard, and the bounce is switched off. Dragging inside the field or the suggestion list is left alone.
 */
export const useBlurInputOnScroll = (): void => {
    useEffect(() => {
        if (!isIOS()) {
            return undefined;
        }

        const originalOverscroll = document.documentElement.style.overscrollBehaviorY;
        document.documentElement.style.overscrollBehaviorY = 'none';

        const onTouchMove = (event: TouchEvent) => {
            const active = document.activeElement;
            if (!isTextInput(active)) {
                return;
            }

            const target = event.target as Element | null;
            if (target && (active.contains(target) || target.closest('[role="listbox"]'))) {
                return;
            }

            active.blur();
        };

        document.addEventListener('touchmove', onTouchMove, { passive: true });
        return () => {
            document.documentElement.style.overscrollBehaviorY = originalOverscroll;
            document.removeEventListener('touchmove', onTouchMove);
        };
    }, []);
};
