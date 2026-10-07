/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useLingui } from '@lingui/react/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { useUpdateChecker } from '@/features/app-updates/hooks/useUpdateChecker.tsx';
import {
    updateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/features/settings/services/ServerSettingsMetadata.ts';
import { STABLE_EMPTY_OBJECT } from '@/base/Base.constants.ts';

const disabledUpdateCheck = () => Promise.resolve();

export const ServerUpdateChecker = () => {
    const { t } = useLingui();

    const lastSavedVersion = useRef<string | undefined>(undefined);
    const [open, setOpen] = useState(false);

    const {
        settings: { serverInformAvailableUpdate, serverInformVersionUpdated, serverAnnouncedVersion: serverVersion },
        loading: areMetadataServerSettingsLoading,
    } = useMetadataServerSettings();

    const {
        data: serverUpdateCheckData,
        loading: isCheckingForServerUpdate,
        error: serverUpdateCheckError,
        refetch: checkForUpdate,
    } = requestManager.useCheckForServerUpdate({
        fetchPolicy: 'cache-only',
    });

    const { data } = requestManager.useGetAbout();
    const { aboutServer } = data ?? STABLE_EMPTY_OBJECT;

    const selectedServerChannelInfo = serverUpdateCheckData?.checkForServerUpdates?.find(
        (channel) => channel.channel === aboutServer?.buildType,
    );
    const version = aboutServer ? aboutServer.version : undefined;

    // the periodic check; the result is shown by the sidebar's SidebarVersionButton
    useUpdateChecker(
        'server',
        serverInformAvailableUpdate ? checkForUpdate : disabledUpdateCheck,
        selectedServerChannelInfo?.tag,
    );

    const changelogUrl =
        aboutServer?.buildType.toLowerCase() === 'stable'
            ? `https://github.com/jt-ito/tsundoku/releases/tag/${aboutServer.version}`
            : 'https://github.com/jt-ito/tsundoku/releases';

    // the announced version lives on the server, so every browser and device announces a release only once
    const saveVersion = (newVersion: string) => {
        if (lastSavedVersion.current === newVersion) {
            return;
        }
        lastSavedVersion.current = newVersion;
        updateMetadataServerSettings('serverAnnouncedVersion', newVersion).catch(() => {
            lastSavedVersion.current = undefined;
        });
    };

    if (
        !areMetadataServerSettingsLoading &&
        version &&
        (!serverVersion || version.localeCompare(serverVersion, undefined, { numeric: true }) > 0)
    ) {
        // every commit bumps the preview version, so only announce tagged (stable) releases, never the first one seen or a downgrade (the recorded version only ever goes up)
        if (serverVersion && !open && serverInformVersionUpdated && aboutServer?.buildType.toLowerCase() === 'stable') {
            setOpen(true);
        }
        saveVersion(version);
    }

    if (isCheckingForServerUpdate) {
        return null;
    }

    if (serverUpdateCheckError) {
        return null;
    }

    if (!open) {
        return null;
    }

    return (
        <Dialog open={open}>
            <DialogTitle>{t`Updated version`}</DialogTitle>
            <DialogContent>
                <DialogContentText>{t`Server was updated to version ${version} (${aboutServer?.buildType})`}</DialogContentText>
            </DialogContent>
            <DialogActions>
                {changelogUrl && (
                    <Button href={changelogUrl} target="_blank" rel="noreferrer">
                        {t`Changelog`}
                    </Button>
                )}
                <Button onClick={() => setOpen(false)} variant="contained">
                    {t`Ok`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
