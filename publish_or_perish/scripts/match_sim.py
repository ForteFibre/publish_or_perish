#!/usr/bin/env python3
"""大会モードのシミュレーター. MuJoCo でフィールド・オブジェクト・ロボットを動かし, 練習の課題と試合を判定する.

  ros2 run publish_or_perish match_sim.py --ros-args -p model:=<MJCF>

ロボット (赤コート): 台車 + マストを上下するリフト + 前へ伸びるアーム + ボトルを横 3 x 奥 2 に並べてつかむハンド.

モード (画面で選ぶ)
  free    自由走行. 時間も課題もない
  course  練習. 手動 → 半自動 → 自動 の順に課題を済ませる. 進み具合は ~/.publish_or_perish/match_course.json
  match   試合. セッティング 60 秒 → 試合 180 秒. 得点を数える

自分のノードから使うもの
  /robot/cmd_vel        geometry_msgs/msg/Twist   受ける  台車の速度 (機体座標, x 前 / y 左 [m/s], z まわり [rad/s]). 0.5 秒途切れると止まる
  /robot/arm/extend     std_msgs/msg/Float64      受ける  アームの伸びの目標 [m] (0〜0.42). 0.4 m/s で近づく
  /robot/arm/lift       std_msgs/msg/Float64      受ける  リフトの高さの目標 [m] (0〜0.35). 0.3 m/s で近づく
  /robot/arm/extend_now std_msgs/msg/Float64      出す    今のアームの伸び [m]
  /robot/arm/lift_now   std_msgs/msg/Float64      出す    今のリフトの高さ [m]
  /robot/pose           geometry_msgs/msg/Pose    出す    台車の位置 [m] と向き (z 軸まわりのクォータニオン). 原点はフィールドの中心, x 右 (赤 → 青), y 奥
  /robot/carrying       std_msgs/msg/Int32        出す    持っているボトルの本数
  /robot/dice_top       std_msgs/msg/Int32        出す    自チームのサイコロの上の目 (サイコロゾーンの外なら 0)
  /operator/button      std_msgs/msg/Int32        出す    画面で数字キー (1〜4) を押したときにその数 (半自動で使う)
  /robot/status         std_msgs/msg/String       出す    上のまとめ (JSON)
  service (std_srvs/srv/Trigger. 結果は response の message に英語で返す. 文は訳の表 share/publish_or_perish/i18n/en.json)
    /robot/grab    ハンドの前のボトル (自チームの桜ボトルと除草剤ボトル) をつかむ. 持てるのはサイコロの目の数まで (5.4)
    /robot/place   ハンドの真ん中のボトルを, 今の高さで離す (下ろしてから離すと倒れにくい)
    /robot/throw   持っている除草剤ボトルを 1 本, 前へ投げる
    /robot/dice    ハンドの前のサイコロを前へ 1 面転がす
    /robot/signal  合図 (満開宣言) の灯りを付ける / 消す
    /match/start   試合を始める (セッティング中に呼ぶと飛ばす) / /match/retry リトライ / /match/reset 最初の位置に戻す
  /match/status         std_msgs/msg/String       出す    モード・残り時間・得点の内訳・練習の課題 (JSON)

画面とのやりとり (自分のノードからは使わない)
  /match/ui     std_msgs/msg/String  受ける  キーの操作 ("drive vx vy wz", "arm extend 0.3", "act grab", "button 1", "mode course" など)
  /match/state  std_msgs/msg/String  出す    動く物の位置と向き, 状態 (JSON). 文言はキーと値 (訳の表の match.*) で送り, 画面が訳す
キーの操作は /match/ui で受けるので, 判定では「キー」と「CLI (ros2 topic pub など)」と「自分のノード」を分けられる.

判定 (赤コートの 1 チームで遊ぶ. ルールブック ver.1.0.1 の 3.6〜3.8, 5)
  A エリア 2 に初めて進入 10 点 / B サイコロの目を初めて変える 20 点 / C 共通ゾーンに完全に接地した桜ボトル 1 本 30 点
  D 雑草ゾーンに完全に接地していない雑草ボトル 1 本 -15 点 / E 五分咲き 90 点 / F 満開 180 点
  桜ボトルは, 置いたときに 下の番号の共通ゾーンが全部埋まっている・自分の雑草ボトルが全部立っている・(12 番は) 五分咲き
  のときだけ数える. 満開の状態で合図をすると満開宣言. 相手のコートに入ると強制リトライ (試合では止まる).

物理は実時間に合わせて進める (重くて追いつかないときは遅れる). MuJoCo は Python 版 (pip の mujoco) を使う.
"""
import json
import math
import os
import time

import mujoco
import numpy as np
import rclpy
from ament_index_python.packages import get_package_share_directory
from geometry_msgs.msg import Point, Pose, Quaternion, Twist
from rclpy.executors import ExternalShutdownException
from rclpy.node import Node
from std_msgs.msg import Float64, Int32, String
from std_srvs.srv import Trigger


def load_messages():
    """英語の訳の表を, . でつないだキー → 文 の辞書にする."""
    path = os.path.join(get_package_share_directory('publish_or_perish'), 'i18n', 'en.json')
    with open(path, encoding='utf-8') as f:
        tree = json.load(f)
    flat = {}

    def walk(prefix, node):
        for k, v in node.items():
            key = f'{prefix}.{k}' if prefix else k
            walk(key, v) if isinstance(v, dict) else flat.__setitem__(key, v)
    walk('', tree)
    return flat


EN = load_messages()


