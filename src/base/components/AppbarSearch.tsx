/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useMemo, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import { useQueryParam, StringParam } from 'use-query-params';
import { useLocation } from 'react-router-dom';
import { alpha, useTheme } from '@mui/material/styles';
import { useHotkeys } from 'react-hotkeys-hook';
import { useLingui } from '@lingui/react/macro';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import { SearchTextField } from '@/base/components/inputs/SearchTextField.tsx';
import { SearchParam } from '@/base/Base.types.ts';
import { TypographyMaxLines } from '@/base/components/texts/TypographyMaxLines.tsx';
import { STABLE_EMPTY_ARRAY } from '@/base/Base.constants.ts';
import { useDebounce } from '@/base/hooks/useDebounce.ts';
import { createFuzzySearch, fuzzySearch } from '@/base/utils/FuzzySearch.ts';
import { enhancedCleanup, escapeRegex } from '@/base/utils/Strings.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';
import { useSearchHistory } from '@/base/hooks/useSearchHistory.ts';
import { useNavBarContext } from '@/features/navigation-bar/NavbarContext.tsx';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { useForceUpdate } from '@mantine/hooks';
import List from '@mui/material/List';
import { ListSubheader } from '@/base/components/lists/ListSubheader.tsx';
import Button from '@mui/material/Button';
import { OffsetContainer } from '@/base/OffsetComponent.tsx';

/** Enough to be worth scrolling through, few enough to not cover the whole screen on mobile. */
const MAX_SUGGESTIONS = 8;

/** Short enough to still feel immediate, long enough to rank a large library only once per pause in the typing. */
const SUGGESTION_DEBOUNCE_MS = 150;

/** Pause in the typing after which "live search" applies the text as the query. */
const LIVE_SEARCH_DEBOUNCE_MS = 300;

const MAX_HISTORY_SUGGESTIONS = 5;

type SearchSuggestion = {
    label: string;
    isFromHistory: boolean;
};

const getSubstringMatches = (query: string, suggestions: string[]): string[] =>
    suggestions.filter((suggestion) => enhancedCleanup(suggestion).includes(query));

interface IProps {
    searchHistoryKey: string;
    isClosable?: boolean;
    suggestions?: string[];
    /** apply the query while typing (after a short pause) instead of only on enter or when picking a suggestion */
    liveSearch?: boolean;
}

