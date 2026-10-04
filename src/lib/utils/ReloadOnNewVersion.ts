/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';
import { SubpathUtil } from '@/lib/utils/SubpathUtil.ts';

const MAIN_SCRIPT = /assets\/index-(?!legacy)[\w-]+\.js/;

const getRunningScript = (): string | undefined =>
    [...document.scripts].map((script) => script.src.match(MAIN_SCRIPT)?.[0]).find(Boolean);

/**
 * An app added to the iOS home screen is suspended instead of closed and then keeps running the version it started
 * with for days, so fixes only show up after force quitting it. When the app comes back to the foreground, the served
 * page is checked, and the app reloads if it names a newer main script.
 */
export const useReloadOnNewVersion = (): void => {
    useEffect(() => {
        const runningScript = getRunningScript();
        if (!runningScript) {
            // dev server, nothing to compare with
            return undefined;
        }

        const check = async () => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            try {
                const response = await fetch(`${window.location.origin}${SubpathUtil.getSubpath()}/?v=${Date.now()}`, {
                    cache: 'no-store',
                });
                const servedScript = (await response.text()).match(MAIN_SCRIPT)?.[0];
                if (servedScript && servedScript !== runningScript) {
                    window.location.reload();
                }
            } catch {
                // offline or the server is restarting: try again the next time the app is shown
            }
        };

        document.addEventListener('visibilitychange', check);

        return () => document.removeEventListener('visibilitychange', check);
    }, []);
};
