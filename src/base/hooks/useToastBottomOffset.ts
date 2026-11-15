/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';

// the toasts sit at the bottom right, the same corner as the floating buttons: a button reserves the space it covers here
const TOAST_BOTTOM_VAR = '--toast-bottom';

const reservedBottoms = new Map<symbol, string>();

const applyReservedBottoms = () => {
    const root = document.documentElement.style;

    if (!reservedBottoms.size) {
        root.removeProperty(TOAST_BOTTOM_VAR);
        return;
    }

    root.setProperty(TOAST_BOTTOM_VAR, `max(${[...reservedBottoms.values()].join(', ')})`);
};

/**
 * Keeps the toasts above a floating button.
 *
 * @param bottom the CSS length of the top edge of the button, from the bottom of the screen plus a gap (e.g.
 * "calc(28px + 48px + 12px)"), or `null` while the button is not there
 */
export const useToastBottomOffset = (bottom: string | null): void => {
    useEffect(() => {
        if (bottom === null) {
            return undefined;
        }

        const key = Symbol('toast-bottom');
        reservedBottoms.set(key, bottom);
        applyReservedBottoms();

        return () => {
            reservedBottoms.delete(key);
            applyReservedBottoms();
        };
    }, [bottom]);
};
