/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Components, Theme } from '@mui/material/styles';
import { alpha, keyframes } from '@mui/material/styles';

const TACTILE_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

const dialogEnter = keyframes`
    from { transform: translateY(10px) scale(0.96); }
    to { transform: none; }
`;

const surfaceBorder = (theme: Theme) => `1px solid ${alpha(theme.palette.text.primary, 0.1)}`;

// Layered elevation: a tight contact shadow plus a soft ambient one reads as depth, a single blur reads as flat.
export const ELEVATION = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 10px -2px rgba(0, 0, 0, 0.35)',
    md: '0 2px 4px rgba(0, 0, 0, 0.32), 0 10px 22px -4px rgba(0, 0, 0, 0.42)',
    lg: '0 4px 8px rgba(0, 0, 0, 0.34), 0 18px 38px -8px rgba(0, 0, 0, 0.55)',
    xl: '0 8px 16px rgba(0, 0, 0, 0.36), 0 30px 60px -12px rgba(0, 0, 0, 0.62)',
} as const;

// hard 1px edge + soft falloff, for icons/labels sitting on translucent or dark chrome
const ICON_SHADOW = 'drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6)) drop-shadow(0 2px 5px rgba(0, 0, 0, 0.55))';
const TEXT_SHADOW = '0 1px 0 rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.6)';

/** Active nav destination glows in the accent color instead of getting a button box. Needs the item tagged `data-active`. */
export const activeIconGlow = (theme: Theme) => ({
    '& [data-active] .MuiSvgIcon-root': {
        filter: `drop-shadow(0 0 6px ${alpha(theme.palette.primary.main, 0.7)})`,
    },
    // History/Downloads glyphs are thin, so the base glow barely reads: layer a tighter + wider halo
    '& a[data-active][href$="/history"] .MuiSvgIcon-root, & a[data-active][href$="/downloads"] .MuiSvgIcon-root': {
        filter: `drop-shadow(0 0 3px ${alpha(theme.palette.primary.main, 0.95)}) drop-shadow(0 0 9px ${alpha(theme.palette.primary.main, 0.85)}) drop-shadow(0 0 16px ${alpha(theme.palette.primary.main, 0.55)})`,
    },
});

// 1px top highlight that catches "light" on glass edges
const EDGE_HIGHLIGHT = 'inset 0 1px 0 rgba(255, 255, 255, 0.08)';

/**
 * Frosted-glass surface for elements that float over scrolling content only (menus, dialogs, sticky bars, FABs).
 * Tune the whole look with the two arguments: opacity (higher = more solid) and blur radius in px.
 */
/** The dark panel color of the accounts dialog: the theme's panel color pushed toward black. `lift` (0-1) lightens it. */
export const darkPanelColor = (theme: Theme, lift = 0) =>
    `color-mix(in srgb, ${theme.vars?.palette.background.paper ?? theme.palette.background.paper} ${65 + lift * 20}%, #000)`;

export const glassSurface = (color: string, opacity = 0.8, blur = 16) => ({
    backgroundColor: alpha(color, opacity),
    backdropFilter: `blur(${blur}px) saturate(160%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(160%)`,
});

/**
 * Component style overrides (rounded corners, tactile press states, softer surfaces) applied on top of every app theme.
 * App themes can still override any of these through their own "components".
 */
