/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useLingui } from '@lingui/react/macro';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import type { CategoryDefaultInfo, CategoryIdInfo, CategoryNameInfo } from '@/features/category/Category.types.ts';
import { extractGraphqlExceptionInfo, getErrorMessage } from '@/lib/HelperFunctions.ts';
import { assertIsDefined } from '@/base/Asserts.ts';
import { getAlertSurfaceSx } from '@/base/components/feedback/AlertSurface.ts';
import { DEFAULT_CATEGORY_ID } from '@/features/category/services/Categories.ts';

export const CreateOrEditCategoryDialog = ({
    category,
    onClose,
}: {
    category: (CategoryIdInfo & CategoryNameInfo & CategoryDefaultInfo) | undefined;
    onClose: () => void;
}) => {
    const isEditMode = !!category;

    const { t } = useLingui();

    const [dialogName, setDialogName] = useState(category?.name);
    const [dialogDefault, setDialogDefault] = useState(!!category?.default);
    // why the server refused the changes: shown in the dialog, which stays open until the changes are accepted
    const [submitError, setSubmitError] = useState<string>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isInvalidName = dialogName !== undefined && !dialogName.trim().length;
    // a problem is shown when Submit is pressed (the dialog stays open), the button is only off while it is working
    const canSubmit = dialogName !== undefined && !isSubmitting;

    const getReadableError = (e: unknown): string => {
        const message = getErrorMessage(e);
        const { isGraphqlException, graphqlError } = extractGraphqlExceptionInfo(message);
        // "Exception while fetching data (/updateCategory) : the reason": only the reason
        const reason = isGraphqlException
            ? (graphqlError ?? message).replace(/^.*?Exception while fetching data \(.*?\) : /s, '')
            : message;

        return reason.trim() || (isEditMode ? t`Failed to save changes` : t`Could not create category`);
    };

    const handleDialogSubmit = async () => {
        assertIsDefined(dialogName);

        const newName = dialogName.trim();

        if (!newName) {
            setSubmitError(t`The category needs a name.`);
            return;
        }

        setSubmitError(undefined);
        setIsSubmitting(true);

        try {
            if (isEditMode) {
                await requestManager.updateCategory(
                    category.id,
                    category.id === DEFAULT_CATEGORY_ID ? { name: newName } : { name: newName, default: dialogDefault },
                ).response;
            } else {
                await requestManager.createCategory({ name: newName, default: dialogDefault }).response;
            }

            onClose();
        } catch (e) {
            setSubmitError(getReadableError(e));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open onClose={onClose}>
            <DialogTitle id="form-dialog-title">{isEditMode ? t`Edit category` : t`New category`}</DialogTitle>
            <DialogContent>
                {submitError && (
                    <Alert severity="error" sx={[getAlertSurfaceSx('error', false), { mb: 1 }]}>
                        {submitError}
                    </Alert>
                )}
                <TextField
                    autoFocus
                    margin="dense"
                    id="name"
                    label={t`Category Name`}
                    type="text"
                    fullWidth
                    value={dialogName}
                    onChange={(e) => {
                        setDialogName(e.target.value);
                        setSubmitError(undefined);
                    }}
                    error={isInvalidName}
                    helperText={isInvalidName ? t`Invalid input` : undefined}
                />
                {category?.id !== DEFAULT_CATEGORY_ID && (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={dialogDefault}
                                onChange={(e) => {
                                    setDialogDefault(e.target.checked);
                                    setSubmitError(undefined);
                                }}
                            />
                        }
                        label={t`Default category when adding new manga to the library`}
                    />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    {t`Cancel`}
                </Button>
                <Button onClick={handleDialogSubmit} color="primary" disabled={!canSubmit}>
                    {t`Submit`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
