/* @flow */
import * as THREE from 'three';
import { getCtx } from './get-ctx';
import { SAMPLE_WIDTH, SAMPLE_HEIGHT } from './constants';

export default class SoundLoader {
  _cache: { [url: string]: THREE.DataTexture };

  constructor() {
    this._cache = {};
  }

  load(url: string): Promise<THREE.DataTexture> {
    const cache = this._cache[url];
    if (cache) {
      return Promise.resolve(cache);
    }

    const ctx = getCtx();
    return new Promise((resolve, reject) => {
      const xhr = new window.XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        resolve(xhr.response);
      };
      xhr.onerror = () => {
        reject(new TypeError('Local request failed'));
      };
      xhr.open('GET', url);
      xhr.send(null);
    })
      .then(res => ctx.decodeAudioData(res))
      .then(audioBuffer => {
        const c0 = audioBuffer.getChannelData(0); // -1 to 1
        const c1 = audioBuffer.numberOfChannels === 2 ?
          audioBuffer.getChannelData(1) : c0;

        // Copy data to Uint8Array
        const array = new Uint8Array(SAMPLE_WIDTH * SAMPLE_HEIGHT * 4);
        for (let i = 0; i < c0.length; i++) {
          const off = i * 4;
          if (off + 3 >= array.length) {
            break;
          }

          const l = c0[i] * 32768 + 32768;
          const r = c1[i] * 32768 + 32768;

          array[off] = l / 256;
          array[off + 1] = l % 256;
          array[off + 2] = r / 256;
          array[off + 3] = r % 256;
        }

        const texture = new THREE.DataTexture(
          array,
          SAMPLE_WIDTH,
          SAMPLE_HEIGHT,
          THREE.RGBAFormat
        );
        texture.needsUpdate = true;

        this._cache[url] = texture;

        return texture;
      });
  }

  unload(url: string): void {
    this._cache[url] = null;
  }
}
