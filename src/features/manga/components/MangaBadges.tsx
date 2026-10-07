/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { alpha, styled } from '@mui/material/styles';
import { useState } from 'react';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { useLingui } from '@lingui/react/macro';
import { plural } from '@lingui/core/macro';
import type { MangaCardMode } from '@/features/manga/Manga.types.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { MUIUtil } from '@/lib/mui/MUI.util.ts';
import { ELEVATION } from '@/features/theme/services/ForkComponentOverrides.ts';
import { MangaStatus } from '@/lib/graphql/generated/graphql-base.types.ts';
import { MANGA_STATUS_TO_COLOR, MANGA_STATUS_TO_TRANSLATION } from '@/features/manga/Manga.constants.ts';

const BadgeContainer = styled('div')({
    display: 'flex',
    height: 'fit-content',
    // a long label (e.g. "Publishing finished") shrinks with an ellipsis instead of wrapping out of the pill
    maxWidth: '100%',
    minWidth: 0,
    borderRadius: 9999,
    overflow: 'hidden',
    boxShadow: ELEVATION.sm,
    '&:empty': { display: 'none' },
});

const Badge = styled(Typography)(({ theme }) => ({
    color: theme.palette.primary.contrastText,
    paddingInline: theme.spacing(0.8),
    fontWeight: 600,
}));

// dark frosted pill: reads as a quiet label on any cover instead of a saturated block (shared by all cover overlays)
const FROSTED_PILL = {
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px) saturate(140%)',
    WebkitBackdropFilter: 'blur(8px) saturate(140%)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)',
} as const;

// fixed height so every frosted pill (In Library, chapter count, fetch button, status) lines up
const PILL_HEIGHT = 22;

const FrostedBadge = styled(Badge)({
    ...FROSTED_PILL,
    height: PILL_HEIGHT,
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    flexShrink: 0,
});

// frosted pill with a small glowing dot in `--status-color`
const DotBadge = styled(FrostedBadge)({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    paddingInline: 10,
    '&::before': {
        content: '""',
        width: 7,
        height: 7,
        borderRadius: '50%',
        backgroundColor: 'var(--status-color)',
        boxShadow: '0 0 6px var(--status-color)',
        flexShrink: 0,
    },
});

