const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

function patchAppDelegate(source) {
  source = source.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
  if (!source.includes('ExpoReactNativeFactoryProvider')) throw new Error('DDD scene migration: unsupported AppDelegate');
  const legacy = /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)\s+factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\s+#endif/;
  source = source.replace(legacy, '// ExpoAppSceneDelegate creates the scene window and starts React Native.');
  if (source.includes('window = UIWindow(frame:')) throw new Error('DDD scene migration: legacy window startup remains');
  return source;
}

module.exports = function withDddSceneLifecycle(config) {
  config = withAppDelegate(config, mod => {
    mod.modResults.contents = patchAppDelegate(mod.modResults.contents);
    return mod;
  });
  return withInfoPlist(config, mod => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
        }],
      },
    };
    return mod;
  });
};
module.exports.patchAppDelegate = patchAppDelegate;
