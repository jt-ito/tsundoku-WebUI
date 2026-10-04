/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Box from '@mui/material/Box';
import { useEffect, useRef, useState } from 'react';
import { requestManager } from '@/lib/requests/RequestManager.ts';

const THUMBNAIL_WIDTH = 480;
const MAX_CONCURRENT_LOADS = 3;
const MAX_ATTEMPTS = 4;

// the server fetches the pages of a chapter when they are first asked for, so asking for all of them at once makes some
// of them fail: a few at a time, and a failed one is asked again
let activeLoads = 0;
const waiting: (() => void)[] = [];
const acquireSlot = () =>
    new Promise<void>((resolve) => {
        if (activeLoads < MAX_CONCURRENT_LOADS) {
            activeLoads++;
            resolve();
            return;
        }
        waiting.push(() => {
            activeLoads++;
            resolve();
        });
    });
const releaseSlot = () => {
    activeLoads--;
    waiting.shift()?.();
};

const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

// one big downscale makes screentones alias into grain: halve until close to the target size, then the last step
const drawDownscaled = (source: ImageBitmap, canvas: HTMLCanvasElement) => {
    const targetWidth = Math.min(THUMBNAIL_WIDTH, source.width);
    const targetHeight = Math.round((source.height * targetWidth) / source.width);

    let current: CanvasImageSource = source;
    let { width, height } = source;
    while (width / 2 > targetWidth) {
        const half = document.createElement('canvas');
        width = Math.round(width / 2);
        height = Math.round(height / 2);
        Object.assign(half, { width, height });
        const halfContext = half.getContext('2d')!;
        halfContext.imageSmoothingQuality = 'high';
        halfContext.drawImage(current, 0, 0, width, height);
        current = half;
    }

    Object.assign(canvas, { width: targetWidth, height: targetHeight });
    const context = canvas.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(current, 0, 0, targetWidth, targetHeight);
};

const fetchAndDraw = async (url: string, canvas: HTMLCanvasElement, isCancelled: () => boolean) => {
    await acquireSlot();
    try {
        if (isCancelled()) {
            return;
        }
        // the app's own image pipeline: it sends the login with the request (a plain fetch is refused) and queues per source
        const image = await requestManager.requestImage(url);
        try {
            const imageUrl = await image.response;
            const response = await fetch(imageUrl);
            const bitmap = await createImageBitmap(await response.blob());
            if (!isCancelled()) {
                drawDownscaled(bitmap, canvas);
            }
            bitmap.close();
        } finally {
            image.cleanup();
        }
    } finally {
        releaseSlot();
    }
};

const loadInto = async (
    url: string,
    canvas: HTMLCanvasElement,
    isCancelled: () => boolean,
    attempt: number = 0,
): Promise<boolean> => {
    if (isCancelled()) {
        return false;
    }

    try {
        await fetchAndDraw(url, canvas, isCancelled);
        return true;
    } catch {
        if (attempt + 1 >= MAX_ATTEMPTS) {
            return false;
        }
        await sleep(1000 * (attempt + 1));
        return loadInto(url, canvas, isCancelled, attempt + 1);
    }
};

export const ReaderPageThumbnail = ({ url, alt, isCurrent }: { url: string; alt: string; isCurrent: boolean }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // only what is (nearly) on screen is loaded
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return () => {};
        }
        const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setIsVisible(true), {
            rootMargin: '300px',
        });
        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible || isLoaded || !canvasRef.current) {
            return () => {};
        }
        let cancelled = false;
        loadInto(url, canvasRef.current, () => cancelled).then((loaded) => !cancelled && setIsLoaded(loaded));
        return () => {
            cancelled = true;
        };
    }, [isVisible, isLoaded, url]);

    return (
        <Box
            component="canvas"
            ref={canvasRef}
            role="img"
            aria-label={alt}
            sx={{
                width: '100%',
                aspectRatio: '2 / 3',
                objectFit: 'cover',
                borderRadius: 1.5,
                backgroundColor: 'action.hover',
                outline: 2,
                outlineStyle: 'solid',
                outlineColor: isCurrent ? 'primary.main' : 'transparent',
                outlineOffset: 2,
            }}
        />
    );
};
