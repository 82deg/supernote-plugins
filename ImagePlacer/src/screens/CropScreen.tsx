// Crop editor. Bars on each side and marks on each corner trim the picture;
// dragging inside the frame moves it. Ratio chips lock the shape (corners
// only, then); corner chips round the picture's corners, previewed live. The image is never stretched; the kept part stays where it was
// on the page. E-ink: black on white, shaded trimmed area, no animation.
import React, {useMemo, useRef, useState} from 'react';
import {
  Image,
  PanResponder,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import type {Size} from '../note/geometry';
import {
  fitRatio,
  fullEdges,
  isFull,
  moveBox,
  moveCorner,
  moveCornerLocked,
  moveEdge,
  type Corner,
  type Edge,
  type Edges,
} from '../image/crop';
import {CORNER_STYLES, cornerRadius, type Corners} from '../image/corners';

interface Props {
  sourcePath: string;
  sourceSize: Size;
  /** The usable part of the image (source px); default: all of it. */
  bounds?: Edges;
  /** Start from an earlier crop (non-destructive re-crop); default: `bounds`. */
  initialEdges?: Edges;
  /** The picture's corner style now; default none. */
  initialCorners?: Corners;
  /** Page px per source px, so the corner preview matches the page. */
  pageScale: number;
  title?: string;
  onDone: (edges: Edges, corners: Corners) => void;
  onCancel: () => void;
}

type RatioId = 'free' | 'original' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
const RATIOS: {id: RatioId; label: string; value?: number}[] = [
  {id: 'free', label: 'Free'},
  {id: 'original', label: 'Original'},
  {id: '1:1', label: '1:1', value: 1},
  {id: '4:3', label: '4:3', value: 4 / 3},
  {id: '3:4', label: '3:4', value: 3 / 4},
  {id: '16:9', label: '16:9', value: 16 / 9},
  {id: '9:16', label: '9:16', value: 9 / 16},
];

const BAR_LONG = 64; // dp
const STROKE = 12; // dp, thickness of side bars and corner marks
const OUTLINE = 2; // dp, white outline so marks show on dark pictures
const ARM = 36; // dp, length of each arm of a corner mark
const HIT = 56; // dp touch target around each bar / corner
const SHADE = 'rgba(255,255,255,0.7)'; // trimmed-away parts
const EDGES: Edge[] = ['left', 'top', 'right', 'bottom'];
const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

export default function CropScreen({
  sourcePath,
  sourceSize,
  bounds: boundsProp,
  initialEdges,
  initialCorners = 'none',
  pageScale,
  title,
  onDone,
  onCancel,
}: Props): React.JSX.Element {
  const [area, setArea] = useState<Size | null>(null);
  const bounds = useMemo(() => boundsProp ?? fullEdges(sourceSize), [boundsProp, sourceSize]);
  const [edges, setEdges] = useState<Edges>(() => initialEdges ?? bounds);
  const [ratioId, setRatioId] = useState<RatioId>('free');
  const [corners, setCorners] = useState<Corners>(initialCorners);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const ratio = useMemo(() => {
    if (ratioId === 'free') {
      return undefined;
    }
    if (ratioId === 'original') {
      return (bounds.right - bounds.left) / (bounds.bottom - bounds.top);
    }
    return RATIOS.find(r => r.id === ratioId)!.value;
  }, [ratioId, bounds]);
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  const pickRatio = (id: RatioId) => {
    setRatioId(id);
    if (id === 'free') {
      return;
    }
    const value =
      id === 'original'
        ? (bounds.right - bounds.left) / (bounds.bottom - bounds.top)
        : RATIOS.find(r => r.id === id)!.value!;
    setEdges(fitRatio(value, bounds, edgesRef.current));
  };

  const pickCorners = (id: Corners) => {
    setCorners(id);
    if (id === 'circle' && ratioId !== '1:1') {
      pickRatio('1:1'); // a circle needs a square; pick another ratio for a pill
    }
  };

  // dp per source px: zoom the picture to fill the canvas (leaving room for
  // the handles), so small pictures are big enough to crop precisely.
  const d = useMemo(() => {
    if (!area) {
      return 0;
    }
    return Math.min((area.width - 2 * HIT) / sourceSize.width, (area.height - 2 * HIT) / sourceSize.height);
  }, [area, sourceSize]);
  const dRef = useRef(d);
  dRef.current = d;

  /** A drag that starts from the current edges and maps finger dp → source px. */
  const drag = (apply: (start: Edges, dx: number, dy: number) => Edges): PanResponderInstance => {
    let start: Edges = edgesRef.current;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = edgesRef.current;
      },
      onPanResponderMove: (_, g) => {
        const s = dRef.current || 1;
        setEdges(apply(start, g.dx / s, g.dy / s));
      },
    });
  };

  const responders = useMemo(
    () => ({
      edges: Object.fromEntries(
        EDGES.map(e => [
          e,
          drag((start, dx, dy) => moveEdge(start, e, e === 'left' || e === 'right' ? dx : dy, bounds)),
        ]),
      ) as Record<Edge, PanResponderInstance>,
      corners: Object.fromEntries(
        CORNERS.map(c => [
          c,
          drag((start, dx, dy) =>
            ratioRef.current
              ? moveCornerLocked(start, c, dx, dy, bounds, ratioRef.current)
              : moveCorner(start, c, dx, dy, bounds),
          ),
        ]),
      ) as Record<Corner, PanResponderInstance>,
      move: drag((start, dx, dy) => moveBox(start, dx, dy, bounds)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bounds],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setArea({width, height});
  };

  const w = sourceSize.width * d;
  const h = sourceSize.height * d;
  const k = {left: edges.left * d, top: edges.top * d, right: edges.right * d, bottom: edges.bottom * d};
  const keptW = edges.right - edges.left;
  const keptH = edges.bottom - edges.top;

  const start = initialEdges ?? bounds;
  const changed = !sameEdges(edges, start) || corners !== initialCorners;
  // Corner radius on screen: page px → source px → dp.
  const scale = pageScale > 0 ? pageScale : 1;
  const rd =
    (cornerRadius(corners, {width: keptW * scale, height: keptH * scale}, PixelRatio.get()) / scale) * d;
  const canReset = !isFull(edges, bounds) || ratioId !== 'free';

  return (
    <View style={styles.root}>
      {/* Top bar: dismiss left, title centred, reset right (secondary, text-only). */}
      <View style={styles.topBar}>
        <Pressable style={styles.textBtn} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.textBtnLabel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title ?? 'Crop'}
        </Text>
        <Pressable
          style={[styles.textBtn, styles.textBtnRight]}
          onPress={() => {
            setRatioId('free');
            setEdges(bounds);
          }}
          disabled={!canReset}
          accessibilityRole="button"
          accessibilityLabel="Reset to the full image"
          accessibilityState={{disabled: !canReset}}>
          <Text style={[styles.textBtnLabel, !canReset && styles.disabledLabel]}>Reset</Text>
        </Pressable>
      </View>

      {/* Ratio presets: segmented chips; the selected one is filled. */}
      <View style={styles.chips} accessibilityRole="radiogroup">
        {RATIOS.map(r => {
          const on = r.id === ratioId;
          return (
            <Pressable
              key={r.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => pickRatio(r.id)}
              accessibilityRole="radio"
              accessibilityState={{selected: on}}
              accessibilityLabel={r.id === 'free' || r.id === 'original' ? r.label : `Ratio ${r.label}`}>
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Corner styles: same chips, on their own labelled row. */}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Corners">
        <Text style={styles.rowLabel}>Corners</Text>
        {CORNER_STYLES.map(c => {
          const on = c.id === corners;
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => pickCorners(c.id)}
              accessibilityRole="radio"
              accessibilityState={{selected: on}}
              accessibilityLabel={c.id === 'none' ? 'Square corners' : `${c.label} corners`}>
              <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.area} onLayout={onLayout}>
        {d > 0 ? (
          <View style={{width: w, height: h}}>
            <Image source={{uri: `file://${sourcePath}`}} style={{width: w, height: h}} resizeMode="stretch" />
            {/* Shade the trimmed-away parts. */}
            <View style={[styles.shade, {left: 0, top: 0, width: w, height: k.top}]} />
            <View style={[styles.shade, {left: 0, top: k.bottom, width: w, height: h - k.bottom}]} />
            <View style={[styles.shade, {left: 0, top: k.top, width: k.left, height: k.bottom - k.top}]} />
            <View style={[styles.shade, {left: k.right, top: k.top, width: w - k.right, height: k.bottom - k.top}]} />
            {/* Rounded corners: shade what they cut off. A ring as thick as the
                radius, clipped to the frame, leaves exactly the rounded shape clear. */}
            {rd > 0 ? (
              <View
                pointerEvents="none"
                style={[styles.cornerClip, {left: k.left, top: k.top, width: k.right - k.left, height: k.bottom - k.top}]}>
                <View
                  style={{
                    position: 'absolute',
                    left: -rd,
                    top: -rd,
                    width: k.right - k.left + 2 * rd,
                    height: k.bottom - k.top + 2 * rd,
                    borderWidth: rd,
                    borderRadius: 2 * rd,
                    borderColor: SHADE,
                  }}
                />
              </View>
            ) : null}
            {/* Kept region: frame + drag-to-move surface. */}
            <View
              {...responders.move.panHandlers}
              style={[
                styles.frame,
                {left: k.left, top: k.top, width: k.right - k.left, height: k.bottom - k.top, borderRadius: rd},
              ]}
            />
            {/* Side bars (hidden while a ratio is locked: corners keep the shape). */}
            {ratio
              ? null
              : EDGES.map(edge => {
                  const horizontal = edge === 'top' || edge === 'bottom';
                  const cx = edge === 'left' ? k.left : edge === 'right' ? k.right : (k.left + k.right) / 2;
                  const cy = edge === 'top' ? k.top : edge === 'bottom' ? k.bottom : (k.top + k.bottom) / 2;
                  return (
                    <View
                      key={edge}
                      {...responders.edges[edge].panHandlers}
                      style={[styles.hit, {left: cx - HIT / 2, top: cy - HIT / 2}]}>
                      <Bar
                        width={horizontal ? BAR_LONG : STROKE}
                        height={horizontal ? STROKE : BAR_LONG}
                        left={(HIT - (horizontal ? BAR_LONG : STROKE)) / 2}
                        top={(HIT - (horizontal ? STROKE : BAR_LONG)) / 2}
                      />
                    </View>
                  );
                })}
            {/* Corner marks: two rounded bars meeting in a right angle, centred on the frame line. */}
            {CORNERS.map(corner => {
              const left = corner === 'topLeft' || corner === 'bottomLeft';
              const top = corner === 'topLeft' || corner === 'topRight';
              const cx = left ? k.left : k.right;
              const cy = top ? k.top : k.bottom;
              const c = HIT / 2;
              const half = STROKE / 2;
              // Arms run inward along the frame from the corner point.
              const armX = {left: left ? c - half : c - ARM + half, top: c - half, width: ARM, height: STROKE};
              const armY = {left: c - half, top: top ? c - half : c - ARM + half, width: STROKE, height: ARM};
              return (
                <View
                  key={corner}
                  {...responders.corners[corner].panHandlers}
                  style={[styles.hit, {left: cx - HIT / 2, top: cy - HIT / 2}]}>
                  {/* White outlines first, black on top: one seamless L with rounded ends. */}
                  <Bar {...armX} outline />
                  <Bar {...armY} outline />
                  <Bar {...armX} />
                  <Bar {...armY} />
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Footer: one quiet status line, then the single primary action. */}
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {isFull(edges, bounds)
            ? ratio
              ? 'Drag a corner to resize, or inside to move'
              : 'Drag the edges or corners to crop'
            : `${Math.round(keptW)} × ${Math.round(keptH)}`}
        </Text>
        <Pressable
          style={[styles.primaryBtn, !changed && styles.primaryBtnDisabled]}
          onPress={() => onDone(edges, corners)}
          disabled={!changed}
          accessibilityRole="button"
          accessibilityLabel="Apply"
          accessibilityState={{disabled: !changed}}>
          <Text style={[styles.primaryLabel, !changed && styles.primaryLabelDisabled]}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A rounded bar; `outline` draws the slightly larger white halo underneath. */
function Bar({
  left,
  top,
  width,
  height,
  outline,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  outline?: boolean;
}): React.JSX.Element {
  const o = outline ? OUTLINE : 0;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left - o,
        top: top - o,
        width: width + 2 * o,
        height: height + 2 * o,
        borderRadius: (Math.min(width, height) + 2 * o) / 2,
        backgroundColor: outline ? '#fff' : '#000',
      }}
    />
  );
}

function sameEdges(a: Edges, b: Edges): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < 0.5;
  return near(a.left, b.left) && near(a.top, b.top) && near(a.right, b.right) && near(a.bottom, b.bottom);
}

const styles = StyleSheet.create({
  // 8-pt spacing; black on white; grey (#8a8a8a) only for disabled/quiet text.
  root: {flex: 1, backgroundColor: '#fff'},
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  title: {flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '600', color: '#000'},
  // Text buttons share a fixed width so the title stays truly centred.
  textBtn: {width: 112, height: 56, justifyContent: 'center', paddingHorizontal: 16},
  textBtnRight: {alignItems: 'flex-end'},
  textBtnLabel: {fontSize: 20, color: '#000'},
  disabledLabel: {color: '#8a8a8a'},
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  chip: {
    minWidth: 64,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {backgroundColor: '#000'},
  rowLabel: {fontSize: 17, color: '#555', alignSelf: 'center', marginRight: 4},
  chipLabel: {fontSize: 17, color: '#000'},
  chipLabelOn: {color: '#fff', fontWeight: '600'},
  area: {flex: 1, alignItems: 'center', justifyContent: 'center', margin: 24, overflow: 'visible'},
  shade: {position: 'absolute', backgroundColor: SHADE},
  cornerClip: {position: 'absolute', overflow: 'hidden'},
  frame: {position: 'absolute', borderWidth: 2, borderColor: '#000'},
  hit: {position: 'absolute', width: HIT, height: HIT},
  footer: {paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24},
  hint: {fontSize: 17, color: '#555', textAlign: 'center', marginBottom: 16},
  primaryBtn: {
    height: 60,
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {backgroundColor: '#fff', borderColor: '#8a8a8a'},
  primaryLabel: {fontSize: 21, fontWeight: '600', color: '#fff'},
  primaryLabelDisabled: {color: '#8a8a8a'},
});
