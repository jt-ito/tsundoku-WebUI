/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useLingui } from '@lingui/react/macro';
import { CARD_LIST_SX } from '@/base/components/lists/cardListSx.ts';
import { ListSubheader } from '@/base/components/lists/ListSubheader.tsx';
import { EmptyViewAbsoluteCentered } from '@/base/components/feedback/EmptyViewAbsoluteCentered.tsx';
import { LoadingPlaceholder } from '@/base/components/feedback/LoadingPlaceholder.tsx';
import { makeToast } from '@/base/utils/Toast.ts';
import { Confirmation } from '@/base/AppAwaitableComponent.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { GET_CATEGORIES_SETTINGS } from '@/lib/graphql/category/CategoryQuery.ts';
import { DEFAULT_CATEGORY_ID } from '@/features/category/services/Categories.ts';
import type {
    GetCategoriesSettingsQuery,
    GetCategoriesSettingsQueryVariables,
    LibraryShareFieldsFragment,
} from '@/lib/graphql/generated/graphql.ts';
import { LibraryShareScope, LibraryShareStatus } from '@/lib/graphql/generated/graphql-base.types.ts';

type Share = LibraryShareFieldsFragment;

const otherOf = (share: Share) => (share.incoming ? share.senderUsername : share.recipientUsername);

/**
 * A two way share is two shares: the original and the one that answers it. When both halves qualify they are shown as
 * one row, the original first. Every other share is a row of its own.
 */
const pairUp = (list: Share[], canMerge: (a: Share, b: Share) => boolean): Share[][] => {
    const used = new Set<number>();
    const rows: Share[][] = [];

    list.forEach((share) => {
        if (used.has(share.id)) {
            return;
        }

        const partner = list.find(
            (other) =>
                other.id !== share.id &&
                !used.has(other.id) &&
                (other.pairedWith === share.id || share.pairedWith === other.id),
        );
        used.add(share.id);

        if (partner && canMerge(share, partner)) {
            used.add(partner.id);
            rows.push([share, partner].toSorted((a, b) => a.id - b.id));
        } else {
            rows.push([share]);
        }
    });

    return rows;
};

const isActiveSynced = (share: Share) => share.status === LibraryShareStatus.Accepted && share.synced;

