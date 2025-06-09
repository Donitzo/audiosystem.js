/**
 * @file AudioSystem.js
 * @version 1.0.0
 * @license MIT
 * @see {@link https://github.com/Donitzo/js-game-framework}
 * @repository https://github.com/Donitzo/js-game-framework
 */

export default class AudioSystem {
    static #soundDirectory = './sounds';
    static #preventCaching = false;

    static #suspendInBackground = true;

    static #ac = null;
    static #acResuming = null;

    static #gain = null;
    static #gainConnected = null;

    static #destinationNode = null;

    static #volume = 1;

    static #sounds = new Map();
    static #soundInstances = [];

    static {
        window.addEventListener('load', AudioSystem.#handleLoad);

        if (AudioSystem.#suspendInBackground) {
            document.addEventListener('visibilitychange', () => {
                const ac = AudioSystem.getAudioContext();

                if (document.hidden) {
                    if (ac.state === 'running') {
                        AudioSystem.getAudioContext().suspend();
                    }
                } else if (ac.state === 'suspended' && !AudioSystem.#acResuming) {
                    AudioSystem.#acResuming = true;

                    ac.resume().finally(() => {
                        AudioSystem.#acResuming = false;
                    });
                }
            });
        }
    }

    static #handleLoad() {
        const userGesture = () => {
            const ac = AudioSystem.#ac;
            if (ac === null) {
                return;
            }

            if (ac.state === 'suspended' && !AudioSystem.#acResuming) {
                AudioSystem.#acResuming = true;

                ac.resume().finally(() => {
                    AudioSystem.#acResuming = false;
                });
            }
        };

        document.addEventListener('click', userGesture);
        document.addEventListener('touchend', userGesture);
        document.addEventListener('keydown', userGesture);
    }

    static getAudioContext() {
        const ac = AudioSystem.#ac;
        if (ac === null) {
            throw new Error('Call .createAudioContext first');
        }
        return ac;
    }

