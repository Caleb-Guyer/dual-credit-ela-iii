import * as T from 'three';

export type FaceExpression = 'neutral' | 'curious' | 'thoughtful' | 'warm' | 'doubtful';
export type FaceCue = {
  expression: FaceExpression;
  openness: number;
  /** One is an open eye; zero is the brief closed part of a blink. */
  blink: number;
  gazeX: number;
  gazeY: number;
  intensity: number;
};

type Material = (color: string, cloth?: boolean) => T.MeshStandardMaterial;
type Eye = {
  side: number;
  group: T.Group;
  pupil: T.Mesh;
  glint: T.Mesh;
  upper: T.Mesh;
  lower: T.Mesh;
  brow: T.Mesh;
};

const oval = new T.SphereGeometry(1, 12, 8);
const lipSegments = 12;
const expressions: FaceExpression[] = ['neutral', 'curious', 'thoughtful', 'warm', 'doubtful'];

/** A shallow ribbon makes a lip seam that can bend, rather than a scaled round hole. */
function lipRibbon() {
  const geometry = new T.BufferGeometry();
  const positions = new Float32Array((lipSegments + 1) * 6);
  const normals = new Float32Array(positions.length);
  const indices: number[] = [];
  for (let index = 0; index <= lipSegments; index++) {
    normals[index * 6 + 2] = normals[index * 6 + 5] = 1;
    if (index < lipSegments) {
      const vertex = index * 2;
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
    }
  }
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new T.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  // The mouth's small deformation always remains inside this fixed local bound.
  geometry.boundingSphere = new T.Sphere(new T.Vector3(0, -0.068, 0.156), 0.06);
  return geometry;
}

