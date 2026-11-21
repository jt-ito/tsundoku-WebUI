/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import OfflinePinIcon from '@mui/icons-material/OfflinePin';
import { useLingui } from '@lingui/react/macro';

/**
 * Where a chapter was downloaded to: the server (it keeps the chapter for everyone who uses it) and/or this device
 * (saved to read without the server).
 */
export const DownloadLocationLabels = ({ isOnServer, isOnDevice }: { isOnServer: boolean; isOnDevice: boolean }) => {
    const { t } = useLingui();

    return (
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
            {isOnServer && <Chip size="small" variant="outlined" icon={<DnsOutlinedIcon />} label={t`Server`} />}
            {isOnDevice && <Chip size="small" color="primary" icon={<OfflinePinIcon />} label={t`This device`} />}
        </Stack>
    );
};
