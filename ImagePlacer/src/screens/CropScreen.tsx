// Edge-bar crop: a bar in the middle of each side trims that side. The image
// is never scaled or stretched; the kept part stays where it was on the page.
// E-ink: black frame and bars, shaded trimmed area, no animation.
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
import {fullEdges, isFull, moveCorner, moveEdge, type Corner, type Edge, type Edges} from '../image/crop';

interface Props {
  sourcePath: string;
  sourceSize: Size;
  /** The usable part of the image (source px); default: all of it. */
  bounds?: Edges;
  /** Start from an earlier crop (non-destructive re-crop); default: `bounds`. */
  initialEdges?: Edges;
  title?: string;
  onDone: (edges: Edges) => void;
  onCancel: () => void;
}

const BAR_LONG = 64; // dp
const BAR_SHORT = 14; // dp
const ARM = 36; // dp, length of each arm of a corner mark
const CORNER_STROKE = 8; // dp, thickness of a corner mark (frame line is 3)
const HIT = 56; // dp touch target around each bar / corner
const EDGES: Edge[] = ['left', 'top', 'right', 'bottom'];
const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

export default function CropScreen({
  sourcePath,
  sourceSize,
  bounds: boundsProp,
  initialEdges,
  title,
  onDone,
  onCancel,
}: Props): React.JSX.Element {
  const [area, setArea] = useState<Size | null>(null);
  const bounds = useMemo(() => boundsProp ?? fullEdges(sourceSize), [boundsProp, sourceSize]);
  const [edges, setEdges] = useState<Edges>(() => initialEdges ?? bounds);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // dp per source px: page-actual size (1 page px = 1/PixelRatio dp) when it
  // fits, else scaled down to fit. Never up-scaled.
  const d = useMemo(() => {
    if (!area) {
      return 0;
    }
    const actual = 1 / PixelRatio.get();
    const fit = Math.min((area.width - 2 * HIT) / sourceSize.width, (area.height - 2 * HIT) / sourceSize.height);
    return Math.min(actual, fit);
  }, [area, sourceSize]);
  const dRef = useRef(d);
  dRef.current = d;

  const responders = useMemo(() => {
    const make = (edge: Edge): PanResponderInstance => {
      let start: Edges = edgesRef.current;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start = edgesRef.current;
        },
        onPanResponderMove: (_, g) => {
          const delta = (edge === 'left' || edge === 'right' ? g.dx : g.dy) / (dRef.current || 1);
          setEdges(moveEdge(start, edge, delta, bounds));
        },
      });
    };
    return Object.fromEntries(EDGES.map(e => [e, make(e)])) as Record<Edge, PanResponderInstance>;
  }, [bounds]);

  const cornerResponders = useMemo(() => {
    const make = (corner: Corner): PanResponderInstance => {
      let start: Edges = edgesRef.current;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start = edgesRef.current;
        },
        onPanResponderMove: (_, g) => {
          const s = dRef.current || 1;
          setEdges(moveCorner(start, corner, g.dx / s, g.dy / s, bounds));
        },
      });
    };
    return Object.fromEntries(CORNERS.map(c => [c, make(c)])) as Record<Corner, PanResponderInstance>;
  }, [bounds]);

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
  const changed = !sameEdges(edges, start);
  const canReset = !isFull(edges, bounds);

  return (
    <View style={styles.root}>
      {/* Top bar: dismiss left, title centred, reset right (secondary, text-only). */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.textBtn}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel">
          <Text style={styles.textBtnLabel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title ?? 'Crop'}
        </Text>
        <Pressable
          style={[styles.textBtn, styles.textBtnRight]}
          onPress={() => setEdges(bounds)}
          disabled={!canReset}
          accessibilityRole="button"
          accessibilityLabel="Reset to the full image"
          accessibilityState={{disabled: !canReset}}>
          <Text style={[styles.textBtnLabel, !canReset && styles.disabledLabel]}>Reset</Text>
        </Pressable>
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
            {/* Kept-region frame. */}
            <View
              pointerEvents="none"
              style={[styles.frame, {left: k.left, top: k.top, width: k.right - k.left, height: k.bottom - k.top}]}
            />
            {/* Mid-side bars, each inside a larger invisible touch target. */}
            {EDGES.map(edge => {
              const horizontal = edge === 'top' || edge === 'bottom';
              const cx = edge === 'left' ? k.left : edge === 'right' ? k.right : (k.left + k.right) / 2;
              const cy = edge === 'top' ? k.top : edge === 'bottom' ? k.bottom : (k.top + k.bottom) / 2;
              return (
                <View
                  key={edge}
                  {...responders[edge].panHandlers}
                  style={[styles.hit, {left: cx - HIT / 2, top: cy - HIT / 2}]}>
                  <View
                    style={[
                      styles.bar,
                      horizontal
                        ? {width: BAR_LONG, height: BAR_SHORT}
                        : {width: BAR_SHORT, height: BAR_LONG},
                    ]}
                  />
                </View>
              );
            })}
            {/* L-shaped corner marks: drag to move two sides at once. */}
            {CORNERS.map(corner => {
              const left = corner === 'topLeft' || corner === 'bottomLeft';
              const top = corner === 'topLeft' || corner === 'topRight';
              const cx = left ? k.left : k.right;
              const cy = top ? k.top : k.bottom;
              // One right angle drawn with two borders of a single box, so the
              // arms meet cleanly. The stroke is centred on the frame line and
              // the arms run inward along it.
              const half = CORNER_STROKE / 2;
              const mark = {
                position: 'absolute' as const,
                width: ARM,
                height: ARM,
                left: left ? HIT / 2 - half : HIT / 2 - ARM + half,
                top: top ? HIT / 2 - half : HIT / 2 - ARM + half,
                borderColor: '#000',
                borderLeftWidth: left ? CORNER_STROKE : 0,
                borderRightWidth: left ? 0 : CORNER_STROKE,
                borderTopWidth: top ? CORNER_STROKE : 0,
                borderBottomWidth: top ? 0 : CORNER_STROKE,
                borderTopLeftRadius: left && top ? 4 : 0,
                borderTopRightRadius: !left && top ? 4 : 0,
                borderBottomLeftRadius: left && !top ? 4 : 0,
                borderBottomRightRadius: !left && !top ? 4 : 0,
              };
              return (
                <View
                  key={corner}
                  {...cornerResponders[corner].panHandlers}
                  style={[styles.hit, {left: cx - HIT / 2, top: cy - HIT / 2}]}>
                  <View style={mark} />
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Footer: one quiet status line, then the single primary action. */}
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {canReset ? `${Math.round(keptW)} × ${Math.round(keptH)}` : 'Drag the edges or corners to crop'}
        </Text>
        <Pressable
          style={[styles.primaryBtn, !changed && styles.primaryBtnDisabled]}
          onPress={() => onDone(edges)}
          disabled={!changed}
          accessibilityRole="button"
          accessibilityLabel="Apply crop"
          accessibilityState={{disabled: !changed}}>
          <Text style={[styles.primaryLabel, !changed && styles.primaryLabelDisabled]}>Apply</Text>
        </Pressable>
      </View>
    </View>
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
  area: {flex: 1, alignItems: 'center', justifyContent: 'center', margin: 24, overflow: 'visible'},
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
  shade: {position: 'absolute', backgroundColor: 'rgba(255,255,255,0.7)'},
  frame: {position: 'absolute', borderWidth: 3, borderColor: '#000'},
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {backgroundColor: '#000', borderWidth: 2, borderColor: '#fff', borderRadius: BAR_SHORT / 2},
});
