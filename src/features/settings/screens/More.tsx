/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Fragment, useState } from 'react';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import Divider from '@mui/material/Divider';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { AppRoutes } from '@/base/AppRoute.constants.ts';
import { CARD_LIST_SX } from '@/base/components/lists/cardListSx.ts';
import { ListItemLink } from '@/base/components/lists/ListItemLink.tsx';
import { NAVIGATION_BAR_ITEMS } from '@/features/navigation-bar/NavigationBar.constants.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { NavigationBarUtil } from '@/features/navigation-bar/NavigationBar.util.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import type { NavbarItem } from '@/features/navigation-bar/NavigationBar.types.ts';
import { NavBarItemMoreGroup } from '@/features/navigation-bar/NavigationBar.types.ts';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { STABLE_EMPTY_ARRAY } from '@/base/Base.constants.ts';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AuthManager } from '@/features/authentication/AuthManager.ts';
import { SidebarVersionButton } from '@/features/app-updates/components/SidebarVersionButton.tsx';
import { UserAccountsDialog } from '@/features/authentication/components/UserAccountsDialog.tsx';

export const More = () => {
    const { t } = useLingui();
    const isMobileWidth = MediaQuery.useIsMobileWidth();

    useAppTitle(t`More`);

    const { isAuthRequired, isInitialized } = AuthManager.useSession();
    const { data: meData } = requestManager.useGetMe({ skip: isAuthRequired === null || !isInitialized });
    const user = meData?.me;
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);

    const {
        settings: { hideHistory },
    } = useMetadataServerSettings();

    const hiddenNavBarItems = NavigationBarUtil.filterItems(NAVIGATION_BAR_ITEMS, {
        hideHistory,
        hideMore: true,
        hideBoth: true,
        hideDesktop: !isMobileWidth,
        hideMobile: isMobileWidth,
    });

    const hiddenNavBarItemsByMoreGroup = Object.groupBy(hiddenNavBarItems, (item) => item.moreGroup);

    const hiddenItemsMoreGroup = [
        ...(hiddenNavBarItemsByMoreGroup[NavBarItemMoreGroup.HIDDEN_ITEM] ?? STABLE_EMPTY_ARRAY),
        {
            path: AppRoutes.settings.children.categories.path,
            title: msg`Categories`,
            SelectedIconComponent: ListAltIcon,
            IconComponent: ListAltIcon,
            show: 'both',
            moreGroup: NavBarItemMoreGroup.HIDDEN_ITEM,
        },
    ] satisfies NavbarItem[];

    const finalHiddenNavBarItemsByGroup: typeof hiddenNavBarItemsByMoreGroup = {
        ...hiddenNavBarItemsByMoreGroup,
        [NavBarItemMoreGroup.HIDDEN_ITEM]: hiddenItemsMoreGroup,
    };

    return (
        <List sx={CARD_LIST_SX}>
            {user && (
                <>
                    <ListItemButton onClick={() => setIsAccountsOpen(true)}>
                        <ListItemIcon>
                            <AccountCircleIcon />
                        </ListItemIcon>
                        <ListItemText primary={user.username} secondary={user.role} />
                    </ListItemButton>
                    <Divider />
                    <UserAccountsDialog user={user} open={isAccountsOpen} onClose={() => setIsAccountsOpen(false)} />
                </>
            )}
            {Object.entries(finalHiddenNavBarItemsByGroup).map(([group, items], index, list) => (
                <Fragment key={group}>
                    {items.map((item) => (
                        <Fragment key={item.path}>
                            <ListItemLink to={item.path}>
                                <ListItemIcon>
                                    <item.IconComponent />
                                </ListItemIcon>
                                <ListItemText
                                    primary={t(item.moreTitle ?? item.title)}
                                    secondary={item.useBadge?.().title}
                                />
                            </ListItemLink>
                            {item.path === AppRoutes.about.path && <SidebarVersionButton inline />}
                        </Fragment>
                    ))}
                    {index !== list.length - 1 && <Divider />}
                </Fragment>
            ))}
        </List>
    );
};
