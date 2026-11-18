#!/usr/bin/env python3
"""関西春ロボコン 2027 "SAKURA AVENUE" のフィールド・オブジェクト・ロボットを MJCF (MuJoCo のモデル) で書き出す.

  python3 tools/harurobo2027_field.py [出力先]   (既定: publish_or_perish/models/harurobo2027/harurobo2027.xml)

フィールドの寸法は運営委員会のフィールド CAD (harurobo2027_field_v2.stp, 2026-11-18) から取った.
CAD のソリッドは Z に押し出した形なので, XY の格子で箱に分けて下の FIELD_BOXES にした (分けた箱の体積は CAD と一致).

座標
  CAD : 原点はフィールドの中心, 上が -Z (床板が Z 0〜10, 木枠が Z -89〜0) [mm].
  MJCF: x = -X, y = Y, z = -Z (Y 軸まわりに 180 度回す) [m]. x = 右 (赤 → 青), y = スタートゾーンから奥, z = 上.
        この向きで赤いテープが左に来て, ルールブックの図 2〜4 と同じ見え方になる.

オブジェクトの置き方はチームが決める (3.2). ここでは各ゾーンの中に並べた一例.
ゾーンは塗られていない (図 3 の注記) ので, 判定用に site (見た目なし) として持つ.
"""
import math
import sys
from pathlib import Path

TIMBER_H = 89.0       # 木枠の高さ [mm]
MARK_H = 0.5          # 床に貼る線の厚み. CAD は 1 mm だが, ロボットが乗り上げないよう見た目だけにする

# (種類, x0, x1, y0, y1) [mm, MJCF の向き]. CAD のソリッド番号はコメント
FIELD_BOXES = [
    ('floor', -3500, 3500, -3500, 3500),        # 0 床板 (CAD は厚さ 10)
    ('timber', -3500, 3500, -3500, -3462),      # 1 外周 + 梯子の下端 + エリア 1 の赤と青の境
    ('timber', 3462, 3500, -3462, 3462),
    ('timber', -19, 19, -3462, -2576),
    ('timber', -3500, -3462, -3462, 3462),
    ('timber', -150, 150, -2576, -2538),
    ('timber', -3500, 3500, 3462, 3500),
    ('timber', -1900, -1862, -1624, 148),       # 2 赤: 長い縦の木枠と, 外への出っ張り, 桜ゾーンの上の横
    ('timber', -2400, -1862, 148, 186),
    ('timber', -1900, -1862, 186, 2324),
    ('timber', -3462, -1862, 2324, 2362),
    ('timber', -3462, -2962, -890, -852),       # 3 赤: 外周から 500
    ('timber', -188, -150, -2576, -538),        # 4 梯子の左のレール (4・8 段目は白線まで伸びる)
    ('timber', -488, -150, -538, -500),
    ('timber', -188, -150, -500, 1462),
    ('timber', -488, -150, 1462, 1500),
    ('timber', -188, -150, 1500, 3462),
    ('timber', -3462, -2962, 1186, 1224),       # 5 赤: 桜ゾーンの下
    ('timber', -3462, -1862, -2762, -2724),     # 6 赤: エリア 1 と 2 の境
    ('timber', 1862, 1900, -1624, 148),         # 7 青 (2 の折り返し)
    ('timber', 1862, 2400, 148, 186),
    ('timber', 1862, 1900, 186, 2324),
    ('timber', 1862, 3462, 2324, 2362),
    ('timber', 2962, 3462, -890, -852),         # 8
    ('timber', 150, 188, -2576, -538),          # 9 梯子の右のレール
    ('timber', 150, 488, -538, -500),
    ('timber', 150, 188, -500, 1462),
    ('timber', 150, 488, 1462, 1500),
    ('timber', 150, 188, 1500, 3462),
    ('timber', 2962, 3462, 1186, 1224),         # 10
    ('timber', 1862, 3462, -2762, -2724),       # 11
    *[('timber', -150, 150, y, y + 38) for y in range(-2038, 2963, 500)],   # 12〜22 梯子の段 (11 本)
    ('line', -444, -294, -3193, -3143),         # 23 赤: サイコロを置く枠 (150 角, 線の幅 50)
    ('line', -344, -294, -3143, -3093),
    ('line', -444, -394, -3143, -3093),
    ('line', -444, -294, -3093, -3043),
    ('line', -3012, -2962, 2362, 3462),         # 24 赤: 除草剤ゾーンの横
    ('line', -719, -669, -3462, -2774),         # 25 赤: サイコロゾーンの横, エリア 1 と 2 の境, 雑草ゾーンの横
    ('line', -1862, -19, -2774, -2724),
    ('line', -488, -438, -2724, 3462),
    ('line', -3012, -2962, 1224, 2324),         # 26 赤: 桜ゾーンの横
    ('line', 294, 444, -3193, -3143),           # 27〜30 青 (折り返し)
    ('line', 394, 444, -3143, -3093),
    ('line', 294, 344, -3143, -3093),
    ('line', 294, 444, -3093, -3043),
    ('line', 2962, 3012, 2362, 3462),
    ('line', 669, 719, -3462, -2774),
    ('line', 19, 1862, -2774, -2724),
    ('line', 438, 488, -2724, 3462),
    ('line', 2962, 3012, 1224, 2324),
    ('tape_red', -2781, -2762, -3462, -2762),   # 31 スタートゾーンの境のテープ (幅 19)
    ('tape_blue', 2762, 2781, -3462, -2762),    # 32
]


