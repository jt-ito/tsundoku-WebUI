/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import type { Theme } from '@mui/material/styles';
import { DEFAULT_FAB_STYLE, StyledFab } from '@/base/components/buttons/StyledFab.tsx';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';

type ScrollTarget = 'top' | 'bottom' | null;

const SMALL_FAB_SIZE = 40;
const SPLIT_FAB_GAP = 8;

const getTarget = (): ScrollTarget => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max < window.innerHeight / 2) {
        return null; // page barely scrolls
    }
    return window.scrollY > max / 2 ? 'top' : 'bottom';
};

const scrollTo = (target: 'top' | 'bottom') => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
        top: target === 'top' ? 0 : document.documentElement.scrollHeight,
        behavior: isReducedMotion ? 'auto' : 'smooth',
    });
};

/** One FAB that jumps to the top when in the lower half of the page, otherwise to the bottom. */
export const LibraryScrollFab = ({ contentKey, isRaised }: { contentKey: unknown; isRaised?: boolean }) => {
    const { t } = useLingui();
    const { bottomBarHeight } = useNavBarContext();
    const {
        settings: { splitScrollButtons },
    } = useMetadataServerSettings();
    const [target, setTarget] = useState<ScrollTarget>(null);
    const [position, setPosition] = useState({ atTop: true, atBottom: false });

    useEffect(() => {
        const update = () => {
            setTarget(getTarget());
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const atTop = window.scrollY <= 1;
            const atBottom = window.scrollY >= max - 1;
            setPosition((prev) => (prev.atTop === atTop && prev.atBottom === atBottom ? prev : { atTop, atBottom }));
        };
        update();
        // re-check after the grid has laid out for the new category/filter
        const timeout = setTimeout(update, 500);
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            clearTimeout(timeout);
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [contentKey]);

    if (!target) {
        return null;
    }

    if (splitScrollButtons) {
        const bottom = (offset: number) =>
            `calc(${bottomBarHeight}px + env(safe-area-inset-bottom) + 16px + ${offset}px${isRaised ? ` + ${DEFAULT_FAB_STYLE.height} + 16px` : ''})`;
        const desktopBottom = (offset: number) =>
            `calc(${DEFAULT_FAB_STYLE.bottom} + ${offset}px${isRaised ? ` + ${DEFAULT_FAB_STYLE.height} + 16px` : ''})`;
        const splitSx = (offset: number) => (theme: Theme) => ({
            bottom: desktopBottom(offset),
            // lined up with the 48px FABs
            right: `calc(${DEFAULT_FAB_STYLE.right} + 4px)`,
            zIndex: 1,
            transition: 'transform 0.15s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.15s ease',
            '&:active': { transform: 'scale(0.96)' },
            '&.Mui-disabled': { opacity: 0.35 },
            [theme.breakpoints.down('md')]: { bottom: bottom(offset) },
        });

        return (
            <>
                <StyledFab
                    size="small"
                    color="primary"
                    aria-label={t`Scroll to top`}
                    disabled={position.atTop}
                    onClick={() => scrollTo('top')}
                    sx={splitSx(SMALL_FAB_SIZE + SPLIT_FAB_GAP)}
                >
                    <KeyboardArrowUp />
                </StyledFab>
                <StyledFab
                    size="small"
                    color="primary"
                    aria-label={t`Scroll to bottom`}
                    disabled={position.atBottom}
                    onClick={() => scrollTo('bottom')}
                    sx={splitSx(0)}
                >
                    <KeyboardArrowDown />
                </StyledFab>
            </>
        );
    }

    return (
        <StyledFab
            size="medium"
            color="primary"
            aria-label={target === 'top' ? t`Scroll to top` : t`Scroll to bottom`}
            onClick={() => scrollTo(target)}
            sx={(theme) => ({
                // bottom right like the other FABs; sits above the selection FAB while that one is shown
                ...(isRaised && {
                    bottom: `calc(${DEFAULT_FAB_STYLE.bottom} + ${DEFAULT_FAB_STYLE.height} + 16px)`,
                }),
                zIndex: 1,
                transition: 'transform 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
                '&:active': { transform: 'scale(0.96)' },
                // on phones the floating navigation bar sits at the bottom: stay above it
                [theme.breakpoints.down('md')]: {
                    bottom: `calc(${bottomBarHeight}px + env(safe-area-inset-bottom) + 16px${isRaised ? ` + ${DEFAULT_FAB_STYLE.height} + 16px` : ''})`,
                },
            })}
        >
            {target === 'top' ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
        </StyledFab>
    );
};
