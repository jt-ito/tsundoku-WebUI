/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { TabsProps } from '@mui/material/Tabs';
import Tabs from '@mui/material/Tabs';
import { styled } from '@mui/material/styles';
import { useEffect, useRef } from 'react';

const StyledTabsMenu = styled(Tabs)(({ theme }) => ({
    display: 'flex',
    backgroundColor: theme.palette.background.default,
    border: 0,
    borderBottomWidth: 2,
    borderStyle: 'solid',
    borderColor: theme.palette.divider,
    position: 'relative',
    // the scroll arrows float over the edges: a hidden arrow must not reserve space, so the first tab starts at the left
    '& .MuiTabs-scrollButtons': {
        position: 'absolute',
        top: 0,
        bottom: 0,
        zIndex: 1,
        width: 32,
        backgroundColor: 'inherit',
        '&:first-child': { left: 0 },
        '&:last-child': { right: 0 },
    },
    '& .MuiTabs-flexContainer': { paddingInline: 8 },
}));

export const TabsMenu = ({ children, ...props }: TabsProps) => {
    const ref = useRef<HTMLDivElement>(null);

    // a mouse wheel scrolls the tabs sideways (touch screens and trackpads already do), as long as they overflow;
    // at the ends it does not fall through to the page, so the page only scrolls when the pointer is elsewhere
    useEffect(() => {
        const element = ref.current;
        const scroller = element?.querySelector<HTMLElement>('.MuiTabs-scroller');
        if (!element || !scroller) {
            return undefined;
        }

        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || scroller.scrollWidth <= scroller.clientWidth) {
                return;
            }

            e.preventDefault();
            scroller.scrollLeft += e.deltaY;
        };

        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    }, []);

    return (
        <StyledTabsMenu
            ref={ref}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            {...props}
        >
            {children}
        </StyledTabsMenu>
    );
};