def msg(key, **args):
    """文言をキーと値で表す (画面に送る形). 値は文字列にしておく. msg の形の値は, それ自体を訳す文."""
    return {'key': key, 'args': {k: v if isinstance(v, dict) else str(v) for k, v in args.items()}}


def render_en(m):
    """英語の文にする. 表にないキーはキーのまま. {{名前}} を値で置き換える (i18next と同じ書き方)."""
    text = EN.get(m['key'], m['key'])
    for k, v in m['args'].items():
        text = text.replace('{{' + k + '}}', render_en(v) if isinstance(v, dict) else v)
    return text


MAX_LINEAR = 2.0         # [m/s]
MAX_ANGULAR = 3.0        # [rad/s]
CMD_TIMEOUT = 0.5        # [s]
START_YAW = math.pi / 2  # スタートゾーンで奥 (+y) を向く
EXTEND_MAX, LIFT_MAX = 0.42, 0.35
EXTEND_SPEED, LIFT_SPEED = 0.4, 0.3   # [m/s]
SETTING_SEC, MATCH_SEC = 60.0, 180.0  # 3.2.1, 1 試合 3 分
POINTS = {'A': 10, 'B': 20, 'C': 30, 'D': -15, 'E': 90, 'F': 180}   # 項目の名前は訳の表の match.item.<記号>
BEST_PATH = os.path.expanduser('~/.publish_or_perish/match_best.json')
COURSE_PATH = os.path.expanduser('~/.publish_or_perish/match_course.json')
UI_TIMEOUT = 0.3         # キーの走行指令が途切れたら止める [s]
BUTTON_WINDOW = 6.0      # ボタンを押してから, この秒数の間の動きを「ボタンで動いた」とみなす

# 練習の課題. 段階ごとに順番に済ませる. 説明は web/public/guide/<言語>/<id>.md,
# 段階の名前は訳の表の match.level.<段階>, 課題の題は match.task.<id>
COURSE = [
    ('manual', ['m_exit', 'm_dice', 'm_grab', 'm_place', 'm_half', 'm_bloom']),
    ('semi', ['s_button', 's_grab', 's_place', 's_dice', 's_bloom']),
    ('auto', ['a_exit', 'a_dice', 'a_place', 'a_bloom']),
]
# 送り手の名前は訳の表の match.src.<送り手> (keyboard / cli / player)
SOURCES = ('keyboard', 'cli', 'player')
# 判定で「自分のノード」に数えないノード (画面の中継, ツール, このシミュレーター)
TOOL_PREFIXES = ('match_sim', 'rosbridge', 'rosapi', 'rviz', 'rqt', 'rosbag2', 'launch_ros_', 'transform_listener_impl', '_ros2cli_daemon')

HOLD_DROP = 0.195        # ハンドの原点 (ボトルの首) からボトルの底まで [m]
# ハンドの中で並べる位置 (ハンドの中心から 前, 左) [m]. 横 3 x 奥 2. 6 本で 0.22 x 0.15 m (共通ゾーン 1 つに収まる)
SLOTS = [(0.0, 0.0), (0.0, 0.075), (0.0, -0.075), (-0.075, 0.0), (-0.075, 0.075), (-0.075, -0.075)]
GRAB_DX = (-0.05, 0.07)  # つかめる範囲: ハンドの中心から前後 [m]
GRAB_DY = 0.11           # 左右 [m] (指 4 本の間の 3 か所)
GRAB_LIFT = 0.03         # リフトがこれより低いときだけつかめる [m]
TIMBER_H = 0.089
DICE_REACH = 0.2         # サイコロに届く距離 (ハンドの中心から水平に) [m]
THROW_V = (3.5, 2.5)     # 投げる速さ (前, 上) [m/s]
# サイコロの面の向き (サイコロの座標) と目. 生成スクリプト (tools/harurobo2027_field.py) の FACES と同じ
DICE_FACES = {1: (0, 0, 1), 6: (0, 0, -1), 2: (1, 0, 0), 5: (-1, 0, 0), 3: (0, 1, 0), 4: (0, -1, 0)}


def yaw_quat(yaw):
    return np.array([math.cos(yaw / 2), 0, 0, math.sin(yaw / 2)])


