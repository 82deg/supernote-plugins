// Renders one image transform (rotate → crop → scale) into a box and captures
// it to a PNG with view-shot. Mounted once; jobs are queued imperatively via
// the `render` function handed to `onReady`.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, PixelRatio, View} from 'react-native';
import {captureRef} from 'react-native-view-shot';
import type {Size} from '../note/geometry';
import {stageLayout, type Crop, type Rotation, type StageLayout} from './transform';

export interface RenderJob {
  path: string; // absolute file path of the source image
  size: Size; // source pixel size
  rotation: Rotation;
  crop: Crop; // in rotated space
  maxSide: number; // longest output side, px
  format?: 'png' | 'jpg'; // jpg for photos (smaller), png for line art / transparency
  quality?: number; // jpg only, 0–1
}

export type RenderFn = (job: RenderJob) => Promise<{path: string; size: Size}>;

interface Pending {
  job: RenderJob;
  layout: StageLayout;
  resolve: (r: {path: string; size: Size}) => void;
  reject: (e: Error) => void;
}

export default function RenderStage({onReady}: {onReady: (render: RenderFn) => void}): React.JSX.Element | null {
  const boxRef = useRef<View>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const render = useCallback<RenderFn>(
    job =>
      new Promise((resolve, reject) => {
        const layout = stageLayout(job.size, job.rotation, job.crop, job.maxSide, PixelRatio.get());
        setPending({job, layout, resolve, reject});
      }),
    [],
  );

  useEffect(() => onReady(render), [onReady, render]);

  const capture = useCallback(async () => {
    if (!pending) {
      return;
    }
    try {
      // One frame for the decoded bitmap to be drawn before capturing.
      await new Promise(r => setTimeout(r, 150));
      const uri = await captureRef(boxRef, {
        format: pending.job.format ?? 'png',
        quality: pending.job.quality ?? 0.85,
        result: 'tmpfile',
        width: pending.layout.output.width,
        height: pending.layout.output.height,
      });
      pending.resolve({path: uri.replace(/^file:\/\//, ''), size: pending.layout.output});
    } catch (e) {
      pending.reject(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setPending(null);
    }
  }, [pending]);

  if (!pending) {
    return null;
  }
  const {layout, job} = pending;
  return (
    <View
      ref={boxRef}
      collapsable={false}
      style={{width: layout.box.width, height: layout.box.height, overflow: 'hidden', backgroundColor: 'transparent'}}>
      <Image
        source={{uri: `file://${job.path}`}}
        // Android fades new images in over ~300 ms; capturing during the fade
        // baked a semi-transparent picture into the note (1.0.0 build 19).
        fadeDuration={0}
        onLoad={capture}
        onError={e => {
          pending.reject(new Error(`image load failed: ${e.nativeEvent.error}`));
          setPending(null);
        }}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          left: layout.image.left,
          top: layout.image.top,
          width: layout.image.width,
          height: layout.image.height,
          transform: [{rotate: `${layout.rotation}deg`}],
        }}
      />
    </View>
  );
}