export const MangaBadges = ({
    inLibraryIndicator,
    updateLibraryState,
    isInLibrary,
    unread,
    downloadCount,
    chapterCount,
    onPeekChapterCount,
    status,
    isSourceMissing,
    mode,
}: {
    inLibraryIndicator?: boolean;
    updateLibraryState: () => void;
    isInLibrary: boolean;
    unread?: number;
    downloadCount?: number;
    // known chapter count for "source" mode cards (e.g. global/browse search results), where it isn't fetched by default
    chapterCount?: number;
    // fetches the live chapter count from the source on demand, when it isn't already known; resolves with the count
    onPeekChapterCount?: () => Promise<number>;
    // release status (ongoing/completed/hiatus/...), only known for library cards ("default" mode)
    status?: MangaStatus;
    isSourceMissing?: boolean;
    mode: MangaCardMode;
}) => {
    const { t } = useLingui();

    const isTouchDevice = MediaQuery.useIsTouchDevice();

    const {
        settings: { showUnreadBadge, showDownloadBadge, showUnknownStatusBadge },
    } = useMetadataServerSettings();

    const [isPeeking, setIsPeeking] = useState(false);
    const [peekedChapterCount, setPeekedChapterCount] = useState<number | null>(null);

    // ponytail: "0 known chapters" is treated as "never fetched" unless it was just peeked - a manga that
    // genuinely has 0 chapters keeps showing the peek button, which is harmless (peeking it just confirms 0)
    const isChapterCountKnown = !!chapterCount || peekedChapterCount !== null;
    const displayedChapterCount = peekedChapterCount ?? chapterCount ?? 0;

    const handlePeekChapterCount = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isPeeking || !onPeekChapterCount) {
            return;
        }

        setIsPeeking(true);
        try {
            setPeekedChapterCount(await onPeekChapterCount());
        } finally {
            setIsPeeking(false);
        }
    };

    return (
        <>
            <BadgeContainer>
                {isSourceMissing && (
                    <CustomTooltip title={t`Source missing. Check your installed extensions.`}>
                        <FrostedBadge
                            aria-label={t`Source missing`}
                            sx={{ display: 'flex', alignItems: 'center', paddingInline: 1, color: 'warning.main' }}
                        >
                            <WarningAmberIcon sx={{ fontSize: '1em' }} />
                        </FrostedBadge>
                    </CustomTooltip>
                )}
                {!isTouchDevice && inLibraryIndicator && mode === 'source' && (
                    <Button
                        className="source-manga-library-state-button"
                        component="div"
                        variant="contained"
                        size="small"
                        {...MUIUtil.preventRippleProp()}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            updateLibraryState();
                        }}
                        sx={(theme) => {
                            const accent = isInLibrary ? theme.palette.error.main : theme.palette.primary.main;

                            return {
                                ...FROSTED_PILL,
                                display: 'none',
                                height: PILL_HEIGHT,
                                minHeight: 0,
                                gap: 0.75,
                                borderRadius: 9999,
                                paddingInline: 1.25,
                                boxShadow: `inset 0 0 0 1px ${alpha(accent, 0.7)}, ${ELEVATION.sm}`,
                                '&::before': {
                                    content: '""',
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    backgroundColor: accent,
                                    boxShadow: `0 0 6px ${accent}`,
                                },
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.68)',
                                    boxShadow: `inset 0 0 0 1px ${accent}, ${ELEVATION.md}`,
                                },
                            };
                        }}
                    >
                        {isInLibrary ? t`Remove from the library` : t`Add To Library`}
                    </Button>
                )}
                {inLibraryIndicator && isInLibrary && (
                    <DotBadge
                        className="source-manga-library-state-indicator"
                        sx={(theme) => ({ '--status-color': theme.palette.primary.main })}
                    >
                        {t`In Library`}
                    </DotBadge>
                )}
                {((showUnreadBadge && mode === 'default') || mode === 'duplicate') && (unread ?? 0) > 0 && (
                    <DotBadge sx={(theme) => ({ '--status-color': theme.palette.primary.main })}>{unread}</DotBadge>
                )}
                {((showDownloadBadge && mode === 'default') || mode === 'duplicate') && (downloadCount ?? 0) > 0 && (
                    <DotBadge sx={(theme) => ({ '--status-color': theme.palette.secondary.main })}>
                        {downloadCount}
                    </DotBadge>
                )}
                {mode === 'default' && !!status && (showUnknownStatusBadge || status !== MangaStatus.Unknown) && (
                    <DotBadge
                        sx={(theme) => ({
                            // the only badge that may shrink
                            flexShrink: 1,
                            minWidth: 0,
                            '--status-color':
                                MANGA_STATUS_TO_COLOR[status] === 'default'
                                    ? theme.palette.text.secondary
                                    : theme.palette[MANGA_STATUS_TO_COLOR[status]].main,
                        })}
                    >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t(MANGA_STATUS_TO_TRANSLATION[status])}
                        </span>
                    </DotBadge>
                )}
            </BadgeContainer>
            {/* top right, next to (or in place of) the option button */}
            {mode === 'source' && (isChapterCountKnown || !!onPeekChapterCount) && (
                <BadgeContainer
                    sx={{
                        ml: 'auto',
                        // hover-capable devices: only show the count while the card is hovered/focused (touch always shows it)
                        '@media (hover: hover) and (pointer: fine)': {
                            opacity: isPeeking ? 1 : 0,
                            transition: 'opacity 160ms cubic-bezier(0.2, 0, 0, 1)',
                            '.MuiCardActionArea-root:hover &, .MuiCardActionArea-root:focus-visible &': { opacity: 1 },
                        },
                    }}
                >
                    {mode === 'source' && isChapterCountKnown && (
                        <CustomTooltip
                            title={plural(displayedChapterCount, {
                                one: '# chapter',
                                other: '# chapters',
                            })}
                        >
                            <FrostedBadge sx={{ display: 'flex', alignItems: 'center', gap: 0.5, paddingInline: 1 }}>
                                <AutoStoriesIcon sx={{ fontSize: '1em' }} />
                                {displayedChapterCount}
                            </FrostedBadge>
                        </CustomTooltip>
                    )}
                    {mode === 'source' && !isChapterCountKnown && !!onPeekChapterCount && (
                        <CustomTooltip title={t`Chapter count unknown, click to fetch it from the source`}>
                            <ButtonBase
                                aria-label={t`Fetch chapter count`}
                                onClick={handlePeekChapterCount}
                                sx={{ cursor: isPeeking ? 'default' : 'pointer' }}
                            >
                                <FrostedBadge sx={{ display: 'flex', alignItems: 'center', paddingInline: 1 }}>
                                    {isPeeking ? (
                                        <CircularProgress size="1em" color="inherit" />
                                    ) : (
                                        <VisibilityIcon sx={{ fontSize: '1em' }} />
                                    )}
                                </FrostedBadge>
                            </ButtonBase>
                        </CustomTooltip>
                    )}
                </BadgeContainer>
            )}
        </>
    );
};
