/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useLocation } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { useBackButton } from '@/base/hooks/useBackButton.ts';
import { useGetOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { DesktopSideBar } from '@/features/navigation-bar/components/DesktopSideBar.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import { MobileBottomBar } from '@/features/navigation-bar/components/MobileBottomBar.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { NAVIGATION_BAR_ITEMS } from '@/features/navigation-bar/NavigationBar.constants.ts';
import { NavigationBarUtil } from '@/features/navigation-bar/NavigationBar.util.ts';

// gap around the app bar (viewport top/right and content below). 0 = flush with the edges; ~10 = floating
const APP_BAR_GAP = 0;

export function DefaultNavBar() {
    const { title, hideTitle, action, override, setAppBarHeight, navBarWidth, setNavBarWidth } = useNavBarContext();

    const theme = useTheme();
    const getOptionForDirection = useGetOptionForDirection();
    const { pathname } = useLocation();
    const handleBack = useBackButton();
    const isMobileWidth = MediaQuery.useIsMobileWidth();

    const {
        settings: { hideHistory },
    } = useMetadataServerSettings();

    const appBarRef = useRef<HTMLDivElement | null>(null);

    const isMainRoute = NAVIGATION_BAR_ITEMS.some(({ path, show }) => {
        if (isMobileWidth && show === 'desktop') {
            return false;
        }

        if (!isMobileWidth && show === 'mobile') {
            return false;
        }

        return path === pathname;
    });
    // the collapsed sidebar stays visible as an icon rail, so the app bar always sits next to it
    const actualNavBarWidth = isMobileWidth ? 0 : navBarWidth;

    const visibleNavBarItems = useMemo(
        () =>
            NavigationBarUtil.filterItems(NAVIGATION_BAR_ITEMS, {
                hideHistory,
                hideBoth: false,
                hideDesktop: isMobileWidth,
                hideMobile: !isMobileWidth,
            }),
        [isMobileWidth, hideHistory],
    );
    const NavBarComponent = useMemo(() => (isMobileWidth ? MobileBottomBar : DesktopSideBar), [isMobileWidth]);

    const navBar = useMemo(
        () => <NavBarComponent navBarItems={visibleNavBarItems} />,
        [NavBarComponent, visibleNavBarItems],
    );

    const measureAppBar = useCallback(() => {
        // bottom edge (includes the top gap + safe area) plus the gap below, so content starts under the pill with breathing room
        setAppBarHeight(
            appBarRef.current ? Math.ceil(appBarRef.current.getBoundingClientRect().bottom) + APP_BAR_GAP : 0,
        );
    }, [appBarRef.current]);

    useResizeObserver(appBarRef, measureAppBar);

    // Rotating a phone changes the safe area without always changing the bar's own size (iOS also reports
    // stale values mid-rotation), which left the sticky tabs offset by the landscape height. Measure again once it settles.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const remeasure = () => {
            measureAppBar();
            clearTimeout(timer);
            timer = setTimeout(measureAppBar, 300);
        };
        window.addEventListener('resize', remeasure);
        window.addEventListener('orientationchange', remeasure);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', remeasure);
            window.removeEventListener('orientationchange', remeasure);
        };
    }, [measureAppBar]);

    useLayoutEffect(() => {
        if (override.status) {
            setAppBarHeight(0);
            setNavBarWidth(0);
        }

        return () => {
            setAppBarHeight(0);
            setNavBarWidth(0);
        };
    }, [override.status]);

    useLayoutEffect(() => {
        if (!isMobileWidth) {
            // do not reset navbar width to prevent grid from jumping due to the changing grid item width
            return;
        }

        setNavBarWidth(0);
    }, [isMobileWidth]);

    // Allow default navbar to be overrided
    if (override.status) {
        return override.value;
    }

    return (
        <>
            <AppBar
                ref={appBarRef}
                sx={{
                    position: 'fixed',
                    top: APP_BAR_GAP,
                    right: APP_BAR_GAP,
                    pt: 'env(safe-area-inset-top)',
                    width: `calc(100% - ${actualNavBarWidth}px - ${2 * APP_BAR_GAP}px)`,
                    zIndex: theme.zIndex.drawer,
                }}
            >
                <Toolbar sx={{ position: 'relative' }}>
                    <Stack
                        sx={{
                            width: 'calc(100% - env(safe-area-inset-left))',
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        {!isMainRoute && (
                            <IconButton
                                edge="start"
                                component="button"
                                sx={{ marginRight: 2 }}
                                aria-label="menu"
                                onClick={handleBack}
                                color="inherit"
                            >
                                {getOptionForDirection(<ArrowBack />, <ArrowForwardIcon />)}
                            </IconButton>
                        )}
                        {!hideTitle && (
                            <Typography
                                variant="h5"
                                component="h1"
                                noWrap
                                sx={{
                                    textOverflow: 'ellipsis',
                                    flexGrow: 1,
                                }}
                            >
                                {title}
                            </Typography>
                        )}
                        {action}
                    </Stack>
                </Toolbar>
            </AppBar>
            {!isMobileWidth || isMainRoute ? navBar : null}
        </>
    );
}
