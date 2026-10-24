const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

function patchCallKitSource(source) {
  if (source.includes("DDD persisted call configuration")) return source;
  const target = "- (void)initializeCallKitWithConfiguration:(NSDictionary *)configuration {";
  if (!source.includes(target)) throw new Error("DDD: CallKit SDK changed; review the persisted ringtone patch before building.");
  return source.replace(target, `${target}
    // DDD persisted call configuration: restore ringtone before a cold-start call arrives.
    NSUserDefaults *dddDefaults = [NSUserDefaults standardUserDefaults];
    if (configuration) {
        [dddDefaults setObject:configuration forKey:@"DDDCallKitConfiguration"];
    } else {
        configuration = [dddDefaults dictionaryForKey:@"DDDCallKitConfiguration"] ?: @{
            @"callKitRingtoneSound": @"ddd_dispatch_alert.wav",
            @"callKitIncludesCallsInRecents": @NO
        };
    }
`);
}

module.exports = function withDddCallSounds(config) {
  return withDangerousMod(config, ["ios", async (mod) => {
    const packagePath = require.resolve("@twilio/voice-react-native-sdk/package.json", { paths: [mod.modRequest.projectRoot] });
    const target = path.join(path.dirname(packagePath), "ios", "TwilioVoiceReactNative+CallKit.m");
    fs.writeFileSync(target, patchCallKitSource(fs.readFileSync(target, "utf8")));
    return mod;
  }]);
};
module.exports.patchCallKitSource = patchCallKitSource;
