/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { MessageDescriptor } from '@lingui/core';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { Mangas } from '@/features/manga/services/Mangas.ts';
import { i18n } from '@/i18n';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import type { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import { DownloadDestination } from '@/features/downloads/Downloads.types.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import { OfflineStorage } from '@/features/offline/OfflineStorage.ts';

const DOWNLOAD_OPTIONS: {
    title: MessageDescriptor;
    getCount: (downloadAheadLimit: number) => number | undefined;
    onlyUnread?: boolean;
    isDownloadAhead?: boolean;
}[] = [
    {
        title: msg`{count, plural, one {Next chapter} other {Next # chapters}}`,
        getCount: () => 1,
    },
    {
        title: msg`{count, plural, one {Next chapter} other {Next # chapters}}`,
        getCount: () => 5,
    },
    {
        title: msg`{count, plural, one {Next chapter} other {Next # chapters}}`,
        getCount: () => 10,
    },
    {
        title: msg`{count, plural, one {Next chapter} other {Next # chapters}}`,
        getCount: () => 25,
    },
    {
        title: msg`Download ahead ({count})`,
        getCount: (downloadAheadLimit) => downloadAheadLimit,
        onlyUnread: true,
        isDownloadAhead: true,
    },
    {
        title: msg`Unread`,
        getCount: () => undefined,
        onlyUnread: true,
    },
    {
        title: msg`All`,
        getCount: () => undefined,
        onlyUnread: false,
    },
];

export const ChaptersDownloadActionMenuItems = ({
    mangaIds,
    closeMenu,
}: {
    mangaIds: MangaIdInfo['id'][];
    closeMenu: () => void;
}) => {
    const { t } = useLingui();
    const {
        settings: { downloadAheadLimit },
    } = useMetadataServerSettings();

    // remembered, so the usual choice is one tap; a browser that cannot save on the device only has the server
    const [savedDestination, setDestination] = useLocalStorage<DownloadDestination>(
        'download-destination',
        DownloadDestination.SERVER,
    );
    const canSaveOnDevice = OfflineStorage.isSupported();
    const destination = canSaveOnDevice ? savedDestination : DownloadDestination.SERVER;

    const handleSelect = (size?: number, onlyUnread: boolean = true, downloadAhead: boolean = false) => {
        Mangas.performAction('download', mangaIds, {
            downloadAhead,
            onlyUnread,
            size,
            destination,
        }).catch(defaultPromiseErrorHandler('ChaptersDownloadActionMenuItems::handleSelect'));

        closeMenu?.();
    };

    return (
        <>
            {canSaveOnDevice && (
                <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pb: 0.5 }}>
                        {t`Download to`}
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        fullWidth
                        size="small"
                        color="primary"
                        value={destination}
                        onChange={(_, value: DownloadDestination | null) => value && setDestination(value)}
                    >
                        <ToggleButton value={DownloadDestination.SERVER} sx={{ textTransform: 'none' }}>
                            {t`Server`}
                        </ToggleButton>
                        <ToggleButton value={DownloadDestination.DEVICE} sx={{ textTransform: 'none' }}>
                            {t`This device`}
                        </ToggleButton>
                        <ToggleButton value={DownloadDestination.BOTH} sx={{ textTransform: 'none' }}>
                            {t`Both`}
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            )}
            {DOWNLOAD_OPTIONS.map(({ title, getCount, onlyUnread, isDownloadAhead }) => (
                <MenuItem
                    key={
                        /* lingui-extract-ignore */
                        i18n.t({ ...title, values: { count: getCount(downloadAheadLimit) } })
                    }
                    onClick={() => handleSelect(getCount(downloadAheadLimit), onlyUnread, isDownloadAhead)}
                >
                    {
                        /* lingui-extract-ignore */
                        i18n.t({ ...title, values: { count: getCount(downloadAheadLimit) } })
                    }
                </MenuItem>
            ))}
        </>
    );
};
