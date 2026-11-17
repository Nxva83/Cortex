// Enveloppes translucides du cerveau : la forme est définie par chaque espèce.
import * as THREE from 'three';
import { ESPECE } from './anatomy.js';

const vertexShader = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const fragmentShader = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; uniform float uPower;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
    gl_FragColor = vec4(uColor, (f * 0.9 + 0.025) * uOpacity);
  }`;

// Matériau « verre » : lumineux sur les bords, transparent au centre
export function shellMaterial(color, opacity, power = 2.4) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uPower: { value: power } },
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function buildShells() {
  const group = ESPECE.shells({ THREE, shellMaterial });
  group.renderOrder = -1;
  return group;
}