    static createAudioContext(audioContext = null, destinationNode = null) {
        if (AudioSystem.#ac !== null) {
            throw new Error('AudioContext already created');
        }

        const ac = audioContext === null ? new AudioContext() : audioContext;
        AudioSystem.#ac = ac;
        AudioSystem.#acResuming = false;

        AudioSystem.#destinationNode = destinationNode === null ? ac.destination : destinationNode;

        AudioSystem.#gain = ac.createGain();
        AudioSystem.#gainConnected = false;

        AudioSystem.setGlobalVolume(AudioSystem.#volume);
    }

    static isAudioContextRunning() {
        return AudioSystem.getAudioContext().state === 'running';
    }

    static setGlobalVolume(volume) {
        AudioSystem.#volume = volume;

        AudioSystem.getAudioContext();

        AudioSystem.#gain.gain.value = volume;

        if (volume <= 0 && AudioSystem.#gainConnected) {
            AudioSystem.#gain.disconnect();
            AudioSystem.#gainConnected = false;
        } else if (volume > 0 && !AudioSystem.#gainConnected) {
            AudioSystem.#gain.connect(AudioSystem.#destinationNode);
            AudioSystem.#gainConnected = true;
        }
    }

    /**
     * @typedef {Object} Sound
     * @property {string} path - The relative file path to the sound file.
     * @property {number} maxSources - The maximum number of simultaneous instances allowed for this sound.
     * @property {number} baseVolume - The base volume factor.
     */

    /**
     * Asynchronously loads a set of sound files into the audio system.
     * @param {Object.<string, Sound>} sounds - An object mapping sound names to their definitions.
     * @returns {Promise<void>} A Promise that resolves when all sounds have been successfully loaded.
     */
    static asyncLoadSounds(sounds) {
        const ac = AudioSystem.getAudioContext();

        return Promise.all(Object.keys(sounds).map(name => {
            const info = sounds[name];
            const url = `${AudioSystem.#soundDirectory}/${info.path}${AudioSystem.#preventCaching ? '?time=' + new Date().getTime() : ''}`;

            return fetch(url, { cache: 'no-cache' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }

                    return response.arrayBuffer();
                })
                .then(buffer => ac.decodeAudioData(buffer))
                .then(buffer => {
                    AudioSystem.#sounds.set(name, {
                        buffer,
                        maxSources: info.maxSources,
                        baseVolume: info.baseVolume,
                        instances: [],
                    });
                })
                .catch(error => {
                    throw new Error(`Error loading sound file "${url}", ${error}`);
                });
        }));
    }

    /**
     * Create, play and return a new sound instance.
     * @param {string} soundName - The sound name.
     * @param {number} [volume] - The sound volume (gain). Scaled by the sound base volume. Defaults to 1.
     * @param {boolean} [loop] - Whether the sound should loop. Defaults to false.
     * @param {object} [tag] - A tag identifying the new sound instance. Disabled by default.
     * @param {number} [offset] - The sound start offset in seconds. Defaults to 0.
     * @param {number} [fadeInSeconds] - Seconds to fade in the sound.
     * @param {boolean} [stopOldestIfMax] - Whether to stop the oldest sound instance if max instances are playing, else ignore play.
     * @param {Function} [endedCallback] - A callback function which is called when the sound instance has ended.
     * @returns {object} - The sound instance.
     */
    static play(soundName, volume = 1, loop = false, tag = null, offset = 0,
        fadeInSeconds = 0, stopOldestIfMax = true, endedCallback = null) {
        const ac = AudioSystem.getAudioContext();

        const sound = AudioSystem.#sounds.get(soundName);
        if (sound === undefined) {
            throw new Error(`Sound "${soundName}" does not exist`);
        }

        if (sound.maxSources <= 0) {
            return null;
        }

        if (sound.instances.length >= sound.maxSources) {
            if (stopOldestIfMax) {
                sound.instances[0].source.stop();
            } else {
                return null;
            }
        }

        const gain = ac.createGain();
        if (fadeInSeconds <= 0) {
            gain.gain.value = sound.baseVolume * volume;
        } else {
            gain.gain.setValueAtTime(1e-4, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(sound.baseVolume * volume, ac.currentTime + fadeInSeconds);
        }
        gain.connect(AudioSystem.#gain);

        const source = ac.createBufferSource();
        source.buffer = sound.buffer;
        if (loop) {
            source.loop = true;
            if (offset > 0) {
                source.loopStart = offset;
                source.loopEnd = sound.buffer.duration;
            }
        }
        source.connect(gain);

        const instance = { source, gain, tag, stopping: false, startTime: ac.currentTime };

        sound.instances.push(instance);
        AudioSystem.#soundInstances.push(instance);

        source.onended = () => {
            if (endedCallback !== null) {
                endedCallback(instance);
            }

            gain.disconnect();

            const si = sound.instances.indexOf(instance);
            if (si > -1) {
                sound.instances.splice(si, 1);
            }

            const i = AudioSystem.#soundInstances.indexOf(instance);
            if (i > -1) {
                AudioSystem.#soundInstances.splice(i, 1);
            }
        };

        source.start(instance.startTime, offset);

        return instance;
    }

    /**
     * Stop all sound instances or sound instances identified by a tag.
     * @param {object} [tag] - A tag identifying the sound instances to stop if not null.
     * @param {number} [fadeOutSeconds] - The number of seconds over which to fade out the sound instances.
     */
    static stop(tag = null, fadeOutSeconds = 0) {
        const ac = AudioSystem.getAudioContext();

        for (let i = AudioSystem.#soundInstances.length - 1; i > -1; i--) {
            const instance = AudioSystem.#soundInstances[i];

            if (instance.stopping || tag !== null && instance.tag !== tag) {
                continue;
            }

            instance.stopping = true;

            if (fadeOutSeconds <= 0) {
                instance.source.stop();
            } else {
                instance.gain.gain.setValueAtTime(instance.gain.gain.value, ac.currentTime);
                instance.gain.gain.exponentialRampToValueAtTime(1e-4, ac.currentTime + fadeOutSeconds);
                instance.source.stop(ac.currentTime + fadeOutSeconds);
            }
        }
    }

    static isTagPlaying(tag) {
        return AudioSystem.#soundInstances.some(instance => !instance.stopping && instance.tag === tag);
    }

    static getSoundNames() {
        return Array.from(AudioSystem.#sounds.keys());
    }

    static getSoundBuffer(soundName) {
        const sound = AudioSystem.#sounds.get(soundName);
        if (sound === undefined) {
            throw new Error(`Sound "${soundName}" does not exist`);
        }
        return sound.buffer;
    }
}
