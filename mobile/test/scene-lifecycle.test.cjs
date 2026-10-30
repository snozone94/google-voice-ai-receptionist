const test = require('node:test');
const assert = require('node:assert/strict');
const { patchAppDelegate } = require('../withDddSceneLifecycle.cjs');

test('migrates legacy startup without removing push and linking callbacks', () => {
  const legacy = `class AppDelegate: ExpoAppDelegate {
    var window: UIWindow?
    #if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
    #endif
    // Linking API and notification callbacks remain here.
  }`;
  const migrated = patchAppDelegate(legacy);
  assert.match(migrated, /ExpoAppDelegate, ExpoReactNativeFactoryProvider/);
  assert.doesNotMatch(migrated, /window = UIWindow|factory.startReactNative/);
  assert.match(migrated, /Linking API and notification callbacks/);
  assert.equal(patchAppDelegate(migrated), migrated);
});

test('fails closed for an unsupported app delegate', () => {
  assert.throws(() => patchAppDelegate('class DifferentAppDelegate {}'), /unsupported AppDelegate/);
});
