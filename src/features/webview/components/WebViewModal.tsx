/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { SyntheticEvent } from 'react';
import { useEffect, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useLingui } from '@lingui/react/macro';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { AuthManager } from '@/features/authentication/AuthManager.ts';

const OPEN_WEBVIEW_EVENT = 'suwayomi:open-webview';

/**
 * Opens the given WebView url (see "requestManager.getWebviewUrl") in a modal on top of the current page instead of a
 * new browser tab.
 */
export const openInAppWebView = (url: string) =>
    window.dispatchEvent(new CustomEvent(OPEN_WEBVIEW_EVENT, { detail: url }));

const isWebViewLink = (link: HTMLAnchorElement) => !!link.href && link.pathname.endsWith('/webview');

// the WebView page logs in by itself unless it is given the token of the current session ("?token=")
const withSessionToken = (webViewUrl: string): string => {
    const token = AuthManager.getAccessToken();
    if (!token) {
        return webViewUrl;
    }

    const hashIndex = webViewUrl.indexOf('#');
    const base = hashIndex === -1 ? webViewUrl : webViewUrl.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : webViewUrl.slice(hashIndex);

    return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}${hash}`;
};

// "<server>/webview#<target url>" => "hostname/path" of the target url
const getDisplayUrl = (webViewUrl: string): string => {
    const target = new URL(webViewUrl, window.location.href).hash.replace(/^#\/?/, '');
    try {
        const { hostname, pathname } = new URL(target);
        return hostname + (pathname !== '/' ? pathname : '');
    } catch {
        return target;
    }
};

export const WebViewModal = () => {
    const { t } = useLingui();
    const theme = useTheme();

    const [url, setUrl] = useState<string | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const onOpen = (event: Event) => {
            setIsMaximized(false);
            setUrl((event as CustomEvent<string>).detail);
        };

        // every "open in WebView" link should open the modal instead of a new browser tab
        const onLinkClick = (event: MouseEvent) => {
            const link = (event.target as Element | null)?.closest('a');
            if (!link || !isWebViewLink(link) || event.ctrlKey || event.metaKey || event.shiftKey) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            openInAppWebView(link.href);
        };

        window.addEventListener(OPEN_WEBVIEW_EVENT, onOpen);
        document.addEventListener('click', onLinkClick, true);
        return () => {
            window.removeEventListener(OPEN_WEBVIEW_EVENT, onOpen);
            document.removeEventListener('click', onLinkClick, true);
        };
    }, []);

    const close = () => setUrl(null);

    // the WebView page ships its own dark styling; recolor it with the app theme so it does not look like a foreign page
    const applyTheme = (event: SyntheticEvent<HTMLIFrameElement>) => {
        const doc = event.currentTarget.contentDocument; // same origin, so it is accessible
        if (!doc?.head) {
            return;
        }

        const style = doc.getElementById('app-theme') ?? doc.head.appendChild(doc.createElement('style'));
        style.id = 'app-theme';
        style.textContent = `
            body { background-color: ${theme.palette.background.default}; color: ${theme.palette.text.primary}; }
            header { background-color: ${alpha(theme.palette.background.paper, 0.96)}; color: ${theme.palette.text.primary}; border-bottom-color: ${theme.palette.divider}; }
            header h1, header #title { color: ${theme.palette.text.primary}; }
        `;
    };

    return (
        <Dialog
            open={url != null}
            onClose={close}
            fullScreen={isMaximized}
            maxWidth={false}
            // no fade-out: the backdrop stays on top of the page until the animation ends and swallows the first clicks
            transitionDuration={{ enter: 225, exit: 0 }}
            slotProps={{
                paper: {
                    sx: isMaximized
                        ? undefined
                        : {
                              width: 'min(1200px, 94vw)',
                              height: 'min(850px, 88vh)',
                              overflow: 'hidden',
                              // phones: nearly the full width and the room between the status bar and the home indicator
                              [theme.breakpoints.down('sm')]: {
                                  width: '96vw',
                                  height: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 28px)',
                                  maxHeight: 'none',
                                  margin: 0,
                                  marginTop: 'calc(env(safe-area-inset-top) + 14px)',
                                  marginBottom: 'calc(env(safe-area-inset-bottom) + 14px)',
                                  borderRadius: '28px',
                              },
                          },
                },
            }}
        >
            <Stack sx={{ height: '100%' }}>
                <Stack
                    direction="row"
                    sx={{
                        alignItems: 'center',
                        gap: 1,
                        pl: { xs: 3, sm: 2 },
                        pr: { xs: 2, sm: 1 },
                        minHeight: 42,
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="subtitle2" noWrap title={url ?? undefined} sx={{ flexGrow: 1 }}>
                        {url ? getDisplayUrl(url) : ''}
                    </Typography>
                    <CustomTooltip title={t`Reload`}>
                        <IconButton size="small" onClick={() => setReloadKey((key) => key + 1)}>
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </CustomTooltip>
                    <CustomTooltip title={t`Open in new tab`}>
                        <IconButton
                            size="small"
                            onClick={() => {
                                window.open(url!, '_blank', 'noopener,noreferrer');
                                close();
                            }}
                        >
                            <OpenInNewIcon fontSize="small" />
                        </IconButton>
                    </CustomTooltip>
                    <CustomTooltip title={isMaximized ? t`Restore` : t`Maximize`}>
                        <IconButton size="small" onClick={() => setIsMaximized((maximized) => !maximized)}>
                            {isMaximized ? (
                                <FullscreenExitIcon fontSize="small" />
                            ) : (
                                <FullscreenIcon fontSize="small" />
                            )}
                        </IconButton>
                    </CustomTooltip>
                    <CustomTooltip title={t`Close`}>
                        <IconButton size="small" onClick={close}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </CustomTooltip>
                </Stack>
                {url && (
                    <iframe
                        key={reloadKey}
                        title={t`WebView`}
                        src={withSessionToken(url)}
                        onLoad={applyTheme}
                        allow="clipboard-read; clipboard-write"
                        style={{ flexGrow: 1, width: '100%', border: 'none' }}
                    />
                )}
            </Stack>
        </Dialog>
    );
};
