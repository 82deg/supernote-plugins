// Settings, opened from the plugin's page in Settings → Apps → Plugins.
// One choice for now: the corners new pictures get. Saved as soon as it's
// tapped. E-ink: black on white, inverted selection, 64dp rows, no animation.
import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {CORNER_DP, CORNER_STYLES, type Corners} from '../image/corners';
import {loadDefaultCorners, saveDefaultCorners} from '../settings';
import {ensureFileAccess} from '../note/insert';

// Circle only makes sense on a square crop, so it lives in the crop screen only.
const OPTIONS = CORNER_STYLES.filter(c => c.id !== 'circle');
const SWATCH = {width: 72, height: 48};

export default function SettingsScreen({onDone}: {onDone: () => void}): React.JSX.Element {
  const [corners, setCorners] = useState<Corners | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDefaultCorners().then(setCorners);
  }, []);

  const pick = async (id: Corners) => {
    const before = corners;
    setCorners(id);
    setError(null);
    try {
      try {
        await saveDefaultCorners(id);
      } catch {
        // The plugin's own folder may need file access on some firmware: ask, then retry once.
        await ensureFileAccess();
        await saveDefaultCorners(id);
      }
    } catch (e) {
      setCorners(before);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.title} accessibilityRole="header">
          Image Placer settings
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.heading}>Corners for new pictures</Text>
        <View accessibilityRole="radiogroup">
          {OPTIONS.map(o => {
            const on = o.id === corners;
            const radius = o.id === 'none' ? 0 : CORNER_DP[o.id as keyof typeof CORNER_DP];
            return (
              <Pressable
                key={o.id}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => pick(o.id)}
                accessibilityRole="radio"
                accessibilityState={{selected: on}}
                accessibilityLabel={o.id === 'none' ? 'Square corners' : `${o.label} rounded corners`}>
                {/* True to size: the same radius the picture's corners get. */}
                <View style={[styles.swatch, {borderRadius: radius}, on && styles.swatchOn]} />
                <Text style={[styles.rowLabel, on && styles.rowLabelOn]}>
                  {o.id === 'none' ? 'None (square)' : o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>
          You can change the corners of any picture later: select it with the lasso, then More → Crop. Circle is there
          too.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={onDone} accessibilityRole="button">
          <Text style={styles.primaryLabel}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  topBar: {height: 64, justifyContent: 'center', borderBottomWidth: 1, borderColor: '#000'},
  title: {textAlign: 'center', fontSize: 22, fontWeight: '600', color: '#000'},
  body: {flex: 1, paddingHorizontal: 32, paddingTop: 32},
  heading: {fontSize: 20, fontWeight: '600', color: '#000', marginBottom: 16},
  row: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 12,
  },
  rowOn: {backgroundColor: '#000'},
  swatch: {...SWATCH, borderWidth: 2, borderColor: '#000', backgroundColor: '#fff', marginRight: 20},
  swatchOn: {borderColor: '#fff'},
  rowLabel: {fontSize: 20, color: '#000'},
  rowLabelOn: {color: '#fff', fontWeight: '600'},
  note: {fontSize: 17, color: '#555', lineHeight: 24, marginTop: 16},
  error: {fontSize: 17, color: '#000', fontWeight: '600', marginTop: 16},
  footer: {paddingHorizontal: 24, paddingBottom: 24},
  primaryBtn: {
    height: 60,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {fontSize: 21, fontWeight: '600', color: '#fff'},
});