/** Small, independently posed features retain the wooden-figure style of the townspeople. */
export function createConversationFace(
  head: T.Group,
  skin: string,
  hair: string,
  material: Material,
) {
  const group = new T.Group();
  group.name = 'Conversation face';
  head.add(group);
  const animated: T.Mesh[] = [];
  const feature = (
    parent: T.Object3D,
    name: string,
    color: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    const mesh = new T.Mesh(oval, material(color));
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    parent.add(mesh);
    animated.push(mesh);
    return mesh;
  };
  const lidColor = new T.Color(skin).lerp(new T.Color('#58463a'), 0.22).getStyle();
  const lipColor = new T.Color(skin).lerp(new T.Color('#76524a'), 0.27).getStyle();
  const eyes: Eye[] = [];
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'Left' : 'Right';
    const eye = new T.Group();
    eye.name = `${name} eye`;
    eye.position.set(side * 0.054, 0.056, 0.136);
    group.add(eye);
    // Warm, narrow whites leave the pupil as the dominant part of the eye.
    feature(eye, `${name} eye white`, '#c6c5af', 0, 0, 0, 0.0205, 0.0115, 0.008);
    const pupil = feature(eye, `${name} pupil`, '#293b37', 0, 0, 0.007, 0.0105, 0.0105, 0.0033);
    const glint = feature(
      eye,
      `${name} eye light`,
      '#d5d6bb',
      -0.0028,
      0.0038,
      0.0101,
      0.002,
      0.002,
      0.001,
    );
    const upper = feature(
      group,
      `${name} upper eyelid`,
      lidColor,
      side * 0.054,
      0.067,
      0.143,
      0.021,
      0.0018,
      0.004,
    );
    const lower = feature(
      group,
      `${name} lower eyelid`,
      lidColor,
      side * 0.054,
      0.045,
      0.143,
      0.02,
      0.0015,
      0.004,
    );
    const brow = feature(
      group,
      `${name} eyebrow`,
      hair,
      side * 0.054,
      0.088,
      0.138,
      0.022,
      0.0045,
      0.005,
    );
    eyes.push({ side, group: eye, pupil, glint, upper, lower, brow });
  }
  const mouthGeometry = lipRibbon();
  const mouth = new T.Mesh(mouthGeometry, material('#60483e'));
  mouth.name = 'Conversation mouth';
  group.add(mouth);
  animated.push(mouth);
  const lowerLipGeometry = lipRibbon();
  const lowerLip = new T.Mesh(lowerLipGeometry, material(lipColor));
  lowerLip.name = 'Lower lip';
  group.add(lowerLip);
  animated.push(lowerLip);
  const mouthPoints = mouthGeometry.getAttribute('position') as T.BufferAttribute;
  const lipPoints = lowerLipGeometry.getAttribute('position') as T.BufferAttribute;
  const weights = { neutral: 1, curious: 0, thoughtful: 0, warm: 0, doubtful: 0 };
  let openness = 0;
  let gazeX = 0;
  let gazeY = 0;
  let intensity = 0;

  const update = (cue: FaceCue, dt: number) => {
    const delta = T.MathUtils.clamp(dt, 0, 0.2);
    for (const expression of expressions)
      weights[expression] = T.MathUtils.damp(
        weights[expression],
        cue.expression === expression ? 1 : 0,
        8,
        delta,
      );
    intensity = T.MathUtils.damp(intensity, T.MathUtils.clamp(cue.intensity, 0, 1), 8, delta);
    openness = T.MathUtils.damp(openness, T.MathUtils.clamp(cue.openness, 0, 1), 23, delta);
    gazeX = T.MathUtils.damp(gazeX, T.MathUtils.clamp(cue.gazeX, -1, 1), 11, delta);
    gazeY = T.MathUtils.damp(gazeY, T.MathUtils.clamp(cue.gazeY, -1, 1), 11, delta);
    const warm = weights.warm * intensity;
    const doubtful = weights.doubtful * intensity;
    const thoughtful = weights.thoughtful * intensity;
    const curious = weights.curious * intensity;
    const blink = T.MathUtils.clamp(cue.blink, 0, 1);
    const aperture = blink * (1 - warm * 0.2 - doubtful * 0.18 - thoughtful * 0.12);
    for (const eye of eyes) {
      const side = eye.side;
      eye.group.scale.y = Math.max(0.025, aperture);
      eye.pupil.position.x = gazeX * 0.005;
      eye.pupil.position.y = gazeY * 0.0035;
      eye.glint.position.x = eye.pupil.position.x - 0.0028;
      eye.glint.position.y = eye.pupil.position.y + 0.0038;
      eye.upper.position.y = 0.056 + 0.011 * aperture;
      eye.lower.position.y = 0.056 - 0.011 * aperture;
      eye.upper.rotation.z = side * (doubtful * 0.1 - curious * 0.05);
      eye.brow.position.y =
        0.088 +
        curious * (side < 0 ? 0.012 : 0.008) +
        warm * 0.004 -
        doubtful * 0.003 +
        thoughtful * (side < 0 ? 0.005 : -0.002);
      eye.brow.rotation.z =
        side * (-0.06 - warm * 0.08 - curious * 0.06 + doubtful * 0.22) + thoughtful * 0.09;
    }
    const smile = warm * 0.01 - doubtful * 0.005 + curious * 0.002;
    const halfWidth = 0.026 + warm * 0.006 - thoughtful * 0.002 - openness * 0.003;
    const opening = openness * 0.025;
    for (let index = 0; index <= lipSegments; index++) {
      const t = (index / lipSegments) * 2 - 1;
      const taper = Math.pow(Math.max(0, 1 - t * t), 0.7);
      const x = t * halfWidth;
      const curve = -0.068 + smile * (t * t - 0.35) + thoughtful * t * 0.0015;
      const thickness = 0.0016 * (0.4 + taper * 0.6);
      const upper = curve + thickness + opening * taper * 0.36;
      const lower = curve - thickness - opening * taper * 0.64;
      const z = 0.156 + (1 - t * t) * 0.001;
      mouthPoints.setXYZ(index * 2, x, upper, z);
      mouthPoints.setXYZ(index * 2 + 1, x, lower, z);
      lipPoints.setXYZ(index * 2, x, lower - 0.0005, z + 0.0004);
      lipPoints.setXYZ(index * 2 + 1, x, lower - 0.0024 * taper - 0.0005, z + 0.0004);
    }
    mouthPoints.needsUpdate = lipPoints.needsUpdate = true;
    group.userData.expression = cue.expression;
    group.userData.openness = openness;
    group.userData.blink = blink;
    group.userData.gazeX = gazeX;
    group.userData.gazeY = gazeY;
    group.userData.intensity = intensity;
  };
  update({ expression: 'neutral', openness: 0, blink: 1, gazeX: 0, gazeY: 0, intensity: 0 }, 0);
  return { group, animated, update };
}
