/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Divider from '@mui/material/Divider';
import { alpha, styled } from '@mui/material/styles';
import { useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { useLingui } from '@lingui/react/macro';
import { Link } from 'react-router-dom';
import { useGetOptionForDirection } from '@/features/theme/services/ThemeCreator.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { useResizeObserver } from '@/base/hooks/useResizeObserver.tsx';
import type { NavbarItem } from '@/features/navigation-bar/NavigationBar.types.ts';
import { SidebarVersionButton } from '@/features/app-updates/components/SidebarVersionButton.tsx';
import { UserProfileCard } from '@/features/authentication/components/UserProfileCard.tsx';
import { NavigationBarItem } from '@/features/navigation-bar/components/NavigationBarItem.tsx';

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0, 1, 0, 1.25),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
}));

const WIDTH_COLLAPSED = 68;
const WIDTH_EXTENDED = 230;

const BrandLogo = ({ size }: { size: number }) => (
    <Box
        component="img"
        src="./favicon.svg"
        alt="tsundoku"
        width={size}
        height={size}
        sx={{
            borderRadius: '50%',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
            transition: 'transform 160ms cubic-bezier(0.2, 0, 0, 1)',
        }}
    />
);

export const DesktopSideBar = ({ navBarItems }: { navBarItems: NavbarItem[] }) => {
    const { t } = useLingui();
    const { isCollapsed, setIsCollapsed, navBarWidth, setNavBarWidth } = useNavBarContext();
    const getOptionForDirection = useGetOptionForDirection();

    const ref = useRef<HTMLDivElement | null>(null);
    useResizeObserver(
        ref,
        useCallback(() => setNavBarWidth(ref.current?.clientWidth ?? 0), [ref.current]),
    );

    const width = isCollapsed ? WIDTH_COLLAPSED : WIDTH_EXTENDED;

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: navBarWidth,
                '& .MuiDrawer-paper': {
                    zIndex: (theme) => theme.zIndex.drawer - 1,
                    overflowX: 'hidden',
                },
            }}
            slotProps={{
                paper: {
                    ref,
                },
            }}
        >
            <Box
                sx={{
                    pt: 'env(safe-area-inset-top)',
                    pl: 'env(safe-area-inset-left)',
                    width,
                    minWidth: width,
                    maxWidth: width,
                    boxSizing: 'border-box',
                }}
            >
                <DrawerHeader sx={isCollapsed ? { justifyContent: 'center', px: 0 } : undefined}>
                    {isCollapsed ? (
                        <ButtonBase
                            aria-label={t`Expand sidebar`}
                            title={t`Expand sidebar`}
                            onClick={() => setIsCollapsed(false)}
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '10px',
                                '&:hover img': { transform: 'scale(1.14)' },
                            }}
                        >
                            <BrandLogo size={28} />
                        </ButtonBase>
                    ) : (
                        <>
                            <Box
                                component={Link}
                                to="/"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    color: 'inherit',
                                    textDecoration: 'none',
                                    minWidth: 0,
                                    '&:hover img': { transform: 'scale(1.1)' },
                                }}
                            >
                                <BrandLogo size={24} />
                                <Typography
                                    noWrap
                                    sx={{ fontSize: '0.94rem', fontWeight: 700, letterSpacing: '-0.02em' }}
                                >
                                    tsundoku
                                </Typography>
                                <Typography
                                    sx={(theme) => ({
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        lineHeight: 1.1,
                                        padding: '1.5px 5.5px',
                                        borderRadius: '4px',
                                        color: theme.palette.primary.main,
                                        backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                    })}
                                >
                                    Server
                                </Typography>
                            </Box>
                            <IconButton
                                aria-label={t`Collapse sidebar`}
                                title={t`Collapse sidebar`}
                                onClick={() => setIsCollapsed(true)}
                                sx={{ opacity: 0.8, '&:hover': { opacity: 1 } }}
                            >
                                {getOptionForDirection(<ChevronLeftIcon />, <ChevronRightIcon />)}
                            </IconButton>
                        </>
                    )}
                </DrawerHeader>
                <Divider />
                <List
                    sx={{
                        p: 1,
                        overflowX: 'hidden',
                        '& .MuiListItemText-root': { display: isCollapsed ? 'none' : undefined },
                        '& .MuiListItemButton-root': {
                            borderRadius: '8px',
                            boxSizing: 'border-box',
                            transition: 'background-color 150ms ease, transform 100ms cubic-bezier(0.2, 0, 0, 1)',
                            ...(isCollapsed
                                ? {
                                      margin: '4px 8px',
                                      padding: '10px 0',
                                      justifyContent: 'center',
                                      width: 'calc(100% - 16px)',
                                  }
                                : { margin: '2px 6px', padding: '8px 10px', width: 'calc(100% - 12px)' }),
                            '&:active': { transform: `scale(${isCollapsed ? 0.96 : 0.98})` },
                        },
                        '& .MuiListItemIcon-root': isCollapsed
                            ? { minWidth: 'unset', justifyContent: 'center', margin: 0 }
                            : { minWidth: '34px' },
                    }}
                    dense={isCollapsed}
                >
                    {navBarItems.map((navBarItem) => (
                        <NavigationBarItem key={navBarItem.path} {...navBarItem} />
                    ))}
                </List>
            </Box>
            <SidebarVersionButton isCollapsed={isCollapsed} />
            <UserProfileCard isCollapsed={isCollapsed} />
        </Drawer>
    );
};
