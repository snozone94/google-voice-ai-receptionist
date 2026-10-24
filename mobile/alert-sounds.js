import catalog from "./assets/notification-sounds.json";

export const alertSounds = catalog.sounds;
export const soundPackVersion = catalog.version;
export const soundFile = (id) => alertSounds.find((sound) => sound.id === id)?.file || "default";
export const soundChannel = (id) => `ddd-alert-${id || "ddd-alert"}-v${soundPackVersion}`;
export const callKitOptions = (id) => ({ callKitIncludesCallsInRecents: false, callKitMaximumCallGroups: 1, callKitMaximumCallsPerCallGroup: 1, callKitSupportedHandleTypes: [0, 1], callKitIconTemplateImageData: "", callKitRingtoneSound: soundFile(id) === "default" ? "" : soundFile(id) });

export async function createAlertChannels(notifications) {
  for (const sound of [...alertSounds, { id: "system", file: "default", label: "System" }, { id: "silent", file: null, label: "Silent" }]) {
    await notifications.setNotificationChannelAsync(soundChannel(sound.id), { name: `DDD · ${sound.label}`, importance: notifications.AndroidImportance.HIGH, sound: sound.file, vibrationPattern: [0, 250, 250, 250], lightColor: "#ff3ea5" });
  }
}
