import * as T from "three";
import { stations } from "./stations";

const palette = {
  wall: "#e5dfcc", side: "#d4d9c8", floor: "#c8ab87", wood: "#b2875d",
  edge: "#8b6243", paper: "#fffdf3", green: "#335d48", leaf: "#53745a",
  lightLeaf: "#829b6a", pot: "#ad7459", book: "#ad8261", lightBook: "#e8d7af",
  metal: "#38493e", rug: "#b6bca6", glass: "#d7e9d6", screen: "#294f40",
};
type Finish = keyof typeof palette;

/** Small procedural scene: no downloaded models, textures, or continuous render loop. */
export function buildOffice(scene: T.Scene) {
  const world = new T.Group();
  scene.add(world);
  const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, new T.MeshStandardMaterial({ color, roughness: 0.88 })])) as Record<Finish, T.MeshStandardMaterial>;
  materials.glass.emissive.set(palette.glass);
  materials.glass.emissiveIntensity = 0.3;
  materials.screen.emissive.set(palette.screen);
  materials.screen.emissiveIntensity = 0.25;

  function box(w: number, h: number, d: number, x: number, y: number, z: number, finish: Finish, group = world) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), materials[finish]);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  }
  function cylinder(top: number, bottom: number, height: number, x: number, y: number, z: number, finish: Finish, group = world) {
    const mesh = new T.Mesh(new T.CylinderGeometry(top, bottom, height, 20), materials[finish]);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  }
  function orb(x: number, y: number, z: number, sx: number, sy: number, sz: number, finish: Finish, group = world) {
    const mesh = new T.Mesh(new T.SphereGeometry(1, 16, 10), materials[finish]);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; group.add(mesh);
    return mesh;
  }
  function stem(a: number[], b: number[], radius: number, finish: Finish, group = world) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), direction = end.clone().sub(start);
    const mesh = cylinder(radius, radius, direction.length(), 0, 0, 0, finish, group);
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }
  box(10, 0.2, 9, 0, -0.13, -0.3, "floor");
  box(10, 5, 0.16, 0, 2.3, -4.8, "wall");
  box(0.16, 5, 9, -5, 2.3, -0.3, "side");
  box(10, 0.16, 0.12, 0, 0.03, -4.65, "paper");
  box(0.12, 0.16, 9, -4.85, 0.03, -0.3, "paper");
  for (let i = 0; i < 12; i++) box(0.012, 0.006, 8.8, -4.45 + i * 0.8, -0.023, -0.3, "wood");
  box(6.9, 0.025, 5.5, 0.15, 0.007, 0.5, "rug");

  box(3.4, 2.25, 0.12, 0.7, 3.15, -4.65, "paper");
  box(3.12, 1.98, 0.06, 0.7, 3.15, -4.56, "glass");
  box(0.065, 2, 0.08, 0.7, 3.15, -4.49, "paper");
  box(3.15, 0.065, 0.08, 0.7, 3.15, -4.49, "paper");
  box(3.75, 0.11, 0.45, 0.7, 1.99, -4.48, "paper");
  box(1.05, 1.4, 0.1, -2.6, 3.1, -4.64, "edge");
  box(0.88, 1.23, 0.05, -2.6, 3.1, -4.56, "paper");
  box(0.44, 0.42, 0.02, -2.6, 3.19, -4.52, "lightLeaf");
  box(0.24, 0.24, 0.025, -2.72, 2.83, -4.52, "pot");

  box(1.75, 3.1, 0.11, -3.9, 1.58, -4.45, "edge");
  box(0.1, 3.1, 0.75, -4.77, 1.58, -4.13, "wood");
  box(0.1, 3.1, 0.75, -3.03, 1.58, -4.13, "wood");
  const bookFinishes: Finish[] = ["green", "book", "lightBook", "paper"];
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 0.1 + shelf * 0.94;
    box(1.85, 0.09, 0.8, -3.9, y, -4.13, "wood");
    if (shelf < 3) for (let book = 0; book < 7; book++) {
      const height = 0.43 + ((book * 3 + shelf) % 4) * 0.075;
      box(0.13, height, 0.5, -4.58 + book * 0.22, y + 0.045 + height / 2, -4.08, bookFinishes[(book + shelf) % 4]);
    }
  }

  box(5, 0.19, 2.35, 0.1, 1.52, 0.25, "wood");
  for (const x of [-2.07, 2.27]) for (const z of [-0.68, 1.18]) box(0.13, 1.44, 0.13, x, 0.73, z, "metal");
  box(3.7, 0.18, 0.11, 0.1, 0.36, -0.66, "metal");
  box(0.72, 0.045, 0.44, 0.1, 1.65, -0.18, "metal");
  box(0.1, 0.45, 0.12, 0.1, 1.86, -0.24, "metal");
  box(1.7, 1.02, 0.11, 0.1, 2.29, -0.28, "metal");
  box(1.53, 0.86, 0.025, 0.1, 2.29, -0.207, "screen");
  for (let bar = 0; bar < 4; bar++) box(0.78 - bar * 0.09, 0.055, 0.015, -0.13, 2.49 - bar * 0.13, -0.186, "lightLeaf");
  box(1.15, 0.045, 0.42, 0.05, 1.655, 0.48, "paper");
  box(0.68, 0.045, 0.85, -1.7, 1.665, 0.68, "green");
  box(0.59, 0.025, 0.79, -1.68, 1.7, 0.68, "paper");
  box(0.025, 0.025, 0.57, -1.22, 1.66, 0.65, "metal");
  box(0.83, 0.045, 0.99, 1.42, 1.64, 0.49, "edge");
  for (const x of [1.02, 1.82]) box(0.045, 0.12, 0.99, x, 1.69, 0.49, "edge");
  for (let i = 0; i < 3; i++) box(0.66, 0.025, 0.79, 1.42, 1.68 + i * 0.025, 0.49, "paper").rotation.y = -0.12 + i * 0.09;
  box(0.67, 0.05, 0.53, 1.65, 1.69, -0.53, "book");
  box(0.62, 0.065, 0.48, 1.62, 1.75, -0.53, "green");
  cylinder(0.15, 0.13, 0.27, -1.09, 1.77, 0.67, "paper");
  orb(-0.9, 1.77, 0.67, 0.08, 0.065, 0.04, "paper");
  cylinder(0.32, 0.32, 0.035, -1.74, 1.66, -0.45, "metal");
  stem([-1.74, 1.68, -0.45], [-1.74, 2.45, -0.45], 0.035, "metal");
  stem([-1.74, 2.45, -0.45], [-1.31, 2.65, -0.45], 0.035, "metal");
  const shade = new T.Mesh(new T.ConeGeometry(0.3, 0.24, 20, 1, true), materials.green);
  shade.position.set(-1.28, 2.55, -0.45); shade.castShadow = true; world.add(shade);
  const taskLight = new T.PointLight(0xffe6b3, 3, 3, 2); taskLight.position.set(-1.28, 2.43, -0.45); world.add(taskLight);

  box(1.2, 0.18, 1.12, 0.1, 0.92, 2.05, "green");
  box(1.2, 1.13, 0.14, 0.1, 1.53, 2.56, "green");
  cylinder(0.075, 0.075, 0.64, 0.1, 0.53, 2.05, "metal");
  box(1.5, 0.065, 0.12, 0.1, 0.2, 2.05, "metal");
  box(0.12, 0.065, 1.5, 0.1, 0.2, 2.05, "metal");
  for (const x of [-0.6, 0.8]) { box(0.1, 0.48, 0.1, x, 1.17, 2.12, "metal"); box(0.12, 0.08, 0.9, x, 1.41, 2.02, "metal"); }
  for (const [x, z] of [[-0.6, 2.05], [0.8, 2.05], [0.1, 1.35], [0.1, 2.75]]) orb(x, 0.13, z, 0.1, 0.1, 0.1, "metal");

  box(2.05, 1.25, 0.76, 3.47, 0.66, -3.93, "paper");
  box(2.13, 0.1, 0.85, 3.47, 1.33, -3.93, "wood");
  box(0.025, 1.1, 0.025, 3.47, 0.68, -3.53, "wood");
  for (const x of [3.34, 3.6]) box(0.045, 0.18, 0.045, x, 0.84, -3.51, "metal");
  function plant(x: number, y: number, z: number, size: number) {
    const group = new T.Group(); group.position.set(x, y, z); group.scale.setScalar(size); world.add(group);
    cylinder(0.36, 0.26, 0.55, 0, 0.28, 0, "pot", group);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7, height = 0.85 + (i % 3) * 0.22;
      const end = [Math.cos(angle) * 0.3, height, Math.sin(angle) * 0.3];
      stem([0, 0.5, 0], end, 0.018, "green", group);
      const leaf = orb(end[0], end[1] + 0.12, end[2], 0.18, 0.38, 0.12, i % 2 ? "leaf" : "lightLeaf", group);
      leaf.rotation.z = -Math.cos(angle) * 0.5; leaf.rotation.x = Math.sin(angle) * 0.5;
    }
  }
  plant(3.9, 0, -1.65, 1.1); plant(3.9, 1.38, -3.91, 0.5);
  box(0.14, 1.62, 2.5, -4.84, 3.1, -0.3, "edge");
  box(0.04, 1.46, 2.32, -4.74, 3.1, -0.3, "paper");
  const laneFinishes: Finish[] = ["lightBook", "lightLeaf", "book"];
  for (let lane = 0; lane < 3; lane++) {
    box(0.025, 0.035, 0.62, -4.7, 3.63, -1.07 + lane * 0.76, "green");
    for (let card = 0; card < (lane === 0 ? 2 : 1); card++) box(0.035, 0.33, 0.55, -4.69, 3.3 - card * 0.43, -1.07 + lane * 0.76, laneFinishes[lane]);
  }

  scene.add(new T.HemisphereLight(0xfff8e5, 0x7b866c, 2.7));
  const sun = new T.DirectionalLight(0xfff0d0, 3.8);
  sun.position.set(-3, 8, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0001; scene.add(sun);
  const fill = new T.DirectionalLight(0xe7f0e4, 1.5); fill.position.set(6, 4, -1); scene.add(fill);

  const hitRegions = stations.map(station => {
    const mesh = new T.Mesh(new T.SphereGeometry(station.href === "/leads" ? 0.65 : 0.42, 12, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    mesh.position.set(...station.anchor); mesh.userData.href = station.href; scene.add(mesh);
    return mesh;
  });

  return { hitRegions, dispose: () => {
    const geometries = new Set<T.BufferGeometry>(), usedMaterials = new Set<T.Material>();
    scene.traverse(object => { if (object instanceof T.Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) usedMaterials.add(material); } });
    geometries.forEach(geometry => geometry.dispose()); usedMaterials.forEach(material => material.dispose()); sun.shadow.dispose();
  } };
}
