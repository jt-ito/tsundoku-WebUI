/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ApolloLink, CombinedGraphQLErrors, ServerError } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { Observable } from 'rxjs';
import { OfflineMode } from '@/features/offline/OfflineMode.ts';
import { OfflineStorage } from '@/features/offline/OfflineStorage.ts';

// fetching the pages of a chapter is a mutation, but only reads: the pages of saved chapters are needed offline
const REPLAYABLE_MUTATIONS = ['GET_CHAPTER_PAGES_FETCH'];

/** the server could not be reached (or a proxy in front of it answered for it), it did not refuse the request */
const isConnectionError = (error: unknown): boolean => {
    if (CombinedGraphQLErrors.is(error)) {
        return false;
    }

    if (ServerError.is(error)) {
        return error.statusCode >= 500;
    }

    return !(error instanceof DOMException && error.name === 'AbortError');
};

/**
 * Keeps the last answer of the server to each query on the device. While the server cannot be reached, these answers
 * are replayed, so the screens that were visited before still work (the library, a manga and its chapters, a saved
 * chapter in the reader).
 *
 * Has to be the first link: the replay must not wait for anything that needs the server (e.g. the login).
 */
export const createOfflineResponseLink = () =>
    new ApolloLink((operation, forward) => {
        const definition = getMainDefinition(operation.query);
        const isReplayable =
            definition.kind === 'OperationDefinition' &&
            (definition.operation === 'query' || REPLAYABLE_MUTATIONS.includes(operation.operationName ?? ''));

        if (!isReplayable) {
            return forward(operation);
        }

        const key = `${operation.operationName}::${JSON.stringify(operation.variables)}`;

        return new Observable<ApolloLink.Result>((observer) => {
            let isClosed = false;
            let subscription: { unsubscribe: () => void } | undefined;

            const replay = async (connectionError?: unknown) => {
                const stored = await OfflineStorage.getResponse(key);
                if (isClosed) {
                    return;
                }

                if (stored) {
                    observer.next(stored);
                    observer.complete();
                    return;
                }

                observer.error(connectionError ?? new Error('Offline: this was not saved on the device'));
            };

            if (OfflineMode.isOffline()) {
                replay().catch(() => {});
            } else {
                subscription = forward(operation).subscribe({
                    next: (result) => {
                        if (!result.errors?.length) {
                            OfflineStorage.putResponse(key, result).catch(() => {});
                        }
                        observer.next(result);
                    },
                    error: (error) => {
                        if (!isConnectionError(error)) {
                            observer.error(error);
                            return;
                        }

                        OfflineMode.markUnreachable();
                        replay(error).catch(() => {});
                    },
                    complete: () => observer.complete(),
                });
            }

            return () => {
                isClosed = true;
                subscription?.unsubscribe();
            };
        });
    });
