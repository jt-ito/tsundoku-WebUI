/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { StyledEngineProvider } from '@mui/material/styles';
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';
import { SnackbarProvider } from 'notistack';
import GlobalStyles from '@mui/material/GlobalStyles';
import { I18nProvider } from '@lingui/react';
import { ActiveDeviceContextProvider } from '@/features/device/DeviceContext.tsx';
import { AppHotkeysProvider } from '@/features/hotkeys/AppHotkeysProvider.tsx';
import { SnackbarWithDescription } from '@/base/components/feedback/SnackbarWithDescription.tsx';
import { AppPageHistoryContextProvider } from '@/base/contexts/AppPageHistoryContext.tsx';
import { AppThemeContextProvider } from '@/features/theme/AppThemeContext.tsx';
import { NavBarContextProvider } from '@/features/navigation-bar/NavbarContext.tsx';
import { SubpathUtil } from '@/lib/utils/SubpathUtil.ts';
import { i18n } from '@/i18n';

interface Props {
    children: React.ReactNode;
}

export const AppContext: React.FC<Props> = ({ children }) => (
    <Router basename={SubpathUtil.getRouterBasename()}>
        <StyledEngineProvider injectFirst>
            <I18nProvider i18n={i18n}>
                <AppThemeContextProvider>
                    <QueryParamProvider adapter={ReactRouter6Adapter}>
                        <NavBarContextProvider>
                            <AppPageHistoryContextProvider>
                                <ActiveDeviceContextProvider>
                                    <GlobalStyles
                                        styles={{
                                            // a floating button in the same corner raises the toasts (see useToastBottomOffset)
                                            '.app-toast-container': {
                                                bottom: 'var(--toast-bottom, 14px) !important',
                                                transition: 'bottom 150ms cubic-bezier(0.23, 1, 0.32, 1)',
                                            },
                                        }}
                                    />
                                    <SnackbarProvider
                                        classes={{ containerAnchorOriginBottomRight: 'app-toast-container' }}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        autoHideDuration={4000}
                                        // the timer stops while the window is not focused (another window or an iframe has
                                        // the focus), which left a toast on screen until it was closed by hand
                                        disableWindowBlurListener
                                        Components={{
                                            default: SnackbarWithDescription,
                                            info: SnackbarWithDescription,
                                            success: SnackbarWithDescription,
                                            warning: SnackbarWithDescription,
                                            error: SnackbarWithDescription,
                                        }}
                                    >
                                        <AppHotkeysProvider>{children}</AppHotkeysProvider>
                                    </SnackbarProvider>
                                </ActiveDeviceContextProvider>
                            </AppPageHistoryContextProvider>
                        </NavBarContextProvider>
                    </QueryParamProvider>
                </AppThemeContextProvider>
            </I18nProvider>
        </StyledEngineProvider>
    </Router>
);
