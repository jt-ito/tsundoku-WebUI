/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

// tonal instead of a loud solid block: the theme's primary colour at low strength
export const TONAL_BUTTON_SX: SxProps<Theme> = {
    flex: 1,
    justifyContent: 'start',
    boxShadow: 'none',
    color: 'primary.main',
    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.14),
    '&:hover': { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.22), boxShadow: 'none' },
};
