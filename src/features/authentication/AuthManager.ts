/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { AppStorage } from '@/lib/storage/AppStorage.ts';

let notifierValue = 0;

/** An account that stays signed in on this device, so it can be switched to without typing the password again. */
export type SavedAccount = { userId: number; username: string; refreshToken: string };

const decodeTokenPayload = (token: string): Record<string, unknown> | null => {
    try {
        const payload = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
};

export class AuthManager {
    static readonly REFRESH_TOKEN_KEY = 'auth-refresh-token';

    static readonly SAVED_ACCOUNTS_KEY = 'auth-saved-accounts';

    private static subscribedCount: number = 0;

    private static subscribers = new Map<number, () => void>();

    private static accessToken: string | null = null;

    private static authInitialized: boolean = false;

    private static authRequired: boolean | null = null;

    private static refreshingToken: boolean = false;

    private static subscribe(callback: () => void): () => void {
        // oxlint-disable-next-line no-plusplus
        const key = AuthManager.subscribedCount++;
        this.subscribers.set(key, callback);

        return () => this.unsubscribe(key);
    }

    private static unsubscribe(key: number): void {
        this.subscribers.delete(key);
    }

    private static notify(): void {
        notifierValue = (notifierValue + 1) % Number.MAX_SAFE_INTEGER;
        this.subscribers.forEach((callback) => callback());
    }

    static useSession(): {
        accessToken: typeof AuthManager.accessToken;
        refreshToken: ReturnType<typeof AuthManager.getRefreshToken>;
        isAuthRequired: typeof AuthManager.authRequired;
        isInitialized: typeof AuthManager.authInitialized;
        isRefreshingToken: typeof AuthManager.refreshingToken;
    } {
        useSyncExternalStore(AuthManager.subscribe.bind(AuthManager), () => notifierValue);

        return useMemo(
            () => ({
                accessToken: AuthManager.accessToken,
                refreshToken: AuthManager.getRefreshToken(),
                isAuthRequired: AuthManager.authRequired,
                isInitialized: AuthManager.authInitialized,
                isRefreshingToken: AuthManager.refreshingToken,
            }),
            [
                AuthManager.accessToken,
                AuthManager.getRefreshToken(),
                AuthManager.authRequired,
                AuthManager.authInitialized,
                AuthManager.refreshingToken,
            ],
        );
    }

    static useIsAuthenticated(): boolean {
        const { isAuthRequired, accessToken, refreshToken } = AuthManager.useSession();

        return !isAuthRequired || (isAuthRequired && (!!accessToken || !!refreshToken));
    }

    static isAuthInitialized(): boolean {
        return AuthManager.authInitialized;
    }

    static isAuthRequired(): boolean | null {
        return AuthManager.authRequired;
    }

    static isRefreshingToken(): boolean {
        return AuthManager.refreshingToken;
    }

    static getAccessToken(): string | null {
        return AuthManager.accessToken;
    }

    /** A login without "stay signed in" lives in the session storage and ends with the browser session. */
    static getRefreshToken(): string | null {
        return (
            AppStorage.session.getItemParsed<string | null>(AuthManager.REFRESH_TOKEN_KEY, null) ??
            AppStorage.local.getItemParsed<string | null>(AuthManager.REFRESH_TOKEN_KEY, null)
        );
    }

    /** The id of the signed-in account, null if there is no login (a server without a required login). */
    static getActiveUserId(): number | null {
        const token = AuthManager.getRefreshToken();
        const userId = token ? decodeTokenPayload(token)?.user_id : null;
        return typeof userId === 'number' ? userId : null;
    }

    static getSavedAccounts(): SavedAccount[] {
        return AppStorage.local.getItemParsed<SavedAccount[]>(AuthManager.SAVED_ACCOUNTS_KEY, []);
    }

    private static setSavedAccounts(accounts: SavedAccount[]): void {
        AppStorage.local.setItem(AuthManager.SAVED_ACCOUNTS_KEY, accounts.length ? accounts : undefined);
        AuthManager.notify();
    }

    static saveAccount(refreshToken: string): void {
        const payload = decodeTokenPayload(refreshToken);
        const userId = payload?.user_id;
        const username = payload?.username;
        if (typeof userId !== 'number' || typeof username !== 'string') {
            return;
        }

        AuthManager.setSavedAccounts([
            ...AuthManager.getSavedAccounts().filter((account) => account.userId !== userId),
            { userId, username, refreshToken },
        ]);
    }

    /** Takes the account off this device. The caller ends its session on the server. */
    static forgetAccount(userId: number): void {
        AuthManager.setSavedAccounts(AuthManager.getSavedAccounts().filter((account) => account.userId !== userId));
    }

    /** Makes a saved account the active one. The page has to be reloaded afterwards, so nothing of the previous one stays. */
    static activateSavedAccount(account: SavedAccount): void {
        AppStorage.session.setItem(AuthManager.REFRESH_TOKEN_KEY, undefined);
        AppStorage.local.setItem(AuthManager.REFRESH_TOKEN_KEY, account.refreshToken);
        AuthManager.accessToken = null;
        AuthManager.notify();
    }

    static getTokens(): { accessToken: string | null; refreshToken: string | null } {
        return {
            accessToken: AuthManager.getAccessToken(),
            refreshToken: AuthManager.getRefreshToken(),
        };
    }

    static setAuthInitialized(value: boolean): void {
        AuthManager.authInitialized = value;
        AuthManager.notify();
    }

    static setAuthRequired(value: boolean | null): void {
        AuthManager.authRequired = value;
        AuthManager.notify();
    }

    static setIsRefreshingToken(value: boolean): void {
        AuthManager.refreshingToken = value;
        AuthManager.notify();
    }

    static setAccessToken(token: string): void {
        AuthManager.accessToken = token;
        AuthManager.notify();
    }

    static setRefreshToken(token: string, stayLoggedIn = true): void {
        if (stayLoggedIn) {
            AppStorage.session.setItem(AuthManager.REFRESH_TOKEN_KEY, undefined);
            AppStorage.local.setItem(AuthManager.REFRESH_TOKEN_KEY, token);
            AuthManager.saveAccount(token);
        } else {
            AppStorage.session.setItem(AuthManager.REFRESH_TOKEN_KEY, token);
        }
        AuthManager.notify();
    }

    static setTokens(accessToken: string, refreshToken: string, stayLoggedIn = true): void {
        AuthManager.setAccessToken(accessToken);
        AuthManager.setRefreshToken(refreshToken, stayLoggedIn);
    }

    static removeAccessToken(): void {
        AuthManager.accessToken = null;
        AuthManager.notify();
    }

    /** The token was rejected or the user signed out: the account does not stay signed in on this device either. */
    static removeRefreshToken(): void {
        const token = AuthManager.getRefreshToken();
        const saved = AuthManager.getSavedAccounts().find((account) => account.refreshToken === token);
        if (saved) {
            AuthManager.forgetAccount(saved.userId);
        }
        AppStorage.session.setItem(AuthManager.REFRESH_TOKEN_KEY, undefined);
        AppStorage.local.setItem(AuthManager.REFRESH_TOKEN_KEY, undefined);
        AuthManager.notify();
    }

    static removeTokens(): void {
        AuthManager.removeAccessToken();
        AuthManager.removeRefreshToken();
    }

    static shouldQueueRequests(): boolean {
        const isLoginRequired = AuthManager.isAuthRequired() === true && AuthManager.getAccessToken() === null;

        return !AuthManager.isAuthInitialized() || AuthManager.isRefreshingToken() || isLoginRequired;
    }
}
