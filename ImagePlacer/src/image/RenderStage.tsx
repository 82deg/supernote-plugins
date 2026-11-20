// Renders one image transform (rotate → crop → scale), with rounded corners
// and a border, and captures it to a PNG with view-shot. Mounted once; jobs are queued imperatively via
// the `render` function handed to `onReady`.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {PixelRatio, View} from 'react-native';
import {captureRef, releaseCapture} from 'react-native-view-shot';
import type {Size} from '../note/geometry';
import {
  stageLayout,
  type Crop,
  type Rotation,
  type StageLayout,
} from './transform';
import type {Border, FrameLayout} from './border';
import FramedPicture, {boxFrame} from './FramedPicture';

export interface RenderJob {
  path: string; // absolute file path of the source image
  size: Size; // source pixel size
  rotation: Rotation;
  crop: Crop; // in rotated space
  maxSide: number; // longest output side, px
  format?: 'png' | 'jpg'; // jpg for photos (smaller), png for line art / transparency
  quality?: number; // jpg only, 0–1
  /** Rounded corners: radius as a share of the photo width (0 = square). Forces png. */
  cornerRadius?: number;
  /** Border around the photo (outside it: the output grows). Forces png. */
  border?: Border;
  /** One design dp as a share of the photo width (how big the border is). */
  borderUnit?: number;
}

export type RenderFn = (job: RenderJob) => Promise<{path: string; size: Size}>;

/** A render that never loads (e.g. an unreadable image) must not hang the plugin. */
const RENDER_TIMEOUT_MS = 20000;

// Captures are temp files in the host's cache. The note keeps its own copy and
// originals are copied to our folder, so they can all go once an action ends.
const captured: string[] = [];
export function releaseRenders(): void {
  for (const uri of captured.splice(0)) {
    try {
      releaseCapture(uri);
    } catch {
      // already gone
    }
  }
}

interface Pending {
  job: RenderJob;
  layout: StageLayout;
  radius: number;
  frame: FrameLayout;
  /** Final PNG size: the photo output plus the border. */
  output: Size;
  resolve: (r: {path: string; size: Size}) => void;
  reject: (e: Error) => void;
}

export default function RenderStage({
  onReady,
}: {
  onReady: (render: RenderFn) => void;
}): React.JSX.Element | null {
  const boxRef = useRef<View>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const render = useCallback<RenderFn>(
    job =>
      new Promise((resolve, reject) => {
        const layout = stageLayout(
          job.size,
          job.rotation,
          job.crop,
          job.maxSide,
          PixelRatio.get(),
        );
        const {radius, frame} = boxFrame(
          layout.box,
          job.cornerRadius ?? 0,
          job.border,
          job.borderUnit ?? 0,
        );
        const k = layout.output.width / layout.box.width; // px per box unit
        const output = {
          width: Math.round(frame.canvas.width * k),
          height: Math.round(frame.canvas.height * k),
        };
        const timer = setTimeout(() => {
          setPending(null);
          reject(new Error('render timed out'));
        }, RENDER_TIMEOUT_MS);
        setPending({
          job,
          layout,
          radius,
          frame,
          output,
          resolve: r => {
            clearTimeout(timer);
            resolve(r);
          },
          reject: e => {
            clearTimeout(timer);
            reject(e);
          },
        });
      }),
    [],
  );

  useEffect(() => onReady(render), [onReady, render]);

  const capture = useCallback(async () => {
    if (!pending) {
      return;
    }
    try {
      // One frame for the decoded bitmap (and any tape tiles) to be drawn first.
      await new Promise(r =>
        setTimeout(r, pending.frame.tapes.length ? 500 : 150),
      );
      const plain =
        !pending.job.cornerRadius &&
        pending.frame.canvas.width === pending.layout.box.width &&
        pending.frame.canvas.height === pending.layout.box.height;
      const uri = await captureRef(boxRef, {
        // Corners and borders need transparency, and jpg has none.
        format: plain ? pending.job.format ?? 'png' : 'png',
        quality: pending.job.quality ?? 0.85,
        result: 'tmpfile',
        width: pending.output.width,
        height: pending.output.height,
      });
      captured.push(uri);
      pending.resolve({
        path: uri.replace(/^file:\/\//, ''),
        size: pending.output,
      });
    } catch (e) {
      pending.reject(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setPending(null);
    }
  }, [pending]);

  if (!pending) {
    return null;
  }
  const {layout, job, radius, frame} = pending;
  return (
    <View
      ref={boxRef}
      collapsable={false}
      style={{backgroundColor: 'transparent'}}>
      <FramedPicture
        layout={layout}
        path={job.path}
        radius={radius}
        frame={frame}
        onLoad={capture}
        onError={message => {
          pending.reject(new Error(`image load failed: ${message}`));
          setPending(null);
        }}
      />
    </View>
  );
}
