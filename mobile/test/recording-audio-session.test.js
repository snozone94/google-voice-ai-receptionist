import test from 'node:test';
import assert from 'node:assert/strict';
import {playRecording} from '../recording-audio-session.js';
test('recording play configures audible media mode before activating and starting audio',async()=>{
 const steps=[],player={muted:true,volume:0,play(){steps.push('play');}};
 assert.equal(await playRecording({player,setMode:async mode=>{steps.push('mode');assert.equal(mode.playsInSilentMode,true);assert.equal(mode.allowsRecording,false);assert.equal(mode.shouldRouteThroughEarpiece,false);assert.equal(mode.shouldPlayInBackground,false);},setActive:async active=>{steps.push('active');assert.equal(active,true);}}),true);
 assert.deepEqual(steps,['mode','active','play']);assert.equal(player.muted,false);assert.equal(player.volume,1);
});
test('active or arriving calls prevent a recording from taking over audio',async()=>{
 for(const interruptAt of [0,1,2]){let allowed=interruptAt!==0,plays=0,activations=0;
 const result=await playRecording({canPlay:()=>allowed,player:{play(){plays++;}},setMode:async()=>{if(interruptAt===1)allowed=false;},setActive:async()=>{activations++;allowed=false;}});
 assert.equal(result,false);assert.equal(plays,0);assert.equal(activations,interruptAt===2?1:0);}
});
test('failed audio-session setup never pretends playback started',async()=>{let played=false;await assert.rejects(playRecording({player:{play(){played=true;}},setMode:async()=>{throw Error('Audio unavailable');},setActive:async()=>{throw Error('Unexpected activation');}}),/Audio unavailable/);assert.equal(played,false);});