def common_zone(n):
    """共通ゾーン n (1 = 手前, 12 = 奥) の y の範囲 [mm]. 梯子の段の下端は -2038 + 500 (k - 1)."""
    if n == 1:
        return -2538, -2038
    lower = -2000 + 500 * (n - 2)
    upper = 3462 if n == 12 else lower + 462
    return lower, upper


# 赤コートのゾーン (x0, x1, y0, y1) [mm]. 青は x を折り返す. 線の上は含めない
ZONES = {
    'start': (-3462, -2762, -3462, -2762),        # 700 x 700. テープ (幅 19) は内側の端に貼ってある
    'dice': (-669, -19, -3462, -2774),
    'dice_mark': (-444, -294, -3193, -3043),
    'herbicide': (-3462, -3012, 2362, 3462),
    'sakura': (-3462, -3012, 1224, 2324),
    'weed': (-438, -188, -2538, 3462),
    'area1': (-3462, -19, -3462, -2774),
    'area2': (-3462, -488, -2724, 3462),
}

# ボトル: 500 ml は φ68 x 213 mm (商品の表記). 1 L は単品の寸法が見つからないので,
# 15 本入りの箱 (幅 420 x 高さ 284 mm, 5 x 3 本) から φ82 x 275 mm と見積もった. 重さはどれも 150 g (2.1〜2.3)
BOTTLE_500 = dict(d=68.0, h=213.0)
BOTTLE_1000 = dict(d=82.0, h=275.0)
BOTTLE_MASS = 0.150
DICE = 150.0          # スポンジサイコロ 15 cm
DICE_MASS = 0.08      # 重さの記載なし. スポンジなので軽くしておく

# ロボット: 450 x 450 mm の全方向に動ける台車 (平面の 3 自由度を速度で動かす. 車輪は見た目だけ) と,
# 前のマストを上下するリフト, 前へ伸びるアーム, アームの先のハンド (ボトルを横 3 x 奥 2 に並べて最大 6 本つかむ.
# 並べた 6 本は 0.22 x 0.15 m で, 共通ゾーン 1 つ (0.30 x 0.462 m) に収まる).
#   初期制限 700 x 700 x 700 (8.4): アームを縮めると前後 0.57 m, 幅 0.45 m, 高さ 0.66 m
#   展開制限 1000 x 1000 x 1000 (8.5): アームを伸ばしきると前後 0.99 m
#   重量制限 20 kg (8.3) の中で 12 kg
# アームを伸ばしきると, ハンドの中心が機体の前端から 0.5 m 先に届く (エリア 2 の白線の外から共通ゾーンの中ほどまで).
# リフト 0 でハンドに持ったボトルの底が床から 5 mm. 木枠 (89 mm) を越えるにはリフトを 0.09 m 以上にする.
ROBOT = dict(size=450.0, mass=12.0, start=(-3112.0, -3112.0), yaw=math.pi / 2,
             extend=0.42, lift=0.35, hand_z=0.20)

def fmt(*v):
    return ' '.join('0' if abs(a) < 1e-9 else f'{a:.4f}'.rstrip('0').rstrip('.') for a in v)


