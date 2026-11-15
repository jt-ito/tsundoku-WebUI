/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { AlertColor } from '@mui/material/Alert';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { ELEVATION, glassSurface } from '@/features/theme/services/ForkComponentOverrides.ts';

/**
 * Looks of a message box (toast, error in a dialog): a frosted panel of the theme with a tint, edge and accent bar in the
 * color of the severity, instead of the muddy dark tint MUI derives from it. Use as `sx` of an `Alert`.
 *
 * @param isFloating the box floats over the page (a toast) and gets a shadow; inside a dialog it stays flat
 */
export const getAlertSurfaceSx =
    (severity: AlertColor, isFloating: boolean = true) =>
    (theme: Theme) => {
        // success toasts keep the original look
        if (severity === 'success') {
            return {};
        }

        const accent = theme.palette[severity].main;
        const isError = severity === 'error';

        return {
            ...glassSurface(theme.palette.background.paper, 0.94, 14),
            // the tint on top of the panel, stronger for errors so they stand out
            backgroundImage: `linear-gradient(${alpha(accent, isError ? 0.2 : 0.13)}, ${alpha(accent, isError ? 0.2 : 0.13)})`,
            color: theme.palette.text.primary,
            border: `1px solid ${alpha(accent, isError ? 0.55 : 0.4)}`,
            borderRadius: '12px',
            // the accent bar on the left edge
            boxShadow: `${isFloating ? `${ELEVATION.md}, ` : ''}inset 3px 0 0 ${accent}`,
            '& .MuiAlert-icon': { color: accent },
            '& .MuiAlert-action': { color: theme.palette.text.secondary },
            '& .MuiAlertTitle-root': { fontWeight: 600 },
        };
    };
