/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/base/AppRoute.constants.ts';

const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const;
const NO_ZOOM_VIEWPORT = ', maximum-scale=1, user-scalable=no';

const preventDefault = (event: Event) => event.preventDefault();

/**
 * Pinch and double-tap zoom only works in the reader, everywhere else the page keeps its size.
 * No single switch covers every browser, so all of them are used: `touch-action` (iOS Safari and the home-screen app,
 * Chrome), the viewport meta tag (Chrome on Android, which ignores `touch-action` for the whole page zoom in some
 * versions) and the `gesture*` events (older iOS versions, which ignore `user-scalable=no`).
 */
export const usePinchZoomOnlyInReader = (): void => {
    const { pathname } = useLocation();
    const isReader = !!matchPath(AppRoutes.reader.match, pathname);

    useEffect(() => {
        if (isReader) {
            return undefined;
        }

        const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
        const originalViewport = viewport?.content;
        const originalTouchAction = document.documentElement.style.touchAction;

        document.documentElement.style.touchAction = 'pan-x pan-y';
        if (viewport && originalViewport !== undefined) {
            viewport.content = originalViewport + NO_ZOOM_VIEWPORT;
        }
        GESTURE_EVENTS.forEach((name) => document.addEventListener(name, preventDefault, { passive: false }));

        return () => {
            document.documentElement.style.touchAction = originalTouchAction;
            if (viewport && originalViewport !== undefined) {
                viewport.content = originalViewport;
            }
            GESTURE_EVENTS.forEach((name) => document.removeEventListener(name, preventDefault));
        };
    }, [isReader]);
};
