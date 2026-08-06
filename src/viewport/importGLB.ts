/**
 * GLB hierarchy extraction (Phase 1.1   " goal.md   2, brief   2, audit S-1/S-2).
 * React-free (IL-3). Loads a GLB once at IMPORT time and emits:
 *  - one SceneNode per Object3D (mesh/group/camera/light) preserving the
 *    parent-child tree and every LOCAL transform (FR-130..133),
 *  - one library Material record PER MESH (FR-140..142): every mesh owns its
 *    own material id, so each mesh is independently editable (goal.md   2).
 *    Records are flagged `imported`; the runtime binds each record to a
 *    per-mesh clone of the source material, so embedded textures survive and
 *    editing one mesh never bleeds into siblings that shared a GLTF material.
 * Mesh nodes reference their source content by `assetId` + `subPath` (index
 * path inside gltf.scene)   " the runtime resolves geometry/material from a
 * cached one-time load and NEVER re-traverses per frame (Doc 13 Part 5).
 *
 * Root wrapper rule (ObjectHierarchy spec   1   " no artificial groups):
 *  - If gltf.scene has exactly ONE child that is itself a group/empty
 *    (i.e. not a bare standalone mesh), that child becomes the import root
 *    and normalization is applied directly to it. No wrapper is added.
 *  - Otherwise a wrapper group is inserted so that:
 *    (a) multiple top-level objects stay together as one import unit,
 *    (b) the whole import is one undo step (IL-1 / registerImportedScene).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { newNodeId, type Material, type SceneNode } from '@bs/engine';

export interface ExtractedScene {
  /** every node, children-before-parents; safe to register in one batch */
  nodes: SceneNode[];
  rootId: string;
  materials: Material[];
  stats: { meshes: number; groups: number; cameras: number; lights: number };
}

function lightKind(light: THREE.Light): string {
  if ((light as THREE.DirectionalLight).isDirectionalLight) return 'directional';
  if ((light as THREE.PointLight).isPointLight) return 'point';
  if ((light as THREE.SpotLight).isSpotLight) return 'spot';
  return 'hemisphere';
}

/** Build a human-readable path string from Object3D names, e.g. "sensor/Body/Bolt_04" */
function buildNamePath(obj: THREE.Object3D, ancestorPath: string): string {
  const segment = obj.name || obj.type;
  return ancestorPath ? `${ancestorPath}/${segment}` : segment;
}

