import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function box(width: number, height: number, depth: number, x = 0, y = height / 2, z = 0) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

function drum(radius: number, height: number, x = 0, y = height / 2, z = 0, sides = 12, topRadius = radius) {
  const geometry = new THREE.CylinderGeometry(topRadius, radius, height, sides);
  geometry.translate(x, y, z);
  return geometry;
}

function dome(radius: number, height: number, y: number) {
  const geometry = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  geometry.scale(radius, height, radius);
  geometry.translate(0, y, 0);
  return geometry;
}

function joined(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('Could not assemble Taris 2.0 architecture.');
  return geometry;
}

// Ten residential silhouettes followed by four civic/industrial landmarks.
// Each complete model is merged once, then drawn many times by InstancedMesh.
export function createTaris2BuildingModels() {
  return [
    joined([box(1, .68, 1), box(.76, .25, .76, 0, .80), box(.53, .13, .53, 0, .99)]),
    joined([drum(.46, .83, 0, .415, 0, 10), drum(.53, .045, 0, .85, 0, 12), drum(.28, .20, 0, .95, 0, 10, .14)]),
    joined([box(.85, .21, .82), box(.48, .67, .50, 0, .53), drum(.24, .25, 0, .97, 0, 8, .02)]),
    joined([box(1, .25, 1), box(.30, .70, .55, -.29, .58), box(.30, .70, .55, .29, .58), box(.9, .07, .4, 0, .75)]),
    joined([drum(.57, .34, 0, .17, 0, 6, .48), drum(.38, .62, 0, .65, 0, 6, .21), box(.8, .06, .8, 0, .39)]),
    joined([box(1, .31, 1), box(.84, .25, .84, 0, .43), box(.66, .23, .66, 0, .67), box(.43, .20, .43, 0, .89)]),
    joined([box(1, .38, .92), drum(.36, .44, 0, .57), dome(.34, .20, .80)]),
    joined([box(1, .29, 1), box(.5, .75, .6, 0, .62), box(.17, .49, .72, -.38, .50), box(.17, .49, .72, .38, .50)]),
    joined([box(.68, .94, .70), box(.10, .78, .10, -.39, .53, -.32), box(.10, .78, .10, .39, .53, -.32), box(.10, .78, .10, -.39, .53, .32), box(.10, .78, .10, .39, .53, .32)]),
    joined([box(.23, .89, .55, -.37, .445), box(.23, .89, .55, .37, .445), box(1, .17, .66, 0, .90), box(.46, .38, .55, 0, .20, -.18)]),
    joined([box(1.18, .22, 1.08), box(.52, .69, .55, 0, .55), box(.23, .47, .30, -.39, .46), box(.23, .47, .30, .39, .46), drum(.30, .13, 0, .96)]),
    joined([box(1.18, .38, .90), box(.93, .30, .72, 0, .52), drum(.40, .24, 0, .78, 0, 12, .16), box(.13, .42, .60, -.51, .57), box(.13, .42, .60, .51, .57)]),
    joined([drum(.56, .27), drum(.39, .46, 0, .50), dome(.37, .24, .72), drum(.08, .35, .25, .84, 0, 8)]),
    joined([box(1.18, .29, 1.14), box(.60, .72, .60, 0, .63), ...([-1, 1] as const).flatMap(x => ([-1, 1] as const).map(z => drum(.12, .56, x * .45, .47, z * .44, 8))), box(.78, .09, .78, 0, 1.02)]),
  ];
}

export function createTaris2PlazaModels() {
  const landingRing = new THREE.TorusGeometry(.43, .018, 4, 48);
  landingRing.rotateX(-Math.PI / 2);
  landingRing.translate(0, .15, 0);
  return [
    // Skyport: a round pad, shallow outer rim and four tall approach beacons.
    joined([
      drum(.55, .13, 0, .065, 0, 16), drum(.47, .035, 0, .145, 0, 16), landingRing,
      ...([-1, 1] as const).flatMap(x => ([-1, 1] as const).flatMap(z => [
        box(.032, 2.25, .032, x * .36, 1.25, z * .36),
        box(.055, .13, .055, x * .36, 2.45, z * .36),
      ])),
    ]),
    // Civic square: an open terrace with a central domed pavilion and pylons.
    joined([
      box(1, .13, 1), box(.52, .11, .52, 0, .16),
      drum(.19, .85, 0, .63), dome(.21, .15, 1.06),
      ...([-1, 1] as const).flatMap(x => ([-1, 1] as const).flatMap(z => [
        box(.065, 1.55, .065, x * .39, .85, z * .39),
        box(.12, .06, .12, x * .39, 1.64, z * .39),
      ])),
    ]),
    // Transit deck: stepped platforms and a long elevated terminal canopy.
    joined([
      box(1.2, .14, .76), box(.94, .06, .16, 0, .13, -.22),
      box(.94, .06, .16, 0, .13, 0), box(.94, .06, .16, 0, .13, .22),
      box(.46, 1.15, .22, 0, .66, -.25), box(.68, .08, .34, 0, 1.28, -.25),
      box(.055, 1.32, .055, -.43, .73, .2), box(.055, 1.32, .055, .43, .73, .2),
      box(.91, .07, .08, 0, 1.42, .2),
    ]),
  ];
}
