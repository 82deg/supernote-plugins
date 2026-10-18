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
import {fullEdges, isFull, moveEdge, type Edge, type Edges} from '../image/crop';

interface Props {
  sourcePath: string;
  sourceSize: Size;
  title?: string;
  onDone: (edges: Edges) => void;
  onCancel: () => void;
}

const BAR_LONG = 64; // dp
const BAR_SHORT = 14; // dp
const HIT = 56; // dp touch target around each bar
const EDGES: Edge[] = ['left', 'top', 'right', 'bottom'];

export default function CropScreen({sourcePath, sourceSize, title, onDone, onCancel}: Props): React.JSX.Element {
  const [area, setArea] = useState<Size | null>(null);
  const [edges, setEdges] = useState<Edges>(() => fullEdges(sourceSize));
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
          setEdges(moveEdge(start, edge, delta, sourceSize));
        },
      });
    };
    return Object.fromEntries(EDGES.map(e => [e, make(e)])) as Record<Edge, PanResponderInstance>;
  }, [sourceSize]);

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    setArea({width, height});
  };

  const w = sourceSize.width * d;
  const h = sourceSize.height * d;
  const k = {left: edges.left * d, top: edges.top * d, right: edges.right * d, bottom: edges.bottom * d};
  const keptW = edges.right - edges.left;
  const keptH = edges.bottom - edges.top;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.btn} onPress={onCancel}>
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{title ?? 'Crop'}</Text>
        <Pressable style={styles.btn} onPress={() => setEdges(fullEdges(sourceSize))}>
          <Text style={styles.btnText}>Reset</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.primary]} onPress={() => onDone(edges)}>
          <Text style={[styles.btnText, styles.primaryText]}>Done</Text>
        </Pressable>
      </View>
      <Text style={styles.info}>
        {Math.round(keptW)} × {Math.round(keptH)} px{isFull(edges, sourceSize) ? ' — drag a bar to crop' : ''}
      </Text>

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
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {flex: 1, fontSize: 22, fontWeight: 'bold', color: '#000', marginLeft: 16},
  btn: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 18, paddingVertical: 10, marginLeft: 12},
  btnText: {fontSize: 20, color: '#000'},
  primary: {backgroundColor: '#000'},
  primaryText: {color: '#fff'},
  info: {fontSize: 18, color: '#000', textAlign: 'center', paddingVertical: 8},
  area: {flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible'},
  shade: {position: 'absolute', backgroundColor: 'rgba(255,255,255,0.7)'},
  frame: {position: 'absolute', borderWidth: 3, borderColor: '#000'},
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {backgroundColor: '#000', borderWidth: 2, borderColor: '#fff'},
});
