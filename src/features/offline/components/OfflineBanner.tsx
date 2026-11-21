/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CloudOff from '@mui/icons-material/CloudOff';
import { useLingui } from '@lingui/react/macro';
import { useIsOffline } from '@/features/offline/OfflineMode.ts';
import { getAlertSurfaceSx } from '@/base/components/feedback/AlertSurface.ts';

/**
 * Tells that what is shown is saved on the device, because the server cannot be reached.
 * Does not take any space and does not block what is below it.
 */
export const OfflineBanner = () => {
    const { t } = useLingui();
    const isOffline = useIsOffline();

    if (!isOffline) {
        return null;
    }

    return (
        <Box
            sx={(theme) => ({
                position: 'fixed',
                top: 'calc(env(safe-area-inset-top) + 8px)',
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                px: 2,
                pointerEvents: 'none',
                zIndex: theme.zIndex.snackbar,
            })}
        >
            <Alert
                severity="warning"
                icon={<CloudOff fontSize="small" />}
                role="status"
                sx={[
                    getAlertSurfaceSx('warning'),
                    { py: 0, maxWidth: '100%', '& .MuiAlert-message': { py: 0.75, fontSize: '0.8125rem' } },
                ]}
            >
                {t`Offline: showing what is saved on this device`}
            </Alert>
        </Box>
    );
};