def box(name, cls, x0, x1, y0, y1, z0, z1, extra=''):
    return (f'<geom name="{name}" class="{cls}" pos="{fmt((x0 + x1) / 2000, (y0 + y1) / 2000, (z0 + z1) / 2000)}" '
            f'size="{fmt((x1 - x0) / 2000, (y1 - y0) / 2000, (z1 - z0) / 2000)}"{extra}/>')


def build_field():
    geoms, count = [], {}
    for kind, x0, x1, y0, y1 in FIELD_BOXES:
        count[kind] = count.get(kind, 0) + 1
        name = f'{kind}_{count[kind]}'
        if kind == 'floor':
            geoms.append(box(name, 'floor', x0, x1, y0, y1, -10, 0))
        elif kind == 'timber':
            geoms.append(box(name, 'timber', x0, x1, y0, y1, 0, TIMBER_H))
        else:
            mat = 'field_line_white' if kind == 'line' else f'field_{kind}'
            geoms.append(box(name, 'mark', x0, x1, y0, y1, 0, MARK_H, f' material="{mat}"'))
    sites = []
    for side, s in (('red', 1), ('blue', -1)):
        for zone, (x0, x1, y0, y1) in ZONES.items():
            a, b = sorted((s * x0, s * x1))
            sites.append(site(f'{side}_{zone}', a, b, y0, y1))
    for n in range(1, 13):
        sites.append(site(f'common_{n}', -150, 150, *common_zone(n)))
    return geoms, sites


def site(name, x0, x1, y0, y1):
    return (f'<site name="{name}" class="zone" pos="{fmt((x0 + x1) / 2000, (y0 + y1) / 2000, 0.001)}" '
            f'size="{fmt((x1 - x0) / 2000, (y1 - y0) / 2000, 0.001)}"/>')


def inertia_cyl(m, r, h):
    ixx = m * (3 * r * r + h * h) / 12
    return ixx, ixx, m * r * r / 2


def bottle(name, x, y, spec, cap):
    """円柱 + 肩 + 口 + キャップの 4 つで近似したペットボトル. x, y は mm."""
    r, h = spec['d'] / 2000, spec['h'] / 1000
    body_h = h * 0.74
    return f'''    <body name="{name}" pos="{fmt(x / 1000, y / 1000, 0.0005)}">
      <freejoint/>
      <inertial pos="0 0 {fmt(h * 0.4)}" mass="{BOTTLE_MASS}" diaginertia="{fmt(*inertia_cyl(BOTTLE_MASS, r, h))}"/>
      <geom class="bottle" type="cylinder" size="{fmt(r, body_h / 2)}" pos="0 0 {fmt(body_h / 2)}"/>
      <geom class="bottle" type="cylinder" size="{fmt(r * 0.72, h * 0.06)}" pos="0 0 {fmt(body_h + h * 0.06)}"/>
      <geom class="bottle" type="cylinder" size="{fmt(r * 0.42, h * 0.035)}" pos="0 0 {fmt(body_h + h * 0.155)}"/>
      <geom class="bottle_cap" type="cylinder" size="{fmt(0.0155, h * 0.04)}" pos="0 0 {fmt(h - h * 0.04)}" material="{cap}"/>
    </body>'''


# サイコロの目の位置 (面の中の 3x3 の格子, -1〜1). 向かい合う目の和は 7. 上を 1 にして置く
PIPS = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)], 4: [(-1, -1), (-1, 1), (1, -1), (1, 1)],
        5: [(-1, -1), (-1, 1), (0, 0), (1, -1), (1, 1)], 6: [(-1, -1), (-1, 0), (-1, 1), (1, -1), (1, 0), (1, 1)]}
FACES = {1: (0, 0, 1), 6: (0, 0, -1), 2: (1, 0, 0), 5: (-1, 0, 0), 3: (0, 1, 0), 4: (0, -1, 0)}


