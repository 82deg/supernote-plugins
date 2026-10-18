/**
 * __DISPLAY__ — root view.
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';
import {log} from './src/log';
import {onButton} from './src/pendingButton';
import {VERSION_CODE, VERSION_NAME} from './src/version';

function App(): React.JSX.Element {
  const [lastButton, setLastButton] = useState<number | null>(null);

  useEffect(
    () =>
      onButton(id => {
        log(`App received button ${id}`);
        setLastButton(id);
      }),
    [],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>
          __DISPLAY__ v{VERSION_NAME} ({VERSION_CODE})
        </Text>
        <Pressable style={styles.button} onPress={() => PluginManager.closePluginView()}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.text}>Opened from button {lastButton ?? '—'}</Text>
      </View>
    </View>
  );
}

// E-ink: pure black on white, thick borders, big targets, no animation.
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
  button: {borderWidth: 2, borderColor: '#000', paddingHorizontal: 18, paddingVertical: 10, marginLeft: 12},
  buttonText: {fontSize: 20, color: '#000'},
  body: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  text: {fontSize: 22, color: '#000'},
});

export default App;