export const AppbarSearch: React.FunctionComponent<IProps> = (props) => {
    const { searchHistoryKey, isClosable = true, suggestions = STABLE_EMPTY_ARRAY, liveSearch = false } = props;

    const theme = useTheme();
    const { t } = useLingui();
    const { setHideTitle, navBarWidth } = useNavBarContext();
    const scrollbarYSize = MediaQuery.useGetScrollbarSize('Y');
    const forceUpdate = useForceUpdate();

    const [prevLocationKey, setPrevLocationKey] = useState<string>();
    const location = useLocation();

    const [query, setQuery] = useQueryParam(SearchParam.QUERY, StringParam);
    const [isSearchOpen, setIsSearchOpen] = useState(!isClosable || !!query);
    const inputRef = React.useRef<HTMLInputElement>(undefined);

    const [searchString, setSearchString] = useState(query ?? '');
    const [liveAutoCompletion, setLiveAutoCompletion] = useState<string>();

    const [focused, setFocused] = useState(false);
    const [hideSuggestions, setHideSuggestions] = useState(false);

    const {
        settings: { fuzzySearch: isFuzzySearchEnabled },
    } = useMetadataServerSettings();

    const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory(
        searchHistoryKey,
        MAX_HISTORY_SUGGESTIONS,
    );

    // set right before live search changes the query param: that navigation must not overwrite what is being typed
    // (it would, for example, trim the trailing space of "one ")
    const isLiveCommitRef = React.useRef(false);

    if (prevLocationKey !== location.key) {
        setPrevLocationKey(location.key);

        if (isLiveCommitRef.current) {
            isLiveCommitRef.current = false;
        } else {
            setSearchString(query ?? '');
            setIsSearchOpen(!isClosable || !!query);
        }
    }

    const isOpen = isSearchOpen || !!query;

    const debouncedSearchString = useDebounce(searchString, SUGGESTION_DEBOUNCE_MS).trim();
    const showHistoryOptions = !debouncedSearchString;

    // The inline suggestion is drawn on top of the field. Its position is measured from the real input element, so it
    // lines up with the typed text whatever the field's padding, border and font are.
    const ghostWrapperRef = React.useRef<HTMLDivElement>(null);
    const [ghostLayout, setGhostLayout] = useState<{
        top: number;
        left: number;
        height: number;
        font: string;
        paddingLeft: string;
    } | null>(null);
    React.useLayoutEffect(() => {
        const input = inputRef.current;
        const wrapper = ghostWrapperRef.current;
        if (!input || !wrapper) {
            setGhostLayout(null);
            return;
        }

        const inputRect = input.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        const { font, paddingLeft } = getComputedStyle(input);
        setGhostLayout({
            top: inputRect.top - wrapperRect.top,
            left: inputRect.left - wrapperRect.left,
            height: inputRect.height,
            font,
            paddingLeft,
        });
    }, [searchString, liveAutoCompletion, focused, isOpen]);

    const debouncedLiveSearchString = useDebounce(searchString, LIVE_SEARCH_DEBOUNCE_MS).trim();
    useEffect(() => {
        if (!liveSearch || !focused || (query ?? '') === debouncedLiveSearchString) {
            return;
        }

        isLiveCommitRef.current = true;
        // replace the history entry, so typing does not fill the browser history with one entry per pause
        setQuery(debouncedLiveSearchString || undefined, 'replaceIn');
    }, [debouncedLiveSearchString]);

    const fuzzySearchIndex = useMemo(
        () => (isOpen && isFuzzySearchEnabled ? createFuzzySearch(suggestions, []) : null),
        [isOpen, isFuzzySearchEnabled, suggestions],
    );

    const { historyOptions, suggestionOptions } = useMemo(() => {
        const matches = fuzzySearchIndex
            ? fuzzySearch(fuzzySearchIndex, debouncedSearchString, { limit: MAX_SUGGESTIONS })
            : getSubstringMatches(enhancedCleanup(debouncedSearchString), suggestions);

        return {
            historyOptions: history.map((label) => ({ label, isFromHistory: true })),
            suggestionOptions: [...new Set(matches)]
                .slice(0, MAX_SUGGESTIONS)
                .map((label) => ({ label, isFromHistory: false })),
        };
    }, [debouncedSearchString, fuzzySearchIndex, suggestions, history]);

    const updateSearchOpenState = (open: boolean) => {
        if (!isClosable && !open) {
            return;
        }

        setIsSearchOpen(open);

        // try to focus input component since in case of navigating to the previous/next page in the browser history
        // the "openSearch" state might not change and thus, won't trigger a focus
        if (open) {
            inputRef.current?.focus();
        }
    };

    function handleChange(newQuery: string) {
        const normalizedQuery = newQuery.trim();

        if (normalizedQuery === '') {
            return;
        }

        setLiveAutoCompletion(undefined);
        setSearchString(normalizedQuery);
        addToHistory(normalizedQuery);
        setQuery(normalizedQuery);
        updateSearchOpenState(false);
        setHideSuggestions(true);
    }

    const cancelSearch = () => {
        setLiveAutoCompletion(undefined);
        setSearchString('');
        setQuery(undefined);
        updateSearchOpenState(false);
        setHideSuggestions(false);
    };
    const handleBlur = () => {
        if (!searchString) {
            updateSearchOpenState(false);
        }
    };

    useHotkeys(
        'ctrl+f, F3',
        () => {
            updateSearchOpenState(true);
        },
        { preventDefault: true },
    );
    useHotkeys(
        'tab',
        (e) => {
            if (!focused || !liveAutoCompletion || liveAutoCompletion === searchString) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            setSearchString(liveAutoCompletion);
        },
        {
            enableOnFormTags: true,
        },
        [focused, liveAutoCompletion, searchString],
    );

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                forceUpdate();
            });
        }

        setHideTitle(isOpen);
        return () => {
            setHideTitle(false);
            setHideSuggestions(false);
        };
    }, [isOpen]);

    if (isOpen) {
        return (
            <Autocomplete<SearchSuggestion, false, true, true>
                open={focused && !hideSuggestions}
                freeSolo
                disableClearable
                forcePopupIcon={false}
                openOnFocus
                fullWidth
                onFocus={() => {
                    setFocused(true);
                }}
                onBlur={() => setFocused(false)}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.5,
                            borderRadius: '10px',
                            overflow: 'hidden',
                            backgroundImage: 'none',
                            border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.34), 0 18px 38px -8px rgba(0, 0, 0, 0.55)',
                        },
                    },
                    popper: {
                        placement: 'bottom-start',
                        // the field sits in the fixed app bar: an absolutely positioned popper would scroll away with the page
                        popperOptions: { strategy: 'fixed' },
                        sx: {
                            [theme.breakpoints.down('md')]: {
                                width: `calc(100vw - ${navBarWidth}px - ${scrollbarYSize}px) !important`,
                            },
                        },
                    },
                }}
                options={showHistoryOptions ? historyOptions : suggestionOptions}
                // the options are already ranked by relevance, re-filtering them would drop the typo tolerant hits
                filterOptions={(unfilteredOptions) => unfilteredOptions}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
                groupBy={(option) => (option.isFromHistory ? t`Recent searches` : '')}
                inputValue={searchString}
                onInputChange={(_, value, reason) => {
                    // "reset" fires on mount and after selecting an option, both of which would overwrite the state
                    // that is kept in sync with the query param
                    if (reason === 'input') {
                        setSearchString(value);
                        setHideSuggestions(false);

                        const tmpNormalizedValue = value.trimStart().toLowerCase();

                        if (!tmpNormalizedValue) {
                            setLiveAutoCompletion(undefined);
                            return;
                        }

                        const findLiveAutoCompletion = (list: string[]) =>
                            list.find((item) => item.toLowerCase().startsWith(tmpNormalizedValue));

                        const liveAutoCompletionString =
                            findLiveAutoCompletion(suggestionOptions.map(({ label }) => label)) ??
                            findLiveAutoCompletion(suggestions);
                        setLiveAutoCompletion(liveAutoCompletionString);
                    }
                }}
                onChange={(_, value) => {
                    handleChange(typeof value === 'string' ? value : value.label);
                }}
                renderGroup={(value) => (
                    <OffsetContainer initial>
                        <List
                            subheader={
                                value.group && (
                                    <ListSubheader sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        {value.group}
                                        <Button onClick={clearHistory}>{t`Delete all`}</Button>
                                    </ListSubheader>
                                )
                            }
                        >
                            {value.children}
                        </List>
                    </OffsetContainer>
                )}
                renderOption={({ key, ...optionProps }, option) => (
                    <Box key={key} component="li" sx={{ gap: 1 }} {...optionProps}>
                        {option.isFromHistory ? <HistoryIcon /> : <SearchIcon />}
                        <Box sx={{ flexGrow: 1 }}>
                            <CustomTooltip title={option.label} placement="right">
                                <TypographyMaxLines sx={{ width: 'fit-content' }}>{option.label}</TypographyMaxLines>
                            </CustomTooltip>
                        </Box>
                        {option.isFromHistory && (
                            <CustomTooltip title={t`Delete`} placement="auto">
                                <IconButton
                                    edge="end"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromHistory(option.label);
                                    }}
                                >
                                    <CloseIcon />
                                </IconButton>
                            </CustomTooltip>
                        )}
                    </Box>
                )}
                renderInput={(params) => (
                    <Box ref={ghostWrapperRef} sx={{ position: 'relative' }}>
                        {focused && liveAutoCompletion && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    display: 'flex',
                                    alignItems: 'center',
                                    top: ghostLayout?.top ?? 0,
                                    left: ghostLayout?.left ?? 0,
                                    height: ghostLayout?.height ?? '100%',
                                    width: ghostLayout ? `calc(100% - ${ghostLayout.left}px)` : '100%',
                                    paddingLeft: ghostLayout?.paddingLeft ?? '17px',
                                    font: ghostLayout?.font,
                                    overflow: 'hidden',
                                    color: 'text.secondary',
                                    whiteSpace: 'pre',
                                    pointerEvents: 'none',
                                    zIndex: 0,
                                }}
                            >
                                <span style={{ visibility: 'hidden' }}>{searchString}</span>
                                {liveAutoCompletion.replace(new RegExp(escapeRegex(searchString).trimStart(), 'i'), '')}
                            </Box>
                        )}
                        <SearchTextField
                            {...params}
                            autoFocus
                            variant="standard"
                            fullWidth
                            onCancel={cancelSearch}
                            onBlur={handleBlur}
                            inputRef={inputRef}
                            sx={theme.applyStyles('light', {
                                '& .MuiInput-underline:before': {
                                    borderBottomColor: 'primary.contrastText', // Default color
                                },
                                '& .MuiInput-underline:hover:before': {
                                    borderBottomColor: 'primary.contrastText', // Hover color
                                },
                                '& .MuiInput-underline:after': {
                                    borderBottomColor: 'primary.dark', // Focused color
                                },
                            })}
                            cancelButtonProps={{
                                sx: theme.applyStyles('light', { color: 'primary.contrastText' }),
                            }}
                        />
                    </Box>
                )}
            />
        );
    }

    return (
        <CustomTooltip title={t`Search`}>
            <IconButton onClick={() => updateSearchOpenState(true)} color="inherit">
                <SearchIcon />
            </IconButton>
        </CustomTooltip>
    );
};
