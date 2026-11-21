/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { CombinedGraphQLErrors } from '@apollo/client';
import { SplashScreen } from '@/features/authentication/components/SplashScreen.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { OfflineMode, useIsOffline } from '@/features/offline/OfflineMode.ts';

const REFRESH_BEFORE_EXPIRY_MS = 30_000;
const MIN_REFRESH_DELAY_MS = 5_000;
const RETRY_REFRESH_DELAY_MS = 10_000;

const getTokenExpiryMs = (token: string): number | null => {
    try {
        const payload = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
        const { exp } = JSON.parse(atob(payload)) as { exp?: number };
        return exp ? exp * 1000 : null;
    } catch {
        return null;
    }
};

const isTokenExpiring = (token: string): boolean => {
    const expiry = getTokenExpiryMs(token);
    return !!expiry && expiry - Date.now() < REFRESH_BEFORE_EXPIRY_MS;
};

/**
 * @returns whether the access token is up to date afterwards
 */
const refreshAccessToken = async (refreshToken: string): Promise<boolean> => {
    try {
        const { data } = await requestManager.refreshUser(refreshToken).response;
        AuthManager.setAccessToken(data!.refreshToken.accessToken);
        return true;
    } catch (e) {
        // only forget the tokens if the server rejected them (e.g. expired refresh token or deleted account), not if it
        // just could not be reached
        if (CombinedGraphQLErrors.is(e)) {
            AuthManager.removeTokens();
        }
        defaultPromiseErrorHandler('AuthGuard::refreshAccessToken')(e);
        return false;
    }
};

/**
 * Refreshes the access token shortly before it expires, instead of only after a request failed because of it.
 *
 * This makes sure that expired tokens are (almost) never sent to the server, which is also necessary if the server does
 * not require a login (see "UserAccountsDialog"): it silently falls back to its default account for expired tokens
 * instead of rejecting them.
 * Timers are not reliable while the tab is in the background or the device is asleep, so the token is also checked when
 * the tab is shown again or the connection is back.
 */
const useAccessTokenRefresh = () => {
    const { isAuthRequired, accessToken, refreshToken } = AuthManager.useSession();

    useEffect(() => {
        if (isAuthRequired === null || !accessToken || !refreshToken) {
            return undefined;
        }

        let timeout: ReturnType<typeof setTimeout> | undefined;

        const refresh = async () => {
            const isRefreshed = await refreshAccessToken(refreshToken);
            // on success, the new token restarts this effect
            if (!isRefreshed && AuthManager.getRefreshToken()) {
                timeout = setTimeout(refresh, RETRY_REFRESH_DELAY_MS);
            }
        };

        const expiry = getTokenExpiryMs(accessToken);
        const delay = expiry
            ? Math.max(expiry - Date.now() - REFRESH_BEFORE_EXPIRY_MS, MIN_REFRESH_DELAY_MS)
            : MIN_REFRESH_DELAY_MS * 12;
        timeout = setTimeout(refresh, delay);

        const refreshIfExpiring = () => {
            if (document.visibilityState === 'visible' && isTokenExpiring(accessToken)) {
                clearTimeout(timeout);
                refresh().catch(defaultPromiseErrorHandler('AuthGuard::refreshIfExpiring'));
            }
        };
        document.addEventListener('visibilitychange', refreshIfExpiring);
        window.addEventListener('online', refreshIfExpiring);

        return () => {
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', refreshIfExpiring);
            window.removeEventListener('online', refreshIfExpiring);
        };
    }, [isAuthRequired, accessToken, refreshToken]);
};

export const AuthGuard = ({ children }: { children: ReactNode }) => {
    const { isAuthRequired } = AuthManager.useSession();
    useAccessTokenRefresh();

    const { data } = requestManager.useGetAbout({
        skip: isAuthRequired !== null,
    });

    const isInitializingRef = useRef(false);
    useEffect(() => {
        if (!data || AuthManager.isAuthInitialized() || isInitializingRef.current) {
            return;
        }
        isInitializingRef.current = true;

        const initialize = async () => {
            if (OfflineMode.isOffline()) {
                // the data is the saved one, so the login has to be set up again once the server is back
                OfflineMode.markStartedOffline();
            }

            AuthManager.setAuthRequired(false);

            // the server does not require a login, so a stored refresh token belongs to a personal account
            const refreshToken = AuthManager.getRefreshToken();
            if (refreshToken) {
                await refreshAccessToken(refreshToken);
            }

            AuthManager.setAuthInitialized(true);
            requestManager.processQueues();
            isInitializingRef.current = false;
        };

        initialize().catch(defaultPromiseErrorHandler('AuthGuard::initialize'));
    }, [data]);

    // The server cannot be reached and told nothing about the login: open the app with what is saved on the device
    // instead of waiting for the server for ever. Nothing is sent to it, the stored answers are shown.
    const isOffline = useIsOffline();
    useEffect(() => {
        if (!isOffline || AuthManager.isAuthInitialized() || AuthManager.isAuthRequired() !== null) {
            return;
        }

        OfflineMode.markStartedOffline();
        AuthManager.setAuthRequired(false);
        AuthManager.setAuthInitialized(true);
        requestManager.processQueues();
    }, [isOffline, isAuthRequired]);

    if (isAuthRequired === null) {
        return <SplashScreen />;
    }

    return children;
};
