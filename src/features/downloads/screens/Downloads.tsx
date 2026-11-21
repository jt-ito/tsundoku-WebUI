/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Tab from '@mui/material/Tab';
import { StringParam, useQueryParam } from 'use-query-params';
import { useLingui } from '@lingui/react/macro';
import { TabPanel } from '@/base/components/tabs/TabPanel.tsx';
import { TabsWrapper } from '@/base/components/tabs/TabsWrapper.tsx';
import { TabsMenu } from '@/base/components/tabs/TabsMenu.tsx';
import { OffsetComponentWithContainer } from '@/base/OffsetComponent.tsx';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle.ts';
import { GROUPED_VIRTUOSO_Z_INDEX } from '@/lib/virtuoso/Virtuoso.constants.ts';
import { SearchParam } from '@/base/Base.types.ts';
import { DownloadsTab } from '@/features/downloads/Downloads.types.ts';
import { DownloadQueue } from '@/features/downloads/screens/DownloadQueue.tsx';
import { DownloadedChapters } from '@/features/downloads/screens/DownloadedChapters.tsx';

/** The downloads: what is still to come (the queue of the server) and what was downloaded before. */
export const Downloads = () => {
    const { t } = useLingui();

    useAppTitle(t`Downloads`);

    const [tabSearchParam, setTabSearchParam] = useQueryParam(SearchParam.TAB, StringParam, {});
    const tab = tabSearchParam === DownloadsTab.DOWNLOADED ? DownloadsTab.DOWNLOADED : DownloadsTab.QUEUE;

    return (
        <TabsWrapper>
            <OffsetComponentWithContainer
                sx={{ zIndex: 2 }}
                component={
                    <TabsMenu
                        sx={{ zIndex: GROUPED_VIRTUOSO_Z_INDEX }}
                        variant="fullWidth"
                        value={tab}
                        onChange={(_, newTab) => setTabSearchParam(newTab, 'replaceIn')}
                    >
                        <Tab value={DownloadsTab.QUEUE} sx={{ textTransform: 'none' }} label={t`Queue`} />
                        <Tab value={DownloadsTab.DOWNLOADED} sx={{ textTransform: 'none' }} label={t`Downloaded`} />
                    </TabsMenu>
                }
            >
                <TabPanel index={DownloadsTab.QUEUE} currentIndex={tab}>
                    <DownloadQueue />
                </TabPanel>
                <TabPanel index={DownloadsTab.DOWNLOADED} currentIndex={tab}>
                    <DownloadedChapters />
                </TabPanel>
            </OffsetComponentWithContainer>
        </TabsWrapper>
    );
};