def dice(name, x, y):
    s = DICE / 2000
    pips = []
    for n, normal in FACES.items():
        k = [i for i in range(3) if normal[i] != 0][0]
        axis = [i for i in range(3) if i != k]
        for u, v in PIPS[n]:
            p = [0.0, 0.0, 0.0]
            p[k] = normal[k] * s
            p[axis[0]], p[axis[1]] = u * s * 0.5, v * s * 0.5
            # 目は面に貼った薄い円柱. 円柱の軸 (z) を面の法線に向ける
            quat = {0: '0.7071 0 0.7071 0', 1: '0.7071 0.7071 0 0', 2: '1 0 0 0'}[k]
            mat, r = ('dice_pip_red', 0.016) if n == 1 else ('dice_pip', 0.011)
            pips.append(f'      <geom class="pip" type="cylinder" size="{fmt(r, 0.0006)}" pos="{fmt(*p)}" quat="{quat}" material="{mat}"/>')
    return f'''    <body name="{name}" pos="{fmt(x / 1000, y / 1000, s + 0.0005)}">
      <freejoint/>
      <inertial pos="0 0 0" mass="{DICE_MASS}" diaginertia="{fmt(*[DICE_MASS * (2 * s) ** 2 / 6] * 3)}"/>
      <geom class="dice" type="box" size="{fmt(s, s, s)}"/>
''' + '\n'.join(pips) + '\n    </body>'


def build_objects():
    out = []
    for side, s in (('red', 1), ('blue', -1)):
        # 桜ボトル 15 本: 桜ゾーン (450 x 1100) に 3 列 x 5 段. 段の間は 75 mm (ハンドの指の間隔. 3 本ずつつかめる)
        i = 0
        for y in (1624, 1699, 1774, 1849, 1924):
            for x in (-3387, -3237, -3087):
                i += 1
                out.append(bottle(f'{side}_sakura_{i}', s * x, y, BOTTLE_500, f'cap_{side}'))
        # 除草剤ボトル 5 本: 除草剤ゾーン (450 x 1100) に 1 列. 間は 75 mm
        for i, y in enumerate((2762, 2837, 2912, 2987, 3062), 1):
            out.append(bottle(f'{side}_herbicide_{i}', s * -3237, y, BOTTLE_500, 'cap_yellow'))
        # 雑草ボトル 3 本: 雑草ゾーン (幅 250) の中. 木枠に触れない位置 (3.2.2)
        for i, y in enumerate((2500, 500, -1500), 1):
            out.append(bottle(f'{side}_weed_{i}', s * -313, y, BOTTLE_1000, 'cap_white'))
        # サイコロ: 相手チームが自チームのサイコロゾーンの白線の枠に置く (3.2.3)
        out.append(dice(f'{side}_dice', s * -369, -3118))
    return '\n'.join(out)


