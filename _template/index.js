/**
 * __DISPLAY__ — plugin entry.
 *
 * @format
 */

import {AppRegistry, Image} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager} from 'sn-plugin-lib';
import {log} from './src/log';
import {VERSION_NAME, VERSION_CODE} from './src/version';
import {setPendingButton} from './src/pendingButton';

export const MAIN_BUTTON_ID = 100;

// Deliberately ungated: release builds bundle with --dev false, so this is the
// only way to confirm in logcat which build is actually running.
log(`__NAME__ v${VERSION_NAME} (${VERSION_CODE}) starting`);

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

PluginManager.registerButton(1, ['NOTE'], {
  id: MAIN_BUTTON_ID,
  name: '__DISPLAY__',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});

// Registered here rather than in App so a press that arrives before the
// component mounts is not lost (pending-button pattern).
PluginManager.registerButtonListener({
  onButtonPress: event => {
    log(`button pressed: id=${event.id}`);
    setPendingButton(event.id);
  },
});
