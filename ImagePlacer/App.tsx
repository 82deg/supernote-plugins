/**
 * Image Placer — root view.
 *
 * - Toolbar "Insert Image": opens Supernote's picker straight away, adds the
 *   chosen picture to the page and leaves it lasso-selected.
 * - Lasso "Rotate left / right": turns the selected picture in place.
 * - Lasso "Crop": opens the crop editor (crop + rounded corners), then
 *   replaces the picture in place.
 * - Settings (plugin manager's config button): corners for new pictures.
 * The plugin closes itself when each action is done.
 *
 * @format
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import {log} from './src/log';
import {onButton} from './src/pendingButton';
import {
  CROP_BUTTON_ID,
  INSERT_BUTTON_ID,
  ROTATE_LEFT_BUTTON_ID,
  ROTATE_RIGHT_BUTTON_ID,
  SETTINGS_ID,
} from './src/buttons';
import RenderStage, {type RenderFn} from './src/image/RenderStage';
import {ProgressOverlay, type Stage} from './src/ui/Progress';
import CropScreen from './src/screens/CropScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import type {Edges} from './src/image/crop';
import type {Corners} from './src/image/corners';
import {ensureFileAccess, insertPicture, pickImage} from './src/note/insert';
import {finishCropJob, rotateLassoPicture, startCropJob, type CropJob} from './src/note/lassoPicture';

function App(): React.JSX.Element {
  const render = useRef<RenderFn | null>(null);
  const busy = useRef(false);
  const [progress, setProgress] = useState<Stage | null>(null);
  const [cropJob, setCropJob] = useState<CropJob | null>(null);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onRenderReady = useCallback((fn: RenderFn) => {
    render.current = fn;
  }, []);

  const close = useCallback(async () => {
    setProgress(null);
    setCropJob(null);
    setSettings(false);
    setError(null);
    busy.current = false;
    PluginManager.closePluginView();
  }, []);

  const doneAndClose = useCallback(async () => {
    setProgress({from: 1, to: 1, label: 'Done'});
    await new Promise(r => setTimeout(r, 350));
    await close();
  }, [close]);

  /** Run one user action: one at a time, friendly error on failure. */
  const runAction = useCallback(async (name: string, action: () => Promise<void>) => {
    if (busy.current) {
      log(`(ignored ${name}: busy)`);
      return;
    }
    busy.current = true;
    setError(null);
    log(`▶ ${name}`);
    try {
      await ensureFileAccess();
      await action();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`✗ ${name}: ${msg}`);
      setProgress(null);
      setCropJob(null);
      setError(friendly(msg));
      busy.current = false;
    }
  }, []);

  const insert = () =>
    runAction('insert', async () => {
      const path = await pickImage();
      if (!path) {
        await close(); // backed out of the picker
        return;
      }
      log(`✓ ${await insertPicture(path, render.current!, setProgress)}`);
      await doneAndClose();
    });

  const rotate = (rotation: 90 | 270) =>
    runAction(`rotate ${rotation}`, async () => {
      log(`✓ ${await rotateLassoPicture(render.current!, rotation, setProgress)}`);
      await doneAndClose();
    });

  const crop = () =>
    runAction('crop', async () => {
      const job = await startCropJob(setProgress);
      setProgress(null);
      setCropJob(job);
      busy.current = false; // the editor is interactive; Apply runs as its own action
    });

  const applyCrop = (edges: Edges, corners: Corners) => {
    const job = cropJob!;
    setCropJob(null);
    runAction('apply crop', async () => {
      log(`✓ ${await finishCropJob(job, edges, corners, render.current!, setProgress)}`);
      await doneAndClose();
    });
  };

  // Latest handlers for the button listener (registered once).
  const openSettings = () => {
    if (busy.current) {
      return;
    }
    setError(null);
    setCropJob(null);
    setSettings(true);
  };

  const handlers = useRef({insert, rotate, crop, openSettings});
  handlers.current = {insert, rotate, crop, openSettings};
  useEffect(
    () =>
      onButton(id => {
        log(`button ${id}`);
        if (id === INSERT_BUTTON_ID) {
          handlers.current.insert();
        } else if (id === ROTATE_RIGHT_BUTTON_ID) {
          handlers.current.rotate(90);
        } else if (id === ROTATE_LEFT_BUTTON_ID) {
          handlers.current.rotate(270);
        } else if (id === CROP_BUTTON_ID) {
          handlers.current.crop();
        } else if (id === SETTINGS_ID) {
          handlers.current.openSettings();
        }
      }),
    [],
  );

  return (
    <View style={styles.root}>
      {/* Renders images for rotate/crop/downscale. Kept mounted and drawn (view-shot
          needs a laid-out view), but always covered by the white layer above. */}
      <View style={styles.stage} pointerEvents="none">
        <RenderStage onReady={onRenderReady} />
      </View>

      <View style={styles.cover}>
        {cropJob ? (
          <CropScreen
            sourcePath={cropJob.sourcePath}
            sourceSize={cropJob.sourceSize}
            bounds={cropJob.bounds}
            initialEdges={cropJob.initialEdges}
            initialCorners={cropJob.initialCorners}
            pageScale={(cropJob.fullPlacement.right - cropJob.fullPlacement.left) / cropJob.sourceSize.width}
            onDone={applyCrop}
            onCancel={close}
          />
        ) : settings ? (
          <SettingsScreen onDone={close} />
        ) : error ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>{error}</Text>
            <Pressable style={styles.primaryBtn} onPress={close} accessibilityRole="button">
              <Text style={styles.primaryLabel}>Close</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {progress ? <ProgressOverlay stage={progress} /> : null}
    </View>
  );
}

/** Turn SDK/internal errors into something a person can act on. */
function friendly(msg: string): string {
  if (/access|permission/i.test(msg) || /Select|selection|writing/i.test(msg)) {
    return msg; // already written for people
  }
  return 'Something went wrong, so the picture was left as it was. Please try again.';
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  stage: {position: 'absolute', left: 0, top: 0},
  cover: {...StyleSheet.absoluteFillObject, backgroundColor: '#fff'},
  message: {flex: 1, justifyContent: 'center', paddingHorizontal: 32},
  messageText: {fontSize: 20, color: '#000', textAlign: 'center', marginBottom: 32, lineHeight: 28},
  primaryBtn: {
    height: 60,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {fontSize: 21, fontWeight: '600', color: '#fff'},
});

export default App;
