#!/usr/bin/env python3
"""MJCF (MuJoCo のモデル) から, ブラウザの画面で描くための形と配置を書き出す.

  python3 tools/mjcf_export.py <model.xml> <出力ディレクトリ>

出力:
  scene.json : body ごとの位置・向きと, そこに付く見た目の geom (形・大きさ・色・body から見た位置)
  meshes.bin : メッシュの頂点 (float32 xyz) と三角形 (uint32) を並べたもの. 位置は scene.json の meshes にある

部の MuJoCo 拡張 (fibril_sim のプラグイン) と, アクチュエータ・センサーの定義は見た目に関係ないので外して読む.
(部の MuJoCo は Python 版にない dcmotor などを使っているため)
`package://<pkg>/` は ROS の install の share に置き換える.
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import mujoco
import numpy as np

VISUAL_GROUPS = {0, 3}   # 0: 見た目兼衝突, 3: 見た目専用 (2 は衝突専用で描かない)


def share_dir(pkg):
    prefix = subprocess.run(['ros2', 'pkg', 'prefix', pkg], capture_output=True, text=True, check=True).stdout.strip()
    return Path(prefix) / 'share' / pkg


def prepare(src_xml: Path, work: Path) -> Path:
    """モデルのディレクトリと, その隣のメッシュを work にコピーし, プラグインと package:// を直す."""
    model_dir = src_xml.parent
    shutil.copytree(model_dir, work / model_dir.name)
    meshes = model_dir.parent / 'meshes'
    if meshes.exists():
        shutil.copytree(meshes, work / 'meshes')
    for f in (work / model_dir.name).glob('*.xml'):
        s = f.read_text()
        s = re.sub(r'<extension>.*?</extension>', '', s, flags=re.S)
        s = re.sub(r'<plugin\b[^>]*?/>', '', s)
        s = re.sub(r'<plugin\b.*?</plugin>', '', s, flags=re.S)
        s = re.sub(r'<(actuator|sensor)>.*?</\1>', '', s, flags=re.S)
        s = re.sub(r'<include file="package://fibril_sim_models/mujoco/actuator_presets.xml"/>', '', s)
        s = re.sub(r'package://([^/]+)/', lambda m: f'{share_dir(m.group(1))}/', s)
        f.write_text(s)
    return work / model_dir.name / src_xml.name


def main():
    src, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        xml = prepare(src, Path(tmp))
        m = mujoco.MjModel.from_xml_path(str(xml))
    d = mujoco.MjData(m)
    mujoco.mj_forward(m, d)

    blob = bytearray()
    meshes = []
    for i in range(m.nmesh):
        v0, nv = m.mesh_vertadr[i], m.mesh_vertnum[i]
        f0, nf = m.mesh_faceadr[i], m.mesh_facenum[i]
        verts = m.mesh_vert[v0:v0 + nv].astype(np.float32)
        faces = m.mesh_face[f0:f0 + nf].astype(np.uint32)
        meshes.append({'name': mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_MESH, i), 'vert_offset': len(blob), 'nvert': int(nv)})
        blob += verts.tobytes()
        meshes[-1].update({'face_offset': len(blob), 'nface': int(nf)})
        blob += faces.tobytes()

    geom_types = {int(k): v for k, v in {mujoco.mjtGeom.mjGEOM_MESH: 'mesh', mujoco.mjtGeom.mjGEOM_BOX: 'box',
                  mujoco.mjtGeom.mjGEOM_CYLINDER: 'cylinder', mujoco.mjtGeom.mjGEOM_SPHERE: 'sphere',
                  mujoco.mjtGeom.mjGEOM_CAPSULE: 'capsule', mujoco.mjtGeom.mjGEOM_ELLIPSOID: 'ellipsoid'}.items()}
    bodies = []
    for b in range(m.nbody):
        bodies.append({'name': mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_BODY, b) or f'body{b}',
                       'pos': d.xpos[b].round(5).tolist(), 'quat': d.xquat[b].round(6).tolist(), 'geoms': []})
    used = set()
    for g in range(m.ngeom):
        t = geom_types.get(int(m.geom_type[g]))
        if t is None or int(m.geom_group[g]) not in VISUAL_GROUPS or m.geom_rgba[g][3] == 0:
            continue
        mat = m.geom_matid[g]
        rgba = (m.mat_rgba[mat] if mat >= 0 else m.geom_rgba[g]).round(3).tolist()
        geom = {'name': mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_GEOM, g) or '', 'type': t, 'group': int(m.geom_group[g]),
                'size': m.geom_size[g].round(5).tolist(), 'pos': m.geom_pos[g].round(5).tolist(),
                'quat': m.geom_quat[g].round(6).tolist(), 'rgba': rgba,
                'material': mujoco.mj_id2name(m, mujoco.mjtObj.mjOBJ_MATERIAL, mat) if mat >= 0 else ''}
        if t == 'mesh':
            geom['mesh'] = int(m.geom_dataid[g])
            used.add(geom['mesh'])
        bodies[m.geom_bodyid[g]]['geoms'].append(geom)

    (out / 'meshes.bin').write_bytes(bytes(blob))
    scene = {'source': src.name, 'bodies': [b for b in bodies if b['geoms']], 'meshes': meshes}
    (out / 'scene.json').write_text(json.dumps(scene, ensure_ascii=False))
    tri = sum(meshes[i]['nface'] for i in used)
    print(f'{len(scene["bodies"])} bodies, {sum(len(b["geoms"]) for b in scene["bodies"])} geoms, '
          f'{len(used)} meshes, {tri} triangles, {len(blob) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
