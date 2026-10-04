/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { CSSProperties } from 'react';
import type {
    ReaderTapZoneRect,
    TapZoneInvertMode,
    TapZoneLayouts,
    TapZoneRegion,
} from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import { TapZoneRegionType } from '@/features/reader/tap-zones/TapZoneLayout.types.ts';
import {
    READER_TAP_ZONE_LAYOUTS,
    TAP_ZONE_REGION_TYPE_DATA,
} from '@/features/reader/tap-zones/ReaderTapZone.constants.ts';
import { i18n } from '@/i18n';
import { t } from '@lingui/core/macro';

interface InvertMode extends TapZoneInvertMode {
    isRTL: boolean;
}

// the region colours are "rgba(r, g, b, a)": same colour, other strength
const withAlpha = (color: string, alpha: number) => color.replace(/[\d.]+\)$/, `${alpha})`);

const calcActualValue = (value: number, size: number) => (value / 100) * size;

export class ReaderTapZoneService {
    private static layout: TapZoneLayouts | null = null;

    private static canvas: HTMLCanvasElement | null = null;

    private static width: number | null = null;

    private static height: number | null = null;

    private static language: string | null = null;

    private static invertMode: InvertMode | null = null;

    private static regions: TapZoneRegion[] | null = null;

    private static fontStyle: CSSProperties | null = null;

    private static invertVertical = ([x, y, width, height]: ReaderTapZoneRect): ReaderTapZoneRect => [
        x,
        100 - (y + height),
        width,
        height,
    ];

    private static invertHorizontal = ([x, y, width, height]: ReaderTapZoneRect): ReaderTapZoneRect => [
        100 - (x + width),
        y,
        width,
        height,
    ];

    private static invertRect(rect: ReaderTapZoneRect, { vertical, horizontal, isRTL }: InvertMode): ReaderTapZoneRect {
        const rectInvertedVertical = vertical ? this.invertVertical(rect) : rect;
        const rectInvertedHorizontal = horizontal ? this.invertHorizontal(rectInvertedVertical) : rectInvertedVertical;
        return isRTL ? this.invertHorizontal(rectInvertedHorizontal) : rectInvertedHorizontal;
    }

    private static getRegions(layout: TapZoneLayouts, invertMode: InvertMode): TapZoneRegion[] {
        const regions = READER_TAP_ZONE_LAYOUTS[layout];

        return regions.map(({ type, rect }) => ({ type, rect: this.invertRect(rect, invertMode) }));
    }

    private static isCanvasReusable(
        layout: TapZoneLayouts,
        canvasWidth: number,
        canvasHeight: number,
        fontStyle: CSSProperties,
        invertMode: InvertMode,
    ): boolean {
        const isSameLayout = this.layout === layout;
        const isSameWidth = this.width === canvasWidth;
        const isSameHeight = this.height === canvasHeight;
        const doesCanvasExist = !!this.canvas;
        const isSameLanguage = this.language === i18n.locale;
        const isSameInvertMode =
            this.invertMode?.vertical === invertMode.vertical &&
            this.invertMode.horizontal === invertMode.horizontal &&
            this.invertMode.isRTL === invertMode.isRTL;
        const isSameFontStyle = this.fontStyle === fontStyle;

        return (
            doesCanvasExist &&
            isSameWidth &&
            isSameHeight &&
            isSameLayout &&
            isSameLanguage &&
            isSameInvertMode &&
            isSameFontStyle
        );
    }

    private static drawCanvas(
        context: CanvasRenderingContext2D,
        canvasWidth: number,
        canvasHeight: number,
        fontStyle: CSSProperties,
        regions: TapZoneRegion[],
    ): void {
        const gap = 4;
        const radius = 18;

        /* oxlint-disable no-param-reassign */
        regions.forEach(({ type, rect: [rectX, rectY, rectWidth, rectHeight] }) => {
            const { text: translation, color } = TAP_ZONE_REGION_TYPE_DATA[type];
            const label = t(translation);
            const arrow = {
                [TapZoneRegionType.PREVIOUS]: '‹  ',
                [TapZoneRegionType.NEXT]: '',
                [TapZoneRegionType.MENU]: '',
            };
            const text = `${arrow[type]}${label}${type === TapZoneRegionType.NEXT ? '  ›' : ''}`;

            const x = calcActualValue(rectX, canvasWidth) + gap;
            const y = calcActualValue(rectY, canvasHeight) + gap;
            const width = calcActualValue(rectWidth, canvasWidth) - gap * 2;
            const height = calcActualValue(rectHeight, canvasHeight) - gap * 2;

            // a soft tinted tile with a thin edge in the same colour, instead of a flat opaque block
            context.beginPath();
            context.roundRect(x, y, width, height, radius);
            context.fillStyle = withAlpha(color, 0.26);
            context.fill();
            context.lineWidth = 1.5;
            context.strokeStyle =
                type === TapZoneRegionType.MENU ? 'rgba(255, 255, 255, 0.35)' : withAlpha(color, 0.85);
            context.stroke();

            // the name sits on a small dark pill in the middle of the tile so it stays readable on any page
            const fontSize = Math.round(Math.min(22, Math.max(14, Math.min(width, height) * 0.09)));
            context.font = `600 ${fontSize}px ${fontStyle.fontFamily}`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            const pillWidth = context.measureText(text).width + fontSize * 1.6;
            const pillHeight = fontSize * 2.1;

            context.beginPath();
            context.roundRect(centerX - pillWidth / 2, centerY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
            context.fillStyle = 'rgba(0, 0, 0, 0.62)';
            context.fill();

            context.fillStyle = 'white';
            context.fillText(text, centerX, centerY);
        });
        /* oxlint-enable no-param-reassign */
    }

    static getOrCreateCanvas(
        layout: TapZoneLayouts,
        canvasWidth: number,
        canvasHeight: number,
        fontStyle: CSSProperties,
        invertMode: InvertMode,
    ): HTMLCanvasElement {
        if (this.isCanvasReusable(layout, canvasWidth, canvasHeight, fontStyle, invertMode)) {
            return this.canvas!;
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;

        context.canvas.width = canvasWidth;
        context.canvas.height = canvasHeight;

        const regions = this.getRegions(layout, invertMode);
        this.drawCanvas(context, canvasWidth, canvasHeight, fontStyle, regions);

        this.layout = layout;
        this.canvas = canvas;
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.language = i18n.locale;
        this.invertMode = invertMode;
        this.regions = regions;
        this.fontStyle = fontStyle;

        return canvas;
    }

    private static doesRegionContainPos(region: TapZoneRegion, x: number, y: number): boolean {
        const [rectX, rectY, width, height] = region.rect;

        return x >= rectX && x <= rectX + width && y >= rectY && y <= rectY + height;
    }

    static getAction(x: number, y: number): TapZoneRegionType {
        const xPercentage = (x / this.width!) * 100;
        const yPercentage = (y / this.height!) * 100;
        const region = this.regions?.find((regionToCheck) =>
            this.doesRegionContainPos(regionToCheck, xPercentage, yPercentage),
        );

        if (region) {
            return region.type;
        }

        return TapZoneRegionType.MENU;
    }
}
