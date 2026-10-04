/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { memo } from 'react';
import { useLingui } from '@lingui/react/macro';
import { ReaderPageThumbnail } from '@/features/reader/overlay/navigation/components/ReaderPageThumbnail.tsx';
import { getIndexOfPage } from '@/features/reader/overlay/progress-bar/ReaderProgressBar.utils.tsx';
import { ReaderControls } from '@/features/reader/services/ReaderControls.ts';
import { useReaderPagesStore } from '@/features/reader/stores/ReaderStore.ts';

const BaseReaderPageThumbnails = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { t } = useLingui();
    const { pages, currentPageIndex } = useReaderPagesStore('pages', 'currentPageIndex');

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: { width: 'min(380px, 88vw)', backgroundImage: 'none', backgroundColor: 'background.default' },
                },
            }}
        >
            <Stack
                sx={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" component="h2">
                    {t`All pages`}
                </Typography>
                <IconButton onClick={onClose} aria-label={t`Close`}>
                    <CloseIcon />
                </IconButton>
            </Stack>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 1.5,
                    p: 1.5,
                    overflowY: 'auto',
                }}
            >
                {pages.map((page) => {
                    const index = getIndexOfPage(page);
                    const isCurrent = index === currentPageIndex;

                    return (
                        <Stack
                            key={index}
                            component="button"
                            type="button"
                            ref={(element: HTMLElement | null) => {
                                if (isCurrent && open) {
                                    element?.scrollIntoView({ block: 'center' });
                                }
                            }}
                            onClick={() => {
                                ReaderControls.openPage(index, undefined, false);
                                onClose();
                            }}
                            sx={{
                                gap: 0.5,
                                p: 0,
                                border: 0,
                                background: 'none',
                                color: 'inherit',
                                font: 'inherit',
                                cursor: 'pointer',
                                alignItems: 'stretch',
                                transition: 'transform 100ms cubic-bezier(0.23, 1, 0.32, 1)',
                                '&:active': { transform: 'scale(0.98)' },
                            }}
                        >
                            <ReaderPageThumbnail url={page.primary.url} alt={page.name} isCurrent={isCurrent} />
                            <Typography
                                variant="caption"
                                sx={{
                                    textAlign: 'center',
                                    color: isCurrent ? 'primary.main' : 'text.secondary',
                                    fontWeight: isCurrent ? 600 : 400,
                                }}
                            >
                                {page.name}
                            </Typography>
                        </Stack>
                    );
                })}
            </Box>
        </Drawer>
    );
};

export const ReaderPageThumbnails = memo(BaseReaderPageThumbnails);