export function LibraryShare() {
    const { t } = useLingui();

    useAppTitle(t`Share library`);

    const shares = requestManager.useGetLibraryShares();
    const categories = requestManager.useGetCategories<GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables>(
        GET_CATEGORIES_SETTINGS,
    );
    const [createShare, { loading: isSending }] = requestManager.useCreateLibraryShare();

    const [username, setUsername] = useState('');
    const [scope, setScope] = useState<LibraryShareScope>(LibraryShareScope.Library);
    const [categoryIds, setCategoryIds] = useState<number[]>([]);
    const [synced, setSynced] = useState(false);
    const [mirror, setMirror] = useState(false);
    // the share whose settings are being changed, with the settings it would get
    const [editing, setEditing] = useState<{ shares: Share[]; synced: boolean; mirror: boolean } | null>(null);
    // the recipient decides per incoming share whether it follows the sender automatically
    const [autoSyncChoice, setAutoSyncChoice] = useState<Record<number, boolean>>({});

    const shareableCategories = (categories.data?.categories.nodes ?? []).filter(
        ({ id }) => id !== DEFAULT_CATEGORY_ID,
    );
    const canSend = !!username.trim() && (scope === LibraryShareScope.Library || categoryIds.length > 0) && !isSending;

    const send = () =>
        createShare({
            variables: {
                input: {
                    username: username.trim(),
                    scope,
                    categoryIds: scope === LibraryShareScope.Categories ? categoryIds : [],
                    synced,
                    mirror: synced && mirror,
                },
            },
        })
            .then(() => {
                makeToast(t`Request sent, ${username.trim()} has to accept it`, 'success');
                setUsername('');
                setCategoryIds([]);
            })
            .catch((e) => makeToast(t`Could not send the request`, 'error', getErrorMessage(e)));

    const respond = (share: Share, accept: boolean) =>
        requestManager
            .respondToLibraryShare(share.id, accept, !!autoSyncChoice[share.id])
            .response.then((result) => {
                const added = result.data?.respondToLibraryShare.addedMangas ?? 0;
                makeToast(accept ? t`Added ${added} manga to your library` : t`Request declined`, 'success');
            })
            .catch((e) => makeToast(t`Could not answer the request`, 'error', getErrorMessage(e)));

    const cancel = (share: Share) =>
        requestManager
            .cancelLibraryShare(share.id)
            .response.catch((e) => makeToast(t`Could not cancel the request`, 'error', getErrorMessage(e)));

    const syncNow = (share: Share) =>
        requestManager
            .syncLibraryShare(share.id)
            .response.then((result) => {
                const added = result.data?.syncLibraryShare.addedMangas ?? 0;
                makeToast(t`Added ${added} new manga to your library`, 'success');
            })
            .catch((e) => makeToast(t`Could not sync`, 'error', getErrorMessage(e)));

    const describeSettings = (isSynced: boolean, isMirror: boolean) => {
        if (!isSynced) {
            return t`send as is, no syncing`;
        }
        return isMirror ? t`keep in sync, one for one` : t`keep in sync`;
    };

    const proposeEdit = () => {
        if (!editing) {
            return undefined;
        }

        const { shares: halves, synced: newSynced, mirror: newMirror } = editing;
        setEditing(null);

        // both halves of a two way share get the same change, the other account confirms them together
        return Promise.all(
            halves
                .filter((half) => half.proposedSynced == null)
                .map(
                    (half) =>
                        requestManager.proposeLibraryShareEdit(half.id, newSynced, newSynced && newMirror).response,
                ),
        )
            .then(() => makeToast(t`Change sent, ${otherOf(halves[0])} has to confirm it`, 'success'))
            .catch((e) => makeToast(t`Could not send the change`, 'error', getErrorMessage(e)));
    };

    const respondToEdit = (halves: Share[], accept: boolean) =>
        Promise.all(halves.map((half) => requestManager.respondToLibraryShareEdit(half.id, accept).response)).catch(
            (e) => makeToast(t`Could not answer the change`, 'error', getErrorMessage(e)),
        );

    const cancelEdit = (halves: Share[]) =>
        Promise.all(
            halves
                .filter((half) => half.proposedSynced != null && half.proposalIsMine)
                .map((half) => requestManager.cancelLibraryShareEdit(half.id).response),
        ).catch((e) => makeToast(t`Could not take the change back`, 'error', getErrorMessage(e)));

    const removeShare = async (halves: Share[]) => {
        await Confirmation.show({
            title: t`Remove this share?`,
            message: t`Syncing with ${otherOf(halves[0])} ends right away for both of you. What was already copied stays in the libraries.`,
        });

        await Promise.all(halves.map((half) => requestManager.removeLibraryShare(half.id).response)).catch((e) =>
            makeToast(t`Could not remove the share`, 'error', getErrorMessage(e)),
        );
    };

    const askTwoWay = (share: Share) =>
        requestManager
            .requestTwoWayLibraryShare(share.id)
            .response.then(() => makeToast(t`Request sent, ${share.senderUsername} has to accept it`, 'success'))
            .catch((e) => makeToast(t`Could not send the request`, 'error', getErrorMessage(e)));

    const setAutoSync = (share: Share, autoSync: boolean) =>
        requestManager
            .setLibraryShareAutoSync(share.id, autoSync)
            .response.catch((e) => makeToast(t`Could not save the change`, 'error', getErrorMessage(e)));

    const describe = (share: Share) => {
        const what =
            share.scope === LibraryShareScope.Library
                ? t`the whole library`
                : t`the categories ${share.categoryNames.join(', ')}`;
        return t`${what} (${share.mangaCount} manga)`;
    };

    if (shares.loading || categories.loading) {
        return <LoadingPlaceholder />;
    }

    if (shares.error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t`Unable to load data`}
                messageExtra={getErrorMessage(shares.error)}
                retry={() => shares.refetch()}
            />
        );
    }

    const all = shares.data?.libraryShares ?? [];
    const incoming = all.filter((share) => share.incoming && share.status === LibraryShareStatus.Pending);
    const history = all.filter((share) => !incoming.includes(share));
    const editRequests = all.filter(
        (share) =>
            share.status === LibraryShareStatus.Accepted && share.proposedSynced != null && !share.proposalIsMine,
    );

    const twoWayText = (share: Share) => {
        if (share.pairedWith != null) {
            return share.mirror ? t`Two-way sync, one for one` : t`Two-way sync`;
        }
        if (!share.incoming || share.status !== LibraryShareStatus.Accepted || !share.synced) {
            return '';
        }
        switch (share.twoWayStatus) {
            case LibraryShareStatus.Pending:
                return t`Two-way request waiting for approval`;
            case LibraryShareStatus.Accepted:
                return t`Two-way sync active`;
            case LibraryShareStatus.Declined:
                return t`Two-way request declined`;
            default:
                return '';
        }
    };

    const rowTitle = (halves: Share[]) => {
        const [first] = halves;
        if (halves.length > 1) {
            return t`With ${otherOf(first)}: ${describe(first)}`;
        }

        return first.incoming
            ? t`From ${first.senderUsername}: ${describe(first)}`
            : t`To ${first.recipientUsername}: ${describe(first)}`;
    };

    const rowTwoWayText = (halves: Share[]) => {
        const [first] = halves;
        if (halves.length === 1) {
            return twoWayText(first);
        }

        return first.mirror ? t`Two-way sync, one for one` : t`Two-way sync`;
    };

    const statusText = (share: Share) => {
        switch (share.status) {
            case LibraryShareStatus.Pending:
                return t`Waiting for approval`;
            case LibraryShareStatus.Accepted:
                if (!share.synced) {
                    return t`Accepted`;
                }
                return share.mirror ? t`Accepted, kept in sync, one for one` : t`Accepted, kept in sync`;
            case LibraryShareStatus.Declined:
                return t`Declined`;
            default:
                return t`Cancelled`;
        }
    };

    return (
        <List sx={CARD_LIST_SX}>
            {editRequests.length > 0 && (
                <List subheader={<ListSubheader component="div">{t`Changes waiting for your approval`}</ListSubheader>}>
                    {pairUp(editRequests, () => true).map((halves) => {
                        const [share] = halves;

                        return (
                            <ListItem key={halves.map((half) => half.id).join('-')} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                <ListItemText
                                    primary={t`${otherOf(share)} wants to change your share: ${describeSettings(!!share.proposedSynced, !!share.proposedMirror)}`}
                                    secondary={t`Now: ${describeSettings(share.synced, share.mirror)}`}
                                />
                                <Stack direction="row" sx={{ gap: 1 }}>
                                    <Button variant="contained" onClick={() => respondToEdit(halves, true)}>
                                        {t`Accept`}
                                    </Button>
                                    <Button onClick={() => respondToEdit(halves, false)}>{t`Decline`}</Button>
                                </Stack>
                            </ListItem>
                        );
                    })}
                </List>
            )}
            {incoming.length > 0 && (
                <List subheader={<ListSubheader component="div">{t`Waiting for your approval`}</ListSubheader>}>
                    {incoming.map((share) => (
                        <ListItem key={share.id} sx={{ flexWrap: 'wrap', gap: 1 }}>
                            <ListItemText
                                primary={
                                    share.pairedWith != null
                                        ? t`${share.senderUsername} wants to sync back: what they add to ${describe(share)} will be shared with you too`
                                        : t`${share.senderUsername} wants to share ${describe(share)} with you`
                                }
                                secondary={
                                    share.synced
                                        ? t`Nothing is added until you accept. The sender keeps it in sync: manga and categories they add later are shared too. Your reading progress is never shared.`
                                        : t`Nothing is added to your library until you accept`
                                }
                            />
                            {share.synced && (
                                <FormControlLabel
                                    label={t`Sync automatically`}
                                    control={
                                        <Switch
                                            checked={!!autoSyncChoice[share.id]}
                                            onChange={(e) =>
                                                setAutoSyncChoice((choice) => ({
                                                    ...choice,
                                                    [share.id]: e.target.checked,
                                                }))
                                            }
                                        />
                                    }
                                />
                            )}
                            <Stack direction="row" sx={{ gap: 1 }}>
                                <Button variant="contained" onClick={() => respond(share, true)}>
                                    {t`Accept`}
                                </Button>
                                <Button onClick={() => respond(share, false)}>{t`Decline`}</Button>
                            </Stack>
                        </ListItem>
                    ))}
                </List>
            )}

            <List subheader={<ListSubheader component="div">{t`Share with another account`}</ListSubheader>}>
                <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
                    <TextField
                        label={t`Username`}
                        helperText={t`Ask the other person for their exact username, accounts can't be browsed`}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="off"
                    />
                    <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as LibraryShareScope)}>
                        <FormControlLabel
                            value={LibraryShareScope.Library}
                            control={<Radio />}
                            label={t`Entire library`}
                        />
                        <FormControlLabel
                            value={LibraryShareScope.Categories}
                            control={<Radio />}
                            label={t`Only some categories`}
                        />
                    </RadioGroup>
                    {scope === LibraryShareScope.Categories && (
                        <Stack sx={{ pl: 4 }}>
                            {shareableCategories.map((category) => (
                                <FormControlLabel
                                    key={category.id}
                                    label={category.name}
                                    control={
                                        <Checkbox
                                            checked={categoryIds.includes(category.id)}
                                            onChange={(e) =>
                                                setCategoryIds((ids) =>
                                                    e.target.checked
                                                        ? [...ids, category.id]
                                                        : ids.filter((id) => id !== category.id),
                                                )
                                            }
                                        />
                                    }
                                />
                            ))}
                        </Stack>
                    )}
                    <Divider />
                    <RadioGroup value={synced ? 'sync' : 'once'} onChange={(e) => setSynced(e.target.value === 'sync')}>
                        <FormControlLabel value="once" control={<Radio />} label={t`Send as is`} />
                        <FormControlLabel
                            value="sync"
                            control={<Radio />}
                            label={t`Keep in sync: manga and categories you add later are shared too`}
                        />
                    </RadioGroup>
                    {synced && (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                {t`The other person can choose to follow it automatically. Reading progress is never shared.`}
                            </Typography>
                            <FormControlLabel
                                label={t`One for one: renaming a shared category on either side renames it on the other side too`}
                                control={<Checkbox checked={mirror} onChange={(e) => setMirror(e.target.checked)} />}
                            />
                        </>
                    )}
                    <Button variant="contained" disabled={!canSend} onClick={send}>
                        {t`Send request`}
                    </Button>
                </ListItem>
            </List>

            {history.length > 0 && (
                <List subheader={<ListSubheader component="div">{t`History`}</ListSubheader>}>
                    {pairUp(history, (a, b) => isActiveSynced(a) && isActiveSynced(b)).map((halves) => {
                        const merged = halves.length > 1;
                        const sent = halves.find((half) => !half.incoming);
                        const received = halves.find((half) => half.incoming);
                        const [first] = halves;
                        const changePending = halves.some((half) => half.proposedSynced != null);

                        return (
                            <ListItem key={halves.map((half) => half.id).join('-')} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                <ListItemText
                                    primary={rowTitle(halves)}
                                    secondary={[
                                        statusText(first),
                                        rowTwoWayText(halves),
                                        merged && sent && received
                                            ? t`Sent ${sent.mangaCount} manga, received ${received.mangaCount} manga`
                                            : '',
                                        halves.some((half) => half.proposedSynced != null && half.proposalIsMine)
                                            ? t`Change waiting for ${otherOf(first)} to confirm`
                                            : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                />
                                {sent && sent.status === LibraryShareStatus.Pending && (
                                    <Button onClick={() => cancel(sent)}>{t`Cancel`}</Button>
                                )}
                                {sent && isActiveSynced(sent) && (
                                    <Button onClick={() => cancel(sent)}>{t`Stop syncing`}</Button>
                                )}
                                {received && isActiveSynced(received) && (
                                    <>
                                        <FormControlLabel
                                            label={t`Sync automatically`}
                                            control={
                                                <Switch
                                                    checked={received.autoSync}
                                                    onChange={(e) => setAutoSync(received, e.target.checked)}
                                                />
                                            }
                                        />
                                        <Button onClick={() => syncNow(received)}>{t`Sync now`}</Button>
                                        {!merged &&
                                            received.pairedWith == null &&
                                            (received.twoWayStatus == null ||
                                                received.twoWayStatus === LibraryShareStatus.Declined ||
                                                received.twoWayStatus === LibraryShareStatus.Cancelled) && (
                                                <Button onClick={() => askTwoWay(received)}>
                                                    {t`Ask for two-way sync`}
                                                </Button>
                                            )}
                                    </>
                                )}
                                {halves.every((half) => half.status === LibraryShareStatus.Accepted) &&
                                    !changePending && (
                                        <Button
                                            onClick={() =>
                                                setEditing({
                                                    shares: halves,
                                                    synced: first.synced,
                                                    mirror: first.mirror,
                                                })
                                            }
                                        >
                                            {t`Edit`}
                                        </Button>
                                    )}
                                {halves.some((half) => half.proposedSynced != null && half.proposalIsMine) && (
                                    <Button onClick={() => cancelEdit(halves)}>{t`Cancel change`}</Button>
                                )}
                                {halves.every((half) => half.status !== LibraryShareStatus.Pending) && (
                                    <Button color="error" onClick={() => removeShare(halves)}>
                                        {t`Remove`}
                                    </Button>
                                )}
                            </ListItem>
                        );
                    })}
                </List>
            )}
            <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
                <DialogTitle>{t`Change this share`}</DialogTitle>
                <DialogContent>
                    <Stack>
                        <FormControlLabel
                            label={t`Keep in sync: manga and categories added later are shared too`}
                            control={
                                <Checkbox
                                    checked={!!editing?.synced}
                                    onChange={(e) =>
                                        setEditing((current) =>
                                            current
                                                ? {
                                                      ...current,
                                                      synced: e.target.checked,
                                                      mirror: e.target.checked && current.mirror,
                                                  }
                                                : current,
                                        )
                                    }
                                />
                            }
                        />
                        <FormControlLabel
                            label={t`One for one: renaming a shared category on either side renames it on the other side too`}
                            control={
                                <Checkbox
                                    checked={!!editing?.mirror}
                                    disabled={!editing?.synced}
                                    onChange={(e) =>
                                        setEditing((current) =>
                                            current ? { ...current, mirror: e.target.checked } : current,
                                        )
                                    }
                                />
                            }
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {editing
                                ? t`${otherOf(editing.shares[0])} has to confirm the change before it applies.`
                                : ''}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditing(null)}>{t`Cancel`}</Button>
                    <Button
                        variant="contained"
                        disabled={
                            !editing ||
                            (editing.synced === editing.shares[0].synced && editing.mirror === editing.shares[0].mirror)
                        }
                        onClick={proposeEdit}
                    >
                        {t`Ask to confirm`}
                    </Button>
                </DialogActions>
            </Dialog>
        </List>
    );
}
