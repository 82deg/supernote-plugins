/**
 * Image Placer — plugin entry.
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

import {
  CROP_BUTTON_ID,
  INSERT_BUTTON_ID,
  ROTATE_LEFT_BUTTON_ID,
  ROTATE_RIGHT_BUTTON_ID,
} from './src/buttons';

// Deliberately ungated: release builds bundle with --dev false, so this is the
// only way to confirm in logcat which build is actually running.
log(`ImagePlacer v${VERSION_NAME} (${VERSION_CODE}) starting`);

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

PluginManager.registerButton(1, ['NOTE'], {
  id: INSERT_BUTTON_ID,
  name: 'Insert Image',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});

// Lasso toolbar button, shown when the lasso contains a picture
// (editDataTypes index 2 = picture; this is NOT the ElementType value 200).
PluginManager.registerButton(2, ['NOTE'], {
  id: ROTATE_LEFT_BUTTON_ID,
  name: 'Rotate left',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  editDataTypes: [2],
  showType: 1,
});

PluginManager.registerButton(2, ['NOTE'], {
  id: ROTATE_RIGHT_BUTTON_ID,
  name: 'Rotate right',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  editDataTypes: [2],
  showType: 1,
});

PluginManager.registerButton(2, ['NOTE'], {
  id: CROP_BUTTON_ID,
  name: 'Crop',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  editDataTypes: [2],
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