export const FORK_COMPONENT_OVERRIDES: Components<Theme> = {
    MuiButton: {
        styleOverrides: {
            root: {
                borderRadius: 8,
                textTransform: 'none',
                fontWeight: 550,
                letterSpacing: '-0.01em',
                transition: `background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 100ms ${TACTILE_EASING}, box-shadow 160ms ease`,
                '&:active': { transform: 'scale(0.97)' },
            },
            outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
            contained: {
                boxShadow: `${ELEVATION.sm}, ${EDGE_HIGHLIGHT}`,
                '&:hover': { boxShadow: `${ELEVATION.md}, ${EDGE_HIGHLIGHT}` },
            },
        },
    },
    MuiIconButton: {
        styleOverrides: {
            root: {
                borderRadius: 8,
                transition: `background-color 150ms ease, color 150ms ease, transform 100ms ${TACTILE_EASING}`,
                '&:active': { transform: 'scale(0.92)' },
            },
        },
    },
    MuiFab: {
        styleOverrides: {
            root: {
                borderRadius: 14,
                boxShadow: `${ELEVATION.lg}, ${EDGE_HIGHLIGHT}`,
                transition: `transform 160ms ${TACTILE_EASING}, box-shadow 160ms ease`,
                '&:hover': { boxShadow: `${ELEVATION.xl}, ${EDGE_HIGHLIGHT}` },
                '&:active': { transform: 'scale(0.94)' },
            },
            // dark panel with the accent on the icon, like the accounts dialog: a bright primary fill was too loud
            primary: ({ theme }) => ({
                backgroundColor: darkPanelColor(theme),
                color: theme.palette.primary.main,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                '&:hover': {
                    backgroundColor: darkPanelColor(theme, 0.5),
                    boxShadow: `${ELEVATION.xl}, ${EDGE_HIGHLIGHT}`,
                },
            }),
        },
    },
    MuiChip: {
        styleOverrides: {
            root: {
                borderRadius: 9999,
                fontWeight: 500,
                transition: `background-color 150ms ease, border-color 150ms ease, transform 100ms ${TACTILE_EASING}`,
                '&:active': { transform: 'scale(0.96)' },
            },
        },
    },
    MuiTabs: {
        styleOverrides: {
            root: { minHeight: 44 },
            // pill-shaped indicator that glides between tabs with a soft glow in the active color
            indicator: ({ theme }) => ({
                height: 3,
                borderRadius: 3,
                boxShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.55)}`,
                transition: `left 300ms ${TACTILE_EASING}, width 300ms ${TACTILE_EASING}`,
            }),
        },
    },
    MuiTab: {
        styleOverrides: {
            root: {
                textTransform: 'none',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                minHeight: 44,
                borderRadius: '8px 8px 0 0',
                transition: 'color 150ms ease, background-color 150ms ease',
            },
        },
    },
    MuiCard: {
        styleOverrides: {
            root: {
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: ELEVATION.md,
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                    // light rim drawn over the cover: dark shadows alone are invisible on dark surfaces
                    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
                },
                transition: `transform 200ms ${TACTILE_EASING}, box-shadow 200ms ${TACTILE_EASING}, border-color 200ms ease`,
                '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: ELEVATION.lg,
                    zIndex: 0, // stay below the sticky toolbar (zIndex 1)
                },
            },
        },
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                borderRadius: 10,
                transition: 'border-color 150ms ease, box-shadow 150ms ease',
            },
        },
    },
    MuiSwitch: {
        styleOverrides: {
            switchBase: {
                transition: `transform 150ms ${TACTILE_EASING}, color 150ms ease`,
            },
            thumb: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)' },
            track: {
                borderRadius: 999,
                transition: 'background-color 150ms ease, opacity 150ms ease',
            },
        },
    },
    MuiCheckbox: {
        styleOverrides: {
            root: {
                transition: `transform 100ms ${TACTILE_EASING}, color 150ms ease`,
                '&:active': { transform: 'scale(0.9)' },
            },
        },
    },
    MuiRadio: {
        styleOverrides: {
            root: {
                transition: `transform 100ms ${TACTILE_EASING}, color 150ms ease`,
                '&:active': { transform: 'scale(0.9)' },
            },
        },
    },
    MuiSlider: {
        styleOverrides: {
            root: { height: 6 },
            track: { borderRadius: 4 },
            rail: { borderRadius: 4, opacity: 0.3 },
            thumb: ({ theme }) => ({
                width: 18,
                height: 18,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                transition: `box-shadow 150ms ease, transform 100ms ${TACTILE_EASING}`,
                '&:hover, &.Mui-focusVisible': {
                    boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`,
                },
                '&.Mui-active': {
                    transform: 'scale(1.15)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                },
            }),
        },
    },
    MuiListSubheader: {
        styleOverrides: {
            root: ({ theme }) => ({
                background: 'transparent',
                color: theme.palette.primary.main,
                fontSize: '0.76rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
                // MUI's default line-height is 48px, which is what really sized these headers: minHeight alone never
                // shrank them. Text size stays the same, only the container gets smaller.
                lineHeight: '24px',
                minHeight: 24,
                padding: '0 18px',
                marginTop: 6,
                marginBottom: 2,
            }),
        },
    },
    MuiDialog: {
        styleOverrides: {
            paper: ({ theme }) => ({
                borderRadius: 16,
                backgroundImage: 'none',
                ...glassSurface(theme.palette.background.paper, 0.92, 20),
                border: surfaceBorder(theme),
                boxShadow: `${ELEVATION.xl}, ${EDGE_HIGHLIGHT}`,
                animation: `${dialogEnter} 240ms ${TACTILE_EASING}`,
            }),
        },
    },
    MuiDrawer: {
        styleOverrides: {
            paper: ({ theme }) => ({
                // light falls from the top: gentle vertical gradient instead of a flat fill
                backgroundImage:
                    'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 45%, rgba(0, 0, 0, 0.16) 100%)',
                borderRight: surfaceBorder(theme),
                boxShadow: `${ELEVATION.lg}, ${EDGE_HIGHLIGHT}, inset -1px 0 0 rgba(255, 255, 255, 0.05)`,
                ...activeIconGlow(theme),
            }),
        },
    },
    MuiPopover: {
        styleOverrides: {
            paper: ({ theme }) => ({
                borderRadius: 12,
                backgroundImage: 'none',
                ...glassSurface(theme.palette.background.paper, 0.86, 16),
                border: surfaceBorder(theme),
                boxShadow: `${ELEVATION.lg}, ${EDGE_HIGHLIGHT}`,
            }),
        },
    },
    MuiAppBar: {
        styleOverrides: {
            root: ({ theme }) => ({
                // the same color MUI paints the bar with (light: --AppBar-background, dark: background.paper, which is what
                // AppBar.darkBg points to), but only 72% opaque so covers show through while scrolling; text and icons
                // stay fully opaque
                backgroundColor: 'color-mix(in srgb, var(--AppBar-background) 72%, transparent)',
                ...theme.applyStyles('dark', {
                    backgroundColor: `color-mix(in srgb, ${theme.vars?.palette.background.paper ?? theme.palette.background.paper} 72%, transparent)`,
                }),
                // ambient light in the theme's primary color: a glow from the top-left corner and a fainter one from the
                // bottom-right, so the bar is lit from two sides instead of being one flat color
                backgroundImage: `radial-gradient(110% 260% at 0% 0%, ${alpha(theme.palette.primary.main, 0.24)} 0%, transparent 62%), radial-gradient(80% 240% at 100% 100%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 65%)`,
                '& .MuiSvgIcon-root': {
                    filter: ICON_SHADOW,
                },
                '& .MuiTypography-root': { textShadow: TEXT_SHADOW },
                // every glyph is traced with the same accent outline as the account switcher box: a stroke painted *under*
                // the fill (paint-order), so only its outer half shows and it follows the exact letter/icon shape
                '& .MuiSvgIcon-root path': {
                    stroke: alpha(theme.palette.primary.main, 0.55),
                    strokeWidth: 2.5,
                    strokeLinejoin: 'round',
                    paintOrder: 'stroke fill',
                },
                '& h1.MuiTypography-root': {
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                    // Safari (iPhone, iPad and Mac) paints -webkit-text-stroke over the letters instead of under them
                    // (paint-order only works on SVG there), which smears the title into a blurry halo. So the outline is
                    // for every other browser only; "font: -apple-system-body" is understood by Safari and nothing else.
                    // (A "hover: none" check was tried first, it misses Safari whenever it reports a pointer.)
                    '@supports not (font: -apple-system-body)': {
                        WebkitTextStroke: `3px ${alpha(theme.palette.primary.main, 0.55)}`,
                        paintOrder: 'stroke fill',
                        textShadow: TEXT_SHADOW,
                    },
                    // an app added to the home screen: plain title, whatever the engine does with outlines and shadows there
                    '@media (display-mode: standalone)': {
                        WebkitTextStroke: 'none',
                        textShadow: 'none',
                    },
                },
                backdropFilter: 'blur(10px) saturate(150%)',
                WebkitBackdropFilter: 'blur(10px) saturate(150%)',
                // iOS 26 lays a system blur over the top ~40pt of an app on the home screen, which blurs the title and icons
                // (nothing in CSS or the meta tags turns it off). It is skipped only when a fixed box at the top edge has an
                // opaque background-color and no backdrop-filter: WebKit then takes that color for the edge instead. So in
                // that case the bar gives up its glass.
                '@media (display-mode: standalone)': {
                    '@supports (-webkit-touch-callout: none)': {
                        backgroundColor: 'var(--AppBar-background)',
                        ...theme.applyStyles('dark', {
                            backgroundColor: theme.vars?.palette.background.paper ?? theme.palette.background.paper,
                        }),
                        backdropFilter: 'none',
                        WebkitBackdropFilter: 'none',
                    },
                },
                // the bar is flush with the top and sides of the window, so only the bottom corners are rounded, slightly
                borderRadius: '0 0 8px 8px',
                borderBottom: `1px solid ${theme.palette.divider}`,
                boxShadow: ELEVATION.md,
                transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
                '& .MuiToolbar-root': {
                    minHeight: 52,
                    height: 52,
                    paddingLeft: 12,
                    paddingRight: 14,
                },
                // search fields in the app bar: rounded outlined box instead of MUI's flat underline
                '& .MuiInputBase-root': {
                    borderRadius: 8,
                    border: `1px solid ${alpha(theme.palette.text.primary, 0.18)}`,
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                    padding: '4px 8px 4px 12px',
                    transition: 'border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease',
                    '&:hover:not(.Mui-focused)': {
                        borderColor: alpha(theme.palette.text.primary, 0.3),
                    },
                    '&.Mui-focused': {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.text.primary, 0.08),
                        boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.25)}`,
                    },
                },
                '& .MuiInput-underline:before, & .MuiInput-underline:after': {
                    display: 'none',
                },
                '& .MuiInputBase-input': {
                    padding: 4,
                    fontSize: '0.875rem',
                    lineHeight: 1.4,
                },
                '& .MuiInputAdornment-positionEnd .MuiIconButton-root': {
                    padding: 4,
                    marginRight: -2,
                },
            }),
        },
    },
};
