# AudioSystem.js

A lightweight audio system for the Web Audio API, supporting multiple simultaneous sound instances, volume control and fade in/out.

## Features

- Lazy creation of `AudioContext` via user gestures
- Volume fading and instance-based playback control
- Tagging of sound instances for playback control
- Suspension/resumption on browser visibility change
- Limiting instances per sound

## Getting Started

### 1. Install / Include

Include `audiosystem.js` in your project:

```js
import AudioSystem from './audiosystem.js';
```

### 2. Initialize AudioSystem

Create the AudioContext object:

```js
AudioSystem.createAudioContext();
```

### 3. Load Sounds

Load sound files (by default located at `./sounds/<path>`):

```js
await AudioSystem.asyncLoadSounds({
    effect__click: {
        path: 'effect__click.wav',
        maxSources: 5,
        baseVolume: 1.0,
    },
    music__background: {
        path: 'music__background.mp3',
        maxSources: 1,
        baseVolume: 0.5,
    }
});
```

### 4. Play a Sound

Play sounds with the following parameters:

| Parameter         | Type       | Description                                                                                          | Default      |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------------------- | ------------ |
| `soundName`       | `string`   | The name of the sound to play.                                                                       | **Required** |
| `volume`          | `number`   | Volume factor.                                                                                       | `1`          |
| `loop`            | `boolean`  | Whether the sound should loop.                                                                       | `false`      |
| `tag`             | `object`   | Optional tag to associate with the sound instance.                                                   | `null`       |
| `offset`          | `number`   | Start offset in seconds.                                                                             | `0`          |
| `fadeInSeconds`   | `number`   | Number of seconds over which to fade in.                                                             | `0`          |
| `stopOldestIfMax` | `boolean`  | If `true`, stops the oldest instance when max instances are reached. Otherwise, playback is skipped. | `true`       |
| `endedCallback`   | `Function` | A callback invoked when the sound instance ends.                                                     | `null`       |

```js
AudioSystem.play('effect__click');
const music = AudioSystem.play('music__background', 1, true, 'music');
```

### 5. Stop Sounds

Stop all sounds:

```js
AudioSystem.stop();
```

Stop all sounds with a specific tag:

```js
AudioSystem.stop('music');
```

or a specific sound instance:

```js
AudioSystem.stop(music);
```