export async function extractGlbScene(
  url: string,
  assetId: string,
  baseName: string,
): Promise<ExtractedScene> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const src = gltf.scene;

  // Normalization: center on origin, rest on ground, fit ~1.6 world units.
  // Applied either to the wrapper group or directly to the detected GLB root.
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
  const normPos: [number, number, number] = [
    -center.x * scale,
    -box.min.y * scale,
    -center.z * scale,
  ];

  const nodes: SceneNode[] = [];
  const materials: Material[] = [];
  const stats = { meshes: 0, groups: 0, cameras: 0, lights: 0 };

  /** One record PER MESH   " each mesh owns its own material id, even when the
   *  GLB shares one material across meshes (independent per-mesh editing). */
  let matCounter = 0;
  const materialRecordFor = (m: THREE.Material, ownerLabel: string): string => {
    matCounter++;
    const id = newNodeId('mat');
    const std = m as THREE.MeshStandardMaterial;
    let rawMatName = m.name ? m.name.replace(/M_[a-f0-9]{8}[-_][a-f0-9]{4}[-_][a-f0-9]{4}[-_][a-f0-9]{4}[-_][a-f0-9]{12}[-_]?/gi, '').replace(/M_[a-f0-9_-]{12,}[-_]?/gi, '').replace(/^Material_\d+\s*[- *]?\s*/gi, '').trim() : '';
    let name = rawMatName ? `${rawMatName}  * ${ownerLabel}` : `${ownerLabel} Material`;
    if (materials.some((x) => x.name === name)) name = `${name} #${matCounter}`;

    materials.push({
      id,
      name,
      baseColor: std.color ? `#${std.color.getHexString()}` : '#8a96b0',
      metallic: typeof std.metalness === 'number' ? std.metalness : 0,
      roughness: typeof std.roughness === 'number' ? std.roughness : 0.5,
      emissive: std.emissive ? `#${std.emissive.getHexString()}` : '#000000',
      emissiveIntensity: typeof std.emissiveIntensity === 'number' ? std.emissiveIntensity : 0,
      opacity: typeof m.opacity === 'number' ? m.opacity : 1,
      imported: true,
    });
    return id;
  };

  let counter = 0;

  /**
   * Walk one Object3D node, producing a SceneNode.
   * @param obj     The Three.js object.
   * @param subPath Index path used by the runtime to resolve geometry (e.g. "0/2/1").
   * @param namePath Human-readable name path for glbPath prop (e.g. "sensor/Body/Bolt_04").
   */
  const walk = (obj: THREE.Object3D, subPath: string, namePath: string): SceneNode => {
    // Structural optimization: collapse artificial groups that wrap a single mesh
    const isGroupNode = obj.type === 'Group' || obj.type === 'Object3D';
    if (isGroupNode && obj.children.length === 1 && (obj.children[0] as THREE.Mesh).isMesh) {
      const child = obj.children[0] as THREE.Mesh;
      const childSubPath = `${subPath}/0`;
      
      obj.updateMatrix();
      child.updateMatrix();
      const mergedMatrix = obj.matrix.clone().multiply(child.matrix);
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      mergedMatrix.decompose(pos, quat, scale);
      const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');

      counter++;
      stats.meshes++;
      const label = child.name || `mesh ${counter}`;
      const thisNamePath = buildNamePath(child, namePath);

      const node: SceneNode = {
        id: newNodeId('mesh'),
        label,
        type: 'mesh',
        visible: obj.visible && child.visible,
        locked: false,
        children: child.children.map((c, i) => walk(c, `${childSubPath}/${i}`, thisNamePath).id),
        transform: {
          position: [pos.x, pos.y, pos.z],
          rotation: [euler.x, euler.y, euler.z],
          scale: [scale.x, scale.y, scale.z],
        },
      };

      const mat = Array.isArray(child.material) ? child.material[0] : child.material;
      node.props = {
        assetId,
        subPath: childSubPath,
        materialId: mat ? materialRecordFor(mat, label) : '',
        castShadow: true,
        receiveShadow: true,
        glbPath: thisNamePath,
      };

      nodes.push(node);
      return node;
    }

    counter++;
    const isMesh = (obj as THREE.Mesh).isMesh === true;
    const isCam = (obj as THREE.Camera).isCamera === true;
    const isLight = (obj as THREE.Light).isLight === true;
    const type: SceneNode['type'] = isMesh
      ? 'mesh'
      : isCam
        ? 'camera'
        : isLight
          ? 'light'
          : 'group';

    if (type === 'mesh') stats.meshes++;
    else if (type === 'camera') stats.cameras++;
    else if (type === 'light') stats.lights++;
    else stats.groups++;

    const label = obj.name || `${type} ${counter}`;
    const thisNamePath = buildNamePath(obj, namePath);

    // Recurse children first so they are registered before their parent.
    const childIds = obj.children.map((c, i) =>
      walk(c, `${subPath}/${i}`, thisNamePath).id,
    );

    const node: SceneNode = {
      id: newNodeId(type),
      label,
      type,
      visible: obj.visible,
      locked: false,
      children: childIds,
      transform: {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      },
    };

    if (isMesh) {
      const mesh = obj as THREE.Mesh;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      node.props = {
        assetId,
        subPath,
        // per-mesh record: this mesh's OWN material id (never shared)
        materialId: mat ? materialRecordFor(mat, label) : '',
        castShadow: true,
        receiveShadow: true,
        // human-readable hierarchy path shown in the Layer panel
        glbPath: thisNamePath,
      };
    } else if (isCam) {
      const cam = obj as THREE.PerspectiveCamera;
      node.props = {
        fov: cam.fov ?? 50,
        near: cam.near ?? 0.1,
        far: cam.far ?? 100,
        active: false,
        glbPath: thisNamePath,
      };
    } else if (isLight) {
      const light = obj as THREE.Light;
      node.props = {
        kind: lightKind(light),
        intensity: typeof light.intensity === 'number' ? light.intensity : 1,
        color: `#${light.color.getHexString()}`,
        glbPath: thisNamePath,
      };
    } else {
      // group / empty
      node.props = { glbPath: thisNamePath };
    }

    nodes.push(node);
    return node;
  };

  //  "  "  Root wrapper decision (ObjectHierarchy   1   " no artificial groups)  "  "  "  "  "  " 
  // Use the GLB's own root when it has exactly one top-level child that is a
  // group/empty (i.e. not a lone bare mesh).  The normalization transform is
  // applied to that node in place.  When the scene has multiple top-level
  // objects, a wrapper group is inserted so the entire import is one undo unit.

  const topLevelChildren = src.children;
  const singleRealRoot =
    topLevelChildren.length === 1 &&
    !((topLevelChildren[0] as THREE.Mesh).isMesh === true);

  if (singleRealRoot) {
    // Walk the real GLB root directly   " no artificial wrapper.
    const glbRoot = topLevelChildren[0];
    const rootNode = walk(glbRoot, '0', '');

    // Apply normalization to the extracted root node in-place.
    rootNode.transform.position = normPos;
    rootNode.transform.scale = [scale, scale, scale];

    // Override label with baseName if the GLB root is unnamed.
    if (!glbRoot.name) rootNode.label = baseName;

    return { nodes, rootId: rootNode.id, materials, stats };
  }

  // Multiple top-level objects OR single bare mesh   ' wrap in a group.
  const childIds = topLevelChildren.map((c, i) => walk(c, `${i}`, '').id);
  const root: SceneNode = {
    id: newNodeId('group'),
    label: baseName,
    type: 'group',
    visible: true,
    locked: false,
    children: childIds,
    transform: {
      position: normPos,
      rotation: [0, 0, 0],
      scale: [scale, scale, scale],
    },
    props: { glbPath: baseName },
  };
  nodes.push(root);
  return { nodes, rootId: root.id, materials, stats };
}
