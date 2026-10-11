/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { bindTrigger, usePopupState } from 'material-ui-popup-state/hooks';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import DisabledByDefaultRounded from '@mui/icons-material/DisabledByDefaultRounded';
import { useLingui } from '@lingui/react/macro';
import { CheckboxListSetting } from '@/base/components/settings/CheckboxListSetting.tsx';
import type { updateChapterListOptions } from '@/features/chapter/utils/ChapterList.util.tsx';
import IconButton from '@mui/material/IconButton';
import { CustomTooltip } from '@/base/components/CustomTooltip.tsx';

export const ChapterExcludeSanlatorsFilter = ({
    updateOption,
    scanlators,
    excludedScanlators,
}: {
    updateOption: ReturnType<typeof updateChapterListOptions>;
    scanlators: string[];
    excludedScanlators: string[];
}) => {
    const { t } = useLingui();
    const popupState = usePopupState({ variant: 'dialog', popupId: 'chapter-list-options-scanlator-filter-dialog' });

    if (!scanlators.length) {
        return null;
    }

    return (
        <>
            <CustomTooltip title={t`Exclude scanlators`}>
                <IconButton {...bindTrigger(popupState)} color="inherit">
                    <PeopleAltOutlinedIcon color={excludedScanlators.length ? 'warning' : undefined} />
                </IconButton>
            </CustomTooltip>
            <CheckboxListSetting
                title={t`Exclude scanlators`}
                open={popupState.isOpen}
                onClose={(selectedScanlators) => {
                    if (selectedScanlators) {
                        updateOption('excludedScanlators', selectedScanlators);
                    }
                    popupState.close();
                }}
                items={scanlators}
                getId={(scanlator) => scanlator}
                getLabel={(scanlator) => scanlator}
                isChecked={(scanlator) => excludedScanlators.includes(scanlator)}
                slotProps={{
                    checkbox: {
                        checkedIcon: <DisabledByDefaultRounded />,
                    },
                }}
            />
        </>
    );
};