def build_robot():
    r = ROBOT
    half = r['size'] / 2000
    m = r['mass']
    izz = m * (2 * half) ** 2 / 6
    wheels = []
    for i, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        wheels.append(f'      <geom name="robot_wheel_{i}" class="robot_visual" type="cylinder" size="0.04 0.018" '
                      f'pos="{fmt(sx * (half - 0.06), sy * (half - 0.02), 0.04)}" quat="0.7071 0.7071 0 0" material="robot_rubber"/>')
    mast_x = half - 0.03
    # ハンドの body の原点 = つかんだボトルの首の高さ. 指はボトルの左右を挟む位置に並べる (6 本分の 7 本)
    fingers = '\n'.join(
        f'            <geom class="robot_visual" type="box" size="0.07 0.006 0.03" pos="0 {fmt(y)} -0.01" material="robot_black"/>'
        for y in (-0.1125, -0.0375, 0.0375, 0.1125))
    x, y = (v / 1000 for v in r['start'])
    # 平面の 3 自由度は x, y のスライドを先に, 向きの回転を後に並べる (スライドの軸はワールドの x, y のまま)
    return f'''    <body name="robot" pos="{fmt(x, y, 0)}">
      <joint name="robot_x" type="slide" axis="1 0 0"/>
      <joint name="robot_y" type="slide" axis="0 1 0"/>
      <joint name="robot_yaw" type="hinge" axis="0 0 1"/>
      <inertial pos="0 0 0.12" mass="{m}" diaginertia="{fmt(izz, izz, izz)}"/>
      <!-- 当たり判定は台車だけ: 床から 10 mm 浮かせた箱 (高さは固定なので床とは当たらない). アームとハンドは当たらない -->
      <geom name="robot_body" type="box" size="{fmt(half, half, 0.1)}" pos="0 0 0.11" group="2" rgba="1 0.5 0 0.3"/>
      <geom name="robot_deck" class="robot_visual" type="box" size="{fmt(half, half, 0.015)}" pos="0 0 0.075" material="robot_aluminium"/>
      <geom name="robot_cover" class="robot_visual" type="box" size="{fmt(half - 0.07, half - 0.05, 0.06)}" pos="-0.04 0 0.15" material="robot_red"/>
      <geom name="robot_mast_l" class="robot_visual" type="box" size="0.015 0.015 0.3" pos="{fmt(mast_x, 0.13, 0.36)}" material="robot_aluminium"/>
      <geom name="robot_mast_r" class="robot_visual" type="box" size="0.015 0.015 0.3" pos="{fmt(mast_x, -0.13, 0.36)}" material="robot_aluminium"/>
      <geom name="robot_mast_top" class="robot_visual" type="box" size="0.015 0.145 0.015" pos="{fmt(mast_x, 0, 0.645)}" material="robot_aluminium"/>
      <geom name="robot_estop_base" class="robot_visual" type="box" size="0.035 0.035 0.02" pos="{fmt(-half + 0.08, 0.1, 0.23)}" material="robot_yellow"/>
      <geom name="robot_estop" class="robot_visual" type="cylinder" size="0.022 0.012" pos="{fmt(-half + 0.08, 0.1, 0.26)}" material="robot_estop"/>
      <site name="robot_beacon" pos="{fmt(-half + 0.08, -0.1, 0.25)}" size="0.03"/>
      <geom name="robot_beacon" class="robot_visual" type="cylinder" size="0.03 0.04" pos="{fmt(-half + 0.08, -0.1, 0.25)}" material="robot_beacon_off"/>
{chr(10).join(wheels)}
      <body name="robot_lift" pos="{fmt(mast_x, 0, r['hand_z'])}">
        <joint name="robot_lift" type="slide" axis="0 0 1" range="0 {fmt(r['lift'])}"/>
        <inertial pos="0 0 0" mass="0.8" diaginertia="0.01 0.01 0.01"/>
        <geom class="robot_visual" type="box" size="0.025 0.15 0.04" pos="0.025 0 0" material="robot_black"/>
        <body name="robot_arm" pos="0 0 0">
          <joint name="robot_extend" type="slide" axis="1 0 0" range="0 {fmt(r['extend'])}"/>
          <inertial pos="0 0 0" mass="0.6" diaginertia="0.01 0.01 0.01"/>
          <!-- 腕: 長さ 0.5 m の角パイプ. 縮めると機体の上に収まり, 伸ばすと前に出る -->
          <geom class="robot_visual" type="box" size="0.25 0.02 0.02" pos="-0.17 0 0.03" material="robot_aluminium"/>
          <body name="robot_hand" pos="0.08 0 0">
            <geom class="robot_visual" type="box" size="0.075 0.13 0.012" pos="0 0 0.03" material="robot_white"/>
{fingers}
            <site name="hand_center" pos="0.035 0 0" size="0.01"/>
          </body>
        </body>
      </body>
    </body>'''


