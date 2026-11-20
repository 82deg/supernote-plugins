// Draws a photo (already laid out by stageLayout) with its rounded corners and
// border. Used twice: by RenderStage for the capture that goes into the note,
// and by the Border screen for the live preview, so they always match.
import React from 'react';
import {Image, View, type ImageSourcePropType} from 'react-native';
import type {Size} from '../note/geometry';
import type {StageLayout} from './transform';
import {frameLayout, type Bar, type Border, type FrameLayout, type TapePattern} from './border';

const TILES: Record<Exclude<TapePattern, 'plain'>, ImageSourcePropType> = {
  stripes: require('../../assets/tape/stripes.png'),
  dots: require('../../assets/tape/dots.png'),
  grid: require('../../assets/tape/grid.png'),
  wavy: require('../../assets/tape/wavy.png'),
  checks: require('../../assets/tape/checks.png'),
  crosses: require('../../assets/tape/crosses.png'),
  zigzag: require('../../assets/tape/zigzag.png'),
  triangles: require('../../assets/tape/triangles.png'),
  scales: require('../../assets/tape/scales.png'),
  diamonds: require('../../assets/tape/diamonds.png'),
  honeycomb: require('../../assets/tape/honeycomb.png'),
  plaid: require('../../assets/tape/plaid.png'),
  houndstooth: require('../../assets/tape/houndstooth.png'),
  herringbone: require('../../assets/tape/herringbone.png'),
  terrazzo: require('../../assets/tape/terrazzo.png'),
  confetti: require('../../assets/tape/confetti.png'),
  squiggles: require('../../assets/tape/squiggles.png'),
  stars: require('../../assets/tape/stars.png'),
  hearts: require('../../assets/tape/hearts.png'),
  leaves: require('../../assets/tape/leaves.png'),
  flowers: require('../../assets/tape/flowers.png'),
  sprigs: require('../../assets/tape/sprigs.png'),
  moons: require('../../assets/tape/moons.png'),
  clouds: require('../../assets/tape/clouds.png'),
  sparkles: require('../../assets/tape/sparkles.png'),
  snowflakes: require('../../assets/tape/snowflakes.png'),
  arrows: require('../../assets/tape/arrows.png'),
  music: require('../../assets/tape/music.png'),
  coffee: require('../../assets/tape/coffee.png'),
  doodles: require('../../assets/tape/doodles.png'),
};
export const tapeTile = (p: TapePattern) => (p === 'plain' ? undefined : TILES[p]);

export const TAPE_BASE = '#D6D6D6';
/** Pattern tiles are 24 dp squares (see tools/render-tape-tiles.mjs). */
export const TILE_DP = 24;

/**
 * Cover `width` × `height` with copies of a tile, `size` units square.
 * A grid of plain images, not resizeMode="repeat": on the device, repeat
 * covered only part of a strip (b33).
 */
export function TileFill({
  tile,
  width,
  height,
  size,
}: {
  tile: ImageSourcePropType;
  width: number;
  height: number;
  size: number;
}): React.JSX.Element | null {
  if (!(size > 0.5)) {
    return null;
  }
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const tiles: React.JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Image
          key={`${r}.${c}`}
          source={tile}
          fadeDuration={0}
          resizeMode="stretch"
          style={{position: 'absolute', left: c * size, top: r * size, width: size + 0.5, height: size + 0.5}}
        />,
      );
    }
  }
  return <>{tiles}</>;
}
/** Washi tape is see-through; on e-ink a light touch of it reads best. */
export const TAPE_OPACITY = 0.85;

/**
 * Corners and border for a photo box, in the box's own units.
 * @param cornerShare corner radius as a share of the photo width
 * @param borderUnit one design dp as a share of the photo width
 */
export function boxFrame(
  box: Size,
  cornerShare: number,
  border: Border | undefined,
  borderUnit: number,
): {radius: number; frame: FrameLayout} {
  const radius = Math.min(cornerShare * box.width, Math.min(box.width, box.height) / 2);
  return {radius, frame: frameLayout(box, radius, border ?? {kind: 'none'}, borderUnit * box.width)};
}

const barStyle = (b: Bar) => ({
  position: 'absolute' as const,
  left: b.cx - b.length / 2,
  top: b.cy - b.thickness / 2,
  width: b.length,
  height: b.thickness,
  transform: [{rotate: `${b.angle}deg`}],
});

interface Props {
  layout: StageLayout;
  path: string;
  radius: number;
  frame: FrameLayout;
  onLoad?: () => void;
  onError?: (message: string) => void;
}

export default function FramedPicture({layout, path, radius, frame, onLoad, onError}: Props): React.JSX.Element {
  const tile = frame.pattern ? tapeTile(frame.pattern) : undefined;
  return (
    <View style={{width: frame.canvas.width, height: frame.canvas.height, backgroundColor: 'transparent'}}>
      <View
        style={{
          position: 'absolute',
          left: frame.photo.left,
          top: frame.photo.top,
          width: frame.photo.width,
          height: frame.photo.height,
          overflow: 'hidden', // also clips the photo to the rounded corners
          borderRadius: radius,
        }}>
        <Image
          source={{uri: `file://${path}`}}
          // Android fades new images in over ~300 ms; capturing during the fade
          // baked a semi-transparent picture into the note (1.0.0 build 19).
          fadeDuration={0}
          onLoad={onLoad}
          onError={e => onError?.(String(e.nativeEvent.error))}
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

      {frame.outline ? (
        <View
          style={{
            position: 'absolute',
            left: frame.outline.left,
            top: frame.outline.top,
            width: frame.outline.width,
            height: frame.outline.height,
            borderWidth: frame.outline.stroke,
            borderRadius: frame.outline.radius,
            borderColor: frame.outline.color,
          }}
        />
      ) : null}

      {frame.pills.map((b, i) => (
        <View key={`p${i}`} style={[barStyle(b), {borderRadius: b.thickness / 2, backgroundColor: frame.pillColor}]} />
      ))}

      {frame.tapes.map((b, i) => (
        <View
          key={`t${i}`}
          style={[barStyle(b), {backgroundColor: TAPE_BASE, opacity: TAPE_OPACITY, overflow: 'hidden'}]}>
          {tile ? <TileFill tile={tile} width={b.length} height={b.thickness} size={TILE_DP * frame.scale} /> : null}
        </View>
      ))}
    </View>
  );
}
