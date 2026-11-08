// Configure only when the user plays a recording. CallKit/Twilio retains control
// while a call is active; stale loading work must never restart over a new call.
export async function playRecording({player,setMode,setActive,canPlay=()=>true}) {
  if(!canPlay())return false;
  await setMode({playsInSilentMode:true,allowsRecording:false,shouldPlayInBackground:false,shouldRouteThroughEarpiece:false,interruptionMode:'doNotMix'});
  if(!canPlay())return false;
  await setActive(true);
  if(!canPlay())return false;
  player.muted=false;
  player.volume=1;
  player.play();
  return true;
}
