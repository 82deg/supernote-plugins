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
  useEffect(() => onButton(id => log(`App received button ${id}`)), []);

  const onRenderReady = useCallback((render: RenderFn) => {
    ctx.current.render = render;
  }, []);

  const run = async (id: string) => {
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
