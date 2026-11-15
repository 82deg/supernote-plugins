// Settings, opened from the plugin's page in Settings → Apps → Plugins.
// Two choices: the corners new pictures get, and whether they go on their
// own "Images" layer. Saved as soon as they're tapped. E-ink: black on white, inverted selection, 64dp rows, no animation.
import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {CORNER_DP, CORNER_STYLES, type Corners} from '../image/corners';
import {loadSettings, saveSettings, type Settings} from '../settings';
import {ensureFileAccess} from '../note/insert';

// Circle only makes sense on a square crop, so it lives in the crop screen only.
const OPTIONS = CORNER_STYLES.filter(c => c.id !== 'circle');
const SWATCH = {width: 72, height: 48};

export default function SettingsScreen({onDone}: {onDone: () => void}): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const update = async (change: Partial<Settings>) => {
    if (!settings) {
      return;
    }
    const before = settings;
    const next = {...settings, ...change};
    setSettings(next);
    setError(null);
    try {
      try {
        await saveSettings(next);
      } catch {
        // The plugin's own folder may need file access on some firmware: ask, then retry once.
        await ensureFileAccess();
        await saveSettings(next);
      }
    } catch (e) {
      setSettings(before);
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const corners = settings?.corners;
  const layerOn = settings?.imagesLayer ?? false;

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
                onPress={() => update({corners: o.id as Corners})}
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
          Change the corners of any picture later: select it with the lasso, then More → Crop (Circle is there too).
        </Text>

        <Text style={[styles.heading, styles.sectionGap]}>Layer</Text>
        <Pressable
          style={[styles.row, layerOn && styles.rowOn]}
          onPress={() => update({imagesLayer: !layerOn})}
          disabled={!settings}
          accessibilityRole="switch"
          accessibilityState={{checked: layerOn}}
          accessibilityLabel="Add images to a dedicated layer called Images">
          <View style={[styles.box, layerOn && styles.boxOn]}>
            {layerOn ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Text style={[styles.rowLabel, styles.rowLabelWrap, layerOn && styles.rowLabelOn]}>
            Add images to a dedicated layer called “Images”
          </Text>
        </Pressable>
        <Text style={styles.note}>
          {layerOn
            ? 'New pictures go on an Images layer below your writing (one per page). To select, crop or rotate them, first choose the Images layer in the Layers panel. Notes without layers use the main layer.'
            : 'Off: new pictures go on the main layer, so you can select them straight away. Turn on to keep pictures on their own layer, below your writing.'}
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
    height: 64,
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
  note: {fontSize: 17, color: '#555', lineHeight: 24, marginTop: 12},
  sectionGap: {marginTop: 32},
  rowLabelWrap: {flex: 1},
  box: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  boxOn: {borderColor: '#fff'},
  tick: {fontSize: 22, fontWeight: '700', color: '#000', lineHeight: 26},
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