class MatchSim(Node):
    def __init__(self):
        super().__init__('match_sim')
        default_model = os.path.join(get_package_share_directory('publish_or_perish'), 'models/harurobo2027/harurobo2027.xml')
        path = self.declare_parameter('model', default_model).value
        self.side = 'red'
        m = self.m = mujoco.MjModel.from_xml_path(path)
        self.d = mujoco.MjData(m)
        jadr = lambda n: m.jnt_qposadr[m.joint(n).id]
        self.yaw_adr, self.ext_adr, self.lift_adr = jadr('robot_yaw'), jadr('robot_extend'), jadr('robot_lift')
        self.act = {n: m.actuator(n).id for n in ('robot_vx', 'robot_vy', 'robot_wz', 'robot_lift', 'robot_extend')}
        self.robot_id = m.body('robot').id
        self.hand_site = m.site('hand_center').id
        # 画面に送る物: ロボットの body と, freejoint を持つオブジェクト
        robot_bodies = {b for b in range(m.nbody) if m.body(b).name.startswith('robot')}
        self.free = {m.body(b).name: b for b in range(m.nbody)
                     if m.body_jntnum[b] > 0 and m.jnt_type[m.body_jntadr[b]] == mujoco.mjtJoint.mjJNT_FREE}
        self.moving = sorted(robot_bodies | set(self.free.values()))
        self.grabbable = [n for n in self.free if n.startswith(f'{self.side}_sakura') or n.startswith(f'{self.side}_herbicide')]
        # 木枠の箱 (持っているボトルが当たるかを見る). (中心 xy, 半分の大きさ xy)
        self.timbers = [(m.geom_pos[g][:2].copy(), m.geom_size[g][:2].copy()) for g in range(m.ngeom)
                        if (m.geom(g).name or '').startswith('timber')]
        self.contype = m.geom_contype.copy()
        self.conaff = m.geom_conaffinity.copy()
        zone = m.site(f'{self.side}_dice')
        self.dice_zone = (m.site_pos[zone.id][:2].copy(), m.site_size[zone.id][:2].copy())
        # ゾーンの長方形 (中心 xy, 半分の大きさ xy)
        self.rect = {m.site(i).name: (m.site_pos[i][:2].copy(), m.site_size[i][:2].copy()) for i in range(m.nsite)}
        self.sakura = [n for n in self.free if n.startswith(f'{self.side}_sakura')]
        self.weeds = [n for n in self.free if n.startswith(f'{self.side}_weed')]
        self.mode = 'free'        # free (自由走行) / course (練習) / match (試合)
        self.phase = 'ready'      # 試合の段階: ready (始める前) / setting / match / finished
        self.phase_t = 0.0
        self.best = self.load_json(BEST_PATH)
        self.course = self.load_json(COURSE_PATH)   # 済んだ課題の id -> 済んだ日時
        self.ui_cmd, self.ui_time = (0.0, 0.0, 0.0), -1.0
        self.reset()

        self.cmd = (0.0, 0.0, 0.0)
        self.cmd_time = -1.0
        self.create_subscription(Twist, '/robot/cmd_vel', self.on_cmd, 10)
        self.create_subscription(Float64, '/robot/arm/extend', lambda m: self.on_arm('extend', m.data), 10)
        self.create_subscription(Float64, '/robot/arm/lift', lambda m: self.on_arm('lift', m.data), 10)
        self.create_subscription(String, '/match/ui', self.on_ui, 10)
        self.button_pub = self.create_publisher(Int32, '/operator/button', 10)
        self.now_pub = {k: self.create_publisher(Float64, f'/robot/arm/{k}_now', 10) for k in ('extend', 'lift')}
        self.carrying_pub = self.create_publisher(Int32, '/robot/carrying', 10)
        self.dice_pub = self.create_publisher(Int32, '/robot/dice_top', 10)
        self.src_cache = {}
        self.pose_pub = self.create_publisher(Pose, '/robot/pose', 10)
        self.status_pub = self.create_publisher(String, '/robot/status', 10)
        self.state_pub = self.create_publisher(String, '/match/state', 10)
        self.match_pub = self.create_publisher(String, '/match/status', 10)
        self.actions = {'grab': self.grab, 'place': self.place, 'throw': self.throw, 'dice': self.roll_dice, 'signal': self.toggle_signal}
        for name, fn in [(f'/robot/{k}', f) for k, f in self.actions.items()] + [
                ('/match/reset', self.on_reset), ('/match/start', self.start), ('/match/retry', self.retry)]:
            self.create_service(Trigger, name, self.service(name, fn))
        self.create_timer(0.01, self.step)        # 物理を進める
        self.create_timer(1 / 30, self.publish)   # 画面・/robot/pose・/robot/status は 30 Hz
        self.get_logger().info(render_en(msg('match.loaded', path=path, bodies=m.nbody, geoms=m.ngeom)))

    # ------------------------------------------------------------ 状態
    def reset(self):
        mujoco.mj_resetData(self.m, self.d)
        self.d.qpos[self.yaw_adr] = START_YAW
        self.m.geom_contype[:] = self.contype
        self.m.geom_conaffinity[:] = self.conaff
        mujoco.mj_forward(self.m, self.d)
        self.target = {'extend': 0.0, 'lift': 0.0}
        self.ctrl = {'extend': 0.0, 'lift': 0.0}
        self.carried = []       # 持っているボトルの名前 (並び = SLOTS の順)
        self.signal = False
        self.last_action = None   # 最後の操作の結果 (msg の形). 画面が訳す
        self.last_ok = True       # その操作がうまくいったか
        self.t0 = time.monotonic()
        # 判定
        self.got = {'A': False, 'B': False, 'E': False, 'F': False}
        self.dice0 = self.dice_top()
        self.placed = {}          # 桜ボトルの名前 -> (共通ゾーンの番号, 数えるか)
        self.stopped = None       # 強制リトライで止めている理由 (msg の形)
        self.message = None       # 画面に大きく出す知らせ (msg の形)
        self.result = None
        self.declared = False     # 満開宣言をした (練習で使う)
        # この回 (最後に最初の位置に戻してから) の操作. 練習の自動・半自動の判定に使う
        self.run = {'drive': set(), 'mech': set(), 't0': self.d.time}
        self.events = []          # (時刻, 種類, 送り手, 中身)
        self.course_note = None   # いまの課題が済まない理由 (msg の形)

    def set_target(self, key, value):
        if self.frozen():
            return
        hi = EXTEND_MAX if key == 'extend' else LIFT_MAX
        self.target[key] = max(0.0, min(hi, float(value)))

    def robot_yaw(self):
        y = self.d.qpos[self.yaw_adr]
        return math.atan2(math.sin(y), math.cos(y))

    def to_robot(self, p):
        """ワールドの点 p (xy) を, ハンドの中心から見た機体の向きの座標 (前, 左) にする."""
        h = self.d.site_xpos[self.hand_site]
        y = self.robot_yaw()
        dx, dy = p[0] - h[0], p[1] - h[1]
        return math.cos(y) * dx + math.sin(y) * dy, -math.sin(y) * dx + math.cos(y) * dy

    def dice_top(self):
        """自チームのサイコロの上の目. サイコロゾーンに完全に接地していなければ 0 (2 本目以降を持てない)."""
        b = self.free[f'{self.side}_dice']
        p = self.d.xpos[b]
        R = self.d.xmat[b].reshape(3, 3)
        (cx, cy), (hx, hy) = self.dice_zone
        corners = [R @ np.array([sx, sy, 0]) * 0.075 + p for sx in (-1, 1) for sy in (-1, 1)]
        inside = all(abs(c[0] - cx) <= hx and abs(c[1] - cy) <= hy for c in corners)
        top = max(DICE_FACES, key=lambda n: (R @ np.array(DICE_FACES[n]))[2])
        grounded = p[2] < 0.08 and (R @ np.array(DICE_FACES[top]))[2] > 0.97
        return top if inside and grounded else 0

    def free_adr(self, name):
        j = self.m.body_jntadr[self.free[name]]
        return self.m.jnt_qposadr[j], self.m.jnt_dofadr[j]

    def set_collide(self, name, on):
        b = self.free[name]
        for g in range(self.m.body_geomadr[b], self.m.body_geomadr[b] + self.m.body_geomnum[b]):
            self.m.geom_contype[g] = self.contype[g] if on else 0
            self.m.geom_conaffinity[g] = self.conaff[g] if on else 0

    def hold_pose(self, slot):
        """ハンドの slot 番目に持ったボトルの位置 (底の中心) と向き."""
        h = self.d.site_xpos[self.hand_site]
        y = self.robot_yaw()
        fwd, lat = SLOTS[slot]
        c, s = math.cos(y), math.sin(y)
        return np.array([h[0] + c * fwd - s * lat, h[1] + s * fwd + c * lat, h[2] - HOLD_DROP]), yaw_quat(y)

    # ------------------------------------------------------------ 誰が動かしたか
    def classify(self, names):
        cli = any(n.startswith('_ros2cli_') and not n.startswith('_ros2cli_daemon') for n in names)
        player = any(not n.startswith('_ros2cli_') and not n.startswith(TOOL_PREFIXES) for n in names)
        return 'player' if player and not cli else 'cli' if cli and not player else 'mixed' if cli and player else ''

    def topic_source(self, topic):
        """topic を publish しているノードが CLI か自分のノードか. 0.5 秒ごとに調べ直す."""
        now = time.monotonic()
        hit = self.src_cache.get(topic)
        if hit and now - hit[0] < 0.5:
            return hit[1]
        src = self.classify([e.node_name for e in self.get_publishers_info_by_topic(topic)])
        self.src_cache[topic] = (now, src)
        return src

    def service_source(self, service):
        """service の client を持っているノードが CLI か自分のノードか (server には呼んだノードが分からないので, グラフから探す)."""
        names = []
        for name, ns in self.get_node_names_and_namespaces():
            try:
                if any(s == service for s, _ in self.get_client_names_and_types_by_node(name, ns)):
                    names.append(name)
            except Exception:
                continue   # 調べている間にノードが終わった
        return self.classify(names)

    def used(self, kind, src):
        """この回に使った操作を覚える. kind は drive (走る) か mech (機構)."""
        for s_ in ('cli', 'player') if src == 'mixed' else (src,):
            if s_:
                self.run[kind].add(s_)

    # ------------------------------------------------------------ topic
    def on_cmd(self, twist):
        clamp = lambda v, lim: max(-lim, min(lim, v))
        self.cmd = (clamp(twist.linear.x, MAX_LINEAR), clamp(twist.linear.y, MAX_LINEAR), clamp(twist.angular.z, MAX_ANGULAR))
        self.cmd_time = time.monotonic()
        if any(abs(v) > 1e-3 for v in self.cmd):
            self.used('drive', self.topic_source('/robot/cmd_vel'))

    def on_arm(self, key, value, src=None):
        src = src or self.topic_source(f'/robot/arm/{key}')
        if self.frozen():
            return
        before = self.target[key]
        self.set_target(key, value)
        if abs(self.target[key] - before) > 1e-4:
            self.used('mech', src)
            self.events.append((self.d.time, key, src, self.target[key]))

    def on_ui(self, ui):
        """画面のキーの操作."""
        w = ui.data.split()
        try:
            self.handle_ui(w)
        except (ValueError, IndexError):
            self.get_logger().warning(render_en(msg('match.ui_bad', text=ui.data)))

    def handle_ui(self, w):
        if not w:
            return
        if w[0] == 'drive' and len(w) == 4:
            self.ui_cmd = tuple(max(-MAX_LINEAR, min(MAX_LINEAR, float(v))) for v in w[1:])
            self.ui_time = time.monotonic()
            if any(abs(v) > 1e-3 for v in self.ui_cmd):
                self.used('drive', 'keyboard')
        elif w[0] == 'arm' and len(w) == 3:
            self.on_arm(w[1], float(w[2]), 'keyboard')
        elif w[0] == 'act' and len(w) == 2 and w[1] in self.actions:
            self.do_action(f'/robot/{w[1]}', self.actions[w[1]], 'keyboard')
        elif w[0] == 'button' and len(w) == 2:
            self.events.append((self.d.time, 'button', 'keyboard', int(w[1])))
            self.button_pub.publish(Int32(data=int(w[1])))
        elif w[0] == 'mode' and len(w) == 2 and w[1] in ('free', 'course', 'match'):
            self.mode, self.phase = w[1], 'ready'
            self.reset()
        elif w[0] in ('reset', 'retry', 'start'):
            ok, m = {'reset': self.on_reset, 'retry': self.retry, 'start': self.start}[w[0]]()
            self.last_action, self.last_ok = m, ok

    def step(self):
        vx, vy, wz = self.cmd if time.monotonic() - self.cmd_time < CMD_TIMEOUT else (0.0, 0.0, 0.0)
        if time.monotonic() - self.ui_time < UI_TIMEOUT:
            vx, vy, wz = self.ui_cmd
        if self.frozen():
            vx, vy, wz = 0.0, 0.0, 0.0
        # 機体座標の速度をワールドの向きにする (アクチュエーターはワールドの x, y の速度を受ける)
        yaw = self.d.qpos[self.yaw_adr]
        c, s = math.cos(yaw), math.sin(yaw)
        self.d.ctrl[self.act['robot_vx']] = c * vx - s * vy
        self.d.ctrl[self.act['robot_vy']] = s * vx + c * vy
        self.d.ctrl[self.act['robot_wz']] = wz
        # 実時間に追いつくまで進める. 1 回に進めるのは 0.05 秒分まで (それより重いときは遅れを受け入れる)
        behind = (time.monotonic() - self.t0) - self.d.time
        self.advance(min(int(behind / self.m.opt.timestep), 25))
        if behind > 0.5:
            self.t0 += behind - 0.05
        self.update_phase()

    def advance(self, n):
        dt = self.m.opt.timestep
        for _ in range(n):
            # リフトとアームの目標は決まった速さで近づける
            for key, speed in (('extend', EXTEND_SPEED), ('lift', LIFT_SPEED)):
                diff = self.target[key] - self.ctrl[key]
                self.ctrl[key] += max(-speed * dt, min(speed * dt, diff))
                self.d.ctrl[self.act[f'robot_{key}']] = self.ctrl[key]
            mujoco.mj_step(self.m, self.d)
            self.carry()

    def carry(self):
        """持っているボトルをハンドに合わせて動かす. 底が木枠より低いまま木枠に重なったら, その場に落とす."""
        for name in list(self.carried):
            pos, quat = self.hold_pose(self.carried.index(name))
            if pos[2] < TIMBER_H and any(abs(pos[0] - c[0]) < h[0] + 0.034 and abs(pos[1] - c[1]) < h[1] + 0.034 for c, h in self.timbers):
                self.release(name)
                self.last_action = msg('match.dropped', name=name, height=TIMBER_H)
                self.last_ok = False
                continue
            qa, va = self.free_adr(name)
            self.d.qpos[qa:qa + 3] = pos
            self.d.qpos[qa + 3:qa + 7] = quat
            self.d.qvel[va:va + 6] = 0

    def release(self, name, vel=None):
        self.carried.remove(name)
        self.set_collide(name, True)
        if vel is not None:
            _, va = self.free_adr(name)
            self.d.qvel[va:va + 3] = vel

    # ------------------------------------------------------------ service
    def service(self, name, fn):
        def handle(_req, res):
            src = self.service_source(name) if name.startswith('/robot/') else ''
            res.success, m = self.do_action(name, fn, src)
            res.message = render_en(m)
            return res
        return handle

    def do_action(self, name, fn, src):
        if self.frozen() and name.startswith('/robot/'):
            return False, self.frozen()
        ok, m = fn()
        if name.startswith('/robot/'):
            self.used('mech', src)
            self.events.append((self.d.time, name.split('/')[-1], src, ok))
            if src in SOURCES:
                m = msg('match.by', text=m, src=msg(f'match.src.{src}'))
        self.last_action, self.last_ok = m, ok
        self.get_logger().info(f'{name}: {render_en(m)}')
        return ok, m

    def on_reset(self):
        if self.mode == 'match':
            self.phase = 'ready'
        self.reset()
        return True, msg('match.reset')

    # ------------------------------------------------------------ 試合の進行
    def frozen(self):
        """ロボットを動かせないときはその理由 (msg の形). 動かせるときは None."""
        if self.mode == 'match' and self.phase == 'setting':
            return msg('match.frozen.setting')
        if self.mode == 'match' and self.phase == 'finished':
            return msg('match.frozen.finished')
        return self.stopped

    def start(self):
        self.mode = 'match'
        if self.phase == 'setting':
            self.phase, self.phase_t = 'match', self.d.time
            self.message = msg('match.notice.start')
            return True, msg('match.start.skip')
        self.reset()
        self.phase, self.phase_t = 'setting', self.d.time
        self.message = msg('match.notice.setting', sec=f'{SETTING_SEC:.0f}')
        return True, msg('match.start.setting', sec=f'{SETTING_SEC:.0f}')

    def update_phase(self):
        if self.mode != 'match':
            return
        t = self.d.time - self.phase_t
        if self.phase == 'setting' and t >= SETTING_SEC:
            self.phase, self.phase_t = 'match', self.d.time
            self.message = msg('match.notice.start')
        elif self.phase == 'match' and t >= MATCH_SEC:
            self.finish(False)

    def remaining(self):
        if self.phase == 'setting':
            return max(0.0, SETTING_SEC - (self.d.time - self.phase_t))
        if self.phase == 'match':
            return max(0.0, MATCH_SEC - (self.d.time - self.phase_t))
        return None

    def retry(self):
        if self.mode == 'match' and self.phase not in ('match', 'ready'):
            return False, msg('match.retry.not_now')
        # ロボットをスタートゾーンへ (4.2). 持っていたボトルは最初の位置へ (4.6)
        for name in list(self.carried):
            self.release(name)
            qa, va = self.free_adr(name)
            self.d.qpos[qa:qa + 7] = self.m.qpos0[qa:qa + 7]
            self.d.qvel[va:va + 6] = 0
        for j in ('robot_x', 'robot_y', 'robot_yaw', 'robot_lift', 'robot_extend'):
            jid = self.m.joint(j).id
            self.d.qpos[self.m.jnt_qposadr[jid]] = START_YAW if j == 'robot_yaw' else 0.0
            self.d.qvel[self.m.jnt_dofadr[jid]] = 0.0
        self.target = {'extend': 0.0, 'lift': 0.0}
        self.ctrl = {'extend': 0.0, 'lift': 0.0}
        self.signal = False
        self.stopped = None
        mujoco.mj_forward(self.m, self.d)
        return True, msg('match.retry.done')

    def finish(self, declared):
        self.phase = 'finished'
        score, _ = self.score()
        t = self.d.time - self.phase_t
        self.result = {'score': score, 'declared': declared, 'time': round(t, 1)}
        best = self.best
        better = (declared and (not best.get('declared') or t < best.get('time', 1e9))) or \
                 (not best.get('declared') and score > best.get('score', -1e9))
        if better:
            self.best = dict(self.result)
            self.save_json(BEST_PATH, self.best)
        key = 'match.notice.declared' if declared else 'match.notice.time_up'
        self.message = msg(key + ('_best' if better else ''), time=f'{t:.1f}', score=score)

    def load_json(self, path):
        try:
            with open(path) as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def save_json(self, path, data):
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                json.dump(data, f, ensure_ascii=False)
        except OSError:
            pass

    # ------------------------------------------------------------ 判定
    def in_rect(self, zone, p, margin=0.0):
        (cx, cy), (hx, hy) = self.rect[zone]
        return abs(p[0] - cx) <= hx - margin and abs(p[1] - cy) <= hy - margin

    def grounded_in(self, name, zone, radius):
        """ボトルが zone の中に完全に接地しているか (立っていて, 底の円が全部 zone の中で, 持たれていない)."""
        if name in self.carried:
            return False
        b = self.free[name]
        p = self.d.xpos[b]
        up = self.d.xmat[b].reshape(3, 3)[2, 2]
        return up > 0.98 and p[2] < 0.005 and self.in_rect(zone, p, radius)

    def robot_points(self):
        """ロボットの正射影の点 (台車の角と辺の中点, ハンドの角, 腕の中ほど)."""
        c = self.d.xpos[self.robot_id]
        y = self.robot_yaw()
        ux, uy = np.array([math.cos(y), math.sin(y)]), np.array([-math.sin(y), math.cos(y)])
        pts = [c[:2] + ux * a + uy * b for a in (-0.225, 0, 0.225) for b in (-0.225, 0, 0.225)]
        h = self.d.site_xpos[self.hand_site][:2]
        pts += [h + ux * a + uy * b for a in (-0.11, 0.04) for b in (-0.13, 0.13)]
        pts.append((c[:2] + ux * 0.225 + h) / 2)
        return pts

    def in_opponent_court(self, p):
        # 赤と青の境 (x = 0) より右で, 共通ゾーン (梯子の内側とレール) の外
        if p[0] <= 0.019:
            return False
        return not (p[0] <= 0.188 and -2.576 <= p[1] <= 3.462)

    def referee(self):
        if self.mode == 'match' and self.phase in ('setting', 'finished'):
            return
        pts = self.robot_points()
        if not self.got['A'] and any(self.in_rect(f'{self.side}_area2', p) for p in pts):
            self.got['A'] = True
        if not self.got['B']:
            top = self.dice_top()
            if top and top != self.dice0:
                self.got['B'] = True
        weeds_ok = all(self.grounded_in(w, f'{self.side}_weed', 0.041) for w in self.weeds)
        for name in self.sakura:
            zone = next((n for n in range(1, 13) if self.grounded_in(name, f'common_{n}', 0.034)), None)
            prev = self.placed.get(name)
            if zone is None:
                self.placed.pop(name, None)
                continue
            if prev and prev[0] == zone:
                continue
            # 置いたときに数えるかを決める (共通ゾーンの定義, 雑草ボトル, 満開の定義)
            valid_zones = {z for z, ok in self.placed.values() if ok}
            reason = None
            if not all(k in valid_zones for k in range(1, zone)):
                reason = msg('match.reason.order', below=zone - 1)
            elif not weeds_ok:
                reason = msg('match.reason.weed')
            elif zone == 12 and len(valid_zones) < 5:
                reason = msg('match.reason.early')
            self.placed[name] = (zone, reason is None)
            self.message = msg('match.notice.placed_skip', zone=zone, reason=reason) if reason else msg('match.notice.placed', zone=zone)
        zones = {z for z, ok in self.placed.values() if ok}
        if len(zones) >= 5:
            self.got['E'] = True
        if 12 in zones and self.got['E']:
            self.got['F'] = True
        if self.signal and 12 in zones and not self.declared:
            self.declared = True
            if self.mode == 'match' and self.phase == 'match':
                self.finish(True)
            else:
                self.message = msg('match.notice.declared_free', time=f'{self.d.time - self.run["t0"]:.1f}')
        if not self.stopped and any(self.in_opponent_court(p) for p in pts):
            if self.mode == 'match' and self.phase == 'match':
                self.stopped = msg('match.notice.opponent_stop')
                self.message = self.stopped
            elif self.mode == 'course':
                self.message = msg('match.notice.opponent')
        if self.mode == 'course':
            self.check_course()

    # ------------------------------------------------------------ 練習の課題
    def course_tasks(self):
        return [(lv, t) for lv, tasks in COURSE for t in tasks]

    def current_task(self):
        return next((t for _, t in self.course_tasks() if t not in self.course), None)

    def after_button(self, n, kind, src='player', ok=True):
        """ボタン n を押してから BUTTON_WINDOW 秒の間に, src が kind をしたか."""
        presses = [t for t, k, s_, v in self.events if k == 'button' and v == n]
        return any(k == kind and s_ == src and (v is ok if isinstance(ok, bool) else v >= ok) and
                   any(0 <= t - tp <= BUTTON_WINDOW for tp in presses)
                   for t, k, s_, v in self.events)

    def only_player(self, kinds):
        """kinds (drive / mech) の操作が, この回は全部自分のノードだったか. ダメなら理由 (msg の形), よければ None."""
        for kind in (k for k in kinds if k in ('drive', 'mech')):
            other = self.run[kind] - {'player'}
            if other:
                who = msg(f'match.src.{other.pop()}') if len(other) == 1 else msg('match.src.both')
                return msg(f'match.note.other_{kind}', who=who)
            if not self.run[kind]:
                return msg(f'match.note.none_{kind}')
        if 'auto' in kinds and any(k == 'button' for _, k, _, _ in self.events):
            return msg('match.note.button')
        return None

    def check_course(self):
        task = self.current_task()
        if task is None:
            return
        zones = {z for z, ok in self.placed.values() if ok}
        carrying = any(n.startswith(f'{self.side}_sakura') for n in self.carried)
        need, note = False, None
        if task == 'm_exit':
            need = self.got['A']
        elif task == 'm_dice':
            need = self.dice_top() == 6
        elif task == 'm_grab':
            need = carrying
        elif task == 'm_place':
            need = 1 in zones
        elif task == 'm_half':
            need = self.got['E']
        elif task == 'm_bloom':
            need = self.declared
        elif task == 's_button':
            need = self.after_button(1, 'lift', ok=0.1)
            if not need and any(k == 'lift' and s_ != 'player' for _, k, s_, _ in self.events):
                note = msg('match.note.lift_other')
        elif task == 's_grab':
            need = carrying and self.after_button(1, 'grab')
        elif task == 's_place':
            need = bool(zones) and self.after_button(2, 'place')
        elif task == 's_dice':
            need = self.after_button(3, 'dice')
        elif task == 's_bloom':
            need = self.declared
            note = self.only_player(['mech']) if need else None
            need = need and not note
        elif task in ('a_exit', 'a_dice', 'a_place', 'a_bloom'):
            need = {'a_exit': self.got['A'], 'a_dice': self.dice_top() == 6, 'a_place': 1 in zones,
                    'a_bloom': self.declared and self.d.time - self.run['t0'] <= MATCH_SEC}[task]
            kinds = ['drive', 'mech', 'auto'] if task != 'a_exit' else ['drive', 'auto']
            note = self.only_player(kinds) if need else None
            need = need and not note
        self.course_note = note
        if need:
            self.course[task] = time.strftime('%Y-%m-%d %H:%M')
            self.save_json(COURSE_PATH, self.course)
            self.message = msg('match.notice.task_done', task=msg(f'match.task.{task}'))
            self.get_logger().info(render_en(self.message))

    def course_status(self):
        cur = self.current_task()
        levels = [{'id': lv, 'tasks': [{'id': t, 'done': t in self.course} for t in tasks]} for lv, tasks in COURSE]
        # run は, この回に台車と機構を動かした送り手 (keyboard / cli / player)
        return {'levels': levels, 'current': cur, 'note': self.course_note,
                'run': {k: sorted(self.run[k]) for k in ('drive', 'mech')},
                'elapsed': round(self.d.time - self.run['t0'], 1)}

    def score(self):
        valid = sum(1 for _, ok in self.placed.values() if ok)
        down = sum(1 for w in self.weeds if not self.grounded_in(w, f'{self.side}_weed', 0.041))
        items = {'A': POINTS['A'] * self.got['A'], 'B': POINTS['B'] * self.got['B'], 'C': POINTS['C'] * valid,
                 'D': POINTS['D'] * down, 'E': POINTS['E'] * self.got['E'], 'F': POINTS['F'] * self.got['F']}
        detail = {k: {'points': v} for k, v in items.items()}
        detail['C']['count'] = valid
        detail['D']['count'] = down
        return sum(items.values()), detail

    def grab(self):
        lift = self.d.qpos[self.lift_adr]
        if lift > GRAB_LIFT:
            return False, msg('match.grab.lift_high', lift=f'{lift:.2f}', max=GRAB_LIFT)
        limit = self.dice_top()
        cands = []
        for name in self.grabbable:
            if name in self.carried:
                continue
            b = self.free[name]
            up = self.d.xmat[b].reshape(3, 3)[2, 2]
            fx, ly = self.to_robot(self.d.xpos[b])
            if GRAB_DX[0] <= fx <= GRAB_DX[1] and abs(ly) <= GRAB_DY and up > 0.9 and self.d.xpos[b][2] < 0.02:
                cands.append((abs(ly), name))
        if not cands:
            return False, msg('match.grab.none', front=GRAB_DX[0], back=GRAB_DX[1], side=GRAB_DY)
        got = []
        for _, name in sorted(cands):
            if len(self.carried) >= limit:
                break
            self.carried.append(name)
            self.set_collide(name, False)
            got.append(name)
        if not got:
            return False, msg('match.grab.full', limit=limit, held=len(self.carried))
        rest = len(cands) - len(got)
        if rest:
            return True, msg('match.grab.done_rest', n=len(got), names=', '.join(got), held=len(self.carried), limit=limit, rest=rest)
        return True, msg('match.grab.done', n=len(got), names=', '.join(got), held=len(self.carried))

    def place(self):
        if not self.carried:
            return False, msg('match.place.none')
        name = self.carried[0]
        pos, _ = self.hold_pose(0)
        self.release(name)   # 残りは次の step で SLOTS の順に詰める
        where = self.zone_of(pos)
        return True, msg('match.place.done', name=name, z=f'{pos[2]:.3f}', zone=where)

    def throw(self):
        herb = [n for n in self.carried if 'herbicide' in n]
        if not herb:
            return False, msg('match.throw.none')
        y = self.robot_yaw()
        vel = np.array([math.cos(y) * THROW_V[0], math.sin(y) * THROW_V[0], THROW_V[1]])
        self.release(herb[0], vel)
        return True, msg('match.throw.done', name=herb[0], fwd=THROW_V[0], up=THROW_V[1])

    def roll_dice(self):
        b = self.free[f'{self.side}_dice']
        h = self.d.site_xpos[self.hand_site]
        p = self.d.xpos[b]
        if math.hypot(p[0] - h[0], p[1] - h[1]) > DICE_REACH:
            return False, msg('match.dice.far', dist=f'{math.hypot(p[0] - h[0], p[1] - h[1]):.2f}', reach=DICE_REACH)
        before = self.dice_top()
        # 機体の左右の軸まわりに 90 度回す (前へ 1 面転がす)
        y = self.robot_yaw()
        axis = np.array([-math.sin(y), math.cos(y), 0.0])
        rot = np.zeros(4)
        mujoco.mju_axisAngle2Quat(rot, axis, math.pi / 2)
        qa, va = self.free_adr(f'{self.side}_dice')
        q = np.zeros(4)
        mujoco.mju_mulQuat(q, rot, self.d.qpos[qa + 3:qa + 7].copy())
        self.d.qpos[qa + 3:qa + 7] = q
        self.d.qpos[qa + 2] = 0.0755
        self.d.qvel[va:va + 6] = 0
        mujoco.mj_forward(self.m, self.d)
        return True, msg('match.dice.done', before=before, after=self.dice_top())

    def toggle_signal(self):
        self.signal = not self.signal
        return True, msg('match.signal.on' if self.signal else 'match.signal.off')

    def zone_of(self, p):
        for i in range(self.m.nsite):
            name = self.m.site(i).name
            if name.startswith('common_') or name.startswith(self.side):
                c, h = self.m.site_pos[i][:2], self.m.site_size[i][:2]
                if abs(p[0] - c[0]) <= h[0] and abs(p[1] - c[1]) <= h[1] and not name.endswith(('area1', 'area2')):
                    return name
        return msg('match.place.outside')

    # ------------------------------------------------------------ 出力
    def publish(self):
        # スライドの qpos は body の初期位置からのずれなので, 位置は xpos から取る
        rp = self.d.xpos[self.robot_id]
        w, _, _, z = yaw_quat(self.robot_yaw())
        self.pose_pub.publish(Pose(position=Point(x=float(rp[0]), y=float(rp[1])), orientation=Quaternion(z=float(z), w=float(w))))
        status = {'extend': round(float(self.d.qpos[self.ext_adr]), 3), 'lift': round(float(self.d.qpos[self.lift_adr]), 3),
                  'carried': self.carried, 'dice': self.dice_top(), 'signal': self.signal,
                  # last_action は英語の文 (ros2 topic echo で読む人向け). 画面は action (キーと値) を訳す
                  'last_action': render_en(self.last_action) if self.last_action else '', 'action': self.last_action,
                  'action_ok': self.last_ok}
        self.status_pub.publish(String(data=json.dumps(status, ensure_ascii=False)))
        self.now_pub['extend'].publish(Float64(data=float(self.d.qpos[self.ext_adr])))
        self.now_pub['lift'].publish(Float64(data=float(self.d.qpos[self.lift_adr])))
        self.carrying_pub.publish(Int32(data=len(self.carried)))
        self.dice_pub.publish(Int32(data=int(status['dice'])))
        self.referee()
        total, items = self.score()
        rem = self.remaining()
        match = {'mode': self.mode, 'phase': self.phase, 'remaining': None if rem is None else round(rem, 1), 'score': total, 'items': items,
                 'stopped': self.stopped, 'message': self.message, 'result': self.result, 'best': self.best,
                 'placed': {n: {'zone': z, 'counted': ok} for n, (z, ok) in self.placed.items()},
                 'course': self.course_status() if self.mode == 'course' else None}
        self.match_pub.publish(String(data=json.dumps(match, ensure_ascii=False)))
        bodies = {self.m.body(b).name: [round(float(v), 4) for v in (*self.d.xpos[b], *self.d.xquat[b])] for b in self.moving}
        self.state_pub.publish(String(data=json.dumps({'t': round(self.d.time, 3), 'bodies': bodies, 'robot': status, 'match': match},
                                                      separators=(',', ':'), ensure_ascii=False)))


def main():
    rclpy.init()
    node = MatchSim()
    try:
        rclpy.spin(node)
    except (KeyboardInterrupt, ExternalShutdownException):
        pass   # Ctrl+C (launch を止めたとき). rclpy が先に終わっているので, ノードは消さずに抜ける
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
