/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import gql from 'graphql-tag';
import { LIBRARY_SHARE_FIELDS } from '@/lib/graphql/libraryShare/LibraryShareFragments.ts';

export const CREATE_LIBRARY_SHARE = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation CREATE_LIBRARY_SHARE($input: CreateLibraryShareInput!) {
        createLibraryShare(input: $input) {
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const RESPOND_TO_LIBRARY_SHARE = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation RESPOND_TO_LIBRARY_SHARE($input: RespondToLibraryShareInput!) {
        respondToLibraryShare(input: $input) {
            addedMangas
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const PROPOSE_LIBRARY_SHARE_EDIT = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation PROPOSE_LIBRARY_SHARE_EDIT($input: ProposeLibraryShareEditInput!) {
        proposeLibraryShareEdit(input: $input) {
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const RESPOND_TO_LIBRARY_SHARE_EDIT = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation RESPOND_TO_LIBRARY_SHARE_EDIT($input: RespondToLibraryShareEditInput!) {
        respondToLibraryShareEdit(input: $input) {
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const CANCEL_LIBRARY_SHARE_EDIT = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation CANCEL_LIBRARY_SHARE_EDIT($input: CancelLibraryShareEditInput!) {
        cancelLibraryShareEdit(input: $input) {
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const REMOVE_LIBRARY_SHARE = gql`
    mutation REMOVE_LIBRARY_SHARE($input: RemoveLibraryShareInput!) {
        removeLibraryShare(input: $input) {
            removedId
        }
    }
`;

export const CANCEL_LIBRARY_SHARE = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation CANCEL_LIBRARY_SHARE($input: CancelLibraryShareInput!) {
        cancelLibraryShare(input: $input) {
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const SET_LIBRARY_SHARE_AUTO_SYNC = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation SET_LIBRARY_SHARE_AUTO_SYNC($input: SetLibraryShareAutoSyncInput!) {
        setLibraryShareAutoSync(input: $input) {
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const SYNC_LIBRARY_SHARE = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation SYNC_LIBRARY_SHARE($input: SyncLibraryShareInput!) {
        syncLibraryShare(input: $input) {
            addedMangas
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const REQUEST_TWO_WAY_LIBRARY_SHARE = gql`
    ${LIBRARY_SHARE_FIELDS}

    mutation REQUEST_TWO_WAY_LIBRARY_SHARE($input: RequestTwoWayLibraryShareInput!) {
        requestTwoWayLibraryShare(input: $input) {
            share {
                ...LIBRARY_SHARE_FIELDS
            }
        }
    }
`;

export const RECORD_MANGA_SWAP = gql`
    mutation RECORD_MANGA_SWAP($input: RecordMangaSwapInput!) {
        recordMangaSwap(input: $input) {
            clientMutationId
        }
    }
`;
