// Small staged progress bar for e-ink.
//
// The host's slow calls (insertPageElements: 3–5 s) report no progress, so
// work is split into stages with a known span (from → to). Within a stage the
// bar creeps toward `to` and never reaches it until the stage really ends.
// Updates are infrequent and confined to a small box to keep e-ink refreshes
// cheap.
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

export interface Stage {
  from: number; // 0–1
  to: number; // 0–1
  label: string;
}

export type OnStage = (stage: Stage) => void;

const TICK_MS = 400;
const CREEP = 0.18; // fraction of the remaining stage span covered per tick

export function ProgressOverlay({stage}: {stage: Stage}): React.JSX.Element {
  const [shown, setShown] = useState(stage.from);
  const stageRef = useRef(stage);

  useEffect(() => {
    stageRef.current = stage;
    // Never move backwards; jump forward to the new stage's start.
    setShown(v => Math.max(v, stage.from));
  }, [stage]);

  useEffect(() => {
    const t = setInterval(() => {
      const {to} = stageRef.current;
      setShown(v => {
        const ceiling = to >= 1 ? 1 : to - 0.01;
        return v >= ceiling ? v : v + (ceiling - v) * CREEP;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, []);

  const pct = Math.round(Math.min(1, shown) * 100);
  return (
    <View style={styles.backdrop} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.label} numberOfLines={1}>
          {stage.label}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, {width: `${pct}%`}]} />
        </View>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Swallows taps so nothing can be pressed twice while work is running.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  card: {
    width: 280,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 10,
  },
  label: {fontSize: 18, color: '#000', marginBottom: 10},
  track: {height: 12, borderWidth: 2, borderColor: '#000', borderRadius: 6, overflow: 'hidden'},
  fill: {height: '100%', backgroundColor: '#000'},
  pct: {fontSize: 14, color: '#000', textAlign: 'right', marginTop: 6},
});
