/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import IconButton from '@mui/material/IconButton';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import { useLingui } from '@lingui/react/macro';
import { CheckboxListSetting } from '@/base/components/settings/CheckboxListSetting.tsx';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';
import type { updateChapterListOptions } from '@/features/chapter/utils/ChapterList.util.tsx';

/** The scanlators that are shown, an empty list means all of them. */
const getShownScanlators = (
    scanlators: string[],
    includedScanlators: string[],
    excludedScanlators: string[],
): string[] => {
    if (includedScanlators.length) {
        return includedScanlators;
    }

    // saved before the filter was "show only these": everything that was not hidden
    return excludedScanlators.length ? scanlators.filter((scanlator) => !excludedScanlators.includes(scanlator)) : [];
};

export const ChapterScanlatorsFilter = ({
    updateOption,
    scanlators,
    includedScanlators,
    excludedScanlators,
}: {
    updateOption: ReturnType<typeof updateChapterListOptions>;
    scanlators: string[];
    includedScanlators: string[];
    excludedScanlators: string[];
}) => {
    const { t } = useLingui();
    const popupState = usePopupState({ variant: 'dialog', popupId: 'chapter-list-options-scanlator-filter-dialog' });

    if (!scanlators.length) {
        return null;
    }

    const shownScanlators = getShownScanlators(scanlators, includedScanlators, excludedScanlators);

    return (
        <>
            <CustomTooltip title={t`Scanlators`}>
                <IconButton {...bindTrigger(popupState)} color="inherit">
                    <PeopleAltOutlinedIcon
                        color={includedScanlators.length || excludedScanlators.length ? 'warning' : undefined}
                    />
                </IconButton>
            </CustomTooltip>
            <CheckboxListSetting
                title={t`Show only these scanlators`}
                open={popupState.isOpen}
                onClose={(selectedScanlators) => {
                    if (selectedScanlators) {
                        // every scanlator chosen is the same as no filter, and keeps new scanlators visible
                        const isEveryScanlator = selectedScanlators.length === scanlators.length;
                        updateOption('includedScanlators', isEveryScanlator ? [] : selectedScanlators);
                        if (excludedScanlators.length) {
                            updateOption('excludedScanlators', []);
                        }
                    }
                    popupState.close();
                }}
                items={scanlators}
                getId={(scanlator) => scanlator}
                getLabel={(scanlator) => scanlator}
                isChecked={(scanlator) => shownScanlators.includes(scanlator)}
            />
        </>
    );
};
