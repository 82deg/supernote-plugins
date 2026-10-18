// On-device test bench for the Phase 2 spike. E-ink friendly: black on white,
// no animation, big targets, results printed as text.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import {CHECKS, LOG_DIR, type SpikeContext} from './checks';
import {enableFileLog, log, subscribeLog, syncLog} from '../log';
import {FILE_WRITE} from '../sdk';
import {onButton} from '../pendingButton';
import {VERSION_CODE, VERSION_NAME} from '../version';
import RenderStage, {type RenderFn} from '../image/RenderStage';
import {CROP_BUTTON_ID, ROTATE_LEFT_BUTTON_ID, ROTATE_RIGHT_BUTTON_ID} from '../buttons';
import CropScreen from '../screens/CropScreen';
import type {Edges} from '../image/crop';
import {finishCropJob, rotateLassoPicture, startCropJob, type CropJob} from '../note/lassoPicture';

type Status = {state: 'idle' | 'running' | 'ok' | 'fail'; text: string};

const CHECK_TIMEOUT_MS = 25000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export default function SpikeScreen(): React.JSX.Element {
  const ctx = useRef<SpikeContext>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [lines, setLines] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | undefined>();
  const [showLog, setShowLog] = useState(false);

  useEffect(() => subscribeLog(setLines), []);
  useEffect(() => {
    // If write access is already granted (e.g. "always allow"), log to file from the start.
    PluginManager.hasPermission(FILE_WRITE).then(has => {
      if (has === 1) {
        enableFileLog(LOG_DIR);
      }
    });
  }, []);
  const runRef = useRef<(id: string) => Promise<void>>(async () => {});
  const startCropRef = useRef<() => Promise<void>>(async () => {});
  const rotateRef = useRef<(rotation: 90 | 270) => Promise<void>>(async () => {});
  const [cropJob, setCropJob] = useState<CropJob | null>(null);
  useEffect(
    () =>
      onButton(id => {
        log(`App received button ${id}`);
        if (id === ROTATE_RIGHT_BUTTON_ID || id === ROTATE_LEFT_BUTTON_ID) {
          setShowLog(false);
          rotateRef.current(id === ROTATE_RIGHT_BUTTON_ID ? 90 : 270);
        }
        if (id === CROP_BUTTON_ID) {
          setShowLog(false);
          startCropRef.current();
        }
      }),
    [],
  );

  const onRenderReady = useCallback((render: RenderFn) => {
    ctx.current.render = render;
  }, []);

  const busy = useRef(false);

  const run = async (id: string) => {
    // E-ink taps are easy to double up while the screen catches up; build 8
    // inserted two stacked pictures that way. Ignore taps while a check runs.
    if (busy.current) {
      log(`(ignored tap on ${id}: a check is still running)`);
      return;
    }
    busy.current = true;
    const check = CHECKS.find(c => c.id === id)!;
    setStatus(s => ({...s, [id]: {state: 'running', text: '…'}}));
    log(`▶ ${check.label}`);
    await syncLog(); // on disk + rescanned, so a native crash still leaves this line visible over MTP
    const t0 = Date.now();
    try {
      const text = await withTimeout(check.run(ctx.current), CHECK_TIMEOUT_MS);
      const msg = `${text} [${Date.now() - t0}ms]`;
      log(`✓ ${check.id}: ${msg}`);
      setStatus(s => ({...s, [id]: {state: 'ok', text: msg}}));
    } catch (e) {
      const msg = `${e instanceof Error ? e.message : String(e)} [${Date.now() - t0}ms]`;
      log(`✗ ${check.id}: ${msg}`);
      setStatus(s => ({...s, [id]: {state: 'fail', text: msg}}));
    }
    setPreview(ctx.current.previewPath);
    busy.current = false;
  };
  runRef.current = run;

  // 15/17. Rotate or crop an already-placed picture (lasso toolbar buttons).
  const setRow = (key: 'rotate' | 'crop', state: Status['state'], text: string) =>
    setStatus(s => ({...s, [key]: {state, text}}));

  const rotate = async (rotation: 90 | 270) => {
    log(`▶ 15. Rotate ${rotation === 90 ? 'right' : 'left'}`);
    await syncLog();
    const t0 = Date.now();
    setRow('rotate', 'running', 'rotating…');
    try {
      const msg = `${await rotateLassoPicture(ctx.current.render!, rotation)} [${Date.now() - t0}ms]`;
      log(`✓ rotate: ${msg}`);
      setRow('rotate', 'ok', `${msg} — close to see it`);
    } catch (e) {
      const msg = `${e instanceof Error ? e.message : String(e)} [${Date.now() - t0}ms]`;
      log(`✗ rotate: ${msg}`);
      setRow('rotate', 'fail', msg);
    }
    await syncLog();
  };
  rotateRef.current = rotate;

  const startCrop = async () => {
    log('▶ 17. Crop lassoed picture');
    await syncLog();
    try {
      const job = await startCropJob();
      setRow('crop', 'running', job.initialEdges ? 're-cropping from the original…' : 'cropping…');
      setCropJob(job);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`✗ crop: ${msg}`);
      setRow('crop', 'fail', msg);
    }
  };
  startCropRef.current = startCrop;

  const finishCrop = async (edges: Edges) => {
    const job = cropJob;
    setCropJob(null);
    if (!job) {
      return;
    }
    const t0 = Date.now();
    try {
      const msg = `${await finishCropJob(job, edges, ctx.current.render!)} [${Date.now() - t0}ms]`;
      log(`✓ crop: ${msg}`);
      setRow('crop', 'ok', `${msg} — close to see it`);
    } catch (e) {
      const msg = `${e instanceof Error ? e.message : String(e)} [${Date.now() - t0}ms]`;
      log(`✗ crop: ${msg}`);
      setRow('crop', 'fail', msg);
    }
    await syncLog();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Image Placer spike v{VERSION_NAME} ({VERSION_CODE})</Text>
        <Pressable style={styles.headerBtn} onPress={() => setShowLog(v => !v)}>
          <Text style={styles.headerBtnText}>{showLog ? 'Checks' : 'Log'}</Text>
        </Pressable>
        <Pressable style={styles.headerBtn} onPress={() => PluginManager.closePluginView()}>
          <Text style={styles.headerBtnText}>Close</Text>
        </Pressable>
      </View>

      {showLog ? (
        <FlatList
          style={styles.log}
          data={lines}
          keyExtractor={(_, i) => String(i)}
          renderItem={({item}) => <Text style={styles.logLine}>{item}</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {([
            ['rotate', '15. Rotate lassoed picture (lasso toolbar "Rotate left/right")'],
            ['crop', '17. Crop lassoed picture (lasso toolbar "Crop")'],
          ] as const).map(([key, label]) =>
            status[key] ? (
              <View key={key} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {status[key].state === 'ok' ? '✓ ' : status[key].state === 'fail' ? '✗ ' : '… '}
                  {label}
                </Text>
                <Text style={styles.rowResult}>{status[key].text}</Text>
              </View>
            ) : null,
          )}
          {CHECKS.map(c => {
            const st = status[c.id];
            return (
              <Pressable key={c.id} style={styles.row} onPress={() => run(c.id)}>
                <Text style={styles.rowLabel}>
                  {st?.state === 'ok' ? '✓ ' : st?.state === 'fail' ? '✗ ' : st?.state === 'running' ? '… ' : ''}
                  {c.label}
                </Text>
                {st ? <Text style={styles.rowResult}>{st.text}</Text> : null}
              </Pressable>
            );
          })}
          {preview ? (
            <Image source={{uri: `file://${preview}`}} style={styles.preview} resizeMode="contain" />
          ) : null}
          {/* Render stage for view-shot jobs (12b/12c); empty when idle. */}
          <RenderStage onReady={onRenderReady} />
        </ScrollView>
      )}

      {/* Crop overlay; the list (and its RenderStage) stays mounted underneath. */}
      {cropJob ? (
        <View style={StyleSheet.absoluteFill}>
          <CropScreen
            sourcePath={cropJob.sourcePath}
            sourceSize={cropJob.sourceSize}
            initialEdges={cropJob.initialEdges}
            title={cropJob.sel.pictureCount > 1 ? `Crop (${cropJob.sel.pictureCount} pictures, merged)` : 'Crop'}
            onDone={finishCrop}
            onCancel={() => {
              setCropJob(null);
              log('crop: cancelled');
              setRow('crop', 'ok', 'cancelled');
            }}
          />
        </View>
      ) : null}
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
  title: {flex: 1, fontSize: 22, fontWeight: 'bold', color: '#000'},
  headerBtn: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 18, paddingVertical: 10, marginLeft: 12},
  headerBtnText: {fontSize: 20, color: '#000'},
  list: {padding: 16},
  row: {borderWidth: 2, borderColor: '#000', padding: 14, marginBottom: 10, minHeight: 56},
  rowLabel: {fontSize: 20, color: '#000'},
  rowResult: {fontSize: 16, color: '#000', marginTop: 6},
  preview: {width: '100%', height: 500, borderWidth: 1, borderColor: '#000'},
  log: {flex: 1, padding: 12},
  logLine: {fontSize: 14, color: '#000', fontFamily: 'monospace'},
});
