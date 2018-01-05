/* @flow */
import * as THREE from 'three';

const WIDTH = 512; // sqrt(48000 * 30)
const HEIGHT = 512; // sqrt(48000 * 30)
const PIXELS = WIDTH * HEIGHT;

const createShader = (shader, width) => `
precision mediump float;
uniform float iBlockOffset;
uniform float iSampleRate;

${shader}

void main(){
  float t = iBlockOffset + ((gl_FragCoord.x - 0.5) + (gl_FragCoord.y - 0.5) * ${width}.0) / iSampleRate;
  vec2 y = mainSound(t); // -1 to 1
  vec2 v  = floor((y * .5 + .5) * 65536.0); // 0 to 65536, int
  vec2 vl = mod(v, 256.) / 255.;
  vec2 vh = floor(v / 256.) / 255.;
  gl_FragColor = vec4(vh.x, vl.x, vh.y, vl.y);
}`;

export default class SoundRenderer {
  _target: THREE.WebGLRenderTarget;
  _scene: THREE.Scene;
  _camera: THREE.Camera;
  _renderer: THREE.Renderer;
  _wctx: WebGLRenderingContext;
  _uniforms: any;

  _audioBuffer: AudioBuffer;
  _ctx: AudioContext;
  _node: AudioBufferSourceNode;

  _soundMode: string = 'LOOP';
  _soundLength: number = 3;
  _isPlaying: boolean = false;

  constructor() {
    this._ctx = new window.AudioContext();
    this._audioBuffer = this._ctx.createBuffer(2, this._ctx.sampleRate * this._soundLength, this._ctx.sampleRate);
    this._node = this._createNode();

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this._renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    this._wctx = this._renderer.getContext();
    this._target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { format: THREE.RGBAFormat });

    this._uniforms = {
      iBlockOffset: { type: 'f', value: 0.0 },
      iSampleRate: { type: 'f', value: this._ctx.sampleRate },
    };
  }

  _createNode(): AudioBufferSourceNode {
    const node = this._ctx.createBufferSource();
    node.loop = true;
    node.buffer = this._audioBuffer;
    node.connect(this._ctx.destination);
    return node;
  }

  setLength(length: number) {
    if (this._isPlaying) {
      this._node.stop();
    }
    this._node.disconnect();

    this._soundLength = length;
    this._audioBuffer = this._ctx.createBuffer(2, this._ctx.sampleRate * this._soundLength, this._ctx.sampleRate);
    // this._node.buffer = this._audioBuffer;

    // Create new node
    this._node = this._createNode();
    this.setMode(this._soundMode);
    if (this._isPlaying) {
      this._node.start();
    }
  }

  setMode(mode: string) {
    this._soundMode = mode.toUpperCase();
    if (this._soundMode === 'LOOP') {
      this._node.loop = true;
    } else {
      this._node.loop = false;
    }
  }

  loadShader(fs: string) {
    const fragmentShader = createShader(fs, WIDTH);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      fragmentShader,
    });
    const plane = new THREE.Mesh(geometry, material);

    this._scene = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this._camera.position.set(0, 0, 1);
    this._camera.lookAt(this._scene.position);

    this._scene.add(plane);
  }

  play() {
    this.render();
    if (!this._isPlaying) {
      this._isPlaying = true;
      this._node.start();
    }
  }

  stop() {
    // Destroy old node
    this._node.stop();
    this._node.disconnect();

    // Create new node
    this._node = this._createNode();
    this.setMode(this._soundMode);
  }

  render = () => {
    const outputDataL = this._audioBuffer.getChannelData(0);
    const outputDataR = this._audioBuffer.getChannelData(1);

    const numBlocks = (this._ctx.sampleRate * this._soundLength) / PIXELS;

    let j = 0;
    const renderOnce = (remain) => {
      const off = j * PIXELS;

      // Update uniform
      this._uniforms.iBlockOffset.value = off / this._ctx.sampleRate;
      this._renderer.render(this._scene, this._camera, this._target, true);

      // Get pixels
      const pixels = new Uint8Array(PIXELS * 4);
      this._wctx.readPixels(0, 0, WIDTH, HEIGHT, this._wctx.RGBA, this._wctx.UNSIGNED_BYTE, pixels);

      for (let i = 0; i < PIXELS; i++) {
        outputDataL[off + i] = (pixels[i * 4 + 0] * 256 + pixels[i * 4 + 1]) / 65535 * 2 - 1;
        outputDataR[off + i] = (pixels[i * 4 + 2] * 256 + pixels[i * 4 + 3]) / 65535 * 2 - 1;
      }

      j++;
      if (j < numBlocks) {
        setTimeout(renderOnce, 100);
      }
    }

    setTimeout(renderOnce, 100);
  }
}
