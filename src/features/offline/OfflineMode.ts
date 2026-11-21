/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { create } from 'zustand';

const PROBE_INTERVAL_MS = 5_000;

// One failed request is not an offline server (a slow connection drops requests): the server has to fail to answer this
// many times, this far apart, before the app goes offline.
const CONFIRMATION_PROBES = 3;
const CONFIRMATION_PAUSE_MS = 2_000;

const useOfflineModeStore = create<{ isServerUnreachable: boolean; isBrowserOnline: boolean }>(() => ({
    isServerUnreachable: false,
    isBrowserOnline: typeof navigator === 'undefined' || navigator.onLine,
}));

export const useIsOffline = (): boolean =>
    useOfflineModeStore((state) => state.isServerUnreachable || !state.isBrowserOnline);

/**
 * The app is offline when the browser has no connection or the server cannot be reached. Then the answers of the
 * server stored on the device are used (see "OfflineResponseLink") instead of asking the server.
 *
 * It does not stay offline: while the server cannot be reached it is probed until it answers again.
 */
export class OfflineMode {
    private static probe: (() => Promise<boolean>) | undefined;

    private static onRecovered: (() => void) | undefined;

    private static probeTimer: ReturnType<typeof setTimeout> | undefined;

    private static isConfirming = false;

    /** the app was opened without a server, so its login state was never set up by the server */
    private static wasStartedOffline = false;

    private static readonly recoveryListeners = new Set<() => void>();

    static setHandlers(probe: () => Promise<boolean>, onRecovered: () => void): void {
        OfflineMode.probe = probe;
        OfflineMode.onRecovered = onRecovered;
    }

    /** called when the server can be reached again (e.g. to send what was done without it) */
    static addRecoveryListener(listener: () => void): void {
        OfflineMode.recoveryListeners.add(listener);
    }

    static isOffline(): boolean {
        const { isServerUnreachable, isBrowserOnline } = useOfflineModeStore.getState();

        return isServerUnreachable || !isBrowserOnline;
    }

    static markStartedOffline(): void {
        OfflineMode.wasStartedOffline = true;
    }

    /** A request failed to connect: goes offline only if the server then really cannot be reached. */
    static markUnreachable(): void {
        if (useOfflineModeStore.getState().isServerUnreachable || OfflineMode.isConfirming) {
            return;
        }

        OfflineMode.isConfirming = true;
        OfflineMode.confirmUnreachable()
            .then((isUnreachable) => {
                if (isUnreachable) {
                    useOfflineModeStore.setState({ isServerUnreachable: true });
                    OfflineMode.scheduleProbe();
                }
            })
            .catch(() => {})
            .finally(() => {
                OfflineMode.isConfirming = false;
            });
    }

    private static async confirmUnreachable(): Promise<boolean> {
        for (let attempt = 0; attempt < CONFIRMATION_PROBES; attempt++) {
            if (attempt > 0) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => {
                    setTimeout(resolve, CONFIRMATION_PAUSE_MS);
                });
            }

            // eslint-disable-next-line no-await-in-loop
            if (await OfflineMode.isServerReachable()) {
                return false;
            }
        }

        return true;
    }

    private static scheduleProbe(): void {
        clearTimeout(OfflineMode.probeTimer);
        OfflineMode.probeTimer = setTimeout(async () => {
            if (await OfflineMode.isServerReachable()) {
                OfflineMode.recover();
                return;
            }

            OfflineMode.scheduleProbe();
        }, PROBE_INTERVAL_MS);
    }

    private static async isServerReachable(): Promise<boolean> {
        try {
            return (await OfflineMode.probe?.()) ?? false;
        } catch {
            return false;
        }
    }

    private static recover(): void {
        clearTimeout(OfflineMode.probeTimer);
        useOfflineModeStore.setState({ isServerUnreachable: false, isBrowserOnline: navigator.onLine });

        if (OfflineMode.wasStartedOffline) {
            // the login state was set up without the server: start over to do it properly
            window.location.reload();
            return;
        }

        OfflineMode.onRecovered?.();
        OfflineMode.recoveryListeners.forEach((listener) => listener());
    }

    static handleBrowserConnectionChange(isOnline: boolean): void {
        useOfflineModeStore.setState({ isBrowserOnline: isOnline });

        if (!isOnline) {
            return;
        }

        // the connection is back: the data shown comes from the device, check the server and refresh it
        OfflineMode.isServerReachable()
            .then((isReachable) => (isReachable ? OfflineMode.recover() : OfflineMode.markUnreachable()))
            .catch(() => {});
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => OfflineMode.handleBrowserConnectionChange(true));
    window.addEventListener('offline', () => OfflineMode.handleBrowserConnectionChange(false));
}
