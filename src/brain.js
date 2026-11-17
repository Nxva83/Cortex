// Enveloppes translucides : hémisphères plissés, cervelet, tronc cérébral.
import * as THREE from 'three';
import { HEMI, CEREB, brainstemPoint, fbm3 } from './anatomy.js';

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

function shellMaterial(color, opacity, power = 2.4) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uPower: { value: power } },
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function hemisphere(side) {
  const g = new THREE.SphereGeometry(1, 240, 170);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let x = v.x * HEMI.rx + side * HEMI.cx;
    const y = v.y * (v.y > 0 ? HEMI.ryTop : HEMI.ryBot) + HEMI.cy;
    const z = v.z * HEMI.rz;
    const m = side * x;
    if (m < HEMI.medial) x = side * (HEMI.medial - (HEMI.medial - m) * 0.06); // face médiane aplatie
    // Sillons : lignes fines là où le bruit croise 0.5
    const n = fbm3(x * 4.6 + side * 7.3, y * 4.6, z * 4.6);
    const ridge = 1 - Math.abs(2 * n - 1);
    const disp = -0.05 * Math.pow(ridge, 12);
    pos.setXYZ(i, x + v.x * disp, y + v.y * disp, z + v.z * disp);
  }
  g.computeVertexNormals();
  return g;
}

function cerebellum() {
  const g = new THREE.SphereGeometry(1, 180, 120);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const x = CEREB.cx + v.x * CEREB.rx, y = CEREB.cy + v.y * CEREB.ry, z = CEREB.cz + v.z * CEREB.rz;
    let disp = -0.016 * Math.pow(0.5 + 0.5 * Math.sin(y * 75 + fbm3(x * 3, y * 3, z * 3) * 7), 3);
    if (Math.abs(x) < 0.05) disp -= 0.03 * (1 - Math.abs(x) / 0.05) * Math.max(0, v.y); // sillon du vermis
    pos.setXYZ(i, x + v.x * disp, y + v.y * disp, z + v.z * disp);
  }
  g.computeVertexNormals();
  return g;
}

function brainstem() {
  const pts = [];
  for (let k = 0; k <= 8; k++) pts.push(new THREE.Vector3(...brainstemPoint(k / 8)));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.11, 32, false);
}

export function buildShells() {
  const group = new THREE.Group();
  const cortexMat = shellMaterial('#5aa8ff', 0.28, 2.8);
  const cerebMat = shellMaterial('#7fd8c8', 0.26, 2.4);
  const stemMat = shellMaterial('#8fa3c0', 0.22, 2.4);
  group.add(new THREE.Mesh(hemisphere(-1), cortexMat));
  group.add(new THREE.Mesh(hemisphere(1), cortexMat));
  group.add(new THREE.Mesh(cerebellum(), cerebMat));
  group.add(new THREE.Mesh(brainstem(), stemMat));
  group.renderOrder = -1;
  group.userData.materials = [cortexMat, cerebMat, stemMat];
  return group;
}