TEMPLATE = '''<!--
  関西春ロボコン 2027 "SAKURA AVENUE" のフィールド・オブジェクト・ロボット.
  tools/harurobo2027_field.py が書き出したもの. 直すときはスクリプトを直して書き出し直す.
  寸法は運営委員会のフィールド CAD から. 座標・読み方はスクリプトの先頭を参照.
-->
<mujoco model="harurobo2027">
  <compiler angle="radian" autolimits="true"/>
  <option timestep="0.002" gravity="0 0 -9.81" integrator="implicitfast" cone="elliptic"/>

  <default>
    <geom friction="0.8 0.005 0.0001" solref="0.008 1"/>
    <!-- group 0 = 見た目兼衝突, 2 = 衝突専用 (描かない), 3 = 見た目専用. ゾーンの site は group 4 (描かない) -->
    <default class="floor">
      <geom type="box" group="0" material="field_linoleum"/>
    </default>
    <default class="timber">
      <geom type="box" group="0" material="field_timber"/>
    </default>
    <default class="mark">
      <geom type="box" group="3" contype="0" conaffinity="0" material="field_line_white"/>
    </default>
    <default class="zone">
      <site type="box" group="4" rgba="1 0.6 0.1 0.3"/>
    </default>
    <default class="bottle">
      <geom group="0" material="bottle_pet" friction="0.5 0.005 0.0001"/>
    </default>
    <default class="bottle_cap">
      <geom group="0"/>
    </default>
    <default class="dice">
      <geom group="0" material="dice_sponge" friction="1.0 0.01 0.001" solref="0.02 1"/>
    </default>
    <default class="pip">
      <geom group="3" contype="0" conaffinity="0"/>
    </default>
    <default class="robot_visual">
      <geom group="3" contype="0" conaffinity="0" density="0"/>
    </default>
  </default>

  <asset>
    <material name="field_linoleum" rgba="0.03 0.64 0 1" specular="0.1"/>
    <material name="field_timber" rgba="0.89 0.67 0.5 1" specular="0.1"/>
    <material name="field_line_white" rgba="0.96 0.96 0.94 1"/>
    <material name="field_tape_red" rgba="1 0 0 1"/>
    <material name="field_tape_blue" rgba="0 0 1 1"/>
    <material name="bottle_pet" rgba="0.85 0.93 0.98 0.45" specular="0.6" shininess="0.8"/>
    <material name="cap_red" rgba="0.88 0.12 0.12 1"/>
    <material name="cap_blue" rgba="0.12 0.25 0.88 1"/>
    <material name="cap_yellow" rgba="0.98 0.82 0.10 1"/>
    <material name="cap_white" rgba="0.95 0.95 0.95 1"/>
    <material name="dice_sponge" rgba="0.97 0.96 0.92 1"/>
    <material name="dice_pip" rgba="0.08 0.08 0.08 1"/>
    <material name="dice_pip_red" rgba="0.85 0.10 0.10 1"/>
    <material name="robot_aluminium" rgba="0.79 0.81 0.84 1"/>
    <material name="robot_red" rgba="0.91 0.38 0.25 1"/>
    <material name="robot_white" rgba="0.96 0.95 0.92 1"/>
    <material name="robot_rubber" rgba="0.18 0.2 0.22 1"/>
    <material name="robot_yellow" rgba="0.98 0.82 0.1 1"/>
    <material name="robot_estop" rgba="0.85 0.1 0.1 1"/>
    <material name="robot_black" rgba="0.2 0.22 0.24 1"/>
    <material name="robot_beacon_off" rgba="0.55 0.55 0.5 1"/>
  </asset>

  <visual>
    <headlight diffuse="0.3 0.3 0.3" ambient="0.45 0.45 0.45" specular="0.05 0.05 0.05"/>
    <quality shadowsize="4096"/>
    <global azimuth="90" elevation="-35" offwidth="1920" offheight="1080"/>
  </visual>

  <worldbody>
    <light name="top" diffuse="0.9 0.9 0.9" pos="0 0 8" dir="0 0 -1" castshadow="true"/>
    <body name="field">
{geoms}
{sites}
    </body>

{objects}

{robot}
  </worldbody>

  <actuator>
    <!-- 台車の速度. 指令はワールドの向きの速度 (シミュレーターのノードが機体の向きから変換する).
         力の上限で加速度が決まる: 120 N / 13.4 kg = 9 m/s^2 -->
    <velocity name="robot_vx" joint="robot_x" kv="600" forcerange="-120 120"/>
    <velocity name="robot_vy" joint="robot_y" kv="600" forcerange="-120 120"/>
    <velocity name="robot_wz" joint="robot_yaw" kv="30" forcerange="-15 15"/>
    <!-- リフトとアームは位置で動かす. 速さはシミュレーターのノードが目標を少しずつ動かして決める -->
    <position name="robot_lift" joint="robot_lift" kp="3000" dampratio="1" ctrlrange="0 {lift}"/>
    <position name="robot_extend" joint="robot_extend" kp="2000" dampratio="1" ctrlrange="0 {extend}"/>
  </actuator>
</mujoco>
'''


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'publish_or_perish/models/harurobo2027/harurobo2027.xml'
    geoms, sites = build_field()
    xml = TEMPLATE.format(geoms='\n'.join('      ' + g for g in geoms), sites='\n'.join('      ' + s for s in sites),
                          objects=build_objects(), robot=build_robot(),
                          lift=fmt(ROBOT['lift']), extend=fmt(ROBOT['extend']))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(xml)
    print(f'{out}: 床・木枠・線 {len(geoms)} 個, ゾーン {len(sites)} 個')


if __name__ == '__main__':
    main()
