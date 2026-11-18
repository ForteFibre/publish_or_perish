#!/usr/bin/env python3
"""大会モードのシミュレーター. MuJoCo でフィールド・オブジェクト・ロボットを動かす.

  ros2 run publish_or_perish match_sim.py --ros-args -p model:=<MJCF>

ロボット (赤コート): 台車 + マストを上下するリフト + 前へ伸びるアーム + ボトルを横に並べてつかむハンド.

topic
  /robot/cmd_vel     geometry_msgs/msg/Twist   受ける  台車の速度 (機体座標, x 前 / y 左 [m/s], z まわり [rad/s]). 0.5 秒途切れると止まる
  /robot/arm/extend  std_msgs/msg/Float64      受ける  アームの伸び [m] の目標 (0〜0.42). 0.4 m/s で近づく
  /robot/arm/lift    std_msgs/msg/Float64      受ける  リフトの高さ [m] の目標 (0〜0.35). 0.3 m/s で近づく
  /robot/pose        geometry_msgs/msg/Pose2D  出す    台車の位置 [m] と向き [rad]. 原点はフィールドの中心, x 右 (赤 → 青), y 奥
  /robot/status      std_msgs/msg/String       出す    アーム・リフト・持っているボトル・サイコロの目など (JSON)
  /match/state       std_msgs/msg/String       出す    画面用. 動く物の位置と向き (JSON)
service (std_srvs/srv/Trigger. 結果は response の message に日本語で返す)
  /robot/grab    ハンドの前のボトル (自チームの桜ボトルと除草剤ボトル) をつかむ. 持てるのはサイコロの目の数まで (5.4)
  /robot/place   ハンドの真ん中のボトルを, 今の高さで離す (下ろしてから離すと倒れにくい)
  /robot/throw   持っている除草剤ボトルを 1 本, 前へ投げる
  /robot/dice    ハンドの前のサイコロを前へ 1 面転がす
  /robot/signal  合図 (満開宣言) の灯りを付ける / 消す
  /match/reset   ロボットとオブジェクトを最初の位置に戻す

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
from geometry_msgs.msg import Pose2D, Twist
from rclpy.node import Node
from std_msgs.msg import Float64, String
from std_srvs.srv import Trigger

MAX_LINEAR = 2.0         # [m/s]
MAX_ANGULAR = 3.0        # [rad/s]
CMD_TIMEOUT = 0.5        # [s]
START_YAW = math.pi / 2  # スタートゾーンで奥 (+y) を向く
EXTEND_MAX, LIFT_MAX = 0.42, 0.35
EXTEND_SPEED, LIFT_SPEED = 0.4, 0.3   # [m/s]

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
        self.reset()

        self.cmd = (0.0, 0.0, 0.0)
        self.cmd_time = -1.0
        self.create_subscription(Twist, '/robot/cmd_vel', self.on_cmd, 10)
        self.create_subscription(Float64, '/robot/arm/extend', lambda msg: self.set_target('extend', msg.data), 10)
        self.create_subscription(Float64, '/robot/arm/lift', lambda msg: self.set_target('lift', msg.data), 10)
        self.pose_pub = self.create_publisher(Pose2D, '/robot/pose', 10)
        self.status_pub = self.create_publisher(String, '/robot/status', 10)
        self.state_pub = self.create_publisher(String, '/match/state', 10)
        for name, fn in (('/robot/grab', self.grab), ('/robot/place', self.place), ('/robot/throw', self.throw),
                         ('/robot/dice', self.roll_dice), ('/robot/signal', self.toggle_signal), ('/match/reset', self.on_reset)):
            self.create_service(Trigger, name, self.service(name, fn))
        self.create_timer(0.01, self.step)        # 物理を進める
        self.create_timer(1 / 30, self.publish)   # 画面・/robot/pose・/robot/status は 30 Hz
        self.get_logger().info(f'{path} を読んだ. 物体 {m.nbody}, 形 {m.ngeom}')

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
        self.last_action = ''
        self.t0 = time.monotonic()

    def set_target(self, key, value):
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

    # ------------------------------------------------------------ topic
    def on_cmd(self, msg):
        clamp = lambda v, lim: max(-lim, min(lim, v))
        self.cmd = (clamp(msg.linear.x, MAX_LINEAR), clamp(msg.linear.y, MAX_LINEAR), clamp(msg.angular.z, MAX_ANGULAR))
        self.cmd_time = time.monotonic()

    def step(self):
        vx, vy, wz = self.cmd if time.monotonic() - self.cmd_time < CMD_TIMEOUT else (0.0, 0.0, 0.0)
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
                self.last_action = f'{name} が木枠に当たって落ちた (リフトを {TIMBER_H} m 以上にして越える)'
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
            res.success, res.message = fn()
            self.last_action = res.message
            self.get_logger().info(f'{name}: {res.message}')
            return res
        return handle

    def on_reset(self):
        self.reset()
        return True, '最初の位置に戻した'

    def grab(self):
        lift = self.d.qpos[self.lift_adr]
        if lift > GRAB_LIFT:
            return False, f'リフトが高い ({lift:.2f} m). {GRAB_LIFT} m 以下に下ろしてからつかむ'
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
            return False, f'ハンドの前に立っているボトルがない (ハンドの中心から前後 {GRAB_DX[0]}〜{GRAB_DX[1]} m, 左右 {GRAB_DY} m 以内)'
        got = []
        for _, name in sorted(cands):
            if len(self.carried) >= limit:
                break
            self.carried.append(name)
            self.set_collide(name, False)
            got.append(name)
        if not got:
            return False, f'サイコロの目が {limit} なので, これ以上は持てない (持っているのは {len(self.carried)} 本. ルール 5.4)'
        rest = len(cands) - len(got)
        note = f'. サイコロの目が {limit} なので残り {rest} 本は持てない' if rest else ''
        return True, f'{len(got)} 本つかんだ ({", ".join(got)}). 持っているのは {len(self.carried)} 本{note}'

    def place(self):
        if not self.carried:
            return False, 'ボトルを持っていない'
        name = self.carried[0]
        pos, _ = self.hold_pose(0)
        self.release(name)   # 残りは次の step で SLOTS の順に詰める
        where = self.zone_of(pos)
        return True, f'{name} を離した (底の高さ {pos[2]:.3f} m, 場所: {where})'

    def throw(self):
        herb = [n for n in self.carried if 'herbicide' in n]
        if not herb:
            return False, '除草剤ボトルを持っていない'
        y = self.robot_yaw()
        vel = np.array([math.cos(y) * THROW_V[0], math.sin(y) * THROW_V[0], THROW_V[1]])
        self.release(herb[0], vel)
        return True, f'{herb[0]} を投げた (前へ {THROW_V[0]} m/s, 上へ {THROW_V[1]} m/s)'

    def roll_dice(self):
        b = self.free[f'{self.side}_dice']
        h = self.d.site_xpos[self.hand_site]
        p = self.d.xpos[b]
        if math.hypot(p[0] - h[0], p[1] - h[1]) > DICE_REACH:
            return False, f'サイコロが遠い (ハンドの中心から {math.hypot(p[0] - h[0], p[1] - h[1]):.2f} m. {DICE_REACH} m 以内に寄せる)'
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
        return True, f'サイコロを転がした ({before} → {self.dice_top()})'

    def toggle_signal(self):
        self.signal = not self.signal
        return True, '合図を付けた' if self.signal else '合図を消した'

    def zone_of(self, p):
        for i in range(self.m.nsite):
            name = self.m.site(i).name
            if name.startswith('common_') or name.startswith(self.side):
                c, h = self.m.site_pos[i][:2], self.m.site_size[i][:2]
                if abs(p[0] - c[0]) <= h[0] and abs(p[1] - c[1]) <= h[1] and not name.endswith(('area1', 'area2')):
                    return name
        return 'ゾーンの外'

    # ------------------------------------------------------------ 出力
    def publish(self):
        # スライドの qpos は body の初期位置からのずれなので, 位置は xpos から取る
        rp = self.d.xpos[self.robot_id]
        self.pose_pub.publish(Pose2D(x=float(rp[0]), y=float(rp[1]), theta=float(self.robot_yaw())))
        status = {'extend': round(float(self.d.qpos[self.ext_adr]), 3), 'lift': round(float(self.d.qpos[self.lift_adr]), 3),
                  'carried': self.carried, 'dice': self.dice_top(), 'signal': self.signal, 'last_action': self.last_action}
        self.status_pub.publish(String(data=json.dumps(status, ensure_ascii=False)))
        bodies = {self.m.body(b).name: [round(float(v), 4) for v in (*self.d.xpos[b], *self.d.xquat[b])] for b in self.moving}
        self.state_pub.publish(String(data=json.dumps({'t': round(self.d.time, 3), 'bodies': bodies, 'robot': status},
                                                      separators=(',', ':'), ensure_ascii=False)))


def main():
    rclpy.init()
    node = MatchSim()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.try_shutdown()


if __name__ == '__main__':
    main()
