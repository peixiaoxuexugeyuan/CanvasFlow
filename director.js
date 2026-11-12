






(function () {
  'use strict';

  /* ---------- 常量与工具 ---------- */
  const THREE_URL = 'vendor/three/three.module.js';
  const FPS = 24;
  const Animation = window.DirectorAnimation;
  let Rig = window.DirectorRig;
  let Crowd = window.DirectorCrowd;
  let timeline;
  const DEFAULT_DURATION = 240;

  const SAM_MODELS = {
    sam:      { file: 'assets3d/models/sam-male.glb',     scale: 1.03 },
    female:   { file: 'assets3d/models/sam-female.glb',   scale: 0.94 },
    muscular: { file: 'assets3d/models/sam-muscular.glb', scale: 1.14 },
    slim:     { file: 'assets3d/models/sam-slim.glb',     scale: 0.97 },
    broad:    { file: 'assets3d/models/sam-broad.glb',    scale: 1.00 },
    child:    { file: 'assets3d/models/sam-child.glb',    scale: 0.63 },
    teen:     { file: 'assets3d/models/sam-teen.glb',     scale: 0.86 },
    chibi:    { file: 'assets3d/models/sam-chibi.glb',    scale: 0.46 },
  };
  const GEOMETRY_TYPES = [
    { key: 'box', label: '方块' }, { key: 'sphere', label: '球体' },
    { key: 'cylinder', label: '圆柱' }, { key: 'torus', label: '圆环' },
    { key: 'cone', label: '锥体' }, { key: 'pyramid', label: '金字塔' },
  ];
  const CAMERA_PRESETS = ['推进', '拉远', '横移', '升降', '环绕', '弧线跟随', '吊臂升降', '跟拍', '揭示', 'Dolly Zoom', '轻微手持'];

  const ASPECT_RATIOS = [['自适应', 0], ['21:9', 21/9], ['16:9', 16/9], ['4:3', 4/3], ['1:1', 1], ['3:4', 3/4], ['9:16', 9/16]];







  const CAM_SHOT_PRESETS = [
    { id: 'front-medium', label: '正面中景', dist: 1.11, height: 1.55, dx: 0, dz: 1, fov: 50, pitch: 0, roll: 0, tgtY: 1.47 },
    { id: 'front-close', label: '正面特写', dist: 1.04, height: 1.62, dx: 0, dz: 1, fov: 32, pitch: 0, roll: 0, tgtY: 1.6 },
    { id: 'front-full', label: '正面全景', dist: 2.87, height: 1.1, dx: 0, dz: 1, fov: 40, pitch: 0, roll: 0, tgtY: 1.0 },
    { id: 'side-track', label: '侧面跟拍', dist: 1.11, height: 1.55, dx: 1, dz: 0.15, fov: 50, pitch: 0, roll: 0, tgtY: 1.47 },
    { id: 'side-close', label: '侧面近景', dist: 1.01, height: 1.58, dx: 1, dz: 0.15, fov: 40, pitch: 0, roll: 0, tgtY: 1.55 },
    { id: 'back-medium', label: '背面中景', dist: 1.11, height: 1.55, dx: 0, dz: -1, fov: 50, pitch: 0, roll: 0, tgtY: 1.47 },
    { id: 'top-full', label: '俯拍全景', dist: 2.69, height: 3.8, dx: 0, dz: 0.45, fov: 45, pitch: 0, roll: 0, tgtY: 0.85 },
    { id: 'high-45', label: '45° 俯拍', dist: 1.3, height: 2.4, dx: 0.4, dz: 0.75, fov: 46, pitch: 0, roll: 0, tgtY: 1.3 },
    { id: 'low-angle', label: '低角度仰拍', dist: 1.0, height: 0.3, dx: 0, dz: 0.85, fov: 55, pitch: 0, roll: 0, tgtY: 1.6 },
    { id: 'low-wide', label: '低角度广角', dist: 1.05, height: 0.3, dx: 0, dz: 1, fov: 90, pitch: 0, roll: 0, tgtY: 1.45 },
    { id: 'over-shoulder', label: '过肩镜头', dist: 1.08, height: 1.6, dx: -0.45, dz: 0.9, fov: 42, pitch: 0, roll: 0, tgtY: 1.51 },
    { id: 'over-shoulder-r', label: '过肩镜头（右）', dist: 1.08, height: 1.6, dx: 0.45, dz: 0.9, fov: 42, pitch: 0, roll: 0, tgtY: 1.51 },
    { id: 'bird-eye', label: '鸟瞰', dist: 2.2, height: 6.0, dx: 0, dz: 0.12, fov: 45, pitch: 0, roll: 0, tgtY: 0.9 },
    { id: 'dutch-angle', label: '荷兰角', dist: 1.15, height: 1.6, dx: 0.15, dz: 0.95, fov: 48, pitch: 0, roll: 18, tgtY: 1.47 },
  ];

  const POSE_PRESETS = [
  {
    "id": "stand",
    "label": "站立",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 2,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": -10,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": -5,
      "leftShoulder.spread": 12,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": -5,
      "rightShoulder.spread": 14,
      "rightShoulder.twist": 0,
      "leftElbow.bend": 15,
      "rightElbow.bend": 15,
      "leftHip.pitch": 0,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "t-pose",
    "label": "T型",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 0,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": 0,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 16,
      "leftShoulder.spread": 60,
      "leftShoulder.twist": 40,
      "rightShoulder.pitch": 22,
      "rightShoulder.spread": 54,
      "rightShoulder.twist": 41,
      "leftElbow.bend": 0,
      "rightElbow.bend": 0,
      "leftHip.pitch": 0,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "walk",
    "label": "行走",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 3,
      "torso.yaw": 5,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 40,
      "leftShoulder.spread": 9,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": -8,
      "rightShoulder.spread": 27,
      "rightShoulder.twist": -4,
      "leftElbow.bend": 37,
      "rightElbow.bend": 26,
      "leftHip.pitch": -10,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": 36,
      "rightHip.spread": -2,
      "rightHip.twist": 0,
      "leftKnee.bend": 22,
      "rightKnee.bend": 41
    }
  },
  {
    "id": "run",
    "label": "跑步",
    "controls": {
      "_c2": 1,
      "body.pitch": -2,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 3,
      "torso.yaw": 5,
      "torso.roll": 0,
      "head.pitch": -10,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": -26,
      "leftShoulder.spread": 23,
      "leftShoulder.twist": 14,
      "rightShoulder.pitch": 23,
      "rightShoulder.spread": 14,
      "rightShoulder.twist": 19,
      "leftElbow.bend": 60,
      "rightElbow.bend": 89,
      "leftHip.pitch": 50,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": -20,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 18,
      "rightKnee.bend": 36
    }
  },
  {
    "id": "sit",
    "label": "坐姿",
    "controls": {
      "_c2": 1,
      "body.pitch": -5,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 5,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 0,
      "leftShoulder.spread": 8,
      "leftShoulder.twist": 6,
      "rightShoulder.pitch": 0,
      "rightShoulder.spread": 15,
      "rightShoulder.twist": 16,
      "leftElbow.bend": 80,
      "rightElbow.bend": 80,
      "leftHip.pitch": 90,
      "leftHip.spread": 5,
      "leftHip.twist": 0,
      "rightHip.pitch": 90,
      "rightHip.spread": 5,
      "rightHip.twist": 0,
      "leftKnee.bend": 90,
      "rightKnee.bend": 90
    }
  },
  {
    "id": "crouch",
    "label": "蹲下",
    "controls": {
      "_c2": 1,
      "body.pitch": -3,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 45,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": -15,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 39,
      "leftShoulder.spread": 8,
      "leftShoulder.twist": 26,
      "rightShoulder.pitch": 20,
      "rightShoulder.spread": 15,
      "rightShoulder.twist": 30,
      "leftElbow.bend": 87,
      "rightElbow.bend": 100,
      "leftHip.pitch": 100,
      "leftHip.spread": 15,
      "leftHip.twist": 16,
      "rightHip.pitch": 90,
      "rightHip.spread": 15,
      "rightHip.twist": 16,
      "leftKnee.bend": 104,
      "rightKnee.bend": 97
    }
  },
  {
    "id": "kneel-one",
    "label": "单膝跪",
    "controls": {
      "_c2": 1,
      "body.pitch": -11,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 21,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 41,
      "leftShoulder.spread": -4,
      "leftShoulder.twist": -24,
      "rightShoulder.pitch": 0,
      "rightShoulder.spread": 16,
      "rightShoulder.twist": 0,
      "leftElbow.bend": 71,
      "rightElbow.bend": 16,
      "leftHip.pitch": 90,
      "leftHip.spread": 0,
      "leftHip.twist": 4,
      "rightHip.pitch": 27,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 74,
      "rightKnee.bend": 89
    }
  },
  {
    "id": "kneel-two",
    "label": "双膝跪",
    "controls": {
      "_c2": 1,
      "body.pitch": 8,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 6,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": -5,
      "leftShoulder.spread": 7,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": -5,
      "rightShoulder.spread": 10,
      "rightShoulder.twist": 0,
      "leftElbow.bend": 15,
      "rightElbow.bend": 15,
      "leftHip.pitch": -10,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": -9,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 108,
      "rightKnee.bend": 104
    }
  },
  {
    "id": "hands-on-hips",
    "label": "叉腰",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 0,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 15,
      "leftShoulder.spread": 31,
      "leftShoulder.twist": -9,
      "rightShoulder.pitch": 21,
      "rightShoulder.spread": 31,
      "rightShoulder.twist": 3,
      "leftElbow.bend": 80,
      "rightElbow.bend": 80,
      "leftHip.pitch": 0,
      "leftHip.spread": 10,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 10,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "lean",
    "label": "倚靠",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": -5,
      "torso.pitch": -3,
      "torso.yaw": 5,
      "torso.roll": -5,
      "head.pitch": -10,
      "head.yaw": 10,
      "head.roll": -5,
      "leftShoulder.pitch": -5,
      "leftShoulder.spread": 13,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": -10,
      "rightShoulder.spread": 16,
      "rightShoulder.twist": 0,
      "leftElbow.bend": 15,
      "rightElbow.bend": 20,
      "leftHip.pitch": 0,
      "leftHip.spread": 5,
      "leftHip.twist": 0,
      "rightHip.pitch": 20,
      "rightHip.spread": 0,
      "rightHip.twist": 10,
      "leftKnee.bend": 0,
      "rightKnee.bend": 40
    }
  },
  {
    "id": "bow",
    "label": "鞠躬",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 45,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": 20,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 13,
      "leftShoulder.spread": -7,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": 3,
      "rightShoulder.spread": -5,
      "rightShoulder.twist": 10,
      "leftElbow.bend": 5,
      "rightElbow.bend": 5,
      "leftHip.pitch": 0,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "think",
    "label": "思考",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 5,
      "torso.yaw": -5,
      "torso.roll": 0,
      "head.pitch": 10,
      "head.yaw": -10,
      "head.roll": 5,
      "leftShoulder.pitch": 5,
      "leftShoulder.spread": 7,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": 87,
      "rightShoulder.spread": -10,
      "rightShoulder.twist": 90,
      "leftElbow.bend": 67,
      "rightElbow.bend": 122,
      "leftHip.pitch": 0,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "fight",
    "label": "格斗",
    "controls": {
      "_c2": 1,
      "body.pitch": 5,
      "body.yaw": 15,
      "body.roll": 0,
      "torso.pitch": 8,
      "torso.yaw": 10,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": -15,
      "head.roll": 0,
      "leftShoulder.pitch": 60,
      "leftShoulder.spread": 30,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": 40,
      "rightShoulder.spread": 25,
      "rightShoulder.twist": 0,
      "leftElbow.bend": 110,
      "rightElbow.bend": 100,
      "leftHip.pitch": 10,
      "leftHip.spread": 15,
      "leftHip.twist": 10,
      "rightHip.pitch": -5,
      "rightHip.spread": 15,
      "rightHip.twist": -10,
      "leftKnee.bend": 25,
      "rightKnee.bend": 30
    }
  },
  {
    "id": "kick",
    "label": "踢球",
    "controls": {
      "_c2": 1,
      "body.pitch": -4,
      "body.yaw": -7,
      "body.roll": -1,
      "torso.pitch": -5,
      "torso.yaw": -10,
      "torso.roll": 5,
      "head.pitch": 5,
      "head.yaw": -10,
      "head.roll": 0,
      "leftShoulder.pitch": -20,
      "leftShoulder.spread": 30,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": 20,
      "rightShoulder.spread": 25,
      "rightShoulder.twist": 0,
      "leftElbow.bend": 40,
      "rightElbow.bend": 35,
      "leftHip.pitch": -10,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": 80,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 10,
      "rightKnee.bend": 20
    }
  },
  {
    "id": "throw",
    "label": "投掷",
    "controls": {
      "_c2": 1,
      "body.pitch": 5,
      "body.yaw": -2,
      "body.roll": 0,
      "torso.pitch": 4,
      "torso.yaw": 15,
      "torso.roll": -5,
      "head.pitch": -5,
      "head.yaw": -15,
      "head.roll": 0,
      "leftShoulder.pitch": 7,
      "leftShoulder.spread": 17,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": 77,
      "rightShoulder.spread": 0,
      "rightShoulder.twist": 90,
      "leftElbow.bend": 88,
      "rightElbow.bend": 96,
      "leftHip.pitch": 15,
      "leftHip.spread": 5,
      "leftHip.twist": 0,
      "rightHip.pitch": -10,
      "rightHip.spread": 5,
      "rightHip.twist": 0,
      "leftKnee.bend": 26,
      "rightKnee.bend": 36
    }
  },
  {
    "id": "push",
    "label": "推进",
    "controls": {
      "_c2": 1,
      "body.pitch": -1,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 19,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 100,
      "leftShoulder.spread": 6,
      "leftShoulder.twist": 5,
      "rightShoulder.pitch": 101,
      "rightShoulder.spread": 11,
      "rightShoulder.twist": 0,
      "leftElbow.bend": 14,
      "rightElbow.bend": 0,
      "leftHip.pitch": 41,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": -15,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 35,
      "rightKnee.bend": 10
    }
  },
  {
    "id": "wave",
    "label": "招手",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 2,
      "torso.yaw": -10,
      "torso.roll": 0,
      "head.pitch": -5,
      "head.yaw": 15,
      "head.roll": 5,
      "leftShoulder.pitch": 0,
      "leftShoulder.spread": 6,
      "leftShoulder.twist": 0,
      "rightShoulder.pitch": 62,
      "rightShoulder.spread": -10,
      "rightShoulder.twist": 90,
      "leftElbow.bend": 62,
      "rightElbow.bend": 94,
      "leftHip.pitch": 0,
      "leftHip.spread": 0,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 0,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "reach",
    "label": "伸手",
    "controls": {
      "_c2": 1,
      "body.pitch": -5,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": -16,
      "torso.yaw": 0,
      "torso.roll": 3,
      "head.pitch": -25,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 115,
      "leftShoulder.spread": -10,
      "leftShoulder.twist": 10,
      "rightShoulder.pitch": 133,
      "rightShoulder.spread": -10,
      "rightShoulder.twist": -10,
      "leftElbow.bend": 59,
      "rightElbow.bend": 53,
      "leftHip.pitch": 0,
      "leftHip.spread": 10,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 10,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "cross-arms",
    "label": "抱臂",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 0,
      "torso.yaw": 2,
      "torso.roll": 0,
      "head.pitch": -8,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 7,
      "leftShoulder.spread": 22,
      "leftShoulder.twist": 17,
      "rightShoulder.pitch": 8,
      "rightShoulder.spread": 22,
      "rightShoulder.twist": 39,
      "leftElbow.bend": 107,
      "rightElbow.bend": 107,
      "leftHip.pitch": 0,
      "leftHip.spread": 5,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 5,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  },
  {
    "id": "phone",
    "label": "看手机",
    "controls": {
      "_c2": 1,
      "body.pitch": 0,
      "body.yaw": 0,
      "body.roll": 0,
      "torso.pitch": 5,
      "torso.yaw": 0,
      "torso.roll": 0,
      "head.pitch": 17,
      "head.yaw": 0,
      "head.roll": 0,
      "leftShoulder.pitch": 55,
      "leftShoulder.spread": -10,
      "leftShoulder.twist": -4,
      "rightShoulder.pitch": 24,
      "rightShoulder.spread": -10,
      "rightShoulder.twist": -13,
      "leftElbow.bend": 89,
      "rightElbow.bend": 43,
      "leftHip.pitch": 0,
      "leftHip.spread": 5,
      "leftHip.twist": 0,
      "rightHip.pitch": 0,
      "rightHip.spread": 5,
      "rightHip.twist": 0,
      "leftKnee.bend": 0,
      "rightKnee.bend": 0
    }
  }
];;  const uid = (p) => `${p || 'id'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtFrame = (f) => {
    const sec = Math.floor(f / FPS), fr = Math.round(f % FPS);
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  };
  const fmtTC = (f) => {
    const sec = Math.floor(f / FPS), fr = Math.round(f % FPS);
    return `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  };
  // 时:分:秒:帧 → 帧
  const parseTC = (s) => {
    const m = String(s).trim().match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    return (+m[1]) * 3600 * FPS + (+m[2]) * 60 * FPS + (+m[3]) * FPS + (+m[4]);
  };


  function defaultProject() {
    return {
      version: 3,
      scene: {
        scale: 1, position: [0, 0, 0], rotation: [0, 0, 0],
        backgroundColor: '#7a7a7a', panoramaYaw: 0, panoramaRadius: 60,
        showLabels: true, snapToGrid: false, showGround: true,
        groundOpacity: 0.45, groundHeight: 0, gridColor: '#474747', gridOpacity: 0.6,
        aspectRatio: '自适应',
      },
      objects: [],            // { id,name,kind,visible,locked,color,transform{position/rotation/scale},bodyType,geometryType }
      cameras: [],           // { id,name,fov,transform,targetMode,target,lastCaptureUrl }
      activeCameraId: '',
      sequence: { fps: FPS, durationFrames: DEFAULT_DURATION },
      cameraTrack: { clips: [] },  // { id,cameraId,startFrame,endFrame }
      objectAnimationTracks: [],  // { objectId, keys:[{frame,position,rotation,scale,interp}] }
    };
  }
  function uniformScaleBase(obj) { return obj?.kind === 'character' && !obj.local ? (SAM_MODELS[obj.bodyType]?.scale || 1) : 1; }
  function defaultTransform() { return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }; }
  // 兼容旧工程：补齐机位 fov/target、场景默认背景等新增字段
  function migrateProject(proj) {
    if (!proj || typeof proj !== 'object') return defaultProject();
    const d = defaultProject();
    if(!Array.isArray(proj.objects))proj.objects=[];
    if(!Array.isArray(proj.cameras))proj.cameras=[];
    proj.scene = Object.assign({}, d.scene, proj.scene || {});
    if (!proj.scene.backgroundColor) proj.scene.backgroundColor = d.scene.backgroundColor;

    if (proj.scene.backgroundColor === '#363634') proj.scene.backgroundColor = '#7a7a7a';
    for (const cam of proj.cameras || []) {
      if (cam.fov == null) cam.fov = 50;
      if (!Array.isArray(cam.target)) cam.target = [0, 1, 0];
    }
    for (const o of proj.objects || []) {
      if (o.kind === 'camera') { if (o.fov == null) o.fov = 50; if (!Array.isArray(o.target)) o.target = [0, 1, 0]; }
    }
    migrateCameraAspects(proj);
    // 仅迁移早期固定出生点；不改变用户主动设置的近景机位。
    for (const cam of proj.objects || []) {
      if (cam.kind !== 'camera') continue;
      // 老版 addCamera 的固定出生点签名（y=1.4, z=2.6, 注视原点）
      const legacySpawn = Math.abs(cam.transform.position[1] - 1.4) < 0.01 && Math.abs(cam.transform.position[2] - 2.6) < 0.01 &&
        JSON.stringify(cam.target || []) === JSON.stringify([0, 1, 0]);
      const victim = !proj.timeline && legacySpawn ? ( (proj.objects || []).find(o => o.kind === 'character')) : null;
      if (victim) {
        const [cx, , cz] = victim.transform.position;
        cam.transform.position = [cx, 1.6, cz + 4.2];
        cam.target = [cx, 1.05, cz];
      }
    }
    if (!proj.sequence) proj.sequence = d.sequence;
    if (!proj.cameraTrack) proj.cameraTrack = { clips: [] };
    if (!Array.isArray(proj.objectAnimationTracks)) proj.objectAnimationTracks = [];
    if (Crowd) Crowd.migrate(proj, Object.fromEntries(Object.entries(SAM_MODELS).map(([k, v]) => [k, v.scale])));
    if(Rig)Rig.upgradePoseControls(proj,POSE_PRESETS,[{label:'叉腰',controls:{...POSE_PRESETS.find(p=>p.id==='hands-on-hips').controls,'leftShoulder.pitch':16,'leftShoulder.spread':29,'leftShoulder.twist':90,'rightShoulder.pitch':23,'rightShoulder.spread':28,'rightShoulder.twist':90,'leftElbow.bend':80,'rightElbow.bend':69}}]);
    return Animation.migrate(proj);
  }

  /* ---------- 模块状态 ---------- */
  const S = {
    open: false, project: null, nodeEl: null,
    three: null, scene: null, renderer: null, camera: null, controls: null, clock: null,
    rigs: new Map(), modelProto: null, sceneObjects: new Map(), cameraHelpers: new Map(),
    playhead: 0, playing: false, playTolerance: 0,
    selectedId: '', selectedKind: '', timelineZoom: 3, loopWorkArea: false, bindPoses: new Map(),
    workArea: null, recording: false,
    undoStack: [], redoStack: [], batchDepth: 0, batchSnapshot: null,
    el: {}, raf: 0, dirty: false, camPreviewRaf: 0, hiddenTimer: 0, watchdog: 0, viewMode: 'director',
    keyNudges: new Set(), sbTab: 'scene', groupCollapsed: new Set(),
  };
  const MAX_UNDO = 60;

  /* ---------- undo / redo（快照式，批操作合并）---------- */
  function snapshot() { return JSON.stringify(S.project); }
  function pushUndo() {
    if (S.batchDepth > 0) { if (!S.batchSnapshot) S.batchSnapshot = snapshot(); return; }
    const snap = snapshot();
    if (S.undoStack[S.undoStack.length - 1] === snap) return;
    S.undoStack.push(snap);
    if (S.undoStack.length > MAX_UNDO) S.undoStack.shift();
    S.redoStack.length = 0;
  }
  function beginBatch() { S.batchDepth++; }
  function endBatch() {
    S.batchDepth = Math.max(0, S.batchDepth - 1);
    if (S.batchDepth === 0 && S.batchSnapshot != null) {
      const cur = snapshot();
      if (cur !== S.batchSnapshot) {
        S.undoStack.push(S.batchSnapshot);
        if (S.undoStack.length > MAX_UNDO) S.undoStack.shift();
        S.redoStack.length = 0;
      }
      S.batchSnapshot = null;
    }
  }
  function undo() {
    if (!S.undoStack.length) return toast('没有可撤销的操作');
    S.redoStack.push(snapshot());
    S.project = JSON.parse(S.undoStack.pop());
    rebuildAll(); persist(); toast('已撤销');
  }
  function redo() {
    if (!S.redoStack.length) return toast('没有可恢复的操作');
    S.undoStack.push(snapshot());
    S.project = JSON.parse(S.redoStack.pop());
    rebuildAll(); persist(); toast('已恢复');
  }

  /* ---------- 持久化：写回画布节点（director-project-change 事件）---------- */
  let persistTimer = 0;
  function persist(immediate) {
    if (!S.nodeEl||S.readOnly||S.viewportReady===false) return;
    clearTimeout(persistTimer);
    const write = () => {
      try { S.nodeEl.dataset.directorProject = JSON.stringify(S.project); } catch (e) { /* 超限忽略 */ }
      document.dispatchEvent(new CustomEvent('director-project-change', { detail: { node: S.nodeEl } }));
    };
    if (immediate) write(); else persistTimer = setTimeout(write, 200);
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'director-toast';
    t.textContent = msg;
    S.el.shell && S.el.shell.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  }

  /* ============================================================
     three.js 动态注入
     ============================================================ */
  let threeReady = null;
  function loadThree() {
    if (threeReady) return threeReady;
    threeReady = (async () => {
      const importer = (url) => import(/* @vite-ignore */ url);
      const base = new URL('.', document.baseURI||location.href).href.replace(/\/[^/]*$/, '/');
      const T = await importer(base + THREE_URL); // Match addon imports; use one Three.js module instance.
      const GLTFMod = await importer(base + 'vendor/three/addons/loaders/GLTFLoader.js?v=dir1');
      const CCMod = await importer(base + 'vendor/three/addons/controls/camera-controls.module.js?v=dir1');
      const SUMod = await importer(base + 'vendor/three/addons/utils/SkeletonUtils.js?v=dir1');
      const TCMod = await importer(base + 'vendor/three/addons/controls/TransformControls.js');
      // camera-controls 是 default 导出
      const CameraControls = CCMod.CameraControls || CCMod.default;
      return { THREE: T, GLTFLoader: GLTFMod.GLTFLoader, CameraControls, SkeletonUtils: SUMod, TransformControls: TCMod.TransformControls };
    })();
    threeReady=threeReady.catch(error=>{threeReady=null;throw error;});
    return threeReady;
  }

  /* ============================================================
     界面骨架
     ============================================================ */
  const ICONS = {
    close: '<svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>',
    plus: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/></svg>',
    play: '<svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"/></svg>',
    pause: '<svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48V208a16,16,0,0,1-16,16H160a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h40A16,16,0,0,1,216,48ZM104,32H64A16,16,0,0,0,48,48V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32Z"/></svg>',
    start: '<svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256"><path d="M199.81,34a16,16,0,0,0-16.24.43L64,109.23V40a8,8,0,0,0-16,0V216a8,8,0,0,0,16,0V146.77l119.57,74.78A15.95,15.95,0,0,0,208,208.12V47.88A15.86,15.86,0,0,0,199.81,34ZM192,208,64.16,128,192,48.07Z"/></svg>',
    end: '<svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256"><path d="M200,32a8,8,0,0,0-8,8v69.23L72.43,34.45A15.95,15.95,0,0,0,48,47.88V208.12a16,16,0,0,0,24.43,13.43L192,146.77V216a8,8,0,0,0,16,0V40A8,8,0,0,0,200,32Z"/></svg>',
    prev: '<svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/></svg>',
    next: '<svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/></svg>',
    eye: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M247.31,124.76c-.35-.79-8.74-19.58-27.08-38.42C206.43,72.11,183,60,156,60h-.5A12,12,0,0,0,148,88h.5c32.57,0,58.74,29.16,71.41,46.3-5.8,7.78-17.06,20.08-31.7,29.71l11.57,11.57c4.09-2.59,7.93-5.33,11.45-8.21,18.34-18.84,26.73-37.63,27.08-38.42A11.92,11.92,0,0,0,247.31,124.76Z"/><path d="M53.92,34.62A12,12,0,0,0,37.23,51.31L62.77,76.85c-13.52,9.45-25.14,20.69-33.08,28.84C11.35,124.55,3,143.34,2.62,144.13a12,12,0,0,0,0,10.44c.35.79,8.74,19.58,27.08,38.42C53.05,224.24,82,236,128,236c20.94,0,39.57-3.49,55.65-9.83l27.4,27.4a12,12,0,1,0,16.69-16.69ZM128,212c-34.57,0-61.38-9.28-84.4-29.18A166,166,0,0,1,27.3,148.8,166,166,0,0,1,44,122.4c8.55-9.62,20.52-19.09,34.46-25.54l14.39,14.39A36,36,0,0,0,138,160.3l23.57,23.57C151.68,209.21,140.94,212,128,212Z"/></svg>',
    eyeOff: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M53.92,34.62A12,12,0,0,0,37.23,51.31L62.77,76.85c-13.52,9.45-25.14,20.69-33.08,28.84C11.35,124.55,3,143.34,2.62,144.13a12,12,0,0,0,0,10.44c.35.79,8.74,19.58,27.08,38.42C53.05,224.24,82,236,128,236c20.94,0,39.57-3.49,55.65-9.83l27.4,27.4a12,12,0,1,0,16.69-16.69Z"/></svg>',
    lock: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M208,104H184V56a56,56,0,0,0-112,0v48H48A16,16,0,0,0,32,120v96a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V120A16,16,0,0,0,208,104ZM96,56a32,32,0,0,1,64,0v48H96Z"/></svg>',
    cam: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M248,96a8,8,0,0,1-8,8H232v16a8,8,0,0,1-16,0V104H152v16a8,8,0,0,1-16,0V104H8A8,8,0,0,1,0,96,8,8,0,0,1,8,88H136V72h80V88h16A8,8,0,0,1,248,96Z"/></svg>',
    person: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>',
    personPlus: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M192,96a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,96Z" opacity="0.2"/><path d="M248,88a8,8,0,0,1-8,8H224v16a8,8,0,0,1-16,0V96H192a8,8,0,0,1,0-16h16V64a8,8,0,0,1,16,0V80h16A8,8,0,0,1,248,88ZM144,104a8,8,0,0,1-8,8,16,16,0,0,0-16,16,8,8,0,0,1-16,0A32,32,0,0,1,136,96,8,8,0,0,1,144,104Zm86.92,116c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,174.78,40.31,193.66,25.08,220a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8Z" transform="translate(0-8)"/></svg>',
    videoCam: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M251.77,73a8,8,0,0,0-8.38.88L216,96.92V72a24,24,0,0,0-24-24H40A24,24,0,0,0,16,72V184a24,24,0,0,0,24,24H192a24,24,0,0,0,24-24V159.08l27.39,23a8,8,0,0,0,13.11-6.13v-96A8,8,0,0,0,251.77,73ZM200,184a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8H192a8,8,0,0,1,8,8Zm48-10.7-32-26.85V109.54l32-26.84Z"/></svg>',
    imagePlus: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,40H32A16,16,0,0,0,16,56V200a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V56A16,16,0,0,0,224,40ZM72,88a12,12,0,1,1-12,12A12,12,0,0,1,72,88Zm152,112H32v-6.06L86.34,139.6a8,8,0,0,1,11.32,0l26.34,26.35,34.35-34.36a8,8,0,0,1,11.32,0L224,185.33Zm0-44.44-42.67-42.68a24,24,0,0,0-33.95,0L118.34,134.3,101,117a24,24,0,0,0-33.94,0L32,152.1V56H224ZM188,80H172V64a8,8,0,0,0-16,0V80H140a8,8,0,0,0,0,16h16v16a8,8,0,0,0,16,0V96h16a8,8,0,0,0,0-16Z" transform="translate(0 4)"/></svg>',
    frameRatio: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,44H40A12,12,0,0,0,28,56V200a12,12,0,0,0,12,12H216a12,12,0,0,0,12-12V56A12,12,0,0,0,216,44Zm4,156a4,4,0,0,1-4,4H40a4,4,0,0,1-4-4V56a4,4,0,0,1,4-4H216a4,4,0,0,1,4,4ZM188,168a8,8,0,0,1-8,8H76a8,8,0,0,1-6.86-12.09l52-88a8,8,0,0,1,13.73,0l52,88A8,8,0,0,1,188,168ZM90.77,160h74.46L128,91.69Z" transform="translate(0-4)"/></svg>',
    photoCam: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M208,56H180.28L166.65,35.56A16,16,0,0,0,153.44,28H102.56a16,16,0,0,0-13.21,7.56L75.71,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,44h55.43l13.63,20.44A8,8,0,0,0,176,68h32a8,8,0,0,1,8,8ZM128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,156Z" transform="translate(0 0)"/></svg>',
    fullscreen: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M208,34H182a6,6,0,0,0,0,12h26a4,4,0,0,1,4,4v26a6,6,0,0,0,12,0V50A18,18,0,0,0,206,34ZM80,210v-2H50a4,4,0,0,1-4-4V178a6,6,0,0,0-12,0v26a18,18,0,0,0,18,18H80a6,6,0,0,0,0-12Zm136-32v26a18,18,0,0,1-18,18H182a6,6,0,0,1,0-12h26a4,4,0,0,0,4-4V178a6,6,0,0,1,12,0ZM50,90a6,6,0,0,0,6-6V58a4,4,0,0,1,4-4H80a6,6,0,0,0,0-12H50A18,18,0,0,0,32,60V84A6,6,0,0,0,38,90Z" transform="translate(4 4)"/></svg>',
    download: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56h160V152a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,132.69V40a8,8,0,0,0-16,0v92.69L93.66,106.34a8,8,0,0,0-11.32,11.32Z"/></svg>',
    film: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,36H40A20,20,0,0,0,20,56V200a20,20,0,0,0,20,20H216a20,20,0,0,0,20-20V56A20,20,0,0,0,216,36ZM76,140V116h32v24Zm32,16v24H76V156Zm-12-72a12,12,0,1,1,12,12A12,12,0,0,1,96,84Zm-4,52a12,12,0,1,1,12,12A12,12,0,0,1,92,136Zm12,48a12,12,0,1,1,12,12A12,12,0,0,1,104,184ZM36,56a4,4,0,0,1,4-4H60V92H44a8,8,0,0,1-8-8Zm0,104a8,8,0,0,1,8-8H60v36H40a4,4,0,0,1-4-4Zm180,40a4,4,0,0,1-4,4H196V164h16a8,8,0,0,1,8,8Zm0-56a8,8,0,0,1-8,8H196V108h16a8,8,0,0,1,8,8Zm0-56a8,8,0,0,1-8,8H196V52h16a4,4,0,0,1,4,4Z" transform="translate(0 0)"/></svg>',
    chevronDown: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M128,184a8,8,0,0,1-5.66-2.34l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32l-80,80A8,8,0,0,1,128,184Z"/></svg>',
    search: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>',
    moveCursor: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M136,40V98.4l11.57-11.57a32,32,0,0,1,45.26,0l25.38,25.38a32,32,0,0,1,0,45.25l-56.57,56.57a32,32,0,0,1-45.25,0L91,188.68a32,32,0,0,1-9.39-24.53L40,163.5a8,8,0,0,1-3.09-14.09L124.09,40h0A8,8,0,0,1,136,40Z" opacity="0.3"/><path d="M135.15,116.28l-16.69,16.7a8,8,0,0,1-11.31-11.32l16.69-16.69a8,8,0,0,1,11.31,11.31Z" transform="translate(8 8)"/></svg>',
    panorama: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48a15.86,15.86,0,0,0-9.88,3.42C193.6,61.4,176.9,68,160,68a79.2,79.2,0,0,1-32-6.75A95.24,95.24,0,0,0,90.67,52c-19.86,0-40,8.24-56.55,15.42A15.91,15.91,0,0,0,24.44,81.9L39.77,195.85A16.1,16.1,0,0,0,55.65,209a15.63,15.63,0,0,0,8-2.19C76.22,198.42,92.13,192,107.33,192A79.2,79.2,0,0,1,139.33,199,95.24,95.24,0,0,0,177.33,208c19.87,0,40-8.25,56.56-15.43A15.89,15.89,0,0,0,243.56,178L228.22,64.15A16,16,0,0,0,216,48Zm11.94,136.85a.29.29,0,0,1-.15.15C212.15,191.68,194.23,200,177.33,200a79.2,79.2,0,0,1-32-6.75A95.24,95.24,0,0,0,107.33,184c-17.49,0-35.53,7.27-51.7,14.51L40.31,79.68a.29.29,0,0,1,.15-.15C55.85,72.32,73.77,64,90.67,64a79.2,79.2,0,0,1,32,6.75A95.24,95.24,0,0,0,160,76c17.48,0,35.53-7.27,51.69-14.51L227.69,176.32A.29.29,0,0,1,227.94,184.85Z"/></svg>',
    cube: '<svg width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M227.35,75.61l-.07-.11-16.65-28.09-.08-.13A16,16,0,0,0,196.77,40H59.23a16,16,0,0,0-13.78,7.28l-.08.13L28.72,75.5l-.07.11A16,16,0,0,0,27,83.12V200a16,16,0,0,0,16,16H213a16,16,0,0,0,16-16V83.12A16,16,0,0,0,227.35,75.61ZM196.77,56l9.33,15.75L215.7,88H167.78L151.5,56ZM159.71,104,143.43,136H112.57L96.29,104ZM93.41,88H40.3l9.6-16.25L59.23,56H76.5L92.78,88ZM59.23,200l14.17-80H90.86l16.28,32.44a8,8,0,0,0,7.15,4.41h37.42a8,8,0,0,0,7.15-4.41L175.14,120h17.46l14.17,80Z"/></svg>',
    loop: '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M80,40V56H64A16,16,0,0,0,48,72V192a16,16,0,0,0,16,16h96a16,16,0,0,0,16-16V168h16v24a32,32,0,0,1-32,32H64a32,32,0,0,1-32-32V72A32,32,0,0,1,64,40ZM232,64V184a8,8,0,0,1-13.66,5.66L188,159.31V184a16,16,0,0,1-16,16H76a8,8,0,0,1-5.66-13.66L152,104V72a16,16,0,0,1,16-16h48A16,16,0,0,1,232,72Zm-64,8L100.68,139.31,152,190.63V176h20Z" transform="scale(0.92)"/></svg>',
    menu: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M228,128a20,20,0,1,1-20-20A20,20,0,0,1,228,128ZM48,108a20,20,0,1,0,20,20A20,20,0,0,0,48,108Zm0-68A20,20,0,1,0,68,60,20,20,0,0,0,48,40Zm0,136A20,20,0,1,0,68,196,20,20,0,0,0,48,176ZM128,40a20,20,0,1,0,20,20A20,20,0,0,0,128,40Zm0,68a20,20,0,1,0,20,20A20,20,0,0,0,128,108Zm0,68a20,20,0,1,0,20,20A20,20,0,0,0,128,176ZM208,40a20,20,0,1,0,20,20A20,20,0,0,0,208,40Zm0,68a20,20,0,1,0,20,20A20,20,0,0,0,208,108Zm0,68a20,20,0,1,0,20,20A20,20,0,0,0,208,176Z"/></svg>',
    panelLeft: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.13 0c1.72 0 3.12 1.4 3.12 3.13v8.33c0 1.72-1.4 3.12-3.12 3.12h-10A3.1 3.1 0 0 1 0 11.46V3.12C0 1.4 1.4 0 3.13 0zm-7.3 13.33h7.3c1.03 0 1.87-.84 1.87-1.87V3.12c0-1.03-.84-1.87-1.87-1.87h-7.3zM3.13 1.25c-1.04 0-1.88.84-1.88 1.88v8.33c0 1.03.84 1.87 1.88 1.87h1.45V1.25z" transform="translate(0 0.8222) scale(0.984615)"/></svg>',
    panelRight: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M16.57 0C18.47 0 20 1.54 20 3.43v13.14c0 1.9-1.54 3.43-3.43 3.43H3.25A3.43 3.43 0 0 1 0 16.57V3.43A3.43 3.43 0 0 1 3.25 0zM3.43 1.8c-.9 0-1.63.73-1.63 1.63v13.14c0 .9.73 1.63 1.63 1.63h13.14c.9 0 1.63-.73 1.63-1.63V3.43c0-.9-.73-1.63-1.63-1.63zM15.29 3c.94 0 1.71.77 1.71 1.71V15.3c0 .94-.77 1.71-1.71 1.71H12.7c-.94 0-1.71-.77-1.71-1.71V4.7c0-.94.77-1.71 1.71-1.71z"/></svg>',
    upload: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M74.34,85.66a8,8,0,0,1,0-11.32l48-48a8,8,0,0,1,11.32,0l48,48a8,8,0,0,1-11.32,11.32L136,59.31V168a8,8,0,0,1-16,0V59.31L85.66,85.66A8,8,0,0,1,74.34,85.66ZM216,168v40a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V168a8,8,0,0,1,16,0v40H200V168a8,8,0,0,1,16,0Z"/></svg>',
  };

  function buildShell() {
    const shell = document.createElement('div');
    shell.className = 'director-modal';
    shell.id = 'directorDeskModal';
    shell.innerHTML = `
      <div class="director-shell">
        <div class="dt-mode-dock">
          <div class="director-mode-toggle">
            <button type="button" data-dt-mode="director" class="is-active">导演视角</button>
            <button type="button" data-dt-mode="camera">机位视角</button>
          </div>
        </div>
        <aside class="director-sidebar director-sidebar-left">
          <div class="dt-sb-head">
            <button type="button" class="dt-sb-head-btn" data-dt-close title="关闭导演台" aria-label="关闭导演台">${ICONS.close}</button>
            <span class="dt-sb-head-title">3D导演台</span>
            <button type="button" class="dt-sb-head-btn dt-sb-collapse-btn" data-dt-sbtoggle data-dt-sbcollapse title="收起">${ICONS.panelLeft}</button>
          </div>
          <div class="dt-sb-body">
            <div class="dt-sb-rail">
              <button type="button" data-dt-sbrail="scene" class="is-active" title="场景">${ICONS.cube}</button>
            <button type="button" data-dt-sbrail="addchar" title="添加角色">${ICONS.person}</button>
            <button type="button" data-dt-sbrail="addcam" title="添加机位">${ICONS.videoCam}</button>
            <button type="button" data-dt-sbrail="pano" title="全景图">${ICONS.panorama}</button>
            <button type="button" data-dt-sbrail="aspect" title="选择画幅比例">${ICONS.frameRatio}</button>
            <button type="button" data-dt-sbshot title="当前视角截图">${ICONS.photoCam}</button>
            <button type="button" data-dt-sbblender title="Blender 本地建模" aria-label="Blender 本地建模">${ICONS.cube}</button>
            <button type="button" data-dt-sbfs title="全屏">${ICONS.fullscreen}</button>
          </div>
          <section class="director-panel dt-sb-panel" id="dtSbPanel">
            <div class="dt-sb-page" data-sbpage="scene">
              <h2 class="dt-sb-page-title"><span>场景</span><button type="button" class="dt-scene-settings" data-dt-scene-settings>调整参数</button></h2>
              <div class="dt-tree-search"><input type="text" id="dtTreeSearch" placeholder="请输入搜索内容">${ICONS.search}</div>
              <div class="director-tree" id="dtObjectTree"></div>
            </div>
            <div class="dt-sb-page" data-sbpage="addchar" hidden>
              <h2 class="dt-sb-page-title">添加角色</h2>
              <div class="dt-sb-list">
                <button type="button" class="dt-sb-item" data-dt-localmodel>${ICONS.upload}<span class="truncate">本地上传</span></button>
                ${[['sam', '标准男性'], ['female', '标准女性'], ['muscular', '健硕'], ['slim', '纤细'], ['teen', '少年'], ['child', '儿童'], ['broad', '宽厚'], ['chibi', '二头身']].map(([k, label]) => `<button type="button" class="dt-sb-item" data-dt-addchar="${k}">${ICONS.person}<span class="truncate">${label}</span></button>`).join('')}
                <button type="button" class="dt-sb-item" data-dt-addcrowd="3x3">${ICONS.person}<span class="truncate">群众 (3×3)</span></button>
              </div>
              <div class="dt-addchar-group" data-dt-geogroup>
                <button type="button" class="dt-sb-item" data-dt-geotoggle>${ICONS.frameRatio}<span class="truncate">几何模型</span></button>
                <div class="dt-sb-list dt-sb-sub" id="dtGeoSub" hidden>
                  ${GEOMETRY_TYPES.map(g => `<button type="button" class="dt-sb-item" data-dt-addgeo="${g.key}">${ICONS.cube}<span class="truncate">${g.label}</span></button>`).join('')}
                </div>
              </div>
            </div>
            <div class="dt-sb-page" data-sbpage="addcam" hidden>
              <h2 class="dt-sb-page-title">添加机位</h2>
              <div class="dt-card-grid" id="dtCamPresetGrid">
                <button type="button" class="dt-card" data-dt-addcampreset="">${ICONS.videoCam}<span class="truncate">当前视角</span></button>
                ${CAM_SHOT_PRESETS.map(p => `<button type="button" class="dt-card" data-dt-addcampreset="${esc(p.id)}">${ICONS.videoCam}<span class="truncate">${esc(p.label)}</span></button>`).join('')}
              </div>
            </div>
            <div class="dt-sb-page" data-sbpage="pano" hidden>
              <h2 class="dt-sb-page-title">全景图</h2>
              <div class="dt-sb-list" id="dtPanoList">
                <button type="button" class="dt-sb-item" data-dt-pano-local>${ICONS.upload}<span class="truncate">本地上传</span></button>
                <button type="button" class="dt-sb-item" data-dt-pano-history>${ICONS.film}<span class="truncate">历史记录</span></button>
                <button type="button" class="dt-sb-item" data-dt-pano-ai>${ICONS.imagePlus}<span class="truncate">AI生成</span></button>
              </div>
            </div>
            <div class="dt-sb-page" data-sbpage="aspect" hidden>
              <h2 class="dt-sb-page-title">选择画幅比例</h2>
              <div class="dt-card-grid" id="dtAspectGrid">
                ${ASPECT_RATIOS.map(([label]) => `<button type="button" class="dt-card" data-dt-setaspect="${esc(label)}"><span class="truncate">${esc(label)}</span></button>`).join('')}
              </div>
            </div>
          </section>
          </div>
        </aside>
        <div class="director-viewport-wrap">
          <div class="director-viewport-main">
            <div class="director-canvas-holder" id="dtCanvasHolder"></div>
            <div class="dt-compare-split" id="dtCompareSplit">
              <div class="dt-compare-divider"></div>
              <span class="dt-compare-tag">导演视角<b>· 编辑</b></span>
              <span class="dt-compare-tag is-cam" id="dtCompareCamTag">机位视角<b>· 机位01</b></span>
            </div>
            <div class="dt-viewfinder" id="dtViewfinder" data-dt-viewfinder-label="机位01"></div>
            <div class="dt-aspect-frame-label" id="dtAspectFrameLabel" hidden>16:9</div>
            <div class="director-viewport-toolbar" role="toolbar" aria-label="3D视口快捷工具" hidden>
              <button type="button" data-dt-add="character" title="添加角色">${ICONS.personPlus}</button>
              <button type="button" id="dtImportPanorama" title="导入全景图">${ICONS.panorama}</button>
              <button type="button" data-dt-add="camera" title="添加机位">${ICONS.videoCam}</button>
              <button type="button" id="dtAspectBtn" title="选择画幅比例">${ICONS.frameRatio}</button>
              <button type="button" id="dtScreenshot" title="当前视角截图">${ICONS.photoCam}</button>
              <button type="button" id="dtFullscreen" title="全屏">${ICONS.fullscreen}</button>
            </div>
            <div class="director-task-overlay" id="dtTaskOverlay" hidden><div class="director-task-card"><span id="dtTaskText">处理中…</span><button type="button" data-dt-task-cancel>取消</button></div></div>
            <div class="dt-axis-compass" id="dtAxisCompass">
              <div class="dt-axis-compass-canvas"><canvas width="72" height="72"></canvas></div>
              <div class="dt-axis-compass-hits">
                <button type="button" class="dt-axis-hit is-x-positive" data-dt-axis-btn="x+" title="切换到 X 正向视图"></button>
                <button type="button" class="dt-axis-hit is-y-positive" data-dt-axis-btn="y+" title="切换到 Y 正向视图"></button>
                <button type="button" class="dt-axis-hit is-z-positive" data-dt-axis-btn="z+" title="切换到 Z 正向视图"></button>
                <button type="button" class="dt-axis-hit is-x-negative" data-dt-axis-btn="x-" title="切换到 X 反向视图"></button>
                <button type="button" class="dt-axis-hit is-y-negative" data-dt-axis-btn="y-" title="切换到 Y 反向视图"></button>
                <button type="button" class="dt-axis-hit is-z-negative" data-dt-axis-btn="z-" title="切换到 Z 反向视图"></button>
              </div>
              <button type="button" class="dt-reset-view" id="dtResetView" title="恢复正面视角与默认焦距">重置视角</button>
            </div>
          </div>
          <footer class="director-timeline" id="dtTimeline">
            <div class="director-timeline-toolbar"></div>
            <div class="director-timeline-body" id="dtTimelineBody">
              <div class="dt-track-labels" id="dtTrackLabels"></div>
              <div class="dt-track-scroll" id="dtTrackScroll"><div class="dt-track-content" id="dtTrackContent"></div></div>
            </div>
            <div class="dt-resize-handle" id="dtTimelineResize"></div>
          </footer>
        </div>
        <aside class="director-sidebar director-sidebar-right">
          <section class="director-panel">
            <h2 class="director-panel-title" id="dtInspectorTitle">场景</h2>
            <div class="director-inspector" id="dtInspector"></div>
          </section>
        </aside>
      </div>
      <div class="dt-cam-preview-fullscreen" id="dtCamPreviewFullscreen" hidden role="dialog" aria-modal="true" aria-label="机位实时预览">
        <header><strong id="dtCamPreviewFullscreenTitle">机位实时预览</strong><button type="button" data-dt-preview-close aria-label="关闭全屏预览">${ICONS.close}</button></header>
        <div id="dtCamPreviewFullscreenHost"></div>
      </div>`;
    document.body.appendChild(shell);
    shell.querySelector('#dtCamPreviewFullscreen').addEventListener('keydown', event => {
      if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.querySelector('button').focus(); }
    });
    S.el = {
      shell, holder: shell.querySelector('#dtCanvasHolder'), tree: shell.querySelector('#dtObjectTree'),
      inspector: shell.querySelector('#dtInspector'), inspectorTitle: shell.querySelector('#dtInspectorTitle'),
      timelineBody: shell.querySelector('#dtTimelineBody'), trackLabels: shell.querySelector('#dtTrackLabels'),
      trackScroll: shell.querySelector('#dtTrackScroll'), trackContent: shell.querySelector('#dtTrackContent'),
      timecodeInput: shell.querySelector('#dtTimecodeInput'), frameNumber: shell.querySelector('#dtFrameNumber'),
      workIn: shell.querySelector('#dtWorkIn'), workOut: shell.querySelector('#dtWorkOut'),
      durationSec: shell.querySelector('#dtDurationSec'), interpSelect: shell.querySelector('#dtInterp'),
      autoKeyBtn: shell.querySelector('#dtAutoKey'), aspectFrameLabel: shell.querySelector('#dtAspectFrameLabel'),
      playBtn: shell.querySelector('[data-dt-play]'),
      loopBtn: shell.querySelector('[data-dt-loop]'), zoomInput: shell.querySelector('#dtZoom'),
      taskOverlay: shell.querySelector('#dtTaskOverlay'), taskText: shell.querySelector('#dtTaskText'),
      recordBtn: shell.querySelector('[data-dt-record]'), timeline: shell.querySelector('#dtTimeline'),
      treeSearch: shell.querySelector('#dtTreeSearch'), aspectBtn: shell.querySelector('#dtAspectBtn'),
      compareSplit: shell.querySelector('#dtCompareSplit'),
      compareCamTag: shell.querySelector('#dtCompareCamTag'), viewfinder: shell.querySelector('#dtViewfinder'),
    };
    return shell;
  }

  /* ============================================================
     3D 视口
     ============================================================ */
  function createDirectorRenderer(THREE,options={}) {
    try{return new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,...options});}
    catch(error){
      if(!/creating WebGL context/i.test(error.message||''))throw error;
      console.warn('[director] 默认 WebGL 配置不可用，尝试关闭抗锯齿');
      return new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power',...options});
    }
  }
  function releaseViewportResources() {
    cancelAnimationFrame(S.raf);cancelAnimationFrame(S.camPreviewRaf);clearInterval(S.watchdog);S.watchdog=0;clearTimeout(S.hiddenTimer);S.hiddenTimer=0;
    S.viewportResizeObserver?.disconnect();S.viewportResizeObserver=null;
    const dispose=resource=>{try{resource?.dispose();}catch(error){console.warn('[director] 释放视口组件失败',error);}};
    dispose(S.controls);dispose(S.poseEditor);S.poseEditor=null;dispose(S.pathEditor);S.pathEditor=null;
    try{S.previsGizmoCleanup?.();}catch(error){console.warn('[director] 释放操作控件失败',error);}S.previsGizmoCleanup=null;for(const g of S.previsGizmos||[])dispose(g);S.previsGizmos=null;S.transformControl=null;S.transformProxy=null;
    const renderers=new Set([S.renderer,S.camPreviewRenderer,S.compareRenderer].filter(Boolean));
    for(const renderer of renderers){try{renderer.dispose();}catch(error){console.warn('[director] 释放渲染器失败',error);}try{renderer.forceContextLoss();}catch(error){console.warn('[director] 释放上下文失败',error);}renderer.domElement?.remove();}
    S.labelLayer?.remove();S.renderer=null;S.camPreviewRenderer=null;S.compareRenderer=null;S.scene=null;S.camera=null;S.controls=null;S.compass=null;S.envRoot=null;S.camPreviewCamera=null;S.labelLayer=null;
    S.sceneObjects.clear();S.rigs.clear();S.keyNudges.clear();
  }
  function showViewportInitializationError(error) {
    const webgl=/WebGL.*context/i.test(error.message||''),layer=document.createElement('div');layer.className='dt-init-error';layer.setAttribute('role','alert');
    layer.innerHTML='<section><h3>'+ (webgl?'浏览器 3D 渲染暂不可用':'3D 场景初始化失败') +'</h3><p>'+(webgl?'浏览器未能创建 WebGL 上下文。可先重试；若仍失败，请关闭其他 3D 页面并重启应用，让浏览器重新启动图形进程。':'初始化依赖未能正常加载，请重试。')+'</p><small></small><div><button type="button" data-init-close>返回画布</button><button type="button" data-init-retry>重新初始化</button></div></section>';
    layer.querySelector('small').textContent=error.message||String(error);
    const node=S.nodeEl,readOnly=S.readOnly,epoch=S.animationEpoch;
    layer.querySelector('[data-init-close]').onclick=()=>close();
    layer.querySelector('[data-init-retry]').onclick=async()=>{if(!S.open||S.animationEpoch!==epoch)return;layer.querySelector('[data-init-retry]').disabled=true;close();await new Promise(resolve=>setTimeout(resolve,250));if(!S.open)await open(node,{readOnly});};
    S.el.shell.append(layer);layer.querySelector('[data-init-retry]').focus();
  }
  async function initViewport() {
    const viewportEpoch=S.animationEpoch;
    const { THREE, GLTFLoader, CameraControls, SkeletonUtils, TransformControls } = await loadThree();
    if(!S.open||S.animationEpoch!==viewportEpoch)return;
    S.three = THREE;
    S.skeletonUtils = SkeletonUtils;
    const holder = S.el.holder;
    const w = holder.clientWidth || 800, h = holder.clientHeight || 500;
    const renderer = createDirectorRenderer(THREE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
    renderer.setSize(w, h);
    holder.appendChild(renderer.domElement);
    S.renderer = renderer;

    const scene = new THREE.Scene();
    const bg = new THREE.Color(S.project.scene.backgroundColor || '#141414');
    scene.background = bg;
    S.scene = scene;
    // 场景根（S.envRoot）：场景缩放/平移/旋转作用于整个场景
    // （网格/地面/全景/几何体 + 人物/机位——人物跟随缩放，与"场景缩放"语义一致）
    // 缩放原点 = envRoot 自身原点；配合 position（场景平移）实现"围绕人物站位的轴心"缩放
    const envRoot = new THREE.Group();
    envRoot.name = 'dtEnvRoot';
    S.envRoot = envRoot;
    scene.add(envRoot);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 2000);
    camera.position.set(3.2, 1.8, 4.6);
    S.camera = camera;


    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(8, 10, 6);
    scene.add(dir);

    // 地面网格（原生实现 drei Grid 的简化：主网格线 + 淡色）
    S.grid = makeGrid(THREE);
    envRoot.add(S.grid);

    const planeMat = new THREE.MeshBasicMaterial({ color: 0x232323, transparent: true, opacity: S.project.scene.groundOpacity != null ? S.project.scene.groundOpacity : 0.45, depthWrite: false });
    S.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), planeMat);
    S.groundPlane.rotation.x = -Math.PI / 2;
    S.groundPlane.position.y = (S.project.scene.groundHeight || 0);
    S.groundPlane.userData.isGrid = true;
    envRoot.add(S.groundPlane);

    // 全景背景球（equirect 纹理贴 backside dome）
    S.panoramaDome = makePanoramaDome(THREE);
    envRoot.add(S.panoramaDome);


    S.labelLayer = document.createElement('div');
    S.labelLayer.className = 'dt-role-label-layer';
    S.el.holder.parentElement.appendChild(S.labelLayer);

    // 画幅框（取景参考线）
    S.aspectFrame = makeAspectFrame(THREE);
    S.camera.add(S.aspectFrame);
    scene.add(S.camera);

    // 相机控制
    CameraControls.install({ THREE });
    const controls = new CameraControls(camera, renderer.domElement);
    controls.azimuthRotateSpeed = 0.4; controls.polarRotateSpeed = 0.4;
    controls.dollyTo(6.4, true);
    S.controls = controls;
    S.clock = new THREE.Clock();

    // 导演视角罗盘与对象三轴变换分别控制视角、对象。
    initAxisCompass();
    initObjectGizmo(TransformControls);
    S.poseEditor = window.DirectorPoseEditor.create({S,TransformControls,
      limits:Object.fromEntries(POSE_AXIS_GROUPS.flatMap(g=>g.rows||g.sides.flatMap(s=>s[1])).map(([key,,min,max])=>[key,[min,max]])),
      visible:id=>Crowd.inherited(S.project,id,'visible'),locked:id=>Crowd.inherited(S.project,id,'locked'),trackLocked:id=>timeline.trackOf(id)?.locked,
      setPlaying,pushUndo,beginBatch,endBatch,persist,changePose:(obj,values)=>applyPoseValues(obj,values,false),
    });
    S.pathEditor = window.DirectorPathEditor.create({S,TransformControls,
      visible:id=>!!id&&Crowd.inherited(S.project,id,'visible'),locked:id=>Crowd.inherited(S.project,id,'locked'),
      trackOf:id=>timeline.trackOf(id),isDrawing:()=>timeline.isDrawing(),commitPath:()=>timeline.commitPath(),
      setPlaying,pushUndo,beginBatch,endBatch,persist,renderInspector,
    });

    // 模型加载
    const loader = new GLTFLoader();
    const base = new URL('.', document.baseURI||location.href).href.replace(/\/[^/]*$/, '/');
    const modelUrl = (S.project.modelUrl || 'assets3d/models/epic-ue4-mannequin.glb') + '?v=dir1';
    try {
      const gltf = await loader.loadAsync(modelUrl);
      if(!S.open||viewportEpoch!==S.animationEpoch)return;
      S.modelProto = gltf;
      S.modelProtos = { mannequin: gltf };
    } catch (e) {
      console.warn('[director] 模型加载失败，使用程序化素体', e);
    }
    // Load the authored body type before the first scene rebuild. Otherwise reopen
    // briefly applies a saved SAM pose to the UE fallback skeleton (68 vs 41 bones).
    S.modelProtos = S.modelProtos || {};
    S.localPrototypeLoads = new Map();
    S.localModelProtosByUrl = new Map();
    const samLoads = new Map();
    const loadSamBody = (key) => {
      const spec = SAM_MODELS[key];
      if (!spec || S.modelProtos[key]) return Promise.resolve(S.modelProtos[key]);
      if (samLoads.has(key)) return samLoads.get(key);
      const promise = loader.loadAsync(base + spec.file + '?v=sam1').then(g2 => {
        if(!S.open||viewportEpoch!==S.animationEpoch)return null;
        S.modelProtos[key] = g2;
        for (const o of S.project.objects) {
          if (o.kind === 'character' && o.bodyType === key && S.sceneObjects.has(o.id)) rebuildObjectMesh(o);
        }
        return g2;
      }).catch(e => {
        console.warn('[director] ' + key + ' 模型加载失败', e);
        samLoads.delete(key); // Explicit retry may succeed without reopening the editor.
        return null;
      });
      samLoads.set(key,promise);
      return promise;
    };
    S.loadSamBody = loadSamBody;
    const allBodies = Object.keys(SAM_MODELS);
    const authoredBodies = new Set(S.project.objects.filter(o=>o.kind==='character'&&!o.local&&SAM_MODELS[o.bodyType||'sam']).map(o=>o.bodyType||'sam'));
    if(!S.project.objects.length)authoredBodies.add('sam');
    // Avoid eight simultaneous GLB downloads competing with the initial page load.
    // Required bodies always load first; unused bodies warm up one at a time.
    for (const key of authoredBodies) await loadSamBody(key);
    if(!S.open||viewportEpoch!==S.animationEpoch)return;
    const allSamReady = (async()=>{ for (const key of allBodies) {
      if (!S.open || viewportEpoch!==S.animationEpoch) return;
      await loadSamBody(key);
    } })();
    allSamReady.then(() => {
      if (S.open && viewportEpoch===S.animationEpoch && allBodies.every(key=>S.modelProtos[key])) toast('SAM 全系素体已就绪');
    });

    for(const obj of S.project.objects.filter(o=>o.local&&o.modelUrl)){try{const proto=await loadStoredPrototype(obj);if(!S.open||viewportEpoch!==S.animationEpoch)return;S.modelProtos[obj.id]=proto;}catch(error){toast(obj.name+'：'+error.message);}}
    bindViewportEvents();
    animate();
    startHiddenWatchdog();
    // WebGL 上下文丢失（显存耗尽/驱动重置）兜底：默认 canvas 合成成空白（用户看到"全白"）。
    // 恢复流程：强制 WebGLRenderer 重建上下文 → 全量重建场景对象（共享几何会重新上传一次）。
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      if(!S.open||S.renderer!==renderer||S.animationEpoch!==viewportEpoch)return;
      e.preventDefault();
      console.warn('[director] WebGL 上下文丢失，自动恢复中');
      toast('3D 上下文丢失，正在恢复…');
      setTimeout(async () => {
        if (!S.open || S.renderer!==renderer || S.animationEpoch!==viewportEpoch) return;
        try {
          renderer.forceContextRestore();
        } catch (err) { console.error('[director] 恢复失败', err); }
      }, 300);
    }, false);
    renderer.domElement.addEventListener('webglcontextrestored',()=>{if(!S.open||S.renderer!==renderer||S.animationEpoch!==viewportEpoch)return;rebuildAll();applySceneTransform();toast('3D 画面已恢复');});
  }

  function makeGrid(THREE) {
    const g = new THREE.GridHelper(200, 200, 0x3a3a3a, 0x262626);
    g.material.transparent = true;
    g.material.opacity = S.project.scene.gridOpacity != null ? S.project.scene.gridOpacity : 0.6;
    g.position.y = (S.project.scene.groundHeight || 0) + 0.001;
    g.userData.isGrid = true;
    return g;
  }
  function makePanoramaDome(THREE) {
    const geo = new THREE.SphereGeometry(60, 96, 64);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, color: 0x000000 });
    mat.visible = false;
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -1000;
    dome.visible = false;
    dome.userData.isPanorama = true;
    return dome;
  }
  function makeAspectFrame(THREE) {
    // 取景框：按 16:9 焦距参考（简化为视口内白框，挂在主相机上不参与渲染，挂在场景中由 updateAspect 摆放）
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthTest: false });
    const frame = new THREE.LineSegments(geo, mat);
    frame.visible = false;
    return frame;
  }
  function updateAspectFrame() {

    if (S.aspectFrame) S.aspectFrame.visible = false;
    if (S.three) for (const obj of S.project.objects) {
      if (obj.kind === 'camera') syncCameraGizmoFrustum(S.sampledObjects?.get(obj.id) || obj);
    }
  }

  // 机位 gizmo 朝向：+Z 镜头指向注视目标（three 里相机看向 -Z，但 gizmo 线框的
  // 镜头/视锥画在 +Z 方向，所以用 lookAt 后再翻 180°），叠加 Roll（旋转 Z 分量）
  function orientCameraGizmo(mesh, obj) {
    const THREE = S.three;
    if (!THREE || !mesh || !obj) return;
    delete mesh.userData.cameraOpticalQuaternion;
    if (obj.targetMode === 'rotation') {
      mesh.quaternion.setFromEuler(new THREE.Euler(...obj.transform.rotation.map(v=>(v||0)*Math.PI/180), 'YXZ'));
      if(mesh.parent){
        mesh.parent.updateWorldMatrix(true,false);
        mesh.userData.cameraOpticalQuaternion=mesh.parent.getWorldQuaternion(new THREE.Quaternion()).normalize().multiply(mesh.quaternion);
      }
      return;
    }
    const t = obj.target || [0, 1, 0];
    const m = new THREE.Matrix4().lookAt(
      new THREE.Vector3(...obj.transform.position),
      new THREE.Vector3(...t),
      new THREE.Vector3(0, 1, 0));
    mesh.quaternion.setFromRotationMatrix(m);
    mesh.rotateY(Math.PI); // lookAt 让 -Z 指向目标；gizmo 镜头朝 +Z，翻半圈
    // Existing projects used X/Y as offsets from lookAt. Keep that convention until
    // the user explicitly edits an orientation mode in the new camera inspector.
    if (!obj.cameraRotationAbsolute) {
      mesh.rotateX((obj.transform.rotation[0]||0)*Math.PI/180);
      mesh.rotateY((obj.transform.rotation[1]||0)*Math.PI/180);
    }
    mesh.rotateZ((obj.transform.rotation[2] || 0) * Math.PI / 180);
    if(obj.cameraRotationAbsolute&&mesh.parent){
      mesh.parent.updateWorldMatrix(true,false);
      const parentQ=mesh.parent.getWorldQuaternion(new THREE.Quaternion()).normalize();
      const p=mesh.parent.localToWorld(new THREE.Vector3(...obj.transform.position));
      const target=mesh.parent.localToWorld(new THREE.Vector3(...t));
      const up=new THREE.Vector3(0,1,0).applyQuaternion(parentQ);
      const worldQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p,target,up));
      worldQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
      worldQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),(obj.transform.rotation[2]||0)*Math.PI/180));
      // Nonuniform parent scale must not skew an optical direction. The frustum,
      // preview and export share this orthonormal pose rather than matrix shear.
      mesh.userData.cameraOpticalQuaternion=worldQ;
      mesh.quaternion.copy(parentQ.invert().multiply(worldQ));
    }
  }

  // Bindings are resolved only after every actor/group has been sampled. Their
  // positions are converted through the scene graph, never taken from stale data.
  function cameraTargetPoint(camera, id, gaze=false) {
    const target=S.project.objects.find(o=>o.id===id&&['character','group'].includes(o.kind));
    const mesh=target&&S.sceneObjects.get(id),parent=S.sceneObjects.get(camera.id)?.parent;
    if(!mesh||!parent)return null;
    mesh.updateWorldMatrix(true,false);parent.updateWorldMatrix(true,false);
    const p=mesh.getWorldPosition(new S.three.Vector3());
    if(gaze&&target.kind==='character')p.y+=1.2;
    return parent.worldToLocal(p).toArray();
  }
  function cameraFollowDelta(camera) {
    const target=cameraTargetPoint(camera,camera.followTargetId);
    if(!target)return [0,0,0];
    const anchor=camera.followAnchor||camera.transform.position.map((v,i)=>v-(camera.followOffset?.[i]||0));
    return target.map((v,i)=>v-anchor[i]);
  }
  function resolveCameraBindings(value) {
    const mesh=S.sceneObjects.get(value.id),T=S.three;
    if(value.followTargetId){
      const delta=cameraFollowDelta(value);
      value.transform.position=value.transform.position.map((v,i)=>v+delta[i]);
      if(value.followViewMode==='firstPerson'){
        const target=S.sceneObjects.get(value.followTargetId);
        if(target){
          const q=target.getWorldQuaternion(new T.Quaternion()).normalize();
          const parentQ=mesh.parent.getWorldQuaternion(new T.Quaternion()).normalize();
          q.premultiply(parentQ.invert());
          value.transform.rotation=new T.Euler().setFromQuaternion(q,'YXZ').toArray().slice(0,3).map(v=>v*180/Math.PI);
          value.targetMode='rotation';
        }
      }
    }
    if(value.targetMode==='object'){
      const target=cameraTargetPoint(value,value.lookAtTargetId,true);
      if(target){value.target=target;value.cameraRotationAbsolute=true;}
    }
    return value;
  }
  function cameraInspectorValue(obj) {
    if(obj.kind!=='camera')return timeline.sampled(obj);
    const value=timeline.sampled(obj),mesh=S.sceneObjects.get(obj.id);
    if(obj.followTargetId){const anchor=obj.followAnchor||cameraTargetPoint(obj,obj.followTargetId)||[0,0,0];value.transform.position=value.transform.position.map((v,i)=>v-anchor[i]);}
    if(mesh)value.transform.rotation=new S.three.Euler().setFromQuaternion(mesh.quaternion,'YXZ').toArray().slice(0,3).map(v=>round3(v*180/Math.PI));
    return value;
  }
  function shiftCameraPosition(obj,delta) {
    obj.transform.position=obj.transform.position.map((v,i)=>v+delta[i]);
    const track=timeline.trackOf(obj.id);
    for(const [i,ch]of Animation.GROUPS.position.entries())for(const key of track?.channels?.[ch]||[])key.value+=delta[i];
    if(track?.path?.origin)track.path.origin=track.path.origin.map((v,i)=>v+delta[i]);
  }
  function freezeCameraDirection(obj) {
    const mesh=S.sceneObjects.get(obj.id),value=S.sampledObjects.get(obj.id)||timeline.sampled(obj);
    if(!mesh)return;
    mesh.updateWorldMatrix(true,false);
    const p=mesh.getWorldPosition(new S.three.Vector3());
    const oldTarget=mesh.parent.localToWorld(new S.three.Vector3(...(value.target||obj.target)));
    const distance=Math.max(.01,oldTarget.distanceTo(p)||10);
    const q=mesh.userData.cameraOpticalQuaternion||mesh.getWorldQuaternion(new S.three.Quaternion()).normalize();
    const target=new S.three.Vector3(0,0,1).applyQuaternion(q).multiplyScalar(distance).add(p);
    obj.target=mesh.parent.worldToLocal(target).toArray();
    obj.transform.rotation=new S.three.Euler().setFromQuaternion(mesh.quaternion,'YXZ').toArray().slice(0,3).map(v=>v*180/Math.PI);
    obj.cameraRotationAbsolute=true;
  }
  function prepareCameraManualRotation(obj,previous) {
    if(obj.targetMode==='rotation'&&obj.followViewMode!=='firstPerson')return;
    const mesh=S.sceneObjects.get(obj.id),track=timeline.trackOf(obj.id);
    const angles=new S.three.Euler().setFromQuaternion(mesh.quaternion,'YXZ').toArray().slice(0,3).map(v=>v*180/Math.PI);
    const original=Animation.clone(obj),source=track&&Animation.clone(track);
    const frames=[...new Set(Animation.GROUPS.rotation.flatMap(ch=>(source?.channels?.[ch]||[]).map(k=>k.frame)))];
    for(const frame of frames){
      let out=angles;
      if(original.targetMode!=='object'&&original.followViewMode!=='firstPerson'){
        const value=Animation.sampleObject(original,source,frame),proxy=new S.three.Group();
        if(source.path?.follow&&!original.cameraRotationAbsolute){
          const yaw=value.transform.rotation[1]*Math.PI/180,p=value.transform.position;
          value.target=[p[0]+Math.sin(yaw),p[1],p[2]+Math.cos(yaw)];value.transform.rotation[1]=0;
        }
        orientCameraGizmo(proxy,value);
        out=new S.three.Euler().setFromQuaternion(proxy.quaternion,'YXZ').toArray().slice(0,3).map(v=>v*180/Math.PI);
      }
      for(const [i,ch]of Animation.GROUPS.rotation.entries()){
        const old=source.channels[ch]?.find(k=>k.frame===frame);
        const key=Animation.putKey(track,ch,frame,out[i],old?.interp||'linear');
        if(old?.source)key.source=old.source;
      }
    }
    // Auto-key's initial frame must contain the actual previous optical angles.
    if(previous)previous.transform.rotation=angles.slice();
  }
  function changeCameraBinding(input) {
    const obj=S.project.objects.find(o=>o.id===S.selectedId&&o.kind==='camera');
    if(!obj||Crowd.inherited(S.project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked){renderInspector();return;}
    pushUndo();sampleAtFrame(S.playhead);
    const previous=timeline.sampled(obj),resolved=S.sampledObjects.get(obj.id),kind=input.dataset.dtCameraBinding;
    if(kind==='follow'||kind==='view'){
      const id=kind==='follow'?input.value:obj.followTargetId;
      const point=cameraTargetPoint(obj,id);
      // Rebase authored position channels by a constant, retaining existing camera
      // motion while freezing the visible position when a binding is removed.
      const delta=resolved.transform.position.map((v,i)=>v-previous.transform.position[i]);
      shiftCameraPosition(obj,delta);
      delete obj.followTargetId;delete obj.followAnchor;delete obj.followOffset;
      if(point){
        obj.followTargetId=id;obj.followAnchor=point;
        obj.followViewMode=kind==='view'?input.value:(obj.followViewMode||'thirdPerson');
        if(obj.followViewMode==='firstPerson'){
          const desired=cameraTargetPoint(obj,id,true);
          const raw=timeline.sampled(obj).transform.position;
          shiftCameraPosition(obj,desired.map((v,i)=>v-raw[i]));
        }
        obj.followOffset=timeline.sampled(obj).transform.position.map((v,i)=>v-point[i]);
      }else{
        if(obj.followViewMode==='firstPerson'){prepareCameraManualRotation(obj,previous);freezeCameraDirection(obj);obj.targetMode='rotation';timeline.edit(obj,'旋转',previous);}
        delete obj.followViewMode;
      }
    }else if(kind==='look'){
      if(input.value==='__rotation__')prepareCameraManualRotation(obj,previous);
      freezeCameraDirection(obj);
      obj.targetMode=input.value==='__rotation__'?'rotation':input.value?'object':'manual';
      if(obj.targetMode==='object')obj.lookAtTargetId=input.value;else delete obj.lookAtTargetId;
      if(obj.targetMode==='rotation')timeline.edit(obj,'旋转',previous);
      if(obj.targetMode==='manual')timeline.edit(obj,'注视坐标',previous);
    }
    sampleAtFrame(S.playhead);persist();renderInspector();refreshTracks();
  }

  // 渲染相机 ← 机位 gizmo 世界姿态（唯一取景基准）：
  // 从场景 mesh 的世界矩阵直接取位姿，场景缩放/平移/旋转、荷兰角 roll 一次继承，
  // 且 roll 旋向与 gizmo 线框严格一致（绕 gizmo 本地 Z，翻 Y 后即相机本地 -Z）。
  // 无 mesh 时回退到工程数据 + envRoot 变换换算。预览小窗 / 对比视角 / 机位视角统一走这里，
  // 三条路径画面完全一致。
  function syncRenderCameraFromGizmo(renderCam, camObj) {
    const THREE = S.three;
    if (!THREE || !renderCam || !camObj) return;
    camObj = S.sampledObjects?.get(camObj.id) || camObj;
    renderCam.fov = Math.max(1, Math.min(179, camObj.fov || 50));
    const g = S.sceneObjects.get(camObj.id);
    if (g) {
      renderCam.position.setFromMatrixPosition(g.matrixWorld);
      const q = g.userData.cameraOpticalQuaternion?.clone() || g.getWorldQuaternion(new THREE.Quaternion()).normalize();
      // gizmo 镜头朝 +Z，渲染相机看向 -Z：绕 gizmo 本地 Y 翻 180°（与 orientCameraGizmo 同约定）
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      renderCam.quaternion.copy(q);
    } else {
      // 回退：工程数据本地坐标 → envRoot 世界坐标
      const sc = S.project.scene;
      const s = sc.scale != null ? sc.scale : 1;
      const off = sc.position || [0, 0, 0];
      const p = camObj.transform.position, t = camObj.target || [0, 1, 0];
      renderCam.position.set(p[0] * s + off[0], p[1] * s + off[1], p[2] * s + off[2]);
      renderCam.lookAt(t[0] * s + off[0], t[1] * s + off[1], t[2] * s + off[2]);
      renderCam.rotateZ((camObj.transform.rotation[2] || 0) * Math.PI / 180);
    }
    renderCam.updateProjectionMatrix();
  }

  /* ---------- 场景对象 → three 对象 ---------- */
  function createSceneObject(obj) {
    const THREE = S.three;
    if (!THREE) return null;
    let mesh = null;
    if (obj.kind === 'group') {
      mesh = new THREE.Group(); mesh.name = obj.name || '分组'; mesh.userData.dtGroup = true;
    } else if (obj.local) {
      const proto=S.localModelProtosByUrl?.get(obj.modelUrl)||S.modelProtos?.[obj.id];if(!proto?.scene)return null;mesh=S.skeletonUtils.clone(proto.scene);
    } else if (obj.kind === 'character') {
      const protos = S.modelProtos || {};
      const proto = protos[obj.id] || protos[obj.bodyType] || (obj.bodyType !== 'mannequin' ? (protos.sam || protos.mannequin) : protos.mannequin) || S.modelProto;
      if (proto && Rig) {
        const made = Rig.cloneActor(THREE, S.skeletonUtils.clone, proto, { color: obj.color || '#4f8ef7', local: !!obj.local, bodyType: obj.bodyType || 'sam' });
        mesh = made.actor; S.rigs.set(obj.id, made.rig);
      } else if (proto) mesh = S.skeletonUtils.clone(proto.scene);
      else mesh = makeProceduralBody(THREE, obj.bodyType);
    } else if (obj.kind === 'camera') {
      // 黄色实体相机、黑色镜头与画幅视锥。
      mesh = makeCameraGizmo(THREE, obj);
      orientCameraGizmo(mesh, obj);
    } else if (obj.kind === 'geometry') {
      mesh = obj.whitebox && window.DirectorSceneAgent ? window.DirectorSceneAgent.meshFor(THREE,obj.whitebox,obj.color) : makeGeometry(THREE, obj.geometryType);
    }
    if (!mesh) return null;
    // All built-in actors use the authored color, including fallback geometry.
    // Clone materials so repainting one actor cannot recolor its prototype or siblings.
    if (obj.kind === 'character' && !obj.local && !S.rigs.has(obj.id)) mesh.traverse(c => {
      if (!c.isMesh || !c.material) return;
      const tint = material => { const m = material.clone(); m.map = null; m.color?.set(obj.color || '#4f8ef7'); return m; };
      c.material = Array.isArray(c.material) ? c.material.map(tint) : tint(c.material);
    });
    applyTransform(mesh, obj.transform, { keepQuaternion: obj.kind === 'camera', isCharacter: false });
    mesh.traverse(c => { c.userData.dtObjectId = obj.id; });
    mesh.userData.dtObjectId = obj.id;
    if (obj.visible === false) mesh.visible = false;
    const parent = obj.parentId && S.sceneObjects.get(obj.parentId) || S.envRoot;
    parent.add(mesh); S.sceneObjects.set(obj.id, mesh);

    if(obj.kind==='character'&&!obj.local&&!S.rigs.has(obj.id))storeBindPoses(obj.id);
    if(obj.kind==='character'&&obj.poseControls)applyPoseControls(obj,obj.poseControls);
    return mesh;
  }
  function makeProceduralBody(THREE, bodyType) {

    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xb0b0b5, roughness: 0.74, metalness: 0.04 });
    const scale = bodyType === 'child' ? 0.6 : bodyType === 'teen' ? 0.8 : 1;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * scale, 0.42 * scale, 6, 12), mat);
    torso.position.y = 1.0 * scale;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 16, 16), mat);
    head.position.y = 1.48 * scale;
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * scale, 0.6 * scale, 4, 8), mat);
    legL.position.set(-0.09 * scale, 0.34 * scale, 0);
    const legR = legL.clone(); legR.position.x = 0.09 * scale;
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.045 * scale, 0.5 * scale, 4, 8), mat);
    armL.position.set(-0.24 * scale, 1.05 * scale, 0); armL.rotation.z = 0.15;
    const armR = armL.clone(); armR.position.x = 0.24 * scale; armR.rotation.z = -0.15;
    g.add(torso, head, legL, legR, armL, armR);
    return g;
  }
  // Camera body and lens follow the supplied reference; optics use the same projection as the preview.
  const CAM_LINE_COLOR = 0x527f99, CAM_LINE_OPACITY = 0.58, CAM_XI = 0.35;
  let _camGizmoShared = null;
  function migrateCameraAspects(proj) {
    // Freeze the old shared output ratio once; subsequent director framing changes never alter cameras.
    const legacy = ASPECT_RATIOS.some(r => r[0] === proj.scene?.aspectRatio) ? proj.scene.aspectRatio : '16:9';
    for (const cam of [...(proj.objects || []).filter(o=>o.kind==='camera'), ...(proj.cameras || [])]) {
      if (!ASPECT_RATIOS.some(r => r[0] === cam.aspectRatio)) cam.aspectRatio = legacy;
    }
  }
  function cameraAspect(camObj = activeCameraObj()) {
    const row = ASPECT_RATIOS.find(r => r[0] === (camObj?.aspectRatio || '16:9'));
    if (row?.[1] > 0) return row[1];
    const holder = S.el?.holder || S.renderer?.domElement;
    return holder?.clientWidth > 0 && holder?.clientHeight > 0 ? holder.clientWidth / holder.clientHeight : 16/9;
  }
  function getCamGizmoShared(THREE) {
    if (_camGizmoShared?.THREE === THREE) return _camGizmoShared;
    const Xi=CAM_XI,parts=[];
    const gold=new THREE.MeshStandardMaterial({color:0xf0a817,emissive:0xf0a817,emissiveIntensity:.25,roughness:.65});
    const dark=new THREE.MeshStandardMaterial({color:0x22252b,roughness:.48});
    const rim=new THREE.MeshStandardMaterial({color:0x39424c,roughness:.5,metalness:.25});
    const glass=new THREE.MeshStandardMaterial({color:0x101c2b,roughness:.25,metalness:.35});
    const box=(size,position,material=gold)=>parts.push({geometry:new THREE.BoxGeometry(...size.map(v=>v*Xi)),material,position:position.map(v=>v*Xi)});
    const cylinder=(radius,length,position,material,rotation=[Math.PI/2,0,0])=>parts.push({geometry:new THREE.CylinderGeometry(radius*Xi,radius*Xi,length*Xi,24),material,position:position.map(v=>v*Xi),rotation});
    box([.68,1.1,.72],[0,-.02,-.8]);
    box([.60,.45,.50],[0,.75,-.82]);
    box([.60,.25,.28],[0,.60,-1.15]);
    // The lens front is local z=0, also the render camera's optical origin.
    cylinder(.31,.12,[0,0,-.36],rim);
    cylinder(.26,.25,[0,0,-.20],dark);
    cylinder(.29,.06,[0,0,-.045],rim);
    cylinder(.225,.02,[0,0,-.01],glass);
    cylinder(.10,.08,[0,.84,-.475],dark);
    cylinder(.085,.06,[0,.62,-.48],dark);
    cylinder(.09,.035,[-.355,.20,-.86],dark,[0,0,Math.PI/2]);
    const lineMat=new THREE.LineBasicMaterial({color:CAM_LINE_COLOR,transparent:true,opacity:CAM_LINE_OPACITY,depthWrite:false});
    const hitMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
    const hitGeo=new THREE.BoxGeometry(1.1*Xi+.08,1.65*Xi+.06,1.5*Xi+.08);
    return _camGizmoShared={THREE,parts,lineMat,hitMat,hitGeo};
  }
  function makeCameraGizmo(THREE, obj) {
    const g=new THREE.Group(),shared=getCamGizmoShared(THREE);
    const body=new THREE.Group();body.name='dt-camera-body';
    for(const part of shared.parts){
      const mesh=new THREE.Mesh(part.geometry,part.material);
      mesh.position.fromArray(part.position);if(part.rotation)mesh.rotation.fromArray(part.rotation);
      mesh.userData.dtObjectId=obj.id;body.add(mesh);
    }
    g.add(body);
    const frustumGroup=new THREE.Group();frustumGroup.name='dt-frustum';
    const frustumLines=[];
    for(let i=0;i<8;i++){
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
      const line=new THREE.Line(geo,shared.lineMat);frustumLines.push(line);frustumGroup.add(line);
    }
    g.add(frustumGroup);g.userData.frustumLines=frustumLines;
    updateCameraFrustum(g,obj);
    const hit=new THREE.Mesh(shared.hitGeo,shared.hitMat);
    hit.position.set(0,.2*CAM_XI,-.65*CAM_XI);
    hit.userData.dtObjectId=obj.id;hit.userData.isCameraHit=true;g.add(hit);
    return g;
  }
  function updateCameraFrustum(camGroup, obj) {
    if(!camGroup?.userData.frustumLines)return;
    const fov=Math.max(1,Math.min(179,obj.fov||50)),aspect=cameraAspect(obj);
    const stamp=fov+':'+aspect;
    if(camGroup.userData.frustumShape!==stamp){
      const t=5.2*CAM_XI,h=Math.tan(fov*Math.PI/360)*t,w=h*aspect;
      const origin=[0,0,0],corners=[[-w,h,t],[w,h,t],[w,-h,t],[-w,-h,t]];
      const segs=[[origin,corners[0]],[origin,corners[1]],[origin,corners[2]],[origin,corners[3]],[corners[0],corners[1]],[corners[1],corners[2]],[corners[2],corners[3]],[corners[3],corners[0]]];
      camGroup.userData.frustumLines.forEach((line,i)=>{
        const attr=line.geometry.attributes.position;attr.array.set([...segs[i][0],...segs[i][1]]);
        attr.needsUpdate=true;line.geometry.computeBoundingSphere();
      });
      camGroup.userData.frustumShape=stamp;
    }
    // Keep the optical cone correct when the camera model or its group is scaled.
    const frame=camGroup.getObjectByName('dt-frustum'),THREE=S.three;
    camGroup.updateWorldMatrix(true,false);
    const position=camGroup.getWorldPosition(new THREE.Vector3()),q=camGroup.userData.cameraOpticalQuaternion?.clone()||camGroup.getWorldQuaternion(new THREE.Quaternion()).normalize();
    const scale=Math.abs(camGroup.getWorldScale(new THREE.Vector3()).z)||1;
    frame.matrixAutoUpdate=false;
    frame.matrix.copy(camGroup.matrixWorld).invert().multiply(new THREE.Matrix4().compose(position,q,new THREE.Vector3(scale,scale,scale)));
    frame.matrixWorldNeedsUpdate=true;
    frame.visible=S.viewMode!=='camera';
  }
  function makeGeometry(THREE, type) {
    let geo;
    switch (type) {
      case 'sphere': geo = new THREE.SphereGeometry(0.5, 24, 24); break;
      case 'cylinder': geo = new THREE.CylinderGeometry(0.4, 0.4, 0.9, 24); break;
      case 'torus': geo = new THREE.TorusGeometry(0.42, 0.14, 16, 40); break;
      case 'cone': geo = new THREE.ConeGeometry(0.45, 0.9, 24); break;
      case 'pyramid': geo = new THREE.ConeGeometry(0.5, 0.8, 4); break;
      default: geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.75 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = (S.project.scene.groundHeight || 0) + (type === 'sphere' ? 0.5 : type === 'box' || type === 'pyramid' ? 0.4 : 0.45);
    return m;
  }
  function applyTransform(mesh, t, opts) {
    if (!t) return;
    // 角色/机位直接挂 S.scene（真实尺寸与位置），场景缩放不影响它们 → 不做场景缩放补偿
    if (t.position) mesh.position.fromArray(t.position);
    // 相机 gizmo 的姿态由"位置→注视目标"决定（createSceneObject 内 lookAt 计算），
    // 用欧拉旋转覆盖会把朝向清零；其余对象照常应用欧拉旋转。
    if (t.rotation && !(opts && opts.keepQuaternion)) mesh.rotation.set(t.rotation[0] * Math.PI / 180, t.rotation[1] * Math.PI / 180 + (opts && opts.modelYaw || 0), t.rotation[2] * Math.PI / 180);
    if (t.scale) {
      mesh.scale.set(t.scale[0], t.scale[1], t.scale[2]);
    }
  }

  /* ---------- 动画采样：应用角色轨 + 对象关键帧轨 ---------- */
  function sampleAtFrame(frame) {
    if (!S.project || !S.three) return;
    S.sampledObjects ||= new Map();
    for (const obj of S.project.objects) {
      const mesh = S.sceneObjects.get(obj.id);
      if (!mesh) continue;
      const track = timeline.trackOf(obj.id);
      const value = Animation.sampleObject(obj, track, frame);
      S.sampledObjects.set(obj.id, value);
      applyTransform(mesh, value.transform, {keepQuaternion: obj.kind === 'camera', isCharacter: false});
      if (obj.kind === 'character') {
        const rig=S.rigs.get(obj.id);
        const editingPose=!S.playing&&!S.recording&&S.charTab==='pose'&&S.selectedId===obj.id;
        const walk=editingPose?null:Animation.samplePathWalk(obj,track,frame,S.project.sequence.fps);
        if(walk){
          const neutral={...POSE_PRESETS[0].controls,'body.offsetY':obj.poseControls?.['body.offsetY']||0};
          for(const ch of Animation.channels('pose'))if(track?.channels?.[ch]?.length)neutral[ch.slice(5)]=value.poseControls[ch.slice(5)];
          applyPoseControls(obj,walk.action==='run'&&Rig.runControls?Rig.runControls(walk.seconds,neutral):Rig.walkControls(walk.seconds,neutral));
          if(rig)rig.walking=true;
        }else if(rig?.walking||Animation.entries(track||{channels:{}},'pose').length){
          if(rig)rig.walking=false;applyPoseControls(obj,value.poseControls||{});
        }
      }
    }
    S.scene?.updateMatrixWorld(true);
    // Cameras may precede their targets in project.objects; a second pass makes
    // playback, arbitrary seeks and offline fractional-frame export identical.
    for (const obj of S.project.objects.filter(o=>o.kind==='camera')) {
      const mesh=S.sceneObjects.get(obj.id),value=S.sampledObjects.get(obj.id);if(!mesh||!value)continue;
        const path = timeline.trackOf(obj.id)?.path;
        if (path?.follow && !obj.cameraRotationAbsolute && obj.targetMode!=='object' && obj.targetMode!=='rotation') {
          const yaw=value.transform.rotation[1]*Math.PI/180, p=value.transform.position;
          value.target=[p[0]+Math.sin(yaw),p[1],p[2]+Math.cos(yaw)];value.transform.rotation[1]=0; // heading already encoded in target
        }
        resolveCameraBindings(value);
        applyTransform(mesh,value.transform,{keepQuaternion:true});
        orientCameraGizmo(mesh, value);
        updateCameraFrustum(mesh, value);
    }
    syncObjectGizmo();
    S.scene?.updateMatrixWorld(true);
  }





  function storeBindPoses(objId) {
    const mesh = S.sceneObjects.get(objId);
    if (!mesh) return;
    const binds = new Map();
    mesh.traverse(o => {
      if (o.isBone) binds.set(o.name, {
        quat: o.quaternion.clone(), pos: o.position.clone(),
        parent: o.parent && o.parent.isBone ? o.parent.name : '',
      });
    });
    // 计算绑定世界四元数与世界位置（traverse 顺序父在子前）
    const identity = new S.three.Quaternion();
    const worlds = new Map();
    const worldPos = new Map();
    for (const [name, b] of binds) {
      const isRoot = !(b.parent && binds.get(b.parent));
      const qp = isRoot ? identity : worlds.get(b.parent);
      worlds.set(name, new S.three.Quaternion().copy(qp).multiply(b.quat));
      const off = new S.three.Vector3().copy(b.pos).applyQuaternion(qp);
      const pp = isRoot ? new S.three.Vector3() : worldPos.get(b.parent);
      worldPos.set(name, new S.three.Vector3().copy(pp).add(off));
    }
    for (const [name, b] of binds) { b.world = worlds.get(name); b.worldPos = worldPos.get(name); }
    // 记录绑定姿态最低点（贴地基准，供姿势应用后自动落地）
    try {
      mesh.updateWorldMatrix(true, true);
      const box = new S.three.Box3().setFromObject(mesh, true);
      const inv = new S.three.Matrix4().copy(mesh.matrixWorld).invert();
      const lowLocal = new S.three.Vector3(mesh.position.x, box.min.y, mesh.position.z).applyMatrix4(inv).y;
      binds.set('groundY', lowLocal);
    } catch (e) { /* 忽略贴地基准计算失败 */ }
    S.bindPoses.set(objId, binds);
  }




  const POSE_LTV_BIND = 40.5;    // UE 男性素体绑定姿势上臂与竖直方向的夹角
  const POSE_LTV_RATIO = 1.0; // 内部展角 → 实际偏离竖直角度的比例（T型标定）
  const POSE_SAM_BIND = 0;      
  // SAM 模型骨骼名映射（语义键 → SAM 骨架实际骨骼名）
  const SAM_BONES = {
    pelvis: 'Pelvis', spine_03: 'Spine02', head: 'Head',
    upperarm_l: 'L_Upperarm', lowerarm_l: 'L_Forearm', hand_l: 'L_Hand',
    upperarm_r: 'R_Upperarm', lowerarm_r: 'R_Forearm', hand_r: 'R_Hand',
    thigh_l: 'L_Thigh', calf_l: 'L_Calf', foot_l: 'L_Foot',
    thigh_r: 'R_Thigh', calf_r: 'R_Calf', foot_r: 'R_Foot',
  };
  function applyPoseControls(obj, controls) {
    const rig = S.rigs?.get(obj.id);
    if (rig) {const stamp=JSON.stringify(controls||{});if(rig.poseStamp!==stamp){rig.apply(controls||{});rig.poseStamp=stamp;}return;}
    const mesh = S.sceneObjects.get(obj.id);
    const binds = S.bindPoses.get(obj.id);
    if (!mesh || !binds || !S.three) return;
    if (controls && !controls._c2) controls = {}; // 旧版符号数据一律按归零处理（= 校准中性姿势）
    const isSam = !!SAM_MODELS[obj.bodyType];
    const bn = k => (isSam && SAM_BONES[k]) ? SAM_BONES[k] : k; // SAM 骨骼名映射
    const bindBase = isSam ? POSE_SAM_BIND : POSE_LTV_BIND;    // 外展基准角（按模型绑定姿势）
    const clampRad = e => e * Math.PI / 180;
    const n = k => (controls[k] != null ? controls[k] : 0);
    const Q = S.three.Quaternion, V3 = S.three.Vector3;
    // 全骨骼复位到绑定
    mesh.traverse(o => {
      if (!o.isBone) return;
      const b = binds.get(o.name);
      if (b) { o.quaternion.copy(b.quat); o.position.copy(b.pos); }
    });
    const AX_X = new V3(1, 0, 0), AX_Y = new V3(0, 1, 0), AX_Z = new V3(0, 0, 1);
    const posedWorld = new Map();
    const applyTo = (boneName, rotList) => {
      const bind = binds.get(boneName);
      const bone = mesh.getObjectByName(boneName);
      if (!bind || !bone) return;
      const qDelta = new Q();
      for (const rot of rotList) {
        qDelta.multiply(new Q().setFromAxisAngle(rot.axis, clampRad(rot.degrees)));
      }
      // 模型空间增量 → 父骨骼当前帧空间（链式：膝/肘跟随已摆的髋/肩）
      const qParent = posedWorld.get(bind.parent) || (binds.get(bind.parent) ? binds.get(bind.parent).world : new Q());
      const qDeltaParent = new Q().copy(qParent).invert().multiply(qDelta).multiply(qParent);
      const qLocal = new Q().copy(qDeltaParent).multiply(bind.quat);
      bone.quaternion.copy(qLocal);
      posedWorld.set(boneName, new Q().copy(qParent).multiply(qLocal));
    };
    // 骨骼方向轴（twist 用）
    const boneDir = (boneName) => {
      const childName = { upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r', thigh_l: 'calf_l', calf_l: 'foot_l', thigh_r: 'calf_r', calf_r: 'foot_r' }[boneName];
      const b = binds.get(boneName);
      if (!childName || !binds.get(childName)) return new V3(0, 1, 0);
      return new V3().copy(binds.get(childName).worldPos).sub(b.worldPos).normalize();
    };
    // 躯干类：yaw(Y) → pitch(X，+值=前倾) → roll(Z)
    const seg = (bone, ctrl) => applyTo(bone, [
      { axis: AX_Y, degrees: n(ctrl + '.yaw') },
      { axis: AX_X, degrees: n(ctrl + '.pitch') },
      { axis: AX_Z, degrees: n(ctrl + '.roll') },
    ]);
    seg(bn('pelvis'), 'body'); seg(bn('spine_03'), 'torso'); seg(bn('head'), 'head');
    for (const pair of [['left', 'l'], ['right', 'r']]) {
      const full = pair[0], s = pair[1], mir = s === 'l' ? -1 : 1;
      const ua = bn('upperarm_' + s), uaDir = boneDir(ua);
      // 肩：外展以竖直下垂为 0（补偿 A-pose 绑定角）；前举+ 向前；扭转随镜像
      const spreadInternal = mir * (n(full + 'Shoulder.spread') - bindBase) / POSE_LTV_RATIO;
      applyTo(ua, [
        { axis: uaDir, degrees: n(full + 'Shoulder.twist') * mir },
        { axis: AX_Z, degrees: -spreadInternal },
        { axis: AX_X, degrees: -n(full + 'Shoulder.pitch') },
      ]);
      const la = bn('lowerarm_' + s);



      const elbowDeg = n(full + 'Elbow.bend');
      if (elbowDeg) {
        if (isSam) {


          const gam = 70 * Math.PI / 180;
          const axis = new V3(Math.sin(gam) * mir, 0, Math.cos(gam));
          applyTo(la, [
            { axis: AX_Z, degrees: elbowDeg * mir },
            { axis, degrees: elbowDeg },
          ]);
        } else {
          const qUposed = posedWorld.get(ua);
          if (qUposed) {
            const qFore0 = new Q().copy(qUposed).multiply(binds.get(la).quat);
            const axis = new V3(0, 0, 1).applyQuaternion(qFore0);
            applyTo(la, [{ axis, degrees: -elbowDeg }]);
          }
        }
      }
      const th = bn('thigh_' + s), thDir = boneDir(th);
      applyTo(th, [
        { axis: thDir, degrees: n(full + 'Hip.twist') * mir },
        { axis: AX_Z, degrees: -n(full + 'Hip.spread') * mir },
        { axis: AX_X, degrees: -n(full + 'Hip.pitch') },
      ]);
      const ca = bn('calf_' + s);
      applyTo(ca, [{ axis: AX_X, degrees: n(full + 'Knee.bend') }]);
    }
    // 手动骨盆偏移（微调用）+ 自动贴地：把姿势后身体最低点落回绑定地面高度
    if (controls['body.offsetY']) {
      const pb = binds.get('pelvis');
      const pelvis = mesh.getObjectByName('pelvis');
      if (pb && pelvis) pelvis.position.y = pb.pos.y + controls['body.offsetY'];
    }
    if (controls['body.autoGround'] !== false && binds.get('groundY') != null) {
      const pelvis = mesh.getObjectByName('pelvis');
      const groundY = binds.get('groundY');
      if (pelvis && groundY != null) {
        mesh.updateWorldMatrix(true, true);
        const box = new S.three.Box3().setFromObject(mesh, true);
        const inv = new S.three.Matrix4().copy(mesh.matrixWorld).invert();
        const lowLocal = new S.three.Vector3(mesh.position.x, box.min.y, mesh.position.z).applyMatrix4(inv).y;
        pelvis.position.y += groundY - lowLocal;
      }
    }
  }
  // 调试钩子：姿势符号标定 / 数值验证用（__poseDebug.apply controls 到当前角色）
  window.__poseDebug = {
    S,
    presets: POSE_PRESETS,
    applyPreset(id) {
      const preset = POSE_PRESETS.find(p => p.id === id);
      const obj = S.project && S.project.objects.find(o => o.kind === 'character');
      if (!preset || !obj) return null;
      applyPoseControls(obj, preset.controls || {});
      return obj.id;
    },
    apply(controls, objId) {
      const obj = S.project.objects.find(o => o.kind === 'character' && (!objId || o.id === objId));
      if (!obj) return null;
      applyPoseControls(obj, controls);
      return obj.id;
    },
    bonePos(objId, names) {
      const mesh = S.sceneObjects.get(objId);
      if (!mesh || !S.three) return null;
      mesh.updateWorldMatrix(true, true);
      const inv = new S.three.Matrix4().copy(mesh.matrixWorld).invert();
      const out = {};
      for (const nm of names) {
        const b = mesh.getObjectByName(nm);
        if (b) {
          const v = b.getWorldPosition(new S.three.Vector3()).applyMatrix4(inv);
          out[nm] = { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) };
        }
      }
      return out;
    },
    bones(objId) {
      const mesh = S.sceneObjects.get(objId);
      const list = [];
      mesh && mesh.traverse(o => { if (o.isBone) list.push(o.name); });
      return list;
    },
    step: (dt) => stepFrame(dt || 0.016),
  };

  async function applyPosePreset(id) {
    const obj = S.project.objects.find(o => o.id === S.selectedId && o.kind === 'character');
    if (!obj) return;
    const preset = POSE_PRESETS.find(p => p.id === id);
    if (!preset) return;
    pushUndo();
    obj.poseMode='static';setPlaying(false);
    obj.poseControls = Object.assign({ _c2: 1 }, preset.controls || {},{_rigAxes:Rig.AXES_VERSION});
    obj.poseName = preset.label;
    sampleAtFrame(S.playhead);
    applyPoseControls(obj, obj.poseControls);
    renderInspector(); // 同步姿势调节滑杆数值
    persist(); toast('已应用姿势「' + preset.label + '」');
  }
  function resetCharacterPose() {
    const obj = S.project.objects.find(o => o.id === S.selectedId && o.kind === 'character');
    if (!obj) return;
    pushUndo();
    obj.poseMode='static';setPlaying(false);
    obj.poseControls = {_c2:1,_rigAxes:Rig.AXES_VERSION};
    obj.poseName = '';
    sampleAtFrame(S.playhead);
    applyPoseControls(obj, {}); // 全骨骼复位到校准中性姿势
    renderInspector(); // 同步姿势调节滑杆数值
    persist(); toast('已重置全部姿势参数');
  }

  function snapCharacterToGround() {
    const obj = S.project.objects.find(o => o.id === S.selectedId);
    const mesh=obj&&S.sceneObjects.get(obj.id);
    if (!mesh||Crowd.inherited(S.project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked) return;
    setPlaying(false);sampleAtFrame(S.playhead);
    const box=window.DirectorGround.bounds(S.three,mesh,S.envRoot);
    if(box.isEmpty())return;
    const previous=timeline.sampled(obj),delta=window.DirectorGround.localDisplacement(S.three,S.envRoot,mesh.parent,(S.project.scene.groundHeight||0)-box.min.y);
    pushUndo();
    obj.transform.position=previous.transform.position.map((value,i)=>value+delta[i]);
    timeline.edit(obj,'位置',previous);sampleAtFrame(S.playhead);
    persist(); renderInspector(); toast('已吸附到地面');
  }
  function setGroundHeight(height){
    const scene=S.project.scene,delta=height-(scene.groundHeight||0);
    if(!delta)return;
    S.scene?.updateMatrixWorld(true);
    for(const obj of S.project.objects){
      if(!obj.followGround)continue;
      // A followed ancestor already carries this object through the same displacement.
      let parentId=obj.parentId,carried=false;
      const seen=new Set([obj.id]);
      while(parentId&&!seen.has(parentId)){seen.add(parentId);const parent=S.project.objects.find(o=>o.id===parentId);if(!parent)break;if(parent.followGround){carried=true;break;}parentId=parent.parentId;}
      if(carried)continue;
      const mesh=S.sceneObjects.get(obj.id);if(!mesh)continue;
      const shift=window.DirectorGround.localDisplacement(S.three,S.envRoot,mesh.parent,delta);
      window.DirectorGround.translateMotion(obj,timeline.trackOf(obj.id),shift);
    }
    scene.groundHeight=height;
    if(S.grid)S.grid.position.y=height+.001;
    if(S.groundPlane)S.groundPlane.position.y=height;
    sampleAtFrame(S.playhead);timeline.refresh();
  }

  function resetCharacterTransform() {
    const obj = S.project.objects.find(o => o.id === S.selectedId);
    if (!obj) return;
    pushUndo();
    if(Crowd.inherited(S.project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked)return;
    const previous=timeline.sampled(obj);
    obj.transform = defaultTransform();
    obj.transform.scale.fill(uniformScaleBase(obj));
    for(const label of ['位置','旋转','缩放'])timeline.edit(obj,label,previous);
    const mesh = S.sceneObjects.get(obj.id);
    if (mesh) applyTransform(mesh, obj.transform, { keepQuaternion: obj.kind === 'camera', isCharacter: false });
    if (obj.kind === 'camera') orientCameraGizmo(mesh, obj);
    persist(); renderInspector(); toast('已重置全部变换参数');
  }

  /* ---------- 主循环 ---------- */
  let lastPlayheadFloat = 0;
  function stepFrame(dtOverride) {
    // 单帧推进（rAF 正常路径直接内联在 animate；hidden 兜底走这里）
    // dt 钳制在 0.1s 内：rAF 断链恢复后 clock.getDelta() 会返回巨大的累积间隔，
    // 不钳制会让播放头一帧跳到末尾。
    const dt = dtOverride != null ? dtOverride : Math.min(0.1, S.clock.getDelta());

    if (S.keyNudges && S.keyNudges.size && S.viewMode === 'director' && S.controls) {
      const dtc = Math.min(dt, 0.05);
      const SPEED = 4 * dtc, VERT = 3 * dtc;
      const pos = S.camera.position.clone();
      const target = S.controls.getTarget(new S.three.Vector3());
      const fwd = target.clone().sub(pos); fwd.y = 0; // 沿地面平移,不随俯仰起伏
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); else fwd.normalize();
      const right = new S.three.Vector3().crossVectors(fwd, new S.three.Vector3(0, 1, 0)).normalize();
      const delta = new S.three.Vector3();
      if (S.keyNudges.has('moveForward')) delta.addScaledVector(fwd, SPEED);
      if (S.keyNudges.has('moveBackward')) delta.addScaledVector(fwd, -SPEED);
      if (S.keyNudges.has('strafeLeft')) delta.addScaledVector(right, -SPEED);
      if (S.keyNudges.has('strafeRight')) delta.addScaledVector(right, SPEED);
      if (S.keyNudges.has('moveDown')) delta.y -= VERT;
      if (S.keyNudges.has('moveUp')) delta.y += VERT;
      // 位置与注视点同步平移 → 视角方向保持不变(setTarget 只动注视点,必须用 setLookAt 同时锚定两者)
      if (delta.lengthSq() > 0) {
        S.controls.setLookAt(
          pos.x + delta.x, pos.y + delta.y, pos.z + delta.z,
          target.x + delta.x, target.y + delta.y, target.z + delta.z,
          false
        );
      }
    }
    if (S.controls) S.controls.update(dt);
    if (S.playing && !S.recording) {
      lastPlayheadFloat += dt * S.project.sequence.fps * (S.playbackRate || 1);
      const range=S.loopWorkArea?S.workArea:[0,S.project.sequence.durationFrames-1];
      if(lastPlayheadFloat>=range[1]+1) {
        if(S.loopWorkArea)lastPlayheadFloat=range[0]+(lastPlayheadFloat-range[0])%(range[1]-range[0]+1);
        else {lastPlayheadFloat=range[1];setPlaying(false);}
      }
      const f=Math.floor(lastPlayheadFloat);
      if(f!==S.playhead)setPlayhead(f,{fromPlay:true});
    }
    sampleAtFrame(S.playhead);
    S.poseEditor?.update();
    S.pathEditor?.update();
    timeline?.syncPathVisibility();
    if (S.viewMode === 'compare') {
      renderCompareView(); // 对比模式：scissor 分屏（含机位 letterbox）
    } else if (S.previs?.active && S.previs.mode === 'film') {
      renderPrevisFilm();
    } else if (S.viewMode === 'camera') {
      renderCameraLetterbox(); 
    } else if (S.previs?.active) {
      const w=S.el.holder.clientWidth,h=S.el.holder.clientHeight;
      if(w&&h){S.camera.aspect=w/h;S.camera.updateProjectionMatrix();S.renderer.setScissorTest(false);S.renderer.setViewport(0,0,w,h);S.renderer.render(S.scene,S.camera);}
    } else {
      renderDirectorWithAspect(); 
    }
    renderCamPreview();
    S.previs?.update();
    syncViewportFields();
    updateRoleLabels();
    // 调试探针：渲染后立即 readPixels 验证 GPU 真实输出（排除合成器节流干扰）
    if (window.__dtPixelProbeWanted) {
      window.__dtPixelProbeWanted = false;
      try {
        const gl = S.renderer.getContext();
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        const px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let bright = 0, blue = 0;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i], g = px[i + 1], b = px[i + 2];
          if (r > 120 && g > 120 && b > 120) bright++;
          if (b > 150 && b - r > 30 && g > 120) blue++;
        }
        window.__dtPixelProbe = { bright, blue, w, h };
      } catch (e) { window.__dtPixelProbe = { error: String(e) }; }
    }
    drawAxisCompass();
  }
  function animate() {
    if (!S.open) return;
    S.rafAlive = Date.now(); // 心跳：watchdog 据此判断 rAF 是否还活着
    S.raf = requestAnimationFrame(animate);
    stepFrame();
  }
  // rAF 在页面被遮挡（document.hidden）时会被浏览器冻结，
  // animate() 停摆后不会再被调用——所以兜底必须独立于 rAF 启动：
  // 每 500ms 检查一次，hidden 且打开中就以 4fps 推进；
  // 页面恢复可见时若 rAF 已断链（animate 不再执行）则重启渲染循环。
  function startHiddenWatchdog() {
    if (S.watchdog) clearInterval(S.watchdog);
    S.watchdog = setInterval(() => {
      if (!S.open) { clearInterval(S.watchdog); S.watchdog = 0; return; }
      if (document.hidden) {
        if (S.renderer) stepFrame(0.25);
      } else if (!S.rafAlive || Date.now() - S.rafAlive > 1500) {
        // 可见但 rAF 断链（曾在隐藏期间冻结）：重启循环
        animate();
      }
    }, 500);
  }

  function setPlayhead(f, opts) {
    f=Math.max(0,Math.min(S.project.sequence.durationFrames-(opts?.fractional?1e-6:1),opts?.fractional?f:Math.round(f)));
    S.playhead=f;
    if(!opts?.fromPlay)lastPlayheadFloat=f;
    if(S.el.frameNumber)S.el.frameNumber.textContent=f+'f';
    sampleAtFrame(f);updatePlayheadUI();timeline?.updateUI();
  }
  function updatePlayheadUI() {
    const ph = S.el.trackContent && S.el.trackContent.querySelector('.dt-playhead');
    if (ph) ph.style.left = `${S.playhead * S.timelineZoom}px`;
  }




  const AXIS_COLORS = { x: '#ff6b6b', y: '#86a3d2', z: '#a8c7fa' };
  function initAxisCompass() {
    const wrap = S.el.shell.querySelector('#dtAxisCompass');
    if (!wrap) return;
    const canvas = wrap.querySelector('canvas');
    S.compass = { wrap, canvas, ctx: canvas.getContext('2d'), activeAxis: null };
    wrap.querySelector('#dtResetView').addEventListener('click', resetDirectorView);
    // 方向按钮：点击进入该轴拖拽
    wrap.querySelectorAll('[data-dt-axis-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => switchAxisView(btn.dataset.dtAxisBtn));
    });
  }
  function resetDirectorView() {
    if (!S.controls || !S.camera || S.recording) return;
    if (S.viewMode !== 'director') switchMode('director');
    S.envRoot.updateWorldMatrix(true, true);
    const T = S.three, box = new T.Box3().makeEmpty();
    // Recover the scene content even after orbiting or panning far away; helpers do not affect framing.
    for (const obj of S.project.objects) {
      if (!['character', 'geometry'].includes(obj.kind) || !Crowd.inherited(S.project, obj.id, 'visible')) continue;
      const mesh = S.sceneObjects.get(obj.id);
      if (mesh) box.union(window.DirectorGround.bounds(T, mesh, S.scene));
    }
    const center = box.isEmpty() ? new T.Vector3(0, 1, 0).applyMatrix4(S.envRoot.matrixWorld) : box.getCenter(new T.Vector3());
    S.camera.fov = 50;
    S.camera.aspect = (S.el.holder.clientWidth || 800) / (S.el.holder.clientHeight || 500);
    S.camera.up.set(0, 1, 0);
    S.controls.updateCameraUp();
    S.controls.setFocalOffset(0, 0, 0, false);
    const size = box.isEmpty() ? new T.Vector3() : box.getSize(new T.Vector3());
    const halfFov = Math.atan(Math.tan(25 * Math.PI / 180) * Math.min(1, S.camera.aspect || 1));
    const distance = Math.max(6.4, size.length() * .5 / Math.sin(halfFov) * 1.15);
    S.controls.setLookAt(center.x, center.y, center.z + distance, center.x, center.y, center.z, false);
    S.controls.update(0);
    S.camera.updateProjectionMatrix();
    S.savedDirectorPose = { p: S.camera.position.toArray(), t: center.toArray() };
    viewportSyncTimer = 0;
    syncViewportFields();
  }
  function drawAxisCompass() {
    const { ctx, canvas, wrap } = S.compass || {};
    const cam = S.camera;
    if (!ctx || !cam || !wrap || getComputedStyle(wrap).display === 'none') return;
    const W = canvas.width, R = W / 2;
    ctx.clearRect(0, 0, W, W);
    const camQuat = cam.quaternion.clone().invert();

    const axes = [
      { key: 'x', v: new S.three.Vector3(1, 0, 0) },
      { key: 'y', v: new S.three.Vector3(0, 1, 0) },
      { key: 'z', v: new S.three.Vector3(0, 0, 1) },
    ];
    const hitPos = {};
    for (const ax of axes) {
      const v = ax.v.clone().applyQuaternion(camQuat);
      const len = (R - 9) * Math.max(0.3, Math.sqrt(Math.max(0, 1 - Math.abs(v.z) * 0.5)));
      const sx = R + v.x * len, sy = R - v.y * len;
      // 细轴线
      ctx.beginPath();
      ctx.moveTo(R, R);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = '#ffffff57';
      ctx.lineWidth = 1;
      ctx.stroke();
      // 轴端彩色圆点（+ 端实心、- 端半透明）
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = AXIS_COLORS[ax.key];
      ctx.fill();
      ctx.beginPath();
      ctx.arc(R - (sx - R), R - (sy - R), 5, 0, Math.PI * 2);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = AXIS_COLORS[ax.key];
      ctx.fill();
      ctx.globalAlpha = 1;
      hitPos[ax.key + (v.x + v.y >= 0 ? '+' : '-')] = { x: sx - 7.5, y: sy - 7.5 };
      hitPos[ax.key + (v.x + v.y >= 0 ? '-' : '+')] = { x: R - (sx - R) - 7.5, y: R - (sy - R) - 7.5 };
    }
    S.compass.hitPos = hitPos;
    const place = (key, pos) => {
      const btn = wrap.querySelector('[data-dt-axis-btn="' + key + '"]');
      if (btn) { btn.style.left = pos.x + 'px'; btn.style.top = pos.y + 'px'; }
    };
    for (const [k, p] of Object.entries(hitPos)) place(k, p);
  }

  function switchAxisView(axisBtn) {
    if (!S.controls || !S.camera) return;

    if (S.viewMode === 'camera') return toast('机位视角为固定取景，切回导演视角后可旋转');
    const axis = axisBtn[0], sign = axisBtn[1] === '+' ? 1 : -1;
    // 以当前注视点为中心，从该轴正/负方向看向中心
    const t = S.controls.getTarget(new S.three.Vector3());
    const dist = S.camera.position.distanceTo(t) || 6;
    const dir = { x: axis === 'x' ? sign : 0, y: axis === 'y' ? sign : 0, z: axis === 'z' ? sign : 0 };
    // Y 轴视图给一个微小俯仰偏移，避免万向锁
    const px = t.x + dir.x * dist, py = t.y + (axis === 'y' ? sign * dist : dist * 0.0001 + dir.y * dist), pz = t.z + dir.z * dist;
    S.controls.moveTo(px, py, pz, false);
    S.controls.setLookAt(px, py, pz, t.x, t.y, t.z, false);
    toast(`已切换到 ${axis.toUpperCase()} ${sign > 0 ? '正向' : '反向'}视图`);
  }
  function initObjectGizmo(TransformControls) {
    const proxy=new S.three.Object3D();S.envRoot.add(proxy);S.transformProxy=proxy;
    const gizmo=new TransformControls(S.camera,S.renderer.domElement);gizmo.setSize(.8);gizmo.setSpace('world');gizmo.userData.directorHelper=true;S.scene.add(gizmo);S.transformControl=gizmo;
    const extras=['rotate','scale'].map((mode,i)=>{const g=new TransformControls(S.camera,S.renderer.domElement);g.setMode(mode);g.setSize(i===0?.72:.52);g.setSpace('local');g.userData.directorHelper=true;S.scene.add(g);return g;});
    S.previsGizmos=[gizmo,...extras];
    const dom=S.renderer.domElement;
    const choose=e=>{
      if(!S.previs?.active||S.previs.mode!=='scene'||S.previsGizmos.some(g=>g.dragging))return;
      const rect=dom.getBoundingClientRect(),ray=new S.three.Raycaster();ray.setFromCamera(new S.three.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),S.camera);
      const hits=S.previsGizmos.filter(g=>g.object&&g.visible).map(g=>({g,hit:ray.intersectObject(g._gizmo.picker[g.getMode()],true).find(x=>x.object.visible)})).filter(x=>x.hit).sort((a,b)=>a.hit.distance-b.hit.distance);
      // The scale cubes overlap translation shafts. Their visible faces take
      // priority; broad invisible rotation pickers must not swallow those clicks.
      const scale=S.previsGizmos.find(g=>g.getMode()==='scale'&&g.object&&g.visible);
      const cubeHit=scale&&ray.intersectObjects(scale._gizmo.gizmo.scale.children.filter(o=>o.visible&&o.geometry?.type==='BoxGeometry'&&['X','Y','Z','XYZ'].includes(o.name)),false)[0];
      const winner=cubeHit?scale:hits[0]?.g;
      for(const g of S.previsGizmos){g.enabled=g===winner;if(g!==winner)g.axis=null;}
    };
    dom.addEventListener('pointermove',choose,true);dom.addEventListener('pointerdown',choose,true);
    const reset=()=>{for(const g of S.previsGizmos||[])g.enabled=true;};
    dom.addEventListener('pointerup',reset);dom.addEventListener('pointercancel',reset);
    S.previsGizmoCleanup=()=>{dom.removeEventListener('pointermove',choose,true);dom.removeEventListener('pointerdown',choose,true);dom.removeEventListener('pointerup',reset);dom.removeEventListener('pointercancel',reset);};
    initDirectorDock(gizmo);
    for(const control of S.previsGizmos){
      control.addEventListener('mouseDown',()=>{setPlaying(false);beginBatch();pushUndo();const obj=S.project.objects.find(o=>o.id===S.selectedId);S.transformBefore=obj?timeline.sampled(obj):null;});
      control.addEventListener('dragging-changed',e=>{S.controls.enabled=!e.value&&S.viewMode==='director';});
      control.addEventListener('objectChange',()=>{
        const obj=S.project.objects.find(o=>o.id===S.selectedId);if(!obj||!control.dragging)return;
        const mode=control.getMode(),before=S.transformBefore;
        if(mode==='translate'){
          const delta=obj.kind==='camera'?cameraFollowDelta(obj):[0,0,0];
          obj.transform.position=proxy.position.toArray().map((v,i)=>round3(v-delta[i]));
          if(obj.followTargetId)obj.followOffset=obj.transform.position.map((v,i)=>v-(obj.followAnchor?.[i]||0));
        }
        else if(mode==='scale')obj.transform.scale=proxy.scale.toArray().map(v=>Math.max(.001,round3(v)));
        else if(obj.kind==='camera'){
          prepareCameraManualRotation(obj,before);obj.targetMode='rotation';obj.cameraRotationAbsolute=true;delete obj.lookAtTargetId;
          if(obj.followViewMode==='firstPerson')obj.followViewMode='thirdPerson';
          obj.transform.rotation=new S.three.Euler().setFromQuaternion(proxy.quaternion,'YXZ').toArray().slice(0,3).map(v=>round3(v*180/Math.PI));
        }else obj.transform.rotation=[proxy.rotation.x,proxy.rotation.y,proxy.rotation.z].map(v=>round3(v*180/Math.PI));
        timeline.edit(obj,mode==='translate'?'位置':mode==='scale'?'缩放':'旋转',before);sampleAtFrame(S.playhead);timeline.updateUI();
      });
      control.addEventListener('mouseUp',()=>{endBatch();S.transformBefore=null;persist();renderInspector();});
    }
  }
  function syncObjectGizmo(){
    const gizmo=S.transformControl;if(!gizmo||(S.previsGizmos||[gizmo]).some(g=>g.dragging))return;
    const all=S.previsGizmos||[gizmo],combined=S.previs?.active&&S.previs.mode==='scene';
    const obj=S.project?.objects.find(o=>o.id===S.selectedId),mesh=obj&&S.sceneObjects.get(obj.id);
    const blocked=S.readOnly||S.pathEditor?.active()||(!combined&&obj?.kind==='character'&&S.charTab==='pose'&&S.rigs.has(obj.id))||!mesh||S.navigationMode==='orbit'||Crowd.inherited(S.project,obj?.id,'locked')||!Crowd.inherited(S.project,obj?.id,'visible')||timeline.trackOf(obj?.id)?.locked||S.viewMode!=='director'||S.recording||timeline.isDrawing();
    if(blocked){all.forEach(g=>g.detach());return;}
    if(S.transformProxy.parent!==mesh.parent)mesh.parent.add(S.transformProxy);
    S.transformProxy.position.copy(mesh.position);S.transformProxy.quaternion.copy(mesh.quaternion);S.transformProxy.scale.copy(mesh.scale);
    if(combined)gizmo.setMode('translate');
    for(const g of all){if(g===gizmo||combined){if(g.object!==S.transformProxy)g.attach(S.transformProxy);g.setTranslationSnap(S.project.scene.snapToGrid?0.1:null);}else{g.detach();g.enabled=false;}}
    if(!combined)gizmo.enabled=true;
  }

  function onGizmoChange() { /* TransformControls updates authored data through timeline.edit. */ }
  function onGizmoRelease() { /* 已由轴盘拖拽替代 */ }
  function round3(v) { return Math.round(v * 1000) / 1000; }
  function syncObjectKeyTrack() {
    // 若对象有动画轨，且处于非 0 帧，提示需要手动打帧（简化：不自动 keyframe）
  }

  function pickAnnotationObject(x,y,rect) {
    if(S.recording||S.previs?.mode!=='scene'||!rect.width||!rect.height)return '';
    const T=S.three,ray=new T.Raycaster(),meshes=[];
    S.scene.updateMatrixWorld(true);S.camera.updateMatrixWorld(true);
    ray.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),S.camera);
    S.sceneObjects.forEach((mesh,id)=>{const obj=S.project.objects.find(o=>o.id===id);if(obj?.kind==='group'||!Crowd.inherited(S.project,id,'visible')||Crowd.inherited(S.project,id,'locked'))return;mesh.traverse(child=>{if(child.isMesh)meshes.push(child);});});
    let target=ray.intersectObjects(meshes,false)[0]?.object;
    while(target&&!target.userData.dtObjectId)target=target.parent;
    const id=target?.userData.dtObjectId||'';selectObject(id);stepFrame(0);
    return S.project.objects.find(o=>o.id===id)?.name||'';
  }

  function bindViewportEvents() {
    const dom = S.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      if(S.navigationMode==='orbit'||(S.previsGizmos||[]).some(g=>g.axis||g.dragging)||S.transformControl?.axis||S.transformControl?.dragging||S.poseEditor?.gizmo.axis||S.poseEditor?.gizmo.dragging||S.pathEditor?.gizmo.axis||S.pathEditor?.gizmo.dragging||timeline.isDrawing()||S.recording)return;
      // 记录最新指针位置（轴盘拖拽的起点基准）
      S.lastPointer = { x: e.clientX, y: e.clientY };
      const rect = dom.getBoundingClientRect();
      const ndc = new S.three.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new S.three.Raycaster();
      ray.setFromCamera(ndc, S.camera);
      const meshes = [];
      S.sceneObjects.forEach((m,id) => {const o=S.project.objects.find(x=>x.id===id);if(o?.kind==='group'||!Crowd.inherited(S.project,id,'visible')||Crowd.inherited(S.project,id,'locked'))return;m.traverse(c=>{if(c.isMesh)meshes.push(c);});});
      const hits = ray.intersectObjects(meshes, false);
      if (hits.length) {
        let p = hits[0].object;
        while (p && !p.userData.dtObjectId) p = p.parent;
        if (p && p.userData.dtObjectId) selectObject(p.userData.dtObjectId);
      }
    });
    dom.addEventListener('dblclick', () => {
      // 双击空白处取消选择
      selectObject('');
    });
    const ro = new ResizeObserver(() => {
      if(!S.open||!S.renderer||!S.el.holder)return;
      const w = S.el.holder.clientWidth, h = S.el.holder.clientHeight;
      if (w && h) { S.renderer.setSize(w, h); S.camera.aspect = w / h; S.camera.updateProjectionMatrix(); }
    });
    S.viewportResizeObserver?.disconnect();S.viewportResizeObserver=ro;ro.observe(S.el.holder);
  }





  const CHARACTER_PALETTE = Crowd?.COLORS || ['#4f8ef7','#f75353','#34c759','#ff9f0a','#af52de','#ff2d55','#5ac8fa','#ffd60a'];
  async function addCharacter(bodyType) {
    const project = S.project, epoch = S.animationEpoch;
    bodyType = SAM_MODELS[bodyType] ? bodyType : 'sam';
    const proto = await S.loadSamBody?.(bodyType);
    if (!S.open || S.project !== project || S.animationEpoch !== epoch) return;
    if (!proto) { toast('角色模型加载失败，请重新点击添加'); return; }
    pushUndo();
    const obj = {
      id: uid('char'), name: nextName('角色'), kind: 'character', visible: true, locked: false,

      color: CHARACTER_PALETTE[(S.project.objects.filter(o => o.kind === 'character').length) % CHARACTER_PALETTE.length],
      transform: defaultTransform(), bodyType: bodyType || 'sam', rigVersion: 2,
      poseName:'站立',poseMode:'static',poseControls:{...POSE_PRESETS.find(p=>p.id==='stand').controls,_rigAxes:Rig.AXES_VERSION},
    };
    const sc = S.project.scene;

    const bodySpec = SAM_MODELS[obj.bodyType] || SAM_MODELS.sam; obj.transform.scale = [bodySpec.scale, bodySpec.scale, bodySpec.scale];
    obj.transform.position = [0, sc.groundHeight || 0, 0];
    S.project.objects.push(obj);
    createSceneObject(obj);
    persist(); refreshTree(); selectObject(obj.id);
    toast(`已添加${obj.name}`);
  }
  function showCrowdDialog(anchor) {
    if (S.el.crowdDialog) { closeCrowdDialog(); return; }
    const box=document.createElement('div');box.className='dt-crowd-dialog';box.setAttribute('role','dialog');box.setAttribute('aria-label','添加群众阵列');
    box.innerHTML='<header><strong>添加群众阵列</strong><span data-crowd-count>共9人</span></header><div class="dt-crowd-size"><label>行数<input type="number" name="rows" aria-label="行数" min="1" max="10" step="1" value="3"></label><label>列数<input type="number" name="columns" aria-label="列数" min="1" max="10" step="1" value="3"></label></div><label>间距<input type="number" name="spacing" aria-label="间距" min="0.1" max="10" step="0.1" value="1.2"></label><footer><button type="button" data-crowd-cancel>取消</button><button type="button" data-crowd-confirm>添加</button></footer>';
    S.el.shell.appendChild(box);S.el.crowdDialog=box;
    const outside = e => { if (!box.contains(e.target) && !anchor?.contains(e.target)) closeCrowdDialog(); };
    document.addEventListener('pointerdown', outside, true);
    S.crowdDialogCleanup = () => document.removeEventListener('pointerdown', outside, true);
    const rect=anchor?.getBoundingClientRect();box.style.left=Math.min((rect?.right||278)+8,innerWidth-250)+'px';box.style.top=Math.min(Math.max(60,rect?.top||150),innerHeight-260)+'px';
    const values=()=>Crowd.params(box.querySelector('[name=rows]').value,box.querySelector('[name=columns]').value,box.querySelector('[name=spacing]').value);
    box.addEventListener('input',()=>{const p=values();box.querySelector('[data-crowd-count]').textContent='共'+p.rows*p.columns+'人';});
    box.querySelector('[data-crowd-cancel]').onclick=closeCrowdDialog;
    box.querySelector('[data-crowd-confirm]').onclick=async()=>{const p=values(),button=box.querySelector('[data-crowd-confirm]'),project=S.project;button.disabled=true;try{const proto=await S.loadSamBody?.('sam');if(!S.open||S.project!==project||S.el.crowdDialog!==box)return;if(!proto)throw Error('角色模型加载失败');addCrowd(p.rows,p.columns,p.spacing);closeCrowdDialog();S.el.shell.querySelector('[data-dt-sbrail="scene"]')?.click();}catch(e){button.disabled=false;toast('群众添加失败：'+e.message);}};
  }
  function closeCrowdDialog() {
    S.crowdDialogCleanup?.(); S.crowdDialogCleanup = null;
    S.el.crowdDialog?.remove(); S.el.crowdDialog = null;
  }
  function addCrowd(rows=3, columns=3, spacing=1.2) {
    if (!Crowd) return addCharacter('sam');
    pushUndo(); const made=Crowd.create(S.project,{rows,columns,spacing},uid,(activeCameraObj()?.transform?.position)||[0,1.6,10]);
    S.project.objects.push(made.group,...made.members);
    createSceneObject(made.group); for(const member of made.members)createSceneObject(member);
    persist();refreshTree();selectObject(made.group.id);refreshTracks();toast('已添加群众阵列（'+made.members.length+' 个独立角色）');
  }
  function addCamera(presetId) {
    pushUndo();
    const obj = {
      id: uid('cam'), name: nextName('机位'), kind: 'camera', visible: true, locked: false,
      color: '#789cd7', transform: defaultTransform(), fov: 50, aspectRatio: '16:9', targetMode: 'manual', target: [0, 1, 0],
    };
    const preset = presetId ? CAM_SHOT_PRESETS.find(p => p.id === presetId) : null;

    const firstChar = S.project.objects.find(o => o.kind === 'character');
    const anchor = firstChar ? firstChar.transform.position : sceneCenterPos();
    obj.transform.position = [anchor[0], 2.2, anchor[2] + 10];
    obj.target = [anchor[0], 1.2, anchor[2]];
    if (preset) {


      const d = preset.dist;
      const len = Math.hypot(preset.dx, preset.dz) || 1;
      const tgtY = preset.tgtY != null ? preset.tgtY : 1.05;
      obj.transform.position = [
        anchor[0] + (preset.dx / len) * d,
        preset.height,
        anchor[2] + (preset.dz / len) * d,
      ];
      obj.fov = preset.fov;
      obj.transform.rotation[2] = preset.roll; // 荷兰角横滚
      obj.target = [anchor[0], tgtY, anchor[2]];
      obj.name = nextName('机位');
    }
    S.project.objects.push(obj);
    S.project.cameras.push({ id: obj.id, name: obj.name, fov: obj.fov, aspectRatio: obj.aspectRatio, transform: obj.transform, target: [...obj.target] });
    if(!S.project.cameraTrack.clips.length)S.project.cameraTrack.clips.push({id:uid('cclip'),cameraId:obj.id,startFrame:0,endFrame:S.project.sequence.durationFrames});
    createSceneObject(obj);
    persist(); refreshTree(); selectObject(obj.id); refreshTracks();
    toast(`已添加${obj.name}`);
  }
  function addGeometry(type) {
    pushUndo();
    const obj = {
      id: uid('geo'), name: nextName(GEOMETRY_TYPES.find(g => g.key === type)?.label || '几何体'),
      kind: 'geometry', visible: true, locked: false, color: '#9a9aa2',
      transform: defaultTransform(), geometryType: type || 'box',
    };
    obj.transform.position = [nextSpawnX(), 0.45, 0];
    if(window.DirectorSceneAgent?.RECIPES.includes(type)&&!['box','sphere','cylinder','cone','torus','pyramid','extrusion','mesh'].includes(type)){obj.geometryType='whitebox';obj.whitebox=window.DirectorSceneAgent.recipe({type});obj.color='#d5d7dc';obj.transform.position[1]=S.project.scene.groundHeight||0;obj.name=nextName(({building:'房屋',road:'道路',wall:'墙',room:'房间',stairs:'台阶',bridge:'桥梁',tree:'树木',car:'车辆',table:'桌子',chair:'椅子'})[type]);}
    S.project.objects.push(obj);
    createSceneObject(obj);
    persist(); refreshTree(); selectObject(obj.id);
  }
  let spawnCounter = 0;
  function nextSpawnX() {
    // 人物挂 envRoot（其 position 即场景平移），本地坐标以原点为基准即可；
    // 场景缩放/平移的轴心天然就是人物站位
    if (S.project.objects.length === 0) return 0;
    // 后续对象从中心向两侧错开
    const side = (S.project.objects.length % 2 === 1) ? 1 : -1;
    return side * (0.9 + (spawnCounter++ % 3) * 0.15);
  }
  function sceneCenterPos() {
    const sc = S.project.scene;
    return [(sc.position || [0, 0, 0])[0], 0, (sc.position || [0, 0, 0])[2]];
  }
  function nextName(prefix) {
    if(prefix==='角色'){let i=S.project.objects.filter(o=>o.kind==='character').length;while(S.project.objects.some(o=>o.name==='角色'+Crowd.letter(i)))i++;return '角色'+Crowd.letter(i);}
    let n = 1;
    while (S.project.objects.some(o => o.name === `${prefix}${String(n).padStart(2, '0')}`)) n++;
    return `${prefix}${String(n).padStart(2, '0')}`;
  }
  function removeObject(id) {
    pushUndo(); const ids=Crowd?.descendants(S.project,id)||new Set([id]);
    sampleAtFrame(S.playhead);
    for(const camera of S.project.objects.filter(o=>o.kind==='camera'&&!ids.has(o.id))){
      if(ids.has(camera.followTargetId)){
        shiftCameraPosition(camera,cameraFollowDelta(camera));
        if(camera.followViewMode==='firstPerson'){prepareCameraManualRotation(camera);freezeCameraDirection(camera);camera.targetMode='rotation';}
        delete camera.followTargetId;delete camera.followViewMode;delete camera.followAnchor;delete camera.followOffset;
      }
      if(ids.has(camera.lookAtTargetId)){
        freezeCameraDirection(camera);camera.targetMode='rotation';delete camera.lookAtTargetId;
        const track=timeline.trackOf(camera.id);
        for(const [i,ch]of Animation.GROUPS.rotation.entries())for(const key of track?.channels?.[ch]||[])key.value=camera.transform.rotation[i];
      }
    }
    for(const oid of ids){const mesh=S.sceneObjects.get(oid);if(mesh){(mesh.parent||S.scene).remove(mesh);S.sceneObjects.delete(oid);}S.rigs?.delete(oid);}
    S.project.objects=S.project.objects.filter(o=>!ids.has(o.id));
    S.project.cameras=S.project.cameras.filter(c=>!ids.has(c.id));S.project.cameraTrack.clips=S.project.cameraTrack.clips.filter(c=>!ids.has(c.cameraId));
    S.project.objectAnimationTracks=S.project.objectAnimationTracks.filter(t=>!ids.has(t.objectId));
    if(ids.has(S.selectedId))selectObject('');sampleAtFrame(S.playhead);persist();refreshTree();refreshTracks();renderInspector();toast('已删除对象');
  }
  function toggleVisible(id) {
    const obj=S.project.objects.find(o=>o.id===id);if(!obj)return;
    pushUndo();const visible=!Crowd.inherited(S.project,id,'visible');obj.visible=visible;
    if(visible){let parent=obj.parentId;const seen=new Set();while(parent&&!seen.has(parent)){seen.add(parent);const o=S.project.objects.find(x=>x.id===parent);if(!o)break;o.visible=true;parent=o.parentId;}}
    for(const o of S.project.objects){const mesh=S.sceneObjects.get(o.id);if(mesh)mesh.visible=o.visible!==false;}
    persist();refreshTree();syncObjectGizmo();
  }

  function selectObject(id) {
    if (!S.project.objects.some(o => o.id === id && o.kind === 'camera')) closeCamPreviewFullscreen();
    S.selectedId = id;
    syncObjectGizmo();
    // 选中机位即把它设为活动机位（机位视角/对比视角跟踪的就是活动机位）
    const picked = S.project && S.project.objects.find(o => o.id === id && o.kind === 'camera');
    if(picked)S.previewCameraId=picked.id;
    if (picked && S.project.activeCameraId !== id) {
      S.project.activeCameraId = id;
      persist();
      const syncTag = () => {
        const camObj = activeCameraObj();
        if (S.el.compareCamTag) S.el.compareCamTag.innerHTML = camObj ? `机位视角<b>· ${esc(camObj.name)}</b>` : '机位视角<b>· 未创建机位</b>';
        if (S.el.viewfinder && S.viewMode === 'camera') S.el.viewfinder.dataset.dtViewfinderLabel = camObj ? camObj.name : '';
      };
      syncTag();
      // 机位视角下切活动机位：相机跟过去
      if (S.viewMode === 'camera' && S.controls) {
        const p = picked.transform.position, t = picked.target || [0, 1, 0];
        S.controls.moveTo(p[0], p[1], p[2], false);
        S.controls.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], false);
      }
    }
    refreshTree(); renderInspector(); timeline?.selectionChanged();S.poseEditor?.update();
  }

  /* ============================================================
     左栏对象树
     ============================================================ */
  function refreshTree() {
    const tree=S.el.tree;if(!tree)return;const filter=(S.treeFilter||'').toLowerCase();
    const match=o=>!filter||(o.name||'').toLowerCase().includes(filter);
    const icon=o=>o.kind==='camera'?ICONS.videoCam:o.kind==='group'?ICONS.frameRatio:ICONS.person;
    const flag=o=>{const parentLocked=o.parentId&&Crowd.inherited(S.project,o.parentId,'locked'),locked=Crowd.inherited(S.project,o.id,'locked'),visible=Crowd.inherited(S.project,o.id,'visible');return `<button type="button" class="dt-tree-flag ${visible?'':'is-off'}" data-dt-visible="${esc(o.id)}" title="${visible?'隐藏':'显示'}">${visible?ICONS.eye:ICONS.eyeOff}</button><button type="button" class="dt-tree-flag ${locked?'is-active':''}" data-dt-lock="${esc(o.id)}" title="${parentLocked?'所属分组已锁定':locked?'解锁':'锁定'}" aria-label="${parentLocked?'所属分组已锁定':locked?'解锁':'锁定'}" ${parentLocked?'disabled':''}>${locked?'▣':'◇'}</button>`;};
    const row=(o,extra='')=>`<div class="dt-tree-row ${S.selectedId===o.id?'is-selected':''}" data-dt-select="${esc(o.id)}"><span class="dt-tree-row-main"><i class="dt-tree-icon">${icon(o)}</i>${o.color?`<i class="dt-tree-dot" style="background:${esc(o.color)}"></i>`:''}<span class="dt-tree-name">${esc(o.name)}</span></span>${flag(o)}<button type="button" class="dt-tree-flag" data-dt-delete="${esc(o.id)}" title="删除">${ICONS.close.replace('18','14')}</button>${extra}</div>`;
    const groups=S.project.objects.filter(o=>o.kind==='group'&&match(o));
    const chars=S.project.objects.filter(o=>o.kind==='character'&&!o.parentId&&match(o));
    const members=g=>S.project.objects.filter(o=>o.kind==='character'&&o.parentId===g.id&&match(o));
    const groupMarkup=groups.map(g=>{const kids=members(g),closed=S.groupCollapsed.has(g.id);return `<div class="dt-tree-object-group"><div class="dt-tree-row ${S.selectedId===g.id?'is-selected':''}" data-dt-select="${esc(g.id)}"><span class="dt-tree-row-main"><button type="button" class="dt-tree-collapse" data-dt-group-toggle="${esc(g.id)}" title="${closed?'展开':'收起'}分组" aria-label="${closed?'展开':'收起'}分组">${closed?'›':'⌄'}</button><i class="dt-tree-icon">${icon(g)}</i><span class="dt-tree-name">${esc(g.name)}</span></span>${flag(g)}</div>${closed?'':`<div class="dt-tree-children">${kids.map(o=>row(o)).join('')}</div>`}</div>`;}).join('');
    const standalone=chars.map(o=>row(o)).join('');
    const cams=S.project.objects.filter(o=>o.kind==='camera'&&match(o)).map(o=>row(o)).join('');
    const geos=S.project.objects.filter(o=>o.kind==='geometry'&&match(o)).map(o=>row(o)).join('');
    const section=(title,body)=>`<div class="dt-tree-group"><h3>${title}</h3><div class="dt-tree-list">${body||'<div class="dt-tree-empty">暂无对象</div>'}</div></div>`;
    tree.innerHTML=section('角色',groupMarkup+standalone)+section('摄像机',cams)+section('几何体',geos);
  }






  function axisRow(label, values, keyframeable) {
    return `<div class="dt-field dt-axis-group">
      <div class="dt-axis-header"><span>${esc(label)}</span>${keyframeable ? `<button type="button" class="dt-key-btn ${hasKeyAtPlayhead(label) ? 'is-active' : ''}" data-dt-keyframe="${esc(label)}" title="在此帧打关键帧">◆</button>` : ''}</div>
      <div class="dt-axis-row">
        ${['X', 'Y', 'Z'].map((axis, i) => `
          <span class="dt-axis-input"><button type="button" class="dt-axis-handle" data-dt-axis-drag="${axis}" data-dt-prop="${esc(label)}" aria-label="左右拖动调整 ${axis} 轴" title="左右拖动或滚轮调整 ${axis} 轴；Shift + 滚轮精细调整">${axis.toLowerCase()}</button><input type="number" data-no-scrub step="0.1" aria-label="${esc(label)} ${axis}" data-dt-axis="${axis}" data-dt-prop="${esc(label)}" value="${values[i] != null ? values[i] : 0}"></span>`).join('')}
      </div></div>`;
  }

  function rangeRow(label, value, min, max, step) {
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    return `<div class="dt-field">
      <div class="dt-axis-header"><span>${esc(label)}</span></div>
      <div class="dt-range-row">
        <input type="range" min="${min}" max="${max}" step="${step}" data-dt-range="${esc(label)}" value="${value}" style="--range-fill:${pct}%">
        <input type="number" class="dt-range-value" step="${step}" data-dt-range-value="${esc(label)}" value="${value}">
      </div></div>`;
  }

  const sectionHead = (t) => `<h3 class="dt-section-title">${esc(t)}</h3>`;

  function objectHeader(kindLabel, obj) {
    const icon = obj ? (obj.kind === 'camera' ? ICONS.videoCam : obj.kind === 'character' ? ICONS.person : ICONS.frameRatio) : ICONS.frameRatio;
    return `<div class="dt-obj-header">
      <div class="dt-obj-header-main"><i>${icon}</i><div><strong>${obj ? esc(obj.name) : '3D 场景'}</strong><small>${esc(kindLabel)}</small></div></div>
      <div class="dt-obj-header-side"><span>帧</span><strong>${S.playhead}</strong><span>${obj ? (Crowd.inherited(S.project,obj.id,'locked')?'已锁定':obj.kind === 'camera' ? '活动机位' : '可编辑') : '全局'}</span></div>
    </div>`;
  }
  const hasKeyAtPlayhead = label => timeline?.hasKey(label);


  const POSE_AXIS_GROUPS = [
    { g: '身体', rows: [['body.pitch', '前倾', -90, 90], ['body.yaw', '转身', -90, 90], ['body.roll', '侧倾', -45, 45]] },
    { g: '躯干', rows: [['torso.pitch', '前倾', -45, 45], ['torso.yaw', '扭转', -45, 45], ['torso.roll', '侧倾', -30, 30]] },
    { g: '头部', rows: [['head.pitch', '点头', -60, 60], ['head.yaw', '转头', -90, 90], ['head.roll', '歪头', -30, 30]] },
    { g: '手臂 — 肩', sides: [['左', [['leftShoulder.pitch', '前举', -90, 180], ['leftShoulder.spread', '外展', -10, 90], ['leftShoulder.twist', '扭转', -90, 90]]], ['右', [['rightShoulder.pitch', '前举', -90, 180], ['rightShoulder.spread', '外展', -10, 90], ['rightShoulder.twist', '扭转', -90, 90]]]] },
    { g: '肘部', sides: [['左', [['leftElbow.bend', '弯曲', 0, 150]]], ['右', [['rightElbow.bend', '弯曲', 0, 150]]]] },
    { g: '腿部 — 髋', sides: [['左', [['leftHip.pitch', '前抬', -120, 150], ['leftHip.spread', '外展', -30, 60], ['leftHip.twist', '扭转', -45, 45]]], ['右', [['rightHip.pitch', '前抬', -120, 150], ['rightHip.spread', '外展', -30, 60], ['rightHip.twist', '扭转', -45, 45]]]] },
    { g: '膝部', sides: [['左', [['leftKnee.bend', '弯曲', 0, 150]]], ['右', [['rightKnee.bend', '弯曲', 0, 150]]]] },
  ];
  function poseAxisPanelHTML(obj) {
    const pc = obj.poseControls || {};
    const row = (key, label, min, max) => {
      const v = pc[key] != null ? pc[key] : 0;
      const pct = max > min ? ((v - min) / (max - min)) * 100 : 50;
      return `<div class="dt-range-row dt-paxis-row"><span class="dt-paxis-label">${esc(label)}</span><input type="range" min="${min}" max="${max}" step="1" data-dt-paxis="${esc(key)}" value="${v}" style="--range-fill:${pct}%"><input type="text" inputmode="decimal" class="dt-range-value" data-dt-paxis-value="${esc(key)}" data-dt-paxis-min="${min}" data-dt-paxis-max="${max}" value="${v}"></div>`;
    };
    return `<div class="dt-insp-block dt-paxis">${POSE_AXIS_GROUPS.map(gr => {
      const inner = gr.rows
        ? gr.rows.map(r => row(r[0], r[1], r[2], r[3])).join('')
        : gr.sides.map(([side, rows]) => `<div class="dt-paxis-side"><div class="dt-paxis-side-label">${esc(side)}</div>${rows.map(r => row(r[0], r[1], r[2], r[3])).join('')}</div>`).join('');
      return `<div class="dt-paxis-group"><div class="dt-paxis-gtitle">${esc(gr.g)}</div>${inner}</div>`;
    }).join('')}</div>`;
  }

  function renderInspector() {
    const box = S.el.inspector; if (!box) return;
    const id = S.selectedId;
    const obj = S.project.objects.find(o => o.id === id);
    if (!obj) {

      const sc = S.project.scene;
      S.el.inspectorTitle.textContent = '场景';
      const sceneHTML = `
        ${objectHeader('场景 · 项目根级', null)}
        <div class="dt-insp-block">
          ${rangeRow('场景缩放', sc.scale != null ? sc.scale : 1, 0.1, 10, 0.05)}
          ${axisRow('场景平移', sc.position || [0, 0, 0], false)}
          ${axisRow('场景旋转', sc.rotation || [0, 0, 0], false)}
        </div>
        <h3 class="dt-section-title">导演视口</h3>
        <div class="dt-insp-block">
          ${S.camera ? axisRow('视口位置', [S.camera.position.x, S.camera.position.y, S.camera.position.z], false) : ''}
          ${S.controls ? axisRow('注视点', (() => { const t = S.controls.getTarget(new S.three.Vector3()); return [t.x, t.y, t.z]; })(), false) : ''}
          ${S.camera ? rangeRow('视野角度 (FOV)', S.camera.fov, 10, 120, 1) : ''}
        </div>
        <h3 class="dt-section-title">全景背景</h3>
        <div class="dt-insp-block">
          <div class="dt-field"><div class="dt-axis-header"><span>${sc.panoramaData || sc.panoramaUrl ? '已连接全景图' : '未连接全景图'}</span></div>
            ${sc.panoramaData || sc.panoramaUrl ? `<img class="dt-pano-current" src="${esc(sc.panoramaData || sc.panoramaUrl)}" alt="${esc(sc.panoramaName || '全景图')}" /><span class="dt-pano-name">${esc(sc.panoramaName || '全景图')}</span>` : ''}
            <div class="dt-axis-header"><span>天空颜色</span></div>
            <div class="dt-color-row"><input type="color" aria-label="天空颜色" data-dt-color="天空颜色" value="${esc(sc.backgroundColor || '#7a7a7a')}"><input type="text" aria-label="天空颜色十六进制值" class="dt-range-value" data-dt-color-value="天空颜色" value="${esc(sc.backgroundColor || '#7a7a7a')}"></div></div>
          <button type="button" class="dt-btn" data-dt-panorama-pick>选择全景图</button>
          <button type="button" class="dt-btn" data-dt-panorama-clear ${sc.panoramaData || sc.panoramaUrl ? '' : 'hidden'}>移除全景图</button>
        </div>
        <h3 class="dt-section-title">全景球</h3>
        <div class="dt-insp-block">
          ${rangeRow('水平旋转', sc.panoramaYaw || 0, -180, 180, 1)}
          ${rangeRow('球形半径', sc.panoramaRadius || 60, 10, 300, 5)}
        </div>
        <h3 class="dt-section-title">开关项</h3>
        <div class="dt-insp-block dt-switch-list">
          <label><input type="checkbox" data-dt-switch="showLabels" ${sc.showLabels !== false ? 'checked' : ''}>角色标签</label>
          <label><input type="checkbox" data-dt-switch="snapToGrid" ${sc.snapToGrid ? 'checked' : ''}>网格吸附</label>
          <label><input type="checkbox" data-dt-switch="showGround" ${sc.showGround !== false ? 'checked' : ''}>地面</label>
        </div>
        <h3 class="dt-section-title">地面</h3>
        <div class="dt-insp-block">
          <div class="dt-field"><div class="dt-axis-header"><span>网格颜色</span></div>
            <div class="dt-color-row"><input type="color" data-dt-color="网格颜色" value="${esc(sc.gridColor || '#474747')}"><input type="text" class="dt-range-value" data-dt-color-value="网格颜色" value="${esc(sc.gridColor || '#474747')}"></div></div>
          ${rangeRow('地面透明度', sc.groundOpacity != null ? sc.groundOpacity : 0.45, 0, 1, 0.05)}
          ${rangeRow('网格透明度', sc.gridOpacity != null ? sc.gridOpacity : 0.6, 0, 1, 0.05)}
          ${rangeRow('地面高度', sc.groundHeight || 0, -2, 2, 0.1)}
        </div>`;
      box.innerHTML = sceneHTML;
      return;
    }
    if (obj.kind === 'group') {
      const kids=S.project.objects.filter(o=>o.parentId===obj.id);S.el.inspectorTitle.textContent='分组';
      box.innerHTML=objectHeader('群众分组 · 独立角色',obj)+`<div class="dt-insp-block"><div class="dt-field"><div class="dt-axis-header"><span>名称</span></div><input type="text" class="dt-text" data-dt-name value="${esc(obj.name)}"></div><div class="dt-group-summary">${kids.length} 个独立角色 · 每个角色可分别设置姿势、动作和关键帧</div><button type="button" class="dt-btn dt-btn-danger" data-dt-delete="${esc(obj.id)}">删除群众分组</button></div>`;return;
    }
    const isCam = obj.kind === 'camera';
    const isChar = obj.kind === 'character';
    S.el.inspectorTitle.textContent = isCam ? '摄像机' : isChar ? '角色' : '几何体';
    let html = objectHeader((isCam ? '摄影机 · 镜头轨' : isChar ? '角色 · '+(S.project.objects.find(o=>o.id===obj.parentId)?.name||'场景根级') : '几何体 · 场景根级'), obj);
    if (isCam) {
      const shown=cameraInspectorValue(obj);
      const bindingOptions=(selected)=>S.project.objects.filter(o=>['character','group'].includes(o.kind)).map(o=>`<option value="${esc(o.id)}" ${o.id===selected?'selected':''}>${esc(o.name)}</option>`).join('');
      html += `
        <div class="dt-cam-preview"><div class="dt-cam-preview-head"><span>当前机位实时预览</span><b id="dtCamPreviewFov">FOV ${Math.round(obj.fov || 50)}°</b></div><div id="dtCamPreviewHost"></div><button type="button" class="dt-cam-preview-expand" data-dt-preview-expand title="全屏预览" aria-label="全屏预览">${ICONS.fullscreen}</button></div>
        <div class="dt-insp-block">
          <div class="dt-field"><div class="dt-axis-header"><span>机位画面画幅比例</span></div><select class="dt-text" data-dt-camera-aspect aria-label="机位画面画幅比例">${ASPECT_RATIOS.map(([label])=>`<option value="${esc(label)}" ${label===(obj.aspectRatio||'16:9')?'selected':''}>${esc(label)}</option>`).join('')}</select></div>
          <div class="dt-field"><div class="dt-axis-header"><span>名称</span></div><input type="text" maxlength="30" class="dt-text" data-dt-name aria-label="机位名称" value="${esc(obj.name)}"></div>
          <div class="dt-field"><div class="dt-axis-header"><span>切换机位视角</span></div>
            <select class="dt-text" data-dt-camera-choice aria-label="选择已有机位">${S.project.objects.filter(o=>o.kind==='camera').map(cam=>`<option value="${esc(cam.id)}" ${cam.id===obj.id?'selected':''}>${esc(cam.name)}</option>`).join('')}</select></div>
          <button type="button" class="dt-btn" data-dt-cycle-cam>切换机位视角</button>
          ${axisRow('位置', shown.transform.position, true).replace('<span>位置</span>',`<span>${obj.followTargetId?'跟随偏移':'位置'}</span>`)}
          <div class="dt-field"><div class="dt-axis-header"><span>跟随目标</span></div><select class="dt-text" data-dt-camera-binding="follow" aria-label="跟随目标"><option value="">不跟随</option>${bindingOptions(obj.followTargetId)}</select></div>
          ${obj.followTargetId?`<div class="dt-field"><div class="dt-axis-header"><span>跟随视角</span></div><select class="dt-text" data-dt-camera-binding="view" aria-label="跟随视角"><option value="thirdPerson" ${obj.followViewMode!=='firstPerson'?'selected':''}>第三人称</option><option value="firstPerson" ${obj.followViewMode==='firstPerson'?'selected':''}>第一人称</option></select></div>`:''}
          ${axisRow('旋转', shown.transform.rotation, true)}
          <div class="dt-field"><div class="dt-axis-header"><span>注视目标</span></div><select class="dt-text" data-dt-camera-binding="look" aria-label="注视目标"><option value="" ${(!obj.targetMode||obj.targetMode==='manual')?'selected':''}>手动坐标</option><option value="__rotation__" ${obj.targetMode==='rotation'?'selected':''}>手动旋转</option>${bindingOptions(obj.targetMode==='object'?obj.lookAtTargetId:'')}</select></div>
          ${(!obj.targetMode||obj.targetMode==='manual')?axisRow('注视坐标', shown.target || [0, 1, 0], true):''}
          ${rangeRow('视野角度 (FOV)', obj.fov || 50, 10, 120, 1)}
        </div>
        <h3 class="dt-section-title">运镜预设</h3>
        <div class="dt-insp-block">
          <div class="dt-preset-grid">${CAMERA_PRESETS.map(p => `<button type="button" data-dt-preset="${esc(p)}">${esc(p)}</button>`).join('')}</div>
          <div class="dt-field"><div class="dt-axis-header"><span>运镜时长（帧）</span></div>
            <input type="number" class="dt-text" id="dtPresetDuration" value="72" min="12" max="480" step="12"></div>
        </div>`;
    } else {

      S.el.inspectorTitle.textContent = '角色';
      const tab = ['props','pose','path'].includes(S.charTab) ? S.charTab : 'props';
      const tabsBar = `<div class="dt-tabs" role="tablist" aria-label="角色面板标签">
        ${[['props', '属性'], ['pose', '姿势'], ['path', '运动轨迹']].map(([k, label]) => `<button type="button" class="${tab === k ? 'is-active' : ''}" data-dt-ctab="${k}">${label}</button>`).join('')}
      </div>`;
      if (tab === 'path') { html += tabsBar + timeline.pathPanel(obj);
      } else if (tab === 'pose') {
        html += tabsBar + `
          <h3 class="dt-section-title">姿势预设</h3>
          <div class="dt-insp-block">
            <div class="dt-preset-grid dt-pose-grid">${POSE_PRESETS.map(p => `<button type="button" data-dt-pose="${esc(p.id)}">${esc(p.label)}</button>`).join('')}</div>
          </div>
          <h3 class="dt-section-title">姿势调节</h3>
          ${poseAxisPanelHTML(obj)}
          <h3 class="dt-section-title">姿势设置</h3>
          <div class="dt-insp-block">
            <button type="button" class="dt-btn" data-dt-pose-reset>重置全部姿势参数</button>
          </div>`;
      } else {

        html += tabsBar + `
          <h3 class="dt-section-title">基础</h3>
          <div class="dt-insp-block">
            <div class="dt-field"><div class="dt-axis-header"><span>名称</span></div>
              <input type="text" class="dt-text" data-dt-name value="${esc(obj.name)}"></div>
          </div>
          <h3 class="dt-section-title">变换</h3>
          <div class="dt-insp-block">
            <div class="dt-btn-row">
              <button type="button" class="dt-btn" data-dt-ground-snap>吸附到地面</button>
              <button type="button" class="dt-btn" data-dt-transform-reset>重置全部变换参数</button>
            </div>
            <label class="dt-switch-line"><input type="checkbox" data-dt-follow-ground ${obj.followGround ? 'checked' : ''}>随地面升降</label>
            ${axisRow('位置', obj.transform.position, true)}
            ${axisRow('旋转', obj.transform.rotation, true)}
            ${axisRow('缩放', obj.transform.scale, true)}
            ${rangeRow('统一缩放', obj.transform.scale[0] / uniformScaleBase(obj), 0.1, 3, 0.01)}
          </div>
          <h3 class="dt-section-title">外观</h3>
          <div class="dt-insp-block">
            <div class="dt-field"><div class="dt-axis-header"><span>颜色</span></div>
              <div class="dt-color-row"><input type="color" data-dt-color="角色颜色" value="${esc(obj.color || '#4f8ef7')}"><input type="text" class="dt-range-value" data-dt-color-value="角色颜色" value="${esc(obj.color || '#4f8ef7')}"></div></div>
          </div>
          `;
      }
    }
    if(obj.whitebox){const p=obj.whitebox.parameters;html+='<h3 class="dt-section-title">白模尺寸（米）</h3><div class="dt-insp-block">'+['宽度','高度','深度'].map((label,i)=>'<label class="dt-field">'+label+'<input class="dt-text" type="number" min="0.02" max="200" step="0.01" data-dt-whitebox-size="'+i+'" aria-label="白模'+label+'" value="'+p.size[i]+'"></label>').join('')+'</div>';}
    if(isCam)html+=timeline.pathPanel(obj);
    html += `<div class="dt-insp-block"><button type="button" class="dt-btn dt-btn-danger" data-dt-delete="${esc(obj.id)}">删除对象</button></div>`;
    box.innerHTML = html;
  }


  function applyCameraPreset(presetName) {
    const obj=S.project.objects.find(o=>o.id===S.selectedId&&o.kind==='camera');if(!obj||obj.locked||timeline.trackOf(obj.id)?.locked)return;
    pushUndo();
    const n=Math.max(12,Math.min(480,parseInt(S.el.inspector.querySelector('#dtPresetDuration')?.value,10)||72));
    const start=S.playhead,end=start+n,value=timeline.sampled(obj),p=value.transform.position.slice(),target=(value.target||[0,1,0]).slice();
    if(end>=S.project.sequence.durationFrames){S.project.sequence.durationFrames=end+1;S.workArea[1]=end;S.project.sequence.workArea=S.workArea.slice();}
    const track=ensureObjectTrack(obj.id),dir=target.map((v,i)=>v-p[i]),dist=Math.hypot(...dir)||1,unit=dir.map(v=>v/dist);
    for(const ch of [...Animation.GROUPS.position,...Animation.GROUPS.target,'fov'])if(track.channels[ch])track.channels[ch]=track.channels[ch].filter(k=>k.frame<start||k.frame>end);if(track.path&&track.channels['rotation.y'])track.channels['rotation.y']=track.channels['rotation.y'].filter(k=>k.source!=='path');delete track.path;
    const right=[-unit[2],0,unit[0]],frames=(presetName==='环绕'||presetName==='吊臂升降'||presetName==='轻微手持')?24:2;
    for(let i=0;i<frames;i++){
      const u=i/(frames-1),f=start+Math.round(n*u);let out=p.slice(),fov=value.fov||50;
      if(presetName==='推进'||presetName==='拉远'||presetName==='Dolly Zoom'){const amt=dist*u*(presetName==='拉远'?-.5:.3);out=out.map((v,j)=>v+unit[j]*amt);if(presetName==='Dolly Zoom')fov=2*Math.atan(Math.tan(fov*Math.PI/360)*dist/(dist-amt))*180/Math.PI;}
      else if(presetName==='横移'||presetName==='跟拍')out=out.map((v,j)=>v+right[j]*1.5*u);
      else if(presetName==='升降')out[1]+=1.4*u;
      else if(presetName==='环绕'||presetName==='吊臂升降'){const dx=p[0]-target[0],dz=p[2]-target[2],a=u*Math.PI/2;out=[target[0]+dx*Math.cos(a)-dz*Math.sin(a),p[1]+(presetName==='吊臂升降'?1.4*u:0),target[2]+dx*Math.sin(a)+dz*Math.cos(a)];}
      else if(presetName==='弧线跟随')out=out.map((v,j)=>v+right[j]*Math.sin(u*Math.PI/2)+unit[j]*u*.8);
      else if(presetName==='揭示')out=[p[0]+1.5*u,p[1]+.8*u,p[2]];
      else if(presetName==='轻微手持')out=out.map((v,j)=>v+Math.sin(i*2.4+j)*.025*Math.sin(u*Math.PI));
      Animation.GROUPS.position.forEach((ch,j)=>Animation.putKey(track,ch,f,out[j],frames>2?'linear':S.interpMode||'ease'));
      Animation.GROUPS.target.forEach((ch,j)=>Animation.putKey(track,ch,f,target[j]+(presetName==='跟拍'?right[j]*1.5*u:0),'linear'));
      if(presetName==='Dolly Zoom')Animation.putKey(track,'fov',f,fov,'linear');
    }
    timeline.expanded.add(obj.id);persist();refreshTracks();toast('已应用运镜「'+presetName+'」');
  }
  function ensureObjectTrack(objectId) { return timeline.track(objectId);
  }
  function setCameraFov(obj, fov) {
    obj.fov = fov;
    const cam = S.project.cameras.find(c => c.id === obj.id);
    if (cam) cam.fov = fov;
  }

  /* ============================================================
     时间轴
     ============================================================ */
  function refreshTracks() { timeline?.refresh();
  }
  function bindTimelineEvents() { /* Event delegation lives in director-timeline.js. */
  }

  /* ---------- 播放控制 ---------- */
  function setPlaying(on) {
    if(on)S.previewCameraId='';
    if(on && !S.recording) {
      const range=S.loopWorkArea?S.workArea:[0,S.project.sequence.durationFrames-1];
      if(S.playhead>=range[1]||S.playhead<range[0])setPlayhead(range[0]);
    }
    S.playing=on;
    if(S.el.playBtn){S.el.playBtn.innerHTML=on?ICONS.pause:ICONS.play;S.el.playBtn.title=on?'暂停':'播放';S.el.playBtn.setAttribute('aria-label',on?'暂停':'播放');}
    if(on)lastPlayheadFloat=S.playhead;
  }
  function setDuration(f) { timeline.setDuration(f);
  }
  // 时间轴元数据（入/出/时长秒）统一同步，避免多处各写一份
  function syncTimelineMeta() { timeline?.syncMeta();
  }

  /* ============================================================
     导出（按时间轴逐帧编码，独立于浏览器实时绘制）
     ============================================================ */
  async function toggleRecording(options={}) {
    if(S.recording){stopRecording();return;}
    if(!S.renderer||!activeCameraObj())return toast('请先添加一个机位');
    if(typeof VideoEncoder==='undefined')return toast('此浏览器不支持逐帧视频导出，请使用支持 WebCodecs 的浏览器');
    const exportState={cancelled:false,node:S.nodeEl,frame:S.playhead,epoch:S.animationEpoch,renderer:null};
    S.exportState=exportState;S.recording=true;setPlaying(false);
    S.el.recordBtn.classList.add('is-recording');S.el.recordBtn.textContent='取消导出';
    S.el.taskOverlay.hidden=false;S.el.taskText.textContent='准备机位视频…';
    const hidden=[];
    try{
      if(exportState.cancelled)return;
      const ar=cameraAspect(activeCameraObj());
      const width=Math.round((ar>=1?1280:1280*ar)/2)*2,height=Math.round((ar>=1?1280/ar:1280)/2)*2;
      const renderer=new S.three.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});exportState.renderer=renderer;
      renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.outputColorSpace=S.renderer.outputColorSpace;renderer.toneMapping=S.renderer.toneMapping;renderer.toneMappingExposure=S.renderer.toneMappingExposure;
      const camera=new S.three.PerspectiveCamera(50,ar,.01,2000);
      const {encodeCanvasVideo}=await import('./director-video-export.mjs?v=20261012-token1');
      const plan=Animation.exportPlan(S.project.sequence,S.workArea,S.project.timeline.exportFps),rate=plan.rate;
      let posterDataUrl='';
      const result=await encodeCanvasVideo({canvas:renderer.domElement,plan,fallbackWebm:options.fallbackWebm,requestedFormat:options.format,
        isCancelled:()=>exportState.cancelled||!S.open||exportState.epoch!==S.animationEpoch,
        renderFrame:frame=>{
          setPlayhead(frame,{fractional:true});
          const cam=activeCameraObj();syncRenderCameraFromGizmo(camera,cam);
          S.scene.traverse(o=>{if(o.userData.directorHelper||o.userData.directorPath||o.isTransformControls||o===S.grid||S.project.objects.some(p=>p.kind==='camera'&&S.sceneObjects.get(p.id)===o)){hidden.push([o,o.visible]);o.visible=false;}});
          try{renderExportCameraFrame(renderer,camera,cam,width,height);if(!posterDataUrl)posterDataUrl=renderer.domElement.toDataURL('image/jpeg',.9);}finally{for(const [o,visible]of hidden)o.visible=visible;hidden.length=0;}
        },
        onProgress:(done,count)=>{if(exportState.cancelled||!S.open||exportState.epoch!==S.animationEpoch)return;S.el.taskText.textContent='正在导出机位视频 '+Math.round(done/count*100)+'% · '+width+' × '+height+' · '+rate+' 帧/秒';}
      });
      if(exportState.cancelled||!S.open)return;
      const {blob}=result;
      S.el.taskText.textContent=options.destination==='download'?'视频编码完成，正在下载…':'视频编码完成，正在保存到画布…';exportState.saving=true;S.el.recordBtn.disabled=true;S.el.taskOverlay.querySelector('button')?.setAttribute('disabled','');
      const name='导演台预演-'+new Date().toISOString().replace(/[:.]/g,'-')+result.extension;
      if(options.destination==='download'){downloadDirectorBlob(blob,name);toast('视频已导出');}
      else if(typeof window.CanvasFlowDirectorExport==='function'){
        try{await window.CanvasFlowDirectorExport({blob,name,node:exportState.node,duration:result.duration,width,height,fps:rate,posterDataUrl,destination:options.destination});toast(options.destination==='film'?'视频已送到成片工作台':'视频已保存到画布');}
        catch(error){offerRecordingDownload(blob,name,'保存到画布失败：'+error.message);}
      }else offerRecordingDownload(blob,name,'视频已完成；当前页面没有画布，可下载保存');
    }catch(error){if(!exportState.cancelled&&error.name!=='AbortError')toast('导出失败：'+error.message);}
    finally{
      for(const [o,visible]of hidden)o.visible=visible;
      exportState.renderer?.dispose();exportState.renderer?.forceContextLoss();
      if(S.exportState===exportState){S.recording=false;S.exportState=null;}
      if(S.open&&exportState.epoch===S.animationEpoch){S.el.recordBtn.classList.remove('is-recording');S.el.recordBtn.textContent='导出视频到画布';S.el.recordBtn.disabled=false;S.el.taskOverlay.querySelector('button')?.removeAttribute('disabled');S.el.taskOverlay.hidden=true;setPlayhead(exportState.frame,{fractional:true});timeline.renderPaths();}
    }
  }
  function stopRecording() {
    if(!S.exportState||S.exportState.saving)return;
    S.exportState.cancelled=true;
    if(S.open)toast('已取消导出，不生成不完整视频');
  }
  function downloadDirectorBlob(blob,name){
    if(!blob)throw Error('没有可下载的数据');
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    (S.exportDownloadUrls||=[]).push(url);setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function previsExportSize(kind){
    if(kind==='video'){const ar=cameraAspect(activeCameraObj());return [Math.round((ar>=1?1280:1280*ar)/2)*2,Math.round((ar>=1?1280/ar:1280)/2)*2];}
    const src=S.renderer?.domElement;if(!src)return [0,0];
    const ar=S.viewMode==='camera'?cameraAspect():src.width/src.height;
    const w=Math.min(src.width,src.height*ar);return [Math.round(w),Math.round(w/ar)];
  }
  async function exportAsset(){
    if(S.recording||!S.envRoot)return;
    const project=S.project,epoch=S.animationEpoch;setPlaying(false);
    try{
      const {GLTFExporter}=await import('./vendor/three/addons/exporters/GLTFExporter.js?v=r160');
      if(!S.open||S.project!==project||S.animationEpoch!==epoch)return;
      S.scene.updateMatrixWorld(true);
      const root=S.skeletonUtils.clone(S.envRoot),remove=[];
      root.name=project.name||'CanvasFlow';
      root.traverse(o=>{const obj=project.objects.find(p=>p.id===o.userData.dtObjectId);if(o.userData.directorHelper||o.userData.directorPath||o.isTransformControls||o.type==='GridHelper'||obj?.kind==='camera')remove.push(o);});
      // Environment helpers and the proxy are editor-only, even when unnamed.
      [S.grid,S.groundPlane,S.panoramaDome,S.transformProxy].forEach(original=>{if(!original)return;const path=[];for(let o=original;o&&o!==S.envRoot;o=o.parent)path.unshift(o.parent.children.indexOf(o));let clone=root;for(const i of path)clone=clone?.children[i];if(clone)remove.push(clone);});
      for(const o of remove)o.removeFromParent();
      const result=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
      if(!S.open||S.project!==project||S.animationEpoch!==epoch)return;
      downloadDirectorBlob(new Blob([result],{type:'model/gltf-binary'}),'CanvasFlow-场景.glb');toast('3D 资产已导出');
    }catch(error){toast('3D 资产导出失败：'+error.message);}
  }
  let previsTransformBatch=false;
  function beginPrevisTransform(){if(previsTransformBatch||S.recording||!S.selectedId)return;setPlaying(false);beginBatch();pushUndo();previsTransformBatch=true;}
  function endPrevisTransform(){if(!previsTransformBatch)return;previsTransformBatch=false;endBatch();persist();}
  function editPrevisTransform(prop,axis,value,linked){
    const obj=S.project.objects.find(o=>o.id===S.selectedId);if(!obj||S.recording||Crowd.inherited(S.project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked||!Number.isFinite(value))return;
    const old=timeline.sampled(obj).transform.scale.slice(),i=['X','Y','Z'].indexOf(axis);
    value=prop==='缩放'?Math.max(.001,value):value;
    onAxisInput({dataset:{dtProp:prop,dtAxis:axis},value:String(value)});
    if(prop==='缩放'&&linked){const factor=value/Math.max(.001,old[i]);for(let j=0;j<3;j++)if(j!==i)onAxisInput({dataset:{dtProp:prop,dtAxis:['X','Y','Z'][j]},value:String(Math.max(.001,old[j]*factor))});}
    sampleAtFrame(S.playhead);timeline.updateUI();persist();
  }
  function setPrevisObjectFlag(id,flag){
    const obj=S.project.objects.find(o=>o.id===id);if(!obj||S.recording)return;
    if(obj.parentId&&Crowd.inherited(S.project,obj.parentId,'locked'))return toast('请先解锁所属分组');
    if(flag==='visible'){toggleVisible(id);sampleAtFrame(S.playhead);refreshTracks();renderInspector();return;}
    pushUndo();if(flag==='visible')obj.visible=obj.visible===false;else obj.locked=!obj.locked;
    sampleAtFrame(S.playhead);persist();refreshTree();refreshTracks();renderInspector();syncObjectGizmo();
  }
  function offerRecordingDownload(blob,name,message){
    toast(message);
    const a=document.createElement('a');const url=URL.createObjectURL(blob);
    (S.exportDownloadUrls||=[]).push(url);a.className='dtl-export-download';a.href=url;a.download=name;a.textContent='下载已导出视频（'+(blob.type==='video/mp4'?'MP4':'WebM')+'）';
    S.el.shell.appendChild(a);a.onclick=()=>{setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},3000);};
  }

  /* ============================================================
     全局事件（导演台 shell 内委托）
     ============================================================ */
  let docKeydownBound = false;
  let fullscreenResizeBound = false;
  let wasdBound = false;
  function syncSidebarToggleUI(shellEl) {

    const collapsed = shellEl.classList.contains('sb-left-collapsed');
    const headBtn = shellEl.querySelector('.dt-sb-head [data-dt-close]');
    if (headBtn) {
      headBtn.title = collapsed ? '展开侧边栏' : '关闭导演台';
      headBtn.setAttribute('aria-label', headBtn.title);
      headBtn.innerHTML = collapsed ? ICONS.panelRight : ICONS.close;
    }
  }
  function bindShellEvents() {
    // S.el.shell 是每次 open 新建的（旧 shell 随 close 移除），监听器随元素销毁；
    // document 级 keydown 需要防重复挂载（handler 里用 S.open 自查生命周期）。
    S.el.shell.addEventListener('click', (e) => {
      const t = e.target.closest('[data-dt-scene-settings],[data-dt-preview-expand],[data-dt-preview-close],[data-dt-add],[data-dt-addchar],[data-dt-addcrowd],[data-dt-geotoggle],[data-dt-addgeo],[data-dt-addcampreset],[data-dt-setaspect],[data-dt-localmodel],[data-dt-pano-local],[data-dt-pano-history],[data-dt-pano-ai],[data-dt-pano-apply],[data-dt-sbrail],[data-dt-sbshot],[data-dt-sbfs],[data-dt-sbblender],[data-dt-sbtoggle],[data-dt-close],[data-dt-select],[data-dt-group-toggle],[data-dt-visible],[data-dt-lock],[data-dt-delete],[data-dt-play],[data-dt-seek],[data-dt-preset],[data-dt-body],[data-dt-crowd],[data-dt-geo],[data-dt-record],[data-dt-mode],[data-dt-panorama-pick],[data-dt-panorama-clear],[data-dt-task-cancel],[data-dt-keyframe],[data-dt-timeline-collapse],[data-dt-key-nav],[data-dt-key-delete],[data-dt-key-copy],[data-dt-key-paste],[data-dt-loop],[data-dt-camera-cut],[data-dt-cycle-cam],[data-dt-ctab],[data-dt-pose],[data-dt-pose-reset],[data-dt-ground-snap],[data-dt-transform-reset],[id="dtAutoKey"],[id="dtAspectBtn"],[id="dtScreenshot"],[id="dtFullscreen"],[id="dtImportPanorama"]');
      if (!t) return;
      const d = t.dataset;
      if (d.dtSceneSettings !== undefined) { selectObject(''); S.el.shell.querySelector('.director-sidebar-right').scrollTop = 0; return; }
      if (d.dtPreviewExpand !== undefined) { openCamPreviewFullscreen(); return; }
      if (d.dtPreviewClose !== undefined) { closeCamPreviewFullscreen(); return; }
      if(S.recording&&d.dtTaskCancel===undefined&&d.dtRecord===undefined&&d.dtClose===undefined)return;
      if(t.closest('#dtInspector')&&Crowd.inherited(S.project,S.selectedId,'locked')&&['dtPreset','dtBody','dtGeo','dtPose','dtPoseReset','dtGroundSnap','dtTransformReset'].some(k=>d[k]!==undefined)){toast('此对象或所属分组已锁定');return;}
      if(d.dtGroupToggle){S.groupCollapsed.has(d.dtGroupToggle)?S.groupCollapsed.delete(d.dtGroupToggle):S.groupCollapsed.add(d.dtGroupToggle);refreshTree();return;}
      if(d.dtLock){const obj=S.project.objects.find(o=>o.id===d.dtLock);if(obj){if(obj.parentId&&Crowd.inherited(S.project,obj.parentId,'locked')){toast('请先解锁所属分组');return;}pushUndo();obj.locked=!obj.locked;persist();refreshTree();refreshTracks();renderInspector();syncObjectGizmo();}return;}
      if (d.dtClose !== undefined) {

        const shellEl = t.closest('.director-shell');
        if (shellEl && shellEl.classList.contains('sb-left-collapsed')) {
          shellEl.classList.remove('sb-left-collapsed');
          syncSidebarToggleUI(shellEl);
          return;
        }
        return close();
      }
      if (d.dtAddchar) { addCharacter(d.dtAddchar); return; }
      if (d.dtAddcrowd !== undefined) { showCrowdDialog(t); return; }
      if (d.dtGeotoggle !== undefined) {
        const sub = document.getElementById('dtGeoSub');
        if (sub) sub.hidden = !sub.hidden;
        return;
      }
      if (d.dtAddgeo) { addGeometry(d.dtAddgeo); return; }
      if (d.dtSbrail !== undefined) {
        const shellEl = t.closest('.director-shell');
        // Clicking the open tab repeats the sidebar collapse action.
        if(shellEl&&!shellEl.classList.contains('sb-left-collapsed')&&t.classList.contains('is-active')){
          shellEl.classList.add('sb-left-collapsed');
          syncSidebarToggleUI(shellEl);
          return;
        }
        S.sbTab = d.dtSbrail;

        if (shellEl && shellEl.classList.contains('sb-left-collapsed')) {
          shellEl.classList.remove('sb-left-collapsed');
          syncSidebarToggleUI(shellEl);
        }
        const rail = t.closest('.dt-sb-rail');
        if (rail) rail.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === t));
        const panel = document.getElementById('dtSbPanel');
        if (panel) panel.querySelectorAll('.dt-sb-page').forEach(p => { p.hidden = p.dataset.sbpage !== d.dtSbrail; });
        if (d.dtSbrail === 'aspect') syncAspectGrid();
        return;
      }

      if (d.dtAddcampreset !== undefined) { addCamera(d.dtAddcampreset || null); return; }
      if (d.dtSetaspect) { setAspect(d.dtSetaspect); return; }

      if (d.dtLocalmodel !== undefined) { importLocalModel(); return; }

      if (d.dtPanoLocal !== undefined) { pickPanorama(); return; }
      if (d.dtPanoHistory !== undefined) { togglePanoHistory(); return; }
      if (d.dtPanoAi !== undefined) { aiGeneratePanorama(); return; }
      if (d.dtSbshot !== undefined) { captureViewport(); return; }
      if (d.dtSbfs !== undefined) { toggleFullscreen(); return; }
      if (d.dtSbblender !== undefined) { openBlenderTools(); return; }
      if (d.dtSbtoggle !== undefined) {

        const shellEl = t.closest('.director-shell');
        if (shellEl) {
          shellEl.classList.toggle('sb-left-collapsed');
          syncSidebarToggleUI(shellEl);
        }
        return;
      }
      if (d.dtAdd) { d.dtAdd === 'camera' ? addCamera() : d.dtAdd === 'geometry' ? addGeometry('box') : addCharacter(); return; }
      if (d.dtSelect !== undefined) { selectObject(d.dtSelect); return; }
      if (d.dtVisible !== undefined) { toggleVisible(d.dtVisible); return; }
      if (d.dtDelete) { S.selectedId && S.project.objects.some(o => o.id === d.dtDelete) ? removeObject(d.dtDelete) : (d.dtDelete && S.project.objects.some(o => o.id === d.dtDelete) ? removeObject(d.dtDelete) : null); return; }
      if (d.dtPlay !== undefined) { setPlaying(!S.playing); return; }
      if (d.dtLoop !== undefined) { toggleLoop(); return; }
      if (d.dtCycleCam !== undefined) { switchSelectedCamera(); return; }
      if (t.id === 'dtAspectBtn') { cycleAspect(); return; }
      if (t.id === 'dtScreenshot') { captureViewport(); return; }
      if (t.id === 'dtFullscreen') { toggleFullscreen(); return; }
      if (t.id === 'dtImportPanorama') { pickPanorama(); return; }
      if (d.dtSeek) {
        const total = S.project.sequence.durationFrames;
        if (d.dtSeek === 'start') setPlayhead(0);
        else if (d.dtSeek === 'end') setPlayhead(total - 1);
        else setPlayhead(S.playhead + (d.dtSeek === 'next' ? 1 : -1));
        return;
      }
      if (d.dtPreset) { applyCameraPreset(d.dtPreset); return; }
      if (d.dtBody) { changeBodyType(d.dtBody); return; }
      if (d.dtCrowd !== undefined) { changeCrowd(d.dtCrowd); return; }
      if (d.dtGeo) { changeGeometry(d.dtGeo); return; }
      if (d.dtRecord !== undefined) { toggleRecording(); return; }
      if (d.dtMode) { switchMode(d.dtMode); return; }
      if (d.dtPanoramaPick !== undefined) { pickPanorama(); return; }
      if (d.dtPanoramaClear !== undefined) { clearPanorama(); return; }
      if (d.dtTaskCancel !== undefined) { stopRecording(); return; }
      if (d.dtKeyframe) { keyframeSelected(d.dtKeyframe); return; }
      if (d.dtCtab) { S.charTab = d.dtCtab; renderInspector(); syncObjectGizmo();S.poseEditor?.update();timeline?.renderPaths();return; }
      if (d.dtPose) { applyPosePreset(d.dtPose); return; }
      if (d.dtPoseReset !== undefined) { resetCharacterPose(); return; }
      if (d.dtGroundSnap !== undefined) { snapCharacterToGround(); return; }
      if (d.dtTransformReset !== undefined) { resetCharacterTransform(); return; }
      if (d.dtTimelineCollapse !== undefined) { timeline.toggleMinimized(); return; }
      if (t.id === 'dtAutoKey') { toggleAutoKey(); return; }
      if (d.dtKeyNav) { navigateKeyframe(d.dtKeyNav === 'next' ? 1 : -1); return; }
      if (d.dtKeyDelete !== undefined) { deleteKeyframeAtPlayhead(); return; }
      if (d.dtKeyCopy !== undefined) { copyKeyframeAtPlayhead(); return; }
      if (d.dtKeyPaste !== undefined) { pasteKeyframeAtPlayhead(); return; }
      if (d.dtCameraCut !== undefined) { cutToCameraAtPlayhead(); return; }
    });



    S.el.shell.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('[data-dt-axis-drag]');
      if (!handle || e.button !== 0 || S.recording || S.readOnly || Crowd.inherited(S.project,S.selectedId,'locked') || timeline.trackOf(S.selectedId)?.locked) return;
      e.preventDefault();
      const axis = handle.dataset.dtAxisDrag;
      const input = handle.parentElement.querySelector('input[data-dt-axis]');
      if (!input) return;
      const startX = e.clientX;
      const startVal = parseFloat(input.value) || 0;
      const selectedId=S.selectedId,pointerId=e.pointerId,oldCursor=document.body.style.cursor;
      beginBatch();
      handle.classList.add('is-dragging');
      document.body.style.cursor = 'ew-resize';
      const onMove = (ev) => {
        if(ev.pointerId!==pointerId)return;
        if(S.selectedId!==selectedId||S.recording||S.readOnly||Crowd.inherited(S.project,selectedId,'locked')||timeline.trackOf(selectedId)?.locked){onUp();return;}
        const val = Math.round((startVal + (ev.clientX - startX) * 0.1) * 1000) / 1000;
        input.value = val;
        onAxisInput(input);
      };
      const onUp = () => {
        if(S.axisScrubCleanup!==onUp)return;
        S.axisScrubCleanup=null;
        handle.classList.remove('is-dragging');
        document.body.style.cursor = oldCursor;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('blur', onUp);
        endBatch();
        persist();
      };
      S.axisScrubCleanup=onUp;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('blur', onUp);
    });
    S.el.shell.addEventListener('wheel', (e) => {
      const handle=e.target.closest('[data-dt-axis-drag]');
      if(!handle||S.recording||S.readOnly||Crowd.inherited(S.project,S.selectedId,'locked')||timeline.trackOf(S.selectedId)?.locked)return;
      const input=handle.parentElement.querySelector('input[data-dt-axis]');
      if(!input||input.disabled||input.readOnly)return;
      const steps=window.CanvasFlowScrub?.wheelSteps(e,handle);if(!steps)return;
      input.value=Number(((Number(input.value)||0)+steps*(e.shiftKey?.01:.1)).toFixed(3));
      beginBatch();try{onAxisInput(input);}finally{endBatch();}persist();
    },{passive:false});
    // inspector 输入
    S.el.shell.addEventListener('input', (e) => {
      const t = e.target;
      if(S.recording)return;
      if(t.matches('[data-dt-camera-choice],[data-dt-camera-binding]'))return;
      if(t.closest('#dtInspector')&&Crowd.inherited(S.project,S.selectedId,'locked')){renderInspector();toast('此对象或所属分组已锁定');return;}
      if(t.matches('[data-dt-whitebox-size]')){const obj=S.project.objects.find(o=>o.id===S.selectedId);if(obj?.whitebox&&Number.isFinite(t.valueAsNumber)&&t.checkValidity()){pushUndoLite();obj.whitebox.parameters.size[Number(t.dataset.dtWhiteboxSize)]=t.valueAsNumber;rebuildObjectMesh(obj);sampleAtFrame(S.playhead);persist();}return;}
      if (t.matches('[data-dt-axis]')) return onAxisInput(t);
      if (t.matches('[data-dt-range]')) return onRangeInput(t); // 滑轨拖动实时生效
      if (t.matches('[data-dt-color]')) return onColorInput(t);
      if (t.matches('[data-dt-color-value]')) return onColorValue(t);
      if (t.id === 'dtTimecodeInput') return onTimecodeInput(t);
      if (t.id === 'dtWorkIn') return onWorkRangeInput('in', t);
      if (t.id === 'dtWorkOut') return onWorkRangeInput('out', t);
      if (t.id === 'dtDurationSec') {if(t.value==='')return;const frames=timeline.parseTime(t.value);if(frames!==null)setDuration(frames);return;}
      if (t.id === 'dtZoom') { timeline.zoom(Number(t.value)); return; }
      if (t.matches('[data-dt-name]')) { onNameInput(t.value); return; }
      if (t.matches('[data-dt-paxis]')) return onPoseAxisInput(t); 
      if (t.matches('[data-dt-paxis-value]')) return onPoseAxisValue(t); // 姿势调节数值框
      if (t.matches('[data-dt-range-value]')) return onRangeValue(t); // 数值框（右）→ 同步滑杆
      if (t.matches('[data-dt-switch]')) {
        const key = t.dataset.dtSwitch;
        S.project.scene[key] = t.checked;
        if (key === 'showLabels' && S.labelLayer) S.labelLayer.style.display = t.checked ? '' : 'none';
        if (key === 'showGround') { if (S.grid) S.grid.visible = t.checked; if (S.groundPlane) S.groundPlane.visible = t.checked; }
        persist(); return;
      }
      if (t.matches('[data-dt-follow-ground]')) {
        const obj = S.project.objects.find(o => o.id === S.selectedId);
        if (obj) {
          if(Crowd.inherited(S.project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked){t.checked=!!obj.followGround;return;}
          pushUndo();obj.followGround = t.checked; persist();
        }
        return;
      }
    });
    S.el.shell.addEventListener('change', (e) => {
      const t = e.target;
      if(S.recording)return;
      if(t.matches('[data-dt-camera-choice]')){
        if(S.project.objects.some(o=>o.kind==='camera'&&o.id===t.value)){selectObject(t.value);sampleAtFrame(S.playhead);persist();}
        return;
      }
      if(t.closest('#dtInspector')&&Crowd.inherited(S.project,S.selectedId,'locked')){renderInspector();toast('此对象或所属分组已锁定');return;}
      if(t.matches('[data-dt-camera-binding]'))return changeCameraBinding(t);
      if(t.matches('[data-dt-camera-aspect]')) { setCameraAspect(t.value); return; }
      if (t.matches('[data-dt-color]')) return onColorInput(t);
      if (t.id === 'dtDurationSec') { const frames=timeline.parseTime(t.value);if(frames!==null)setDuration(frames);return; }
      if (t.id === 'dtInterp') { timeline.interpolate(t.value); return; }
      if (t.matches('[data-dt-scene-aspect]')) { setAspect(t.value); return; }
    });

    const search = S.el.treeSearch;
    if (search) {
      search.addEventListener('input', () => { S.treeFilter = search.value.trim(); refreshTree(); });
    }

    if (!wasdBound) {
      wasdBound = true;
      const wasdMap = (code) => ({ KeyW: 'moveForward', KeyS: 'moveBackward', KeyA: 'strafeLeft', KeyD: 'strafeRight', KeyQ: 'moveDown', KeyE: 'moveUp' }[code] || null);
      window.addEventListener('keydown', (e) => {
        if (!S.open || panoHistoryDialog || panoAiDialog) return;
        if(e.target.closest?.('.pv-share-card'))return;
        const t = e.target;
        if (t && t.closest && t.closest('input, textarea, select')) return;
        const a = wasdMap(e.code);
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        S.keyNudges.add(a);
      }, true);
      window.addEventListener('keyup', (e) => {
        const a = wasdMap(e.code);
        if (a) S.keyNudges.delete(a);
      }, true);
      window.addEventListener('blur', () => S.keyNudges.clear());
    }
    // Esc 关闭（keydown 挂在 document 上并检查导演台是否打开，因为 shell 无 tabindex 无法可靠聚焦；
    // 只挂一次——重复 open 不叠加监听器）
    if (!docKeydownBound) {
      docKeydownBound = true;
      document.addEventListener('keydown', (e) => {
        if (!S.open || panoHistoryDialog || panoAiDialog) return;
        if(S.readOnly&&(['Delete','Backspace','Escape','g','r','s'].includes(e.key)||(e.ctrlKey||e.metaKey)&&['v','z','y'].includes(e.key.toLowerCase()))){e.preventDefault();e.stopImmediatePropagation();return;}
        if(e.target.closest?.('.pv-share-card,.pv-asset-library-layer,.pv-object-menu,.pv-asset-rename'))return;
        const inField = e.target.closest && e.target.closest('input, textarea, select');
        if(e.key==='Escape'&&!S.el.shell.querySelector('#dtCamPreviewFullscreen').hidden){closeCamPreviewFullscreen();e.preventDefault();e.stopImmediatePropagation();return;}
        if(e.key==='Escape'&&S.el.crowdDialog){closeCrowdDialog();e.preventDefault();return;}
        if(e.key==='Escape'&&S.poseEditor?.escape()){e.preventDefault();return;}
        if (e.key === 'Escape' && timeline.escape()) {e.preventDefault();return;}
        if (e.key === 'Escape' && S.previs?.escape()) {e.preventDefault();e.stopImmediatePropagation();return;}
        if (e.key === 'Escape') {
          const shell = document.querySelector('.director-shell');
          if (shell && shell.classList.contains('dt-css-fullscreen')) { cssFullscreen(shell); return; }
          if (S.recording) stopRecording(); else if (S.el.timeline && S.el.timeline.classList.contains('is-open') && !inField) setTimelineOpen(false); else if (!inField) close();
        }
        if(e.target.closest?.('.dt-path-point')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
        if (S.recording || inField || e.target.isContentEditable || e.target.closest?.('.dt-director-dock button,.pv-header button,.pv-header summary,.pv-timeline button,.pv-camera-preview button,.pv-duration-dialog')) return; // 原生按钮保留键盘激活行为
        if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();timeline.copy();}
        if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();timeline.paste();}
        if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
        if([' ','Home','End','ArrowLeft','ArrowRight','Delete','Backspace'].includes(e.key)||(e.ctrlKey||e.metaKey)&&['c','v','z','y'].includes(e.key.toLowerCase()))e.stopImmediatePropagation();
        if (e.key === ' ') { e.preventDefault(); setPlaying(!S.playing); }
        if (e.key === 'Home') setPlayhead(0);
        if (e.key === 'End') setPlayhead(S.project.sequence.durationFrames - 1);
        if (e.key === 'ArrowLeft') { e.preventDefault(); setPlayhead(S.playhead - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); setPlayhead(S.playhead + 1); }
        if (e.key === 'Delete') { deleteKeyframeAtPlayhead(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      }, true);
    }
    // 全屏进出时 ResizeObserver 不可靠（实测全屏期间零次 resize 回调），
    // canvas 会卡在旧 GL 缓冲尺寸 → 画面小一圈/黑边。fullscreenchange 一到就同步重算。
    if (!fullscreenResizeBound) {
      fullscreenResizeBound = true;
      document.addEventListener('fullscreenchange', () => {
        if (!S.open || !S.renderer || !S.el.holder) return;
        requestAnimationFrame(() => {
          const w = S.el.holder.clientWidth, h = S.el.holder.clientHeight;
          if (w && h) {
            S.renderer.setSize(w, h);
            S.camera.aspect = w / h;
            S.camera.updateProjectionMatrix();
          }
        });
      });
    }
    // 时间轴高度拖拽
    const handle = S.el.shell.querySelector('#dtTimelineResize');
    if (handle) {
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(S.el.timeline.classList.contains('dtl-minimized')){timeline.toggleMinimized();return;}
        const startY = e.clientY, startH = S.el.timeline.offsetHeight;
        const move = (ev) => { S.el.timeline.style.height = `${Math.max(100, Math.min(460, startH + (startY - ev.clientY)))}px`; };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }
  }

  function onAxisInput(input) {
    const axis = input.dataset.dtAxis, val = parseFloat(input.value) || 0;
    const prop = input.dataset.dtProp;
    const i = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
    // ===== 场景级属性（未选中对象时）：场景平移/旋转、导演视口位置/注视点 =====
    if (prop === '场景平移' || prop === '场景旋转') {
      pushUndoLite();
      const arr = prop === '场景平移' ? S.project.scene.position : S.project.scene.rotation;
      arr[i] = prop==='缩放'?Math.max(.001,round3(val)):round3(val);
      applySceneTransform();
      S.dirty = true; return;
    }
    if (prop === '视口位置' || prop === '注视点') {
      // 机位视角为固定取景，不响应导演视口的数值调节
      if (S.viewMode === 'camera') return;
      pushUndoLite();
      const p = S.camera.position, t = S.controls.getTarget(new S.three.Vector3());
      const px = [p.x, p.y, p.z], tt = [t.x, t.y, t.z];
      (prop === '视口位置' ? px : tt)[i] = round3(val);
      S.controls.moveTo(px[0], px[1], px[2], false);
      S.controls.setLookAt(px[0], px[1], px[2], tt[0], tt[1], tt[2], false);
      S.dirty = true; return;
    }
    const id = S.selectedId; const obj = S.project.objects.find(o => o.id === id); if (!obj) return;
    if(Crowd.inherited(S.project,obj.id,'locked') || timeline.trackOf(obj.id)?.locked)return;
    pushUndoLite();
    const current=timeline.sampled(obj);
    obj.transform=Animation.clone(current.transform);if(obj.target)obj.target=current.target.slice();
    if(obj.kind==='camera'&&prop==='旋转'){
      // Rotation fields describe the actual lens, not offsets added to lookAt.
      prepareCameraManualRotation(obj,current);
      obj.transform.rotation=cameraInspectorValue(obj).transform.rotation;
      obj.targetMode='rotation';obj.cameraRotationAbsolute=true;delete obj.lookAtTargetId;
      if(obj.followViewMode==='firstPerson')obj.followViewMode='thirdPerson';
    }
    let arr;
    if (prop === '位置') arr = obj.transform.position;
    else if (prop === '旋转') arr = obj.transform.rotation;
    else if (prop === '缩放') arr = obj.transform.scale;
    else if (prop === '注视坐标') arr = obj.target;
    else return;
    arr[i] = round3(val)+(obj.kind==='camera'&&prop==='位置'&&obj.followTargetId?(obj.followAnchor?.[i]||0):0);
    if(obj.kind==='camera'&&prop==='位置'&&obj.followTargetId)obj.followOffset=obj.transform.position.map((v,j)=>v-(obj.followAnchor?.[j]||0));
    const mesh = S.sceneObjects.get(id);
    if (mesh) {
      applyTransform(mesh, obj.transform, { keepQuaternion: obj.kind === 'camera', isCharacter: false });
      // 机位的位置/注视变了 → 朝向重算（roll 用旋转 Z 分量叠加）
      if (obj.kind === 'camera') orientCameraGizmo(mesh, obj);
      if (prop === '缩放' && obj.kind === 'character') keepCharacterInView(); // 只在即将出画时轻拉镜头
    }
    // 机位视角下的相机跟随由 renderCameraLetterbox 每帧从场景 mesh 对齐（统一覆盖编辑/播放路径）
    timeline.edit(obj, prop, current);
    if(obj.kind==='camera'){
      sampleAtFrame(S.playhead);
      const look=S.el.inspector.querySelector('[data-dt-camera-binding="look"]');
      if(look&&prop==='旋转')look.value='__rotation__';
      if(prop==='旋转')S.el.inspector.querySelectorAll('[data-dt-prop="注视坐标"]').forEach(el=>el.closest('.dt-field')?.remove());
    }
    S.dirty = true;
  }
  let undoLiteTimer = 0;
  function pushUndoLite() {
    // 输入过程节流地记一次 undo 起点
    if (undoLiteTimer) return;
    undoLiteTimer = setTimeout(() => { undoLiteTimer = 0; }, 400);
    pushUndo();
  }

  let poseAxisPersistTimer = 0;
  function onPoseAxisInput(input) {
    const key = input.dataset.dtPaxis, val = parseFloat(input.value) || 0;
    const pct = input.max > input.min ? ((val - parseFloat(input.min)) / (parseFloat(input.max) - parseFloat(input.min))) * 100 : 50;
    input.style.setProperty('--range-fill', pct + '%');
    const numBox = S.el.inspector.querySelector(`[data-dt-paxis-value="${key}"]`);
    if (numBox && document.activeElement !== numBox) numBox.value = val;
    applyPoseAxisValue(key, val);
  }
  function onPoseAxisValue(input) {
    const key = input.dataset.dtPaxisValue;
    let val = parseFloat(input.value);
    if (isNaN(val)) val = 0;
    const min = parseFloat(input.dataset.dtPaxisMin), max = parseFloat(input.dataset.dtPaxisMax);
    val = Math.max(min, Math.min(max, val));
    const range = S.el.inspector.querySelector(`[data-dt-paxis="${key}"]`);
    if (range) {
      if (document.activeElement !== range) range.value = val;
      const pct = range.max > range.min ? ((val - parseFloat(range.min)) / (parseFloat(range.max) - parseFloat(range.min))) * 100 : 50;
      range.style.setProperty('--range-fill', pct + '%');
    }
    applyPoseAxisValue(key, val);
  }
  function applyPoseAxisValue(key, val) {
    const obj = S.project.objects.find(o => o.id === S.selectedId && o.kind === 'character');
    applyPoseValues(obj,{[key]:val},true);
  }
  function applyPoseValues(obj, values, remember) {
    if (!obj || Crowd.inherited(S.project,obj.id,'locked') || timeline.trackOf(obj.id)?.locked) return;
    if(remember)pushUndoLite();
    obj.poseMode='static';setPlaying(false);
    obj.poseControls = { _rigAxes:Rig.AXES_VERSION, ...obj.poseControls, _c2:1, ...values };
    obj.poseName = '自定义';
    applyPoseControls(obj, obj.poseControls);
    for(const [key,val] of Object.entries(values)){
      const range=S.el.inspector.querySelector(`[data-dt-paxis="${key}"]`),number=S.el.inspector.querySelector(`[data-dt-paxis-value="${key}"]`);
      if(range){range.value=val;range.style.setProperty('--range-fill',((val-Number(range.min))/(Number(range.max)-Number(range.min))*100)+'%');}
      if(number&&document.activeElement!==number)number.value=val;
    }
    if (poseAxisPersistTimer) clearTimeout(poseAxisPersistTimer);
    poseAxisPersistTimer = setTimeout(() => { poseAxisPersistTimer = 0; persist(); }, 400);
  }
  function onRangeInput(input) {
    const label = input.dataset.dtRange; let val = parseFloat(input.value);if(!Number.isFinite(val))return;if(label==='统一缩放')val=Math.max(.001,val);
    // 同步滑轨填充比例
    const pct = input.max > input.min ? ((val - parseFloat(input.min)) / (parseFloat(input.max) - parseFloat(input.min))) * 100 : 0;
    input.style.setProperty('--range-fill', pct + '%');
    // 数值框与滑杆双向同步
    const numBox = S.el.inspector.querySelector(`[data-dt-range-value="${label}"]`);
    if (numBox && document.activeElement !== numBox) numBox.value = val;
    const id = S.selectedId;
    const obj = S.project.objects.find(o => o.id === id);
    if(obj&&(Crowd.inherited(S.project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked))return;
    const previous=obj?timeline.sampled(obj):null;
    const sc = S.project.scene;
    pushUndoLite();
    if (label === '统一缩放' && obj) {
      const actual = val * uniformScaleBase(obj);
      obj.transform.scale = [actual, actual, actual];
      const mesh = S.sceneObjects.get(obj.id);
      if (mesh) applyTransform(mesh, obj.transform, { keepQuaternion: obj.kind === 'camera', isCharacter: false });
      if (obj.kind === 'character') keepCharacterInView(); // 只在即将出画时轻拉镜头，不抵消缩放的视觉变化
      timeline.edit(obj, '缩放',previous);
      persist(); return;
    }
    if (label === '视野角度 (FOV)') {
      // 未选中对象 = 导演视口 FOV；选中机位 = 机位 FOV
      if (obj && obj.kind === 'camera') {
        setCameraFov(obj, Math.round(val)); syncCameraGizmoFrustum(obj);
        if (S.viewMode === 'camera' && S.camera) { S.camera.fov = obj.fov; S.camera.updateProjectionMatrix(); }
      } else if (S.camera) { S.camera.fov = Math.round(val); S.camera.updateProjectionMatrix(); updateAspectFrame(); }
    }
    else if (label === '场景缩放' && sc) { sc.scale = val; applySceneTransform(); reframeCameraToCharacters(); }
    else if (label === '横滚 (Roll)' && obj) {
      obj.transform.rotation[2] = Math.round(val);
      const mesh = S.sceneObjects.get(obj.id);
      if (mesh) orientCameraGizmo(mesh, obj);
      // 机位视角下横滚实时可见：renderCameraLetterbox 每帧按工程数据叠加 roll
    }
    else if (label === '网格透明度' && sc) { sc.gridOpacity = val; if (S.grid) { S.grid.material.opacity = val; } }
    else if (label === '地面透明度' && sc) { sc.groundOpacity = val; if (S.groundPlane) S.groundPlane.material.opacity = val; }
    else if (label === '地面高度' && sc) { setGroundHeight(val); }
    else if (label === '水平旋转' && sc) { sc.panoramaYaw = val; if (S.panoramaDome) S.panoramaDome.rotation.y = val * Math.PI / 180; }
    else if (label === '球形半径' && sc) { sc.panoramaRadius = val; if (S.panoramaDome) { S.panoramaDome.scale.setScalar(val / 60); } }
    if (obj) timeline.edit(obj,label,previous);
    persist();
  }
  // FOV 改动后刷新机位 gizmo 的视锥线（工程数据 → 场景线框）
  function syncCameraGizmoFrustum(camObj) {
    const g = S.sceneObjects.get(camObj.id);
    if (g) updateCameraFrustum(g, camObj);
  }


  function keepCharacterInView() {
    if (!S.controls || !S.camera || S.viewMode !== 'director') return;
    const obj = S.project.objects.find(o => o.id === S.selectedId && o.kind === 'character');
    if (!obj) return;
    const mesh = S.sceneObjects.get(obj.id);
    if (!mesh) return;
    mesh.updateWorldMatrix(true, true);
    const box = new S.three.Box3().setFromObject(mesh, true);
    if (box.isEmpty()) return;
    // 世界包围盒角点全部投影,检查是否在画面内
    const corners = [
      new S.three.Vector3(box.min.x, box.min.y, box.min.z), new S.three.Vector3(box.max.x, box.min.y, box.min.z),
      new S.three.Vector3(box.min.x, box.max.y, box.max.z), new S.three.Vector3(box.max.x, box.max.y, box.max.z),
      new S.three.Vector3(box.min.x, box.max.y, box.min.z), new S.three.Vector3(box.max.x, box.min.y, box.max.z),
    ];
    let out = false;
    for (const c of corners) {
      const p = c.clone().project(S.camera);
      if (p.x < -0.98 || p.x > 0.98 || p.y < -0.98 || p.y > 0.98) { out = true; break; }
    }
    if (!out) return; // 完整在画面内:不动镜头,让缩放变化直接可见
    // 出画了:把注视点平移到人物中心(距离不变,人物回到画面中央)
    const center = box.getCenter(new S.three.Vector3());
    S.controls.setTarget(center.x, center.y, center.z, false);
    S.controls.update(0);
  }


  function reframeCameraToCharacters() {
    if (!S.controls || !S.camera || S.viewMode !== 'director') return;
    const charMeshes = [];
    const selected = S.project.objects.find(o => o.id === S.selectedId && o.kind === 'character');
    for (const o of S.project.objects) {
      if (o.kind !== 'character' || o.visible === false) continue;
      if (selected && o.id !== selected.id) continue;
      const m = S.sceneObjects.get(o.id);
      if (m) charMeshes.push(m);
    }
    if (!charMeshes.length) {
      for (const o of S.project.objects) {
        if (o.kind !== 'character' || o.visible === false) continue;
        const m = S.sceneObjects.get(o.id);
        if (m) charMeshes.push(m);
      }
    }
    if (!charMeshes.length) return;
    const box = new S.three.Box3();
    for (const m of charMeshes) {
      m.updateWorldMatrix(true, true);
      box.expandByObject(m);
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new S.three.Vector3());
    const size = box.getSize(new S.three.Vector3());
    const radius = Math.max(0.4, Math.max(size.x, Math.max(size.y, size.z)) * 0.5);
    // 距离不足以容纳全身时，沿当前视线方向拉远到刚好完整可见
    const dist = S.camera.position.distanceTo(center);
    const fovV = S.camera.fov * Math.PI / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * (S.camera.aspect || 1.6));
    const need = (radius / Math.sin(Math.min(fovV, fovH) / 2)) * 1.12;
    if (dist < need) {
      const dir = new S.three.Vector3().subVectors(S.camera.position, center);
      if (dir.lengthSq() < 1e-6) dir.set(0.4, 0.3, 1);
      dir.normalize();
      S.camera.position.copy(center).addScaledVector(dir, need);
    }
    S.controls.setTarget(center.x, center.y, center.z, false);
    S.controls.update(0);
  }
  function applySceneTransform() {
    if (!S.scene || !S.envRoot) return;
    const sc = S.project.scene;
    // 场景缩放/平移/旋转作用于整个场景根（网格/地面/全景/几何体/人物/机位）——
    // 人物跟随场景一起缩放；envRoot.position 即缩放轴心（默认=人物站位）
    const env = S.envRoot;
    env.scale.setScalar(sc.scale != null ? sc.scale : 1);
    env.position.fromArray(sc.position || [0, 0, 0]);
    env.rotation.set((sc.rotation || [0, 0, 0]).map(d => d * Math.PI / 180)[0], (sc.rotation || [0, 0, 0]).map(d => d * Math.PI / 180)[1], (sc.rotation || [0, 0, 0]).map(d => d * Math.PI / 180)[2]);
  }
  // 数值框（右）输入 → 同步滑杆
  function onRangeValue(input) {
    const range = S.el.inspector.querySelector(`[data-dt-range="${input.dataset.dtRangeValue}"]`);
    if (range) { range.value = input.value; range.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function onColorInput(input) {
    const label = input.dataset.dtColor;
    if (!/^#[0-9a-fA-F]{6}$/.test(input.value)) return;
    const valueInput = S.el.inspector?.querySelector(`[data-dt-color-value="${label}"]`);
    if (valueInput) valueInput.value = input.value;
    if (label === '天空颜色' || label === '背景色') {
      S.project.scene.backgroundColor = input.value;
      S.project.scene.panoramaTint = input.value;
      if (S.scene) S.scene.background = new S.three.Color(input.value);
      S.panoramaDome?.material.color.set(input.value);
      persist();
    }
    else if (label === '网格颜色') {
      S.project.scene.gridColor = input.value;
      if (S.grid) S.grid.material.color = new S.three.Color(input.value);
      persist();
    }
    else if (label === '角色颜色') {
      const obj = S.project.objects.find(o => o.id === S.selectedId);
      if (!obj) return;
      obj.color = input.value;
      // 实时换色：重设该角色全部材质颜色
      const mesh = S.sceneObjects.get(obj.id);
      if (mesh && S.three) {
        mesh.traverse(c => { if (c.isMesh && c.material) { const set = (m) => { m.color = new S.three.Color(input.value); return m; }; c.material = Array.isArray(c.material) ? c.material.map(set) : set(c.material); } });
      }
      persist();
    }
    if (S.renderer && S.scene && S.camera) stepFrame(0);
  }
  function onColorValue(input) {
    const swatch = S.el.inspector.querySelector(`[data-dt-color="${input.dataset.dtColorValue}"]`);
    if (swatch && /^#[0-9a-fA-F]{6}$/.test(input.value.trim())) { swatch.value = input.value.trim(); swatch.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function onNameInput(val) {
    const obj = S.project.objects.find(o => o.id === S.selectedId); if (!obj) return;
    pushUndoLite(); obj.name = String(val).slice(0, 30);
    const legacy=S.project.cameras.find(c=>c.id===obj.id);if(legacy)legacy.name=obj.name;
    persist(); refreshTree(); refreshTracks();
    const option=S.el.inspector.querySelector(`[data-dt-camera-choice] option[value="${CSS.escape(obj.id)}"]`);if(option)option.textContent=obj.name;
    const name=S.el.inspector.querySelector('.dt-obj-header-main strong');if(name)name.textContent=obj.name;
  }
  function changeBodyType(bt) {
    const obj = S.project.objects.find(o => o.id === S.selectedId && o.kind === 'character'); if (!obj) return;
    pushUndo();
    const oldScale=SAM_MODELS[obj.bodyType]?.scale||1,newScale=SAM_MODELS[bt]?.scale||1;
    const factor=newScale/oldScale;
    obj.transform.scale=obj.transform.scale.map(v=>v*factor);obj.rigVersion=2;
    const anim=timeline.trackOf(obj.id);
    for(const ch of ['scale.x','scale.y','scale.z'])for(const k of anim?.channels?.[ch]||[])k.value*=factor;
    obj.bodyType = bt;
    rebuildObjectMesh(obj);
    persist(); renderInspector(); refreshTree();
  }
  function changeCrowd(mode) { if(mode)showCrowdDialog();
  }

  function changeGeometry(gt) {
    const obj = S.project.objects.find(o => o.id === S.selectedId && o.kind === 'geometry'); if (!obj) return;
    pushUndo();
    obj.geometryType = gt;
    rebuildObjectMesh(obj);
    persist(); renderInspector();
  }
  function rebuildObjectMesh(obj) {
    const old = S.sceneObjects.get(obj.id);
    if (old) { if(old.userData.aiWhitebox){const mats=new Set();old.traverse(c=>{c.geometry?.dispose();if(c.material)mats.add(c.material);});mats.forEach(m=>m.dispose());}(old.parent || S.scene).remove(old); S.sceneObjects.delete(obj.id); }
    S.rigs.delete(obj.id);
    createSceneObject(obj);
    sampleAtFrame(S.playhead);
  }
  function keyframeSelected(propLabel, quiet) { timeline.keyframe(propLabel,quiet);
  }

  function toggleLoop() {
    S.loopWorkArea = !S.loopWorkArea; timeline.saveSettings();
    if (S.el.loopBtn) S.el.loopBtn.classList.toggle('is-active', S.loopWorkArea);
    toast(S.loopWorkArea ? '已开启循环播放' : '已关闭循环播放');
  }

  function toggleAutoKey() {
    S.autoKey = !S.autoKey; timeline.saveSettings();
    if (S.el.autoKeyBtn) S.el.autoKeyBtn.classList.toggle('is-active', S.autoKey);
    toast(S.autoKey ? '自动 K 已开启：移动/旋转对象将自动打关键帧' : '自动 K 已关闭');
  }

  function onTimecodeInput(input) { const f=timeline.parseTime(input.value);if(f!==null)setPlayhead(f);
  }

  function onWorkRangeInput(which,input) { timeline.setRange(which,input.value);
  }

  function copyKeyframeAtPlayhead() { timeline.copy();
  }
  function pasteKeyframeAtPlayhead() { timeline.paste();
  }

  function cutToCameraAtPlayhead() { timeline.cut();
  }
  // 画幅框标签（机位视角/对比视角右栏显示当前画幅比例）
  function syncAspectFrameLabel() {
    if (S.el.aspectFrameLabel) {
      S.el.aspectFrameLabel.textContent = S.project.scene.aspectRatio || '16:9';
      S.el.aspectFrameLabel.hidden = false;
    }
  }
  // Enter the selected camera's view with the same optics as its preview.
  function switchSelectedCamera() {
    const cam = S.project.objects.find(o => o.kind === 'camera' && o.id === S.selectedId);
    if (!cam) return;
    setPlaying(false);
    S.project.activeCameraId = cam.id;
    S.previewCameraId = cam.id;
    if(S.previs?.active)S.previs.setMode('film');else switchMode('camera');
    sampleAtFrame(S.playhead);
    if(S.previs?.active)renderPrevisFilm();else renderCameraLetterbox();
    persist();
  }

  function cycleAspect() {
    const idx = ASPECT_RATIOS.findIndex(r => r[0] === (S.project.scene.aspectRatio || '16:9'));
    const next = ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length];
    setAspect(next[0]);
  }

  function setAspect(label) {
    if (!ASPECT_RATIOS.some(r => r[0] === label) || label === S.project.scene.aspectRatio) return;
    pushUndo();
    S.project.scene.aspectRatio = label;
    updateAspectFrame(); syncAspectFrameLabel(); syncAspectGrid(); persist();
    toast('画幅比例 ' + label);
  }
  function setCameraAspect(label) {
    const cam=S.project.objects.find(o=>o.kind==='camera'&&o.id===S.selectedId);
    if (!cam || !ASPECT_RATIOS.some(r=>r[0]===label) || cam.aspectRatio===label) return;
    pushUndo();cam.aspectRatio=label;
    const saved=S.project.cameras.find(o=>o.id===cam.id);if(saved)saved.aspectRatio=label;
    updateAspectFrame();renderCamPreview();persist();
    toast('机位画幅比例 ' + label);
  }
  function syncAspectGrid() {
    const grid = S.el.shell && S.el.shell.querySelector('#dtAspectGrid');
    if (!grid) return;
    const cur = S.project.scene.aspectRatio || '16:9';
    grid.querySelectorAll('[data-dt-setaspect]').forEach(b => b.classList.toggle('is-active', b.dataset.dtSetaspect === cur));
  }

  function captureNodePreview() {
    if (!S.renderer || !S.scene || !S.camera) return null;
    // Do not replace a usable cover with a scene whose assets are still loading.
    if (S.project.objects.some(o=>o.kind==='character'&&!S.rigs.has(o.id))) return null;
    if ((S.project.scene.panoramaData||S.project.scene.panoramaUrl)&&!S.panoramaDome?.material.map) return null;
    if(S.viewMode==='camera')renderCameraLetterbox();else renderCameraScene(S.renderer, S.camera);
    const src=S.renderer.domElement,sw=src.width,sh=src.height;
    const ratio=S.viewMode==='camera'?cameraAspect():S.previs?.active?sw/sh:(ASPECT_RATIOS.find(r=>r[0]===S.project.scene.aspectRatio)||[])[1]||sw/sh;
    const cw=Math.min(sw,sh*ratio),ch=cw/ratio,cx=(sw-cw)/2,cy=(sh-ch)/2;
    const out=document.createElement('canvas');out.width=Math.min(1280,Math.round(cw));out.height=Math.round(out.width/ratio);
    const ctx=out.getContext('2d');ctx.drawImage(src,cx,cy,cw,ch,0,0,out.width,out.height);
    if(S.project.scene.showLabels!==false){
      const factor=out.width/cw;
      ctx.font='600 '+Math.round(14*factor*(S.renderer.getPixelRatio?.()||1))+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      for(const o of S.project.objects){
        if(o.kind!=='character'||!Crowd.inherited(S.project,o.id,'visible'))continue;
        const mesh=S.sceneObjects.get(o.id),rig=S.rigs.get(o.id);if(!mesh)continue;
        const wp=new S.three.Vector3();(rig?.head||mesh).getWorldPosition(wp);wp.y+=(rig?.head ? .32 : 1.75)*mesh.getWorldScale(new S.three.Vector3()).y;
        const p=wp.project(S.camera);if(p.z>1||p.z< -1)continue;
        const x=S.viewMode==='camera'?(p.x*.5+.5)*out.width:((p.x*.5+.5)*sw-cx)*factor;
        const w=ctx.measureText(o.name).width+14,h=24*factor*(S.renderer.getPixelRatio?.()||1);
        const y=Math.max(h+4,Math.min(out.height,S.viewMode==='camera'?(-p.y*.5+.5)*out.height:((-p.y*.5+.5)*sh-cy)*factor));
        ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(x-w/2,y-h,w,h);ctx.fillStyle='#fff';ctx.fillText(o.name,x,y-h/2);
      }
    }
    return {dataUrl:out.toDataURL('image/png'),width:out.width,height:out.height,node:S.nodeEl};
  }
  async function captureViewport(options={}) {
    if (!S.renderer) return;
    try {

      const node = S.nodeEl;
      if(S.viewMode==='camera')renderCameraLetterbox();else renderCameraScene(S.renderer, S.camera);
      const src = S.renderer.domElement;
      const sw = src.width, sh = src.height;
      const arRow = ASPECT_RATIOS.find(r => r[0] === (S.project.scene.aspectRatio || '16:9')) || ASPECT_RATIOS[0];
      const ar = S.viewMode==='camera' ? cameraAspect() : S.previs?.active ? sw/sh : arRow[1] > 0 ? arRow[1] : sw / sh;
      let cw = sw, ch = sw / ar;
      if (ch > sh) { ch = sh; cw = sh * ar; }
      const cx = Math.floor((sw - cw) / 2), cy = Math.floor((sh - ch) / 2);
      const out = document.createElement('canvas');
      out.width = Math.round(cw); out.height = Math.round(ch);
      out.getContext('2d').drawImage(src, cx, cy, cw, ch, 0, 0, out.width, out.height);
      const url = out.toDataURL('image/png');
      if(options.destination==='download'){downloadDirectorBlob(await new Promise(resolve=>out.toBlob(resolve,'image/png')),'CanvasFlow-预演.png');return;}
      if(!window.CanvasFlowDirectorSnapshot)throw Error('请从项目画布打开导演台后截图');
      await window.CanvasFlowDirectorSnapshot({dataUrl:url,node,width:out.width,height:out.height});
      if(S.open&&S.nodeEl===node)toast('截图已添加到画布');
    } catch (e) { toast('截图失败：' + e.message); }
  }




  function toggleFullscreen() {
    const el = document.querySelector('.director-viewport-main');
    const shell = document.querySelector('.director-shell');
    if (!el || !shell) return;
    const nativeOk = el.requestFullscreen && !navigator.userAgent.includes('ZCode');
    if (nativeOk && !document.fullscreenElement && !shell.classList.contains('dt-css-fullscreen')) {
      el.requestFullscreen().catch(() => cssFullscreen(shell));
      return;
    }
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    cssFullscreen(shell);
  }
  function cssFullscreen(shell) {
    const on = shell.classList.toggle('dt-css-fullscreen');
    requestAnimationFrame(() => {
      const w = S.el.holder.clientWidth, h = S.el.holder.clientHeight;
      if (w && h && S.renderer) {
        S.renderer.setSize(w, h);
        S.camera.aspect = w / h;
        S.camera.updateProjectionMatrix();
      }
    });
    toast(on ? '已进入全屏（ESC 退出）' : '已退出全屏');
  }

  function setTimelineOpen(open) {
    if (!S.el.timeline) return;
    S.el.timeline.classList.toggle('is-open', open);
    syncDockTimeline();
    // 时间轴高度变化 → 3D 画布自适应（flex 布局下 ResizeObserver 兜底）
    const epoch=S.animationEpoch;
    requestAnimationFrame(() => {
      if(!S.open||epoch!==S.animationEpoch||!S.el.holder)return;
      const w = S.el.holder.clientWidth, h = S.el.holder.clientHeight;
      if (S.renderer && w && h) { S.renderer.setSize(w, h); S.camera.aspect = w / h; S.camera.updateProjectionMatrix(); }
    });
  }
  // 关键帧导航：跳到选中对象（或全部轨道）中上一/下一关键帧
  function navigateKeyframe(dir) { timeline.navigate(dir);
  }
  function deleteKeyframeAtPlayhead() { timeline.removeKeys();
  }
  function pickPanorama() {
    const project = S.project, epoch = S.animationEpoch;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (!S.open || S.project !== project || S.animationEpoch !== epoch) return;
        const url = String(reader.result || '');
        applyPanoramaData(url, file.name, file);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }
  // 应用全景图（本地上传与历史记录共用）：贴全景球 + 记入历史列表 + 写工程
  let panoramaRequest = 0;
  async function applyPanoramaData(url, name, file) {
    if (!url) return false;
    const request = ++panoramaRequest, project = S.project, epoch = S.animationEpoch;
    let tex;
    try {
      tex = await new S.three.TextureLoader().loadAsync(url);
      let keep = url;
      if (url.startsWith('data:') && (window.CanvasFlowDirectorUploadPanorama || url.length >= 2000000)) {
        if (!window.CanvasFlowDirectorUploadPanorama) throw new Error('全景图较大，请在项目页面中登录后导入');
        const blob = file || await (await fetch(url)).blob();
        keep = await window.CanvasFlowDirectorUploadPanorama(file || new File([blob], name || 'panorama.png', {type:blob.type}));
      }
      if (!S.open || S.project !== project || S.animationEpoch !== epoch || request !== panoramaRequest) { tex.dispose(); return false; }
      pushUndo();
      S.project.scene.panoramaData = keep.startsWith('data:') ? keep : '';
      S.project.scene.panoramaUrl = keep.startsWith('data:') ? '' : keep;
      S.project.scene.panoramaName = name || '全景图';
      S.project.scene.panoramaHistory = [
        {name:name || '全景图',data:keep,ts:Date.now()},
        ...(S.project.scene.panoramaHistory || []).filter(h => h.data && h.data !== keep && h.data !== url),
      ].slice(0,12);
      setPanoramaTexture(tex, keep);
      persist(); renderInspector(); refreshPanoHistory(); toast('全景图已应用');
      return true;
    } catch (e) {
      tex?.dispose();
      if (S.open && S.project === project && S.animationEpoch === epoch && request === panoramaRequest) toast('全景图导入失败：' + e.message);
      return false;
    }
  }
  function setPanoramaTexture(tex, source) {
    tex.mapping = S.three.EquirectangularReflectionMapping;
    S.panoramaDome.material.map?.dispose();
    S.panoramaDome.material.map = tex;
    S.panoramaDome.material.color = new S.three.Color(S.project.scene.panoramaTint || '#ffffff');
    S.panoramaDome.material.visible = true;
    S.panoramaDome.visible = true;
    S.panoramaDome.material.needsUpdate = true;
    S.panoramaDome.userData.panoramaSource = source;
    S.panoramaDome.rotation.y = (S.project.scene.panoramaYaw || 0) * Math.PI / 180;
    S.panoramaDome.scale.setScalar((S.project.scene.panoramaRadius || 60) / 60);
  }
  function restorePanorama() {
    const dome = S.panoramaDome, sc = S.project.scene;
    if (!dome || !S.three) return;
    const source = sc.panoramaData || sc.panoramaUrl || '';
    dome.rotation.y = (sc.panoramaYaw || 0) * Math.PI / 180;
    dome.scale.setScalar((sc.panoramaRadius || 60) / 60);
    dome.material.color.set(sc.panoramaTint || '#ffffff');
    if (source === dome.userData.panoramaSource) return;
    dome.userData.panoramaSource = source;
    dome.visible = false;
    dome.material.map?.dispose(); dome.material.map = null; dome.material.needsUpdate = true;
    if (!source) return;
    new S.three.TextureLoader().loadAsync(source).then(tex => {
      if (!S.open || S.panoramaDome !== dome || S.project.scene !== sc || dome.userData.panoramaSource !== source) { tex.dispose(); return; }
      setPanoramaTexture(tex, source);
    }).catch(e => {
      if (S.open && S.panoramaDome === dome && dome.userData.panoramaSource === source) {
        dome.userData.panoramaSource = null;
        toast('全景图加载失败：' + e.message);
      }
    });
  }
  let panoHistoryDialog = null;
  function refreshPanoHistory() {
    if (!panoHistoryDialog) return;
    const h = panoHistoryDialog;
    h.items = window.DirectorHistory.merge([...h.items,...localPanoHistory(h.projectId)]);
    renderPanoHistory(h);
  }
  function localPanoHistory(projectId) {
    const sc=S.project.scene,items=(sc.panoramaHistory || []).map(h=>({id:'pano:'+h.ts,data:h.data,name:h.name||'全景图',createdAt:h.ts,rating:h.rating||0,projectIds:[projectId]}));
    const current=sc.panoramaData||sc.panoramaUrl;if(current&&!items.some(h=>h.data===current))items.push({id:'pano:current',data:current,name:sc.panoramaName||'全景图',createdAt:0,rating:0,projectIds:[projectId]});
    return items;
  }
  function closePanoHistory() {
    const h = panoHistoryDialog;if (!h) return;
    if (h.applying) panoramaRequest++;
    h.layer.remove();document.removeEventListener('keydown',h.keydown,true);
    panoHistoryDialog = null;
    S.el.shell?.querySelector('[data-dt-pano-history]')?.setAttribute('aria-expanded','false');
    if (h.focus?.isConnected) h.focus.focus();
  }
  function renderPanoHistory(h) {
    if (panoHistoryDialog !== h) return;
    const items = window.DirectorHistory.filter(h.items,{scope:h.scope,projectId:h.projectId,rating:h.rating,order:h.order});
    if (!items.some(x=>x.id===h.selected)) h.selected = '';
    const box=h.layer,grid=box.querySelector('#dtPanoHistory');
    box.querySelector('[data-dt-history-count]').textContent=items.length;
    box.querySelectorAll('[data-dt-history-scope]').forEach(b=>{const active=b.dataset.dtHistoryScope===h.scope;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    box.querySelector('[data-dt-history-sort]').textContent=h.order==='desc'?'⇵ 时间倒序':'⇅ 时间正序';
    box.querySelector('[data-dt-history-confirm]').disabled=!h.selected||h.loading||h.applying;
    box.querySelector('[data-dt-history-confirm]').textContent=h.applying?'应用中…':'确认选择';
    box.querySelectorAll('[data-dt-history-scope],[data-dt-history-sort],[data-dt-history-rating],[data-dt-history-size]').forEach(control=>control.disabled=h.applying);
    grid.setAttribute('aria-busy',String(h.loading));
    grid.innerHTML=(h.loading?'<p class="dt-history-empty" role="status">正在加载历史记录…</p>':items.map((x,i)=>`<button type="button" class="dt-history-card${x.id===h.selected?' selected':''}" data-dt-history-item="${i}" aria-pressed="${x.id===h.selected}" title="${esc(x.name)}" ${h.applying?'disabled':''}><span class="dt-history-image"><img src="${esc(x.data)}" alt="${esc(x.name)}" draggable="false" loading="lazy" /><span class="dt-history-check">✓</span></span><span class="dt-history-name">${esc(x.name)}</span><span class="dt-history-meta">${x.rating?'★'.repeat(x.rating):'未评级'} · ${x.createdAt?esc(new Date(x.createdAt).toLocaleDateString()):''}</span></button>`).join('')||'<p class="dt-history-empty">'+(h.scope==='all'&&h.rating==='all'?'暂无历史记录':'暂无符合条件的历史记录')+'</p>');
    const error=box.querySelector('[data-dt-history-error]');error.hidden=!h.error;
    error.innerHTML=h.error?esc(h.error)+' <button type="button" data-dt-history-retry>重新加载</button>':'';
    h.visibleItems=items;
  }
  async function loadPanoHistory(h) {
    h.loading=true;h.error=false;renderPanoHistory(h);
    try {
      const result=window.CanvasFlowDirectorGetImageHistory?await window.CanvasFlowDirectorGetImageHistory():{currentProjectId:'current',items:[]};
      if (panoHistoryDialog!==h||S.project!==h.project||S.animationEpoch!==h.epoch) return;
      h.projectId=result.currentProjectId||'current';
      h.items=window.DirectorHistory.merge([...(result.items||[]),...localPanoHistory(h.projectId)]);
    } catch(e) {if (panoHistoryDialog!==h) return;h.error='历史记录加载失败，请重试。';}
    h.loading=false;renderPanoHistory(h);
  }
  function togglePanoHistory(onPick=null) {
    if (panoHistoryDialog) {closePanoHistory();return;}
    if (!window.DirectorHistory) {toast('历史记录组件尚未加载，请刷新页面重试');return;}
    const layer=document.createElement('div');layer.className='dt-history-backdrop';
    layer.innerHTML=`<section class="dt-history-dialog" role="dialog" aria-modal="true" aria-labelledby="dtHistoryTitle" tabindex="-1">
      <header class="dt-history-header"><h2 id="dtHistoryTitle">生成历史</h2><div class="dt-history-density"><span aria-hidden="true">⊞</span><input type="range" min="110" max="260" value="185" aria-label="缩略图大小" data-dt-history-size /><span aria-hidden="true">▦</span></div><button type="button" class="dt-history-close" data-dt-history-close aria-label="关闭生成历史">×</button></header>
      <div class="dt-history-toolbar"><div class="dt-history-tabs"><button type="button" data-dt-history-scope="all">全部画布</button><button type="button" data-dt-history-scope="current">本画布</button></div><span class="dt-history-total">图片 <span data-dt-history-count>0</span></span><div class="dt-history-filters"><select aria-label="筛选评级" data-dt-history-rating><option value="all">所有评级</option><option value="0">未评级</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n} 星</option>`).join('')}</select><button type="button" data-dt-history-sort>⇵ 时间倒序</button></div></div>
      <div class="dt-history-content"><div class="dt-history-error" data-dt-history-error hidden></div><div class="dt-history-grid" id="dtPanoHistory"></div></div>
      <footer class="dt-history-footer"><button type="button" data-dt-history-close>取消</button><button type="button" data-dt-history-confirm disabled>确认选择</button></footer>
    </section>`;
    const h=panoHistoryDialog={layer,project:S.project,epoch:S.animationEpoch,projectId:'current',items:window.DirectorHistory.merge(localPanoHistory('current')),scope:'all',rating:'all',order:'desc',selected:'',focus:document.activeElement,applying:false,onPick};
    h.keydown=e=>{
      if (e.key==='Escape') {e.preventDefault();e.stopImmediatePropagation();closePanoHistory();return;}
      if (e.key==='Tab') {
        const focusable=[...layer.querySelectorAll('button:not(:disabled),input,select')],first=focusable[0],last=focusable.at(-1);
        if (e.shiftKey&&(document.activeElement===first||!focusable.includes(document.activeElement))) {e.preventDefault();last?.focus();}
        else if (!e.shiftKey&&(document.activeElement===last||!focusable.includes(document.activeElement))) {e.preventDefault();first?.focus();}
      }
      e.stopImmediatePropagation();
    };
    document.addEventListener('keydown',h.keydown,true);
    layer.addEventListener('click',async e=>{
      const b=e.target.closest('button');if (e.target===layer||b?.hasAttribute('data-dt-history-close')) {closePanoHistory();return;}
      if (!b||h.applying) return;
      if (b.dataset.dtHistoryScope) {h.scope=b.dataset.dtHistoryScope;renderPanoHistory(h);}
      else if (b.hasAttribute('data-dt-history-sort')) {h.order=h.order==='desc'?'asc':'desc';renderPanoHistory(h);}
      else if (b.hasAttribute('data-dt-history-item')) {const index=Number(b.dataset.dtHistoryItem);h.selected=h.visibleItems[index]?.id||'';renderPanoHistory(h);layer.querySelector(`[data-dt-history-item="${index}"]`)?.focus();}
      else if (b.hasAttribute('data-dt-history-retry')) {loadPanoHistory(h);}
      else if (b.hasAttribute('data-dt-history-confirm')&&h.selected&&!h.loading) {
        const item=h.items.find(x=>x.id===h.selected);if(!item)return;
        h.applying=true;renderPanoHistory(h);
        const applied=h.onPick?await h.onPick(item):await applyPanoramaData(item.data,item.name);
        if(panoHistoryDialog!==h)return;
        h.applying=false;if(applied)closePanoHistory();else{h.error='图片应用失败，请重新选择或重试。';renderPanoHistory(h);}
      }
    });
    layer.addEventListener('change',e=>{if(e.target.hasAttribute('data-dt-history-rating')&&!h.applying){h.rating=e.target.value;renderPanoHistory(h);}});
    layer.addEventListener('input',e=>{if(e.target.hasAttribute('data-dt-history-size'))layer.querySelector('.dt-history-grid').style.setProperty('--dt-history-size',e.target.value+'px');});
    layer.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.closest('.dt-history-card')?.classList.add('unavailable');},true);
    (document.fullscreenElement||document.body).appendChild(layer);S.keyNudges.clear();
    S.el.shell?.querySelector('[data-dt-pano-history]')?.setAttribute('aria-expanded','true');
    layer.querySelector('[role="dialog"]').focus();loadPanoHistory(h);
  }
  const dockIcon=paths=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  const upIcon=dockIcon('<path d="M12 19V5m-6 6 6-6 6 6"/>');
  function syncDockTimeline(){
    const button=S.el.dock?.querySelector('[data-dock-timeline]');if(!button)return;
    const open=!!S.el.timeline?.classList.contains('is-open');
    button.setAttribute('aria-expanded',String(open));
    button.title=open?'隐藏动画时间轴':'展开动画时间轴';button.setAttribute('aria-label',button.title);
  }
  function inspectAgentPreview(candidate){
    const T=S.three,renderer=S.renderer,oldProject=S.project,oldFrame=S.playhead,oldSelection=S.selectedId,oldPreview=S.previewCameraId;
    const viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),oldTarget=renderer.getRenderTarget(),oldAutoClear=renderer.autoClear;
    const width=320,height=180,target=new T.WebGLRenderTarget(width,height),pixels=new Uint8Array(width*height*4),out=document.createElement('canvas'),tile=document.createElement('canvas');
    target.texture.colorSpace=T.SRGBColorSpace;out.width=width*3;out.height=height+25;tile.width=width;tile.height=height;
    const ctx=out.getContext('2d'),tileCtx=tile.getContext('2d'),issues=[];
    try{
      S.project=candidate;S.playhead=0;S.selectedId='';rebuildAll();
      const cam=activeCameraObj();if(!cam)return{image:'',issues:[]};
      const camera=new T.PerspectiveCamera(50,cameraAspect(cam),.05,1000),frames=[0,Math.floor((candidate.sequence.durationFrames-1)/2),candidate.sequence.durationFrames-1];
      for(const [index,frame]of frames.entries()){
        sampleAtFrame(frame);syncRenderCameraFromGizmo(camera,cam);camera.aspect=cameraAspect(cam);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.autoClear=true;renderCameraScene(renderer,camera);
        renderer.readRenderTargetPixels(target,0,0,width,height,pixels);const data=tileCtx.createImageData(width,height);
        for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
        tileCtx.putImageData(data,0,0);ctx.drawImage(tile,index*width,0);
        ctx.fillStyle='#171c23';ctx.fillRect(index*width,height,width,25);ctx.fillStyle='#edf4fa';ctx.font='12px sans-serif';ctx.fillText((frame/candidate.sequence.fps).toFixed(2)+'s',index*width+10,height+17);
        const subjects=cam.lookAtTargetId?candidate.objects.filter(o=>o.id===cam.lookAtTargetId):candidate.objects.filter(o=>o.kind==='character'&&o.visible!==false).slice(0,4);
        for(const obj of subjects){
          const mesh=S.sceneObjects.get(obj.id);if(!mesh||!Crowd.inherited(candidate,obj.id,'visible'))continue;
          const bounds=new T.Box3().setFromObject(mesh),point=bounds.getCenter(new T.Vector3()),projected=point.clone().project(camera);
          if(projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1){if(!issues.some(i=>i.code==='out-of-frame'&&i.id===obj.id))issues.push({code:'out-of-frame',id:obj.id,message:obj.name+'在 '+(frame/candidate.sequence.fps).toFixed(1)+' 秒超出当前机位画面'});}
          const direction=point.clone().sub(camera.position),distance=direction.length(),ray=new T.Raycaster(camera.position,direction.normalize(),.05,distance*.97);
          const obstacles=candidate.objects.filter(o=>o.kind==='geometry'&&Crowd.inherited(candidate,o.id,'visible')&&['building','wall'].includes(o.whitebox?.type)).map(o=>S.sceneObjects.get(o.id)).filter(Boolean);
          if(ray.intersectObjects(obstacles,true).length&&!issues.some(i=>i.code==='occluded'&&i.id===obj.id))issues.push({code:'occluded',id:obj.id,message:obj.name+'在 '+(frame/candidate.sequence.fps).toFixed(1)+' 秒可能被建筑或墙遮挡'});
        }
      }
      return{image:out.toDataURL('image/jpeg',.78),issues};
    }finally{
      renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=oldAutoClear;target.dispose();
      S.project=oldProject;S.playhead=oldFrame;S.selectedId=oldSelection;S.previewCameraId=oldPreview;rebuildAll();sampleAtFrame(oldFrame);
    }
  }
  function previsSceneBounds(){
    const T=S.three,box=new T.Box3().makeEmpty();S.scene.updateMatrixWorld(true);
    for(const obj of S.project.objects)if(['geometry','character'].includes(obj.kind)&&Crowd.inherited(S.project,obj.id,'visible')){const mesh=S.sceneObjects.get(obj.id);if(mesh)box.union(window.DirectorGround.bounds(T,mesh,S.scene));}
    if(box.isEmpty())box.set(new T.Vector3(-4,0,-4),new T.Vector3(4,2,4));return box;
  }
  function focusPrevisAsset(id){
    if(S.recording||!S.controls)return;const obj=S.project.objects.find(o=>o.id===id),mesh=S.sceneObjects.get(id);if(!obj||!mesh)return;
    setPlaying(false);selectObject(id);const T=S.three;mesh.updateWorldMatrix(true,true);
    const box=obj.kind==='camera'?new T.Box3().setFromCenterAndSize(mesh.getWorldPosition(new T.Vector3()),new T.Vector3(1,1,1)):window.DirectorGround.bounds(T,mesh,S.scene);
    const center=box.isEmpty()?mesh.getWorldPosition(new T.Vector3()):box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),oldTarget=S.controls.getTarget(new T.Vector3()),direction=S.camera.position.clone().sub(oldTarget).normalize();if(direction.lengthSq()<.1)direction.set(1,1,1).normalize();
    const fov=Math.atan(Math.tan(S.camera.fov*Math.PI/360)*Math.min(1,S.camera.aspect)),distance=Math.max(2,size.length()*.5/Math.sin(fov)*1.25),eye=center.clone().addScaledVector(direction,distance);
    S.camera.up.set(0,1,0);S.controls.updateCameraUp();S.controls.setLookAt(...eye.toArray(),...center.toArray(),false);S.controls.update(0);
  }
  function topPrevisView(){
    if(S.recording||!S.controls)return;setPlaying(false);const T=S.three,box=previsSceneBounds(),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),distance=Math.max(8,size.length()*.5/Math.sin(S.camera.fov*Math.PI/360)*1.2);
    S.controls.setLookAt(center.x,center.y+distance,center.z+.001,center.x,center.y,center.z,false);S.controls.update(0);
  }
  function renderPrevisMonitors(topCanvas,camCanvas){
    const T=S.three,r=S.renderer;if(!r||S.recording)return;
    const width=224,height=126,target=S.previsMonitorTarget||(S.previsMonitorTarget=new T.WebGLRenderTarget(width,height));target.texture.colorSpace=T.SRGBColorSpace;
    const oldTarget=r.getRenderTarget(),viewport=r.getViewport(new T.Vector4()),scissor=r.getScissor(new T.Vector4()),test=r.getScissorTest(),auto=r.autoClear,pixels=new Uint8Array(width*height*4);
    const draw=(canvas,camera)=>{r.setRenderTarget(target);r.setScissorTest(false);r.setViewport(0,0,width,height);r.autoClear=true;renderCameraScene(r,camera);r.readRenderTargetPixels(target,0,0,width,height,pixels);const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(data,0,0);return ctx;};
    try{
      const box=previsSceneBounds(),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),span=Math.max(8,size.z*1.15,size.x*height/width*1.15),top=new T.OrthographicCamera(-span*width/height/2,span*width/height/2,span/2,-span/2,.01,4000);
      top.position.set(center.x,box.max.y+Math.max(50,size.length()*2),center.z);top.up.set(0,0,-1);top.lookAt(center);top.updateMatrixWorld(true);const ctx=draw(topCanvas,top);
      for(const o of S.project.objects.filter(o=>o.kind==='camera')){const mesh=S.sceneObjects.get(o.id);if(!mesh)continue;const p=mesh.getWorldPosition(new T.Vector3()).project(top);ctx.fillStyle=o.id===S.project.activeCameraId?'#17c8e9':'#f1ba4d';ctx.beginPath();ctx.arc((p.x+1)*width/2,(1-p.y)*height/2,3,0,Math.PI*2);ctx.fill();}
      const cam=activeCameraObj();if(cam){const camera=new T.PerspectiveCamera(50,width/height,.01,2000);syncRenderCameraFromGizmo(camera,cam);camera.aspect=cameraAspect(cam);camera.updateProjectionMatrix();const ctx=draw(camCanvas,camera),ar=camera.aspect,display=camCanvas.ownerDocument.createElement('canvas');display.width=width;display.height=height;display.getContext('2d').drawImage(camCanvas,0,0);ctx.fillStyle='#15181e';ctx.fillRect(0,0,width,height);const w=ar>=width/height?width:height*ar,h=ar>=width/height?width/ar:height;ctx.drawImage(display,(width-w)/2,(height-h)/2,w,h);}else{const ctx=camCanvas.getContext('2d');ctx.fillStyle='#232832';ctx.fillRect(0,0,width,height);ctx.fillStyle='#aab3bf';ctx.font='12px sans-serif';ctx.fillText('未添加机位',78,66);}
    }finally{r.setRenderTarget(oldTarget);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(test);r.autoClear=auto;}
  }
  function renamePrevisAsset(id,name){
    const obj=S.project.objects.find(o=>o.id===id);if(!obj||S.recording||Crowd.inherited(S.project,id,'locked')||timeline.trackOf(id)?.locked)return;
    name=String(name).trim().slice(0,80);if(!name||name===obj.name)return;pushUndo();obj.name=name;persist();refreshTree();refreshTracks();renderInspector();
  }
  function removePrevisAsset(id){
    if(S.recording)return;const ids=Crowd.descendants(S.project,id);if([...ids].some(key=>Crowd.inherited(S.project,key,'locked')||timeline.trackOf(key)?.locked)){toast('请先解锁对象');return;}
    removeObject(id);const cam=activeCameraObj();S.project.activeCameraId=cam?.id||'';persist();
  }
  function initDirectorDock(gizmo){
    const dock=document.createElement('div');dock.className='dt-director-dock';
    dock.innerHTML='<div class="dt-dock-tools" role="toolbar" aria-label="视口工具"><button type="button" data-dock-select title="选择和变换对象" aria-label="选择和变换对象" aria-pressed="true">'+dockIcon('<path d="m5 3 5 17 3-7 7-3Z"/>')+'</button><button type="button" data-dock-shot title="截图并添加到画布" aria-label="截图并添加到画布">'+dockIcon('<path d="M4 6h4l2-3h4l2 3h4v14H4Z"/><circle cx="12" cy="12" r="3.5"/>')+'</button><button type="button" data-dock-orbit title="环视场景" aria-label="环视场景" aria-pressed="false">'+dockIcon('<ellipse cx="12" cy="12" rx="5" ry="9" transform="rotate(45 12 12)"/><path d="M20 7c2 3-1 7-6 10S4 19 3 16s2-7 7-10 9-3 10 1Z"/>')+'</button></div><form class="dt-dock-composer"><button type="button" data-dock-attach title="添加参考图片" aria-label="添加参考图片">'+dockIcon('<path d="M12 5v14M5 12h14"/>')+'</button><textarea data-dock-prompt aria-label="描述想搭建的场景" placeholder="描述想搭建的场景" rows="1"></textarea><button type="submit" data-dock-send title="搭建场景" aria-label="搭建场景" disabled>'+upIcon+'</button><div class="dt-dock-reference" hidden></div><div class="dt-dock-status" role="status" aria-live="polite" hidden></div></form><div class="dt-dock-transform" hidden role="toolbar" aria-label="对象变换"><button type="button" data-transform-mode="translate" class="is-active">↔ 移动</button><button type="button" data-transform-mode="rotate">⟳ 旋转</button><button type="button" data-transform-mode="scale">⤢ 缩放</button></div>';
    const timelineButton=document.createElement('button');timelineButton.type='button';timelineButton.dataset.dockTimeline='';timelineButton.setAttribute('aria-controls','dtTimeline');
    timelineButton.innerHTML=dockIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 10v10M13 10v10M17 14h2M17 17h2"/>');
    dock.querySelector('.dt-dock-tools').appendChild(timelineButton);
    S.el.holder.parentElement.appendChild(dock);S.el.dock=dock;syncDockTimeline();
    const input=dock.querySelector('[data-dock-prompt]'),send=dock.querySelector('[data-dock-send]'),menu=dock.querySelector('.dt-dock-transform'),form=dock.querySelector('form'),status=dock.querySelector('.dt-dock-status');
    let reference='',busy=false,taskSerial=0;
    const sceneQuote=window.CanvasFlowMountQuote?.(form,()=>S.previs?.active&&!S.previsModelId?null:({signature:JSON.stringify([S.previsModelId,input.value,!!reference,S.project,S.selectedId]),load:()=>window.CanvasFlowDirectorSceneQuote({modelId:S.previsModelId,prompt:input.value,project:S.project,selectedId:S.selectedId,referenceImage:reference})}),{label:'首轮预扣'});
    const conversation=document.createElement('section');conversation.className='dt-agent-history';conversation.hidden=true;conversation.setAttribute('aria-label','预演台对话记录');
    conversation.innerHTML='<header><strong>场景对话</strong><button type="button" data-dock-history-close aria-label="关闭对话记录">×</button></header><div class="dt-agent-messages" role="log" aria-live="polite"></div><footer>每轮调整可撤销，手动修改会同步到下一轮对话。</footer>';dock.appendChild(conversation);
    const historyButton=document.createElement('button');historyButton.type='button';historyButton.className='dt-agent-history-trigger';historyButton.dataset.dockAiHistory='';historyButton.setAttribute('aria-label','查看场景对话');historyButton.setAttribute('aria-expanded','false');historyButton.title='场景对话记录';historyButton.innerHTML=dockIcon('<path d="M4 4h16v12H9l-5 4Z"/><path d="M8 8h8M8 12h5"/>');
    const historyContent=conversation.querySelector('[role="log"]');let historyStamp='';
    S.refreshAgentHistory=()=>{const messages=window.DirectorSceneAgent.history(S.project),issues=S.project.aiLastReport?.issues||[],stamp=JSON.stringify([messages,issues]);if(stamp===historyStamp)return;historyStamp=stamp;historyContent.innerHTML=messages.length?messages.map(m=>'<article class="dt-agent-message is-'+m.role+'"><small>'+(m.role==='user'?'你':'场景助手')+'</small><p>'+esc(m.content)+'</p></article>').join(''):'<p class="dt-agent-empty">描述你想搭建的场景、角色动作和镜头运动。</p>';if(issues.length)historyContent.innerHTML+='<article class="dt-agent-checks"><small>需要检查</small>'+issues.map(i=>'<p>'+esc(i.message)+'</p>').join('')+'</article>';historyContent.scrollTop=historyContent.scrollHeight;};
    const showHistory=on=>{conversation.hidden=!on;historyButton.setAttribute('aria-expanded',String(on));S.refreshAgentHistory();};historyButton.onclick=()=>showHistory(conversation.hidden);conversation.querySelector('[data-dock-history-close]').onclick=()=>showHistory(false);
    const setStatus=(message,cancellable=false)=>{status.hidden=false;status.replaceChildren();const span=document.createElement('span');span.textContent=message;status.appendChild(span);if(cancellable){const b=document.createElement('button');b.type='button';b.textContent='取消';b.setAttribute('aria-label','取消本次场景调整');b.onclick=()=>{taskSerial++;busy=false;setStatus('已取消本次调整，场景保持原状');update();};status.appendChild(b);}};
    const update=()=>{send.disabled=busy||!(input.value.trim()||reference);form.classList.toggle('has-reference',!!reference);form.classList.toggle('is-expanded',(form.contains(document.activeElement)&&document.activeElement!==form.querySelector('[data-dock-previs]'))||form.classList.contains('has-popup')||!!reference||busy);};
    input.addEventListener('input',update);input.addEventListener('focus',update);input.addEventListener('blur',()=>setTimeout(update,0));form.addEventListener('focusin',update);form.addEventListener('focusout',()=>setTimeout(update,0));
    dock.addEventListener('click',async e=>{
      if(e.target.closest('[data-dock-select]')){const wasOrbit=S.navigationMode==='orbit';S.navigationMode='select';dock.querySelector('[data-dock-select]').setAttribute('aria-pressed','true');dock.querySelector('[data-dock-orbit]').setAttribute('aria-pressed','false');menu.hidden=wasOrbit?true:!menu.hidden;syncObjectGizmo();}
      if(e.target.closest('[data-dock-orbit]')){S.navigationMode='orbit';menu.hidden=true;dock.querySelector('[data-dock-select]').setAttribute('aria-pressed','false');dock.querySelector('[data-dock-orbit]').setAttribute('aria-pressed','true');syncObjectGizmo();}
      if(e.target.closest('[data-dock-timeline]'))setTimelineOpen(!S.el.timeline.classList.contains('is-open'));
      const mode=e.target.closest('[data-transform-mode]');if(mode){gizmo.setMode(mode.dataset.transformMode);menu.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',b===mode));menu.hidden=true;}
      if(e.target.closest('[data-dock-shot]')){const b=dock.querySelector('[data-dock-shot]');if(b.disabled)return;b.disabled=true;try{await captureViewport();}finally{b.disabled=false;}}
      if(e.target.closest('[data-dock-attach]')){
        const anchor=dock.querySelector('[data-dock-attach]');
        if(!S.previs?.active){pickReferenceFile();return;}
        const old=form.querySelector('.pv-attachment-menu');if(old){old.remove();return;}
        const choices=document.createElement('div');choices.className='pv-attachment-menu';choices.setAttribute('role','menu');choices.setAttribute('aria-label','添加附件');choices.innerHTML='<button type="button" role="menuitem" data-reference-source="local">↥ 本地上传</button><button type="button" role="menuitem" data-reference-source="history">◷ 从生成历史选择</button>';form.appendChild(choices);anchor.setAttribute('aria-expanded','true');
        choices.addEventListener('click',ev=>{const choice=ev.target.closest('[data-reference-source]');if(!choice)return;choices.remove();anchor.setAttribute('aria-expanded','false');if(choice.dataset.referenceSource==='local')pickReferenceFile();else{const project=S.project,epoch=S.animationEpoch;togglePanoHistory(async item=>{try{const response=await fetch(item.data);if(!response.ok)throw Error('参考图读取失败');const blob=await response.blob();if(!S.open||S.project!==project||S.animationEpoch!==epoch)return false;await setReference(new File([blob],item.name||'参考图片',{type:blob.type}));return true;}catch(error){toast(error.message);return false;}});}});
        choices.querySelector('button').focus();
      }
      if(e.target.closest('[data-dock-remove]')){reference='';dock.querySelector('.dt-dock-reference').hidden=true;update();}
    });
    async function setReference(file,shouldApply=()=>true){const project=S.project,epoch=S.animationEpoch,data=await readDirectorImage(file);if(!S.open||S.project!==project||epoch!==S.animationEpoch||!shouldApply())return;reference=data;const box=dock.querySelector('.dt-dock-reference');box.hidden=false;box.innerHTML='<img alt="场景参考图"><span>'+esc(file.name||'参考图片')+'</span><button type="button" data-dock-remove aria-label="移除参考图片">×</button>';box.querySelector('img').src=reference;update();input.focus();}
    function pickReferenceFile(){const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.onchange=async()=>{try{await setReference(file.files?.[0]);}catch(error){toast(error.message);}};file.click();}
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(busy||!(input.value.trim()||reference))return;
      if(S.recording)return;
      const project=S.project,epoch=S.animationEpoch,baseline=JSON.stringify(project),node=S.nodeEl,task=++taskSerial,submittedText=input.value,submittedReference=reference;
      const current=()=>task===taskSerial&&S.open&&S.project===project&&S.animationEpoch===epoch&&S.nodeEl===node&&JSON.stringify(project)===baseline;
      busy=true;setPlaying(false);update();setStatus('正在规划白模、动作和运镜…',true);
      try{
        if(!window.CanvasFlowDirectorBuildScene)throw Error('请从项目画布打开导演台');
        const description=input.value.trim()||(S.previs?.active?'根据参考图片中的标注调整场景或机位，保留未标注的其他对象。':'根据参考图片搭建场景。');
        const plan=await window.DirectorSceneAgent.run({project,prompt:description,selectedId:S.selectedId,referenceImage:reference,modelId:S.previsModelId,previs:!!S.previs?.active,animation:Animation,buildScene:window.CanvasFlowDirectorBuildScene,current,progress:message=>{if(current())setStatus(message,true);},prepare:async candidate=>{
          const loaded=await Promise.all([...new Set(candidate.objects.filter(o=>o.kind==='character'&&!o.local).map(o=>o.bodyType))].map(type=>S.loadSamBody(type)));
          if(loaded.some(model=>!model))throw Error('角色模型加载失败，请重试');
          for(const obj of candidate.objects.filter(o=>o.kind==='character'))if(obj.agentPose||!obj.poseControls){const preset=POSE_PRESETS.find(p=>p.label===obj.agentPose)||POSE_PRESETS[0];Object.assign(obj,{rigVersion:2,poseName:preset.label,poseMode:'static',poseControls:{...preset.controls,_rigAxes:Rig.AXES_VERSION}});delete obj.agentPose;}
        },preview:inspectAgentPreview});
        if(!current())throw Error('场景已改变，请根据最新场景重新提交');
        pushUndo();Object.assign(project,plan.project);rebuildAll();setPlayhead(0);
        const selectable=id=>project.objects.some(o=>o.id===id&&(o.kind!=='camera'||id===project.activeCameraId));const chosen=plan.created.find(selectable)||plan.changed.find(selectable);if(chosen)selectObject(chosen);
        persist(true);if(input.value===submittedText)input.value='';if(reference===submittedReference){reference='';dock.querySelector('.dt-dock-reference').hidden=true;}
        setStatus(plan.operations?'已完成 '+plan.operations+' 项场景调整'+(plan.report.issues.length?' · 有 '+plan.report.issues.length+' 项需要检查':'')+'，可在对话记录查看详情':plan.message);
        toast(plan.operations?'场景与动画已更新，可继续对话修改':plan.message);
      }catch(err){if(task===taskSerial&&S.open&&S.project===project){setStatus(err.message);toast('场景调整未应用：'+err.message);}}
      finally{if(task===taskSerial){busy=false;update();}}
    });
    dock.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){menu.hidden=true;e.preventDefault();e.stopPropagation();}});
    S.previs=window.createDirectorPrevis({S,esc,ICONS,openBlender:openBlenderTools,renderMonitors:renderPrevisMonitors,topView:topPrevisView,focusAsset:focusPrevisAsset,renameAsset:renamePrevisAsset,removeAsset:removePrevisAsset,importAsset:importLocalModel,saveSelectedAsset,addStoredAsset,aspects:ASPECT_RATIOS,setReference,pickAnnotationObject,activeCameraObj,switchMode,selectObject,renderInspector,setPlaying,setPlayhead,setTimelineOpen,setCameraAspect,toggleLoop,undo,redo,persist,toast,captureViewport,toggleRecording,close,closeCamPreviewFullscreen,createPath:kind=>timeline.createPath(kind),pathPanel:()=>timeline.pathPanel(S.project.objects.find(o=>o.id===S.selectedId)),cameraPath:id=>timeline.trackOf(id)?.path,exportAsset,exportSize:previsExportSize,sampleObject:obj=>obj.kind==='camera'?cameraInspectorValue(obj):timeline.sampled(obj),beginTransform:beginPrevisTransform,endTransform:endPrevisTransform,editTransform:editPrevisTransform,editWhiteboxSize:(axis,value)=>{const obj=S.project.objects.find(o=>o.id===S.selectedId);if(!obj?.whitebox||Crowd.inherited(S.project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked||S.recording)return;pushUndo();obj.whitebox.parameters.size[axis]=value;rebuildObjectMesh(obj);persist();},keyState:()=>{setPlaying(false);timeline.keyframe('all');},hasState:()=>timeline.hasKey('all'),setObjectFlag:setPrevisObjectFlag,addAsset:(kind,body)=>{setPlaying(false);if(kind==='camera')addCamera('current');else if(kind==='character')addCharacter(body||'sam');else addGeometry(kind);},setTransformMode:mode=>{S.transformControl.setMode(mode);syncObjectGizmo();},renderFrame:()=>stepFrame(0),isLocked:id=>Crowd.inherited(S.project,id,'locked')||timeline.trackOf(id)?.locked,setDuration:frames=>{beginBatch();pushUndo();timeline.setDuration(frames);timeline.setRange('in',0);timeline.setRange('out',S.project.sequence.durationFrames-1);endBatch();persist();}});
    const blenderButton=document.createElement('button');blenderButton.type='button';blenderButton.textContent='Blender 建模';blenderButton.setAttribute('aria-label','打开 Blender 本地建模');blenderButton.onclick=openBlenderTools;
    dock.querySelector('.pv-composer-tools').prepend(historyButton,blenderButton);S.refreshAgentHistory();
  }
  async function readDirectorImage(file){
    if(!file)throw Error('请选择图片');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请使用 PNG、JPEG 或 WebP 图片');
    if(file.size>20*1024*1024)throw Error('图片不能超过20MB');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(file);});
  }
  let panoAiDialog=null;
  const panoramaJobs=new Map();
  function closePanoAi(){if(!panoAiDialog)return;const h=panoAiDialog;panoAiDialog=null;document.removeEventListener('keydown',h.keydown,true);h.layer.remove();h.focus?.isConnected&&h.focus.focus();}
  function followPanoramaJob(task,node){
    let watched=panoramaJobs.get(task.jobId);
    if(!watched){
      watched=window.DirectorTools.watchJob(task.jobId,window.CanvasFlowDirectorReadJob,{onProgress:job=>{
        if(panoAiDialog?.taskId===task.jobId)panoAiDialog.status.textContent=job.progress!=null?'生成中 '+Math.round(job.progress)+'%':'全景图生成中…';
      }}).then(async job=>{await window.CanvasFlowDirectorFinishPanorama?.(task,job);return job;});
      panoramaJobs.set(task.jobId,watched);
      watched.catch(()=>{});
    }
    return watched.then(async job=>{
      // Completion can arrive after the editor closes. Keep the origin scene's result for reopen.
      let project=S.open&&S.nodeEl===node?S.project:null;
      if(!project){try{project=JSON.parse(node?.dataset.directorProject||'null');}catch(_){} }
      if(project?.scene.panoramaJob?.jobId!==task.jobId)return;
      project.scene.panoramaJob.resultUrl=job.imageUrl;
      if(S.open&&S.nodeEl===node&&S.project===project){
        if((project.scene.panoramaUrl||project.scene.panoramaData||'')===task.previousUrl){const ok=await applyPanoramaData(job.imageUrl,'AI全景图');if(!ok){persist(true);return;}}
        delete project.scene.panoramaJob;persist(true);
        if(panoAiDialog?.taskId===task.jobId){panoAiDialog.status.textContent='全景图已生成';closePanoAi();}
      }else if(node){node.dataset.directorProject=JSON.stringify(project);document.dispatchEvent(new CustomEvent('director-project-change',{detail:{node}}));}
    }).catch(err=>{
      window.CanvasFlowDirectorFailPanorama?.(task,err).catch(()=>{});
      if(S.open&&S.nodeEl===node&&S.project.scene.panoramaJob?.jobId===task.jobId){S.project.scene.panoramaJob.error=err.message;persist(true);toast(err.message);}
      if(panoAiDialog?.taskId===task.jobId){const h=panoAiDialog;h.busy=false;h.status.textContent=err.message;h.update();}
    });
  }
  function aiGeneratePanorama(){
    if(panoAiDialog){panoAiDialog.layer.querySelector('[role=dialog]').focus();return;}
    closePanoHistory();
    const layer=document.createElement('div');layer.className='dt-pano-ai-layer';
    layer.innerHTML='<section class="dt-pano-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="dtPanoAiTitle" tabindex="-1"><header><strong id="dtPanoAiTitle">AI生成</strong><button type="button" data-ai-close aria-label="关闭">×</button></header><div class="dt-pano-ai-body"><button type="button" class="dt-pano-ai-upload" aria-label="上传图片"><span class="dt-pano-ai-empty"><span>＋</span>上传图片</span><img alt="上传图片预览" hidden></button><input type="file" data-ai-file accept="image/png,image/jpeg,image/webp" hidden><button type="button" class="dt-pano-ai-remove" aria-label="移除参考图片" hidden>×</button><p class="dt-pano-ai-status" role="status" aria-live="polite" hidden></p></div><footer><span>退出不会中断生成，可在历史记录中查看结果</span><div><span class="dt-pano-ai-cost" title="生成积分">ϟ <span data-ai-cost>0</span></span><button type="button" data-ai-submit aria-label="生成" title="生成" disabled>'+upIcon+'</button></div></footer></section>';
    const h=panoAiDialog={layer,focus:document.activeElement,project:S.project,node:S.nodeEl,epoch:S.animationEpoch,reference:'',model:null,busy:false,taskId:'',status:layer.querySelector('.dt-pano-ai-status')};
    const modelLabel=document.createElement('label');modelLabel.className='dt-pano-ai-model';modelLabel.innerHTML='<span>模型</span><select data-ai-model aria-label="生图模型" disabled><option value="">加载模型…</option></select>';
    layer.querySelector('footer>div').prepend(modelLabel);const modelSelect=modelLabel.querySelector('select');
    const file=layer.querySelector('[data-ai-file]'),upload=layer.querySelector('.dt-pano-ai-upload'),image=upload.querySelector('img'),remove=layer.querySelector('.dt-pano-ai-remove'),submit=layer.querySelector('[data-ai-submit]');
    h.update=()=>{submit.disabled=!h.reference||!h.model||h.busy;file.disabled=upload.disabled=remove.disabled=h.busy;modelSelect.disabled=h.busy||!h.model;h.status.hidden=!h.status.textContent;};
    const chooseModel=id=>{
      const model=h.models?.find(item=>item.id===id);if(!model)return;
      h.model={...model,projectId:h.modelProjectId};modelSelect.value=id;
      layer.querySelector('[data-ai-cost]').textContent='见预扣';h.quote?.refresh(true);
      layer.querySelector('.dt-pano-ai-cost').title=model.name+' · 生成积分';h.update();
    };
    h.quote=window.CanvasFlowMountQuote?.(layer.querySelector('footer'),()=>h.model?{signature:h.model.id,load:()=>window.CanvasFlowDirectorPanoramaQuote(h.model.id)}:null,{label:'全景图预扣'});
    modelSelect.onchange=()=>{chooseModel(modelSelect.value);h.project.scene.panoramaModelId=modelSelect.value;if(S.project===h.project&&S.nodeEl===h.node)persist();};
    layer.querySelector('[data-ai-close]').onclick=closePanoAi;
    upload.onclick=()=>file.click();remove.onclick=()=>{h.reference='';file.value='';image.hidden=true;remove.hidden=true;upload.querySelector('span').hidden=false;h.update();};
    const receive=async f=>{try{const data=await readDirectorImage(f);if(panoAiDialog!==h)return;h.reference=data;image.src=data;image.hidden=false;remove.hidden=false;upload.querySelector('span').hidden=true;h.update();}catch(e){h.status.textContent=e.message;h.update();}};
    file.onchange=()=>receive(file.files?.[0]);upload.ondragover=e=>{e.preventDefault();upload.classList.add('drag-over');};upload.ondragleave=()=>upload.classList.remove('drag-over');upload.ondrop=e=>{e.preventDefault();upload.classList.remove('drag-over');if(!h.busy)receive(e.dataTransfer.files?.[0]);};
    submit.onclick=async()=>{
      if(submit.disabled)return;h.busy=true;h.status.textContent='正在提交生成任务…';h.update();
      try{
        const task=await window.CanvasFlowDirectorSubmitPanorama({referenceImage:h.reference,model:h.model,node:h.node});
        task.previousUrl=h.project.scene.panoramaUrl||h.project.scene.panoramaData||'';
        h.taskId=task.jobId;h.status.textContent='全景图生成中…';h.project.scene.panoramaJob=task;
        if(S.project===h.project&&S.nodeEl===h.node)persist(true);
        else if(h.node){h.node.dataset.directorProject=JSON.stringify(h.project);document.dispatchEvent(new CustomEvent('director-project-change',{detail:{node:h.node}}));}
        h.update();followPanoramaJob(task,h.node);
      }catch(err){h.busy=false;h.status.textContent=err.message;h.update();}
    };
    layer.addEventListener('click',e=>{if(e.target===layer)closePanoAi();});
    h.keydown=e=>{
      if(panoAiDialog!==h)return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePanoAi();return;}
      if(e.key==='Tab'){
        const focusable=[...layer.querySelectorAll('button:not(:disabled),select:not(:disabled)')].filter(b=>!b.hidden&&!b.closest('[hidden]')),first=focusable[0],last=focusable[focusable.length-1];
        if(!layer.contains(document.activeElement)){first?.focus();e.preventDefault();}
        else if(e.shiftKey&&(document.activeElement===first||document.activeElement===layer.querySelector('section'))){last?.focus();e.preventDefault();}
        else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}
      }
    };
    document.addEventListener('keydown',h.keydown,true);layer.addEventListener('keydown',e=>e.stopPropagation());
    (document.fullscreenElement||document.body).appendChild(layer);S.keyNudges.clear();layer.querySelector('section').focus();
    const pending=S.project.scene.panoramaJob;
    if(pending&&!pending.error){h.taskId=pending.jobId;h.busy=true;h.status.textContent='全景图生成中…';h.update();}
    Promise.resolve().then(()=>{if(!window.CanvasFlowDirectorPanoramaModel)throw Error('请从项目画布打开导演台');return window.CanvasFlowDirectorPanoramaModel();}).then(model=>{
      if(panoAiDialog!==h)return;h.models=model.models?.length?model.models:[model];h.modelProjectId=model.projectId;
      modelSelect.replaceChildren(...h.models.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;return option;}));
      const saved=h.project.scene.panoramaModelId;chooseModel(h.models.some(item=>item.id===saved)?saved:model.id);
    }).catch(err=>{if(panoAiDialog!==h)return;modelSelect.options[0].textContent='暂无可用生图模型';h.status.textContent=err.message;h.update();});
  }

  function importLocalModel() {
    if(S.recording||S.readOnly||!S.open)return;
    const project=S.project,epoch=S.animationEpoch;
    if(!window.openCommunityShareEditor){toast('模型导入组件未就绪，请刷新后重试');return;}
    window.openCommunityShareEditor({kind:'models',mode:'import',submit:async(fields,file)=>{
      if(!file)throw Error('请上传模型文件');
      if(!S.open||S.project!==project||epoch!==S.animationEpoch)throw Error('场景已切换，请重新打开导入弹窗');
      return importGLBFile(file,fields);
    },done:()=>toast('模型已导入并保存到我的资产')});
  }
  async function renderAssetThumbnail(obj,proto) {
    const T=S.three;if(!T)throw Error('3D 场景尚未就绪');let mesh;
    if(obj.local){if(!proto?.scene)throw Error('模型文件尚未加载');mesh=S.skeletonUtils.clone(proto.scene);}
    else if(obj.kind==='character'){const body=await S.loadSamBody(obj.bodyType||'sam');if(!body)throw Error('角色模型加载失败');mesh=Rig.cloneActor(T,S.skeletonUtils.clone,body,{color:'#d5d7dc',bodyType:obj.bodyType||'sam'}).actor;}
    else if(obj.kind==='camera'){mesh=new T.Group();for(const part of getCamGizmoShared(T).parts){const item=new T.Mesh(part.geometry,part.material);item.position.fromArray(part.position);if(part.rotation)item.rotation.fromArray(part.rotation);mesh.add(item);}}
    else mesh=obj.whitebox?window.DirectorSceneAgent.meshFor(T,obj.whitebox,obj.color||'#d5d7dc'):makeGeometry(T,obj.geometryType);
    const scene=new T.Scene();scene.background=new T.Color('#303740');scene.add(new T.HemisphereLight(0xffffff,0x606c7d,2.1));const light=new T.DirectionalLight(0xffffff,3);light.position.set(4,8,6);scene.add(light);scene.add(mesh);mesh.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(mesh),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());if(bounds.isEmpty())throw Error('模型没有可显示的几何体');const radius=Math.max(size.length()/2,.1),camera=new T.PerspectiveCamera(38,4/3,.01,Math.max(100,radius*30)),distance=radius/Math.sin(T.MathUtils.degToRad(19))*1.08;camera.position.copy(center).add(new T.Vector3(1,.65,1.25).normalize().multiplyScalar(distance));camera.lookAt(center);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(320,240);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;try{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');}finally{renderer.dispose();renderer.forceContextLoss();if(!obj.local&&obj.kind!=='camera')mesh.traverse(o=>{if(o.material){for(const material of [].concat(o.material))material.dispose();}if(obj.kind==='geometry')o.geometry?.dispose();});}
  }
  async function assetPreview(key){const [type,body]=key.split(':');return renderAssetThumbnail(type==='camera'?{kind:'camera'}:type==='character'?{kind:'character',bodyType:body}:window.DirectorSceneAgent.RECIPES.includes(type)&&!['box','sphere','cylinder','cone','torus','pyramid'].includes(type)?{kind:'geometry',whitebox:window.DirectorSceneAgent.recipe({type})}:{kind:'geometry',geometryType:type});}
  async function loadStoredPrototype(obj){
    if(!obj.local)return null;if(!/^\/media\/media-[a-f0-9]{32}\.(glb|bin)$/.test(obj.modelUrl||''))throw Error('模型文件未保存，请重新导入');const cache=S.localPrototypeLoads||(S.localPrototypeLoads=new Map());if(cache.has(obj.modelUrl))return cache.get(obj.modelUrl);
    const promise=(async()=>{const response=await fetch(obj.modelUrl);if(!response.ok)throw Error('模型文件读取失败');const length=Number(response.headers.get('Content-Length')||0);if(length>40*1024*1024)throw Error('模型文件不能超过 40 MB');const bytes=await response.arrayBuffer();if(bytes.byteLength>40*1024*1024)throw Error('模型文件不能超过 40 MB');inspectModelData(bytes,false);const {GLTFLoader}=await loadThree();const proto=await new GLTFLoader().parseAsync(bytes,new URL('.',document.baseURI||location.href).href);(S.localModelProtosByUrl||(S.localModelProtosByUrl=new Map())).set(obj.modelUrl,proto);return proto;})();cache.set(obj.modelUrl,promise);try{return await promise;}catch(error){cache.delete(obj.modelUrl);throw error;}
  }

  async function addStoredAsset(asset){
    if(S.recording||!asset?.object)throw Error('此收藏不是可添加的 3D 模型');const project=S.project,epoch=S.animationEpoch,obj=JSON.parse(JSON.stringify(asset.object));if(!['geometry','character','camera'].includes(obj.kind))throw Error('不支持的模型类型');const proto=await loadStoredPrototype(obj);if(obj.kind==='character'&&!obj.local){if(!await S.loadSamBody(obj.bodyType||'sam'))throw Error('角色模型加载失败');}if(!S.open||S.project!==project||epoch!==S.animationEpoch)throw Error('场景已切换，请重新添加');if(S.recording)throw Error('导出结束后再添加模型');
    obj.id=uid(obj.kind==='camera'?'cam':'asset');obj.name=nextName(asset.name||'模型');obj.visible=true;obj.locked=false;obj.transform=obj.transform||defaultTransform();if(obj.kind!=='camera')obj.transform.position=[nextSpawnX(),S.project.scene.groundHeight||0,0];pushUndo();if(proto)S.modelProtos[obj.id]=proto;S.project.objects.push(obj);if(obj.kind==='camera'){obj.targetMode='manual';obj.target=obj.target||[0,1,0];S.project.activeCameraId=obj.id;}createSceneObject(obj);persist();refreshTree();selectObject(obj.id);toast('已添加 '+obj.name);return obj;
  }
  function openBlenderTools(){
    if(!S.open||!S.viewportReady||S.readOnly||S.recording){toast('请先打开可编辑的预演台');return;}
    const project=S.project,epoch=S.animationEpoch,selectedId=S.selectedId;
    const selected=project.objects.find(o=>o.id===selectedId);
    const current=()=>S.open&&S.project===project&&S.animationEpoch===epoch&&!S.recording&&!S.readOnly;
    window.openCanvasFlowBlender({addAsset:addStoredAsset,selectedJobId:selected?.blenderJobId||'',current,
      replaceAsset:selected?.blenderJobId?async asset=>{
        const obj=project.objects.find(o=>o.id===selectedId);
        if(!current()||!obj)throw Error('原模型已移除或场景已切换');
        if(Crowd.inherited(project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked)throw Error('请先解锁模型及轨道');
        const proto=await loadStoredPrototype(asset.object);
        if(!current()||!project.objects.includes(obj))throw Error('场景已切换');
        if(Crowd.inherited(project,obj.id,'locked')||timeline.trackOf(obj.id)?.locked)throw Error('请先解锁模型及轨道');
        pushUndo();obj.modelUrl=asset.object.modelUrl;obj.blenderJobId=asset.object.blenderJobId;
        S.modelProtos[obj.id]=proto;rebuildObjectMesh(obj);persist();refreshTree();selectObject(obj.id);toast('模型已更新，位置和动画已保留');
      }:null});
  }
  async function saveSelectedAsset(){const obj=S.project.objects.find(o=>o.id===S.selectedId);if(!obj||!['geometry','character','camera'].includes(obj.kind))throw Error('请先选中模型或机位');if(!window.CanvasFlowDirectorSaveAsset)throw Error('请从已登录的项目画布保存模型');const project=S.project,epoch=S.animationEpoch,descriptor=JSON.parse(JSON.stringify(obj)),thumbnail=await renderAssetThumbnail(descriptor,S.modelProtos[obj.id]);if(!S.open||S.project!==project||epoch!==S.animationEpoch)throw Error('场景已切换');const asset=await window.CanvasFlowDirectorSaveAsset({object:descriptor,name:descriptor.name,description:'',thumbnail});toast('已保存到我的资产');return asset;}
  function inspectModelData(bytes,isJson){const data=isJson?JSON.parse(new TextDecoder().decode(bytes)):(()=>{const view=new DataView(bytes);if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error('GLB 文件格式无效');const length=view.getUint32(12,true);return JSON.parse(new TextDecoder().decode(bytes.slice(20,20+length)).replace(/\0+$/,''));})();for(const item of [...(data.buffers||[]),...(data.images||[])])if(item.uri&&!item.uri.startsWith('data:'))throw Error('请导入资源已内嵌的 GLB 或 glTF 文件');}
  async function importGLBFile(file,fields={}) {
    if(S.recording||S.readOnly||!S.open)throw Error('当前场景不可导入模型');const project=S.project,epoch=S.animationEpoch;let url;
    try{if(file.size>40*1024*1024)throw Error('模型文件不能超过 40 MB');if(!window.CanvasFlowDirectorSaveAsset)throw Error('请从已登录的项目画布导入模型');const bytes=await file.arrayBuffer(),isJson=/\.gltf$/i.test(file.name);inspectModelData(bytes,isJson);const {GLTFLoader}=await loadThree();url=URL.createObjectURL(file);const proto=await new GLTFLoader().loadAsync(url);let blob=file;if(isJson){const {GLTFExporter}=await import('./vendor/three/addons/exporters/GLTFExporter.js?v=r160');blob=new Blob([await new GLTFExporter().parseAsync(proto.scene,{binary:true,animations:proto.animations})],{type:'model/gltf-binary'});}
      const obj={kind:'geometry',geometryType:'model',local:true,transform:defaultTransform()},name=fields.name||file.name.replace(/\.(glb|gltf)$/i,'').slice(0,120)||'本地模型',thumbnail=fields.thumbnail||await renderAssetThumbnail(obj,proto);if(!S.open||S.project!==project||epoch!==S.animationEpoch)throw Error('场景已切换');const asset=await window.CanvasFlowDirectorSaveAsset({object:obj,name,description:fields.description||'',thumbnail,blob});if(!S.open||S.project!==project||epoch!==S.animationEpoch)throw Error('模型已保存到我的资产，场景已切换，请手动添加');await addStoredAsset(asset);return asset;
    }finally{if(url)URL.revokeObjectURL(url);}
  }
  function clearPanorama() {
    panoramaRequest++;
    pushUndo();
    S.panoramaDome.visible = false;
    if (S.panoramaDome.material.map) { S.panoramaDome.material.map.dispose(); S.panoramaDome.material.map = null; }
    S.panoramaDome.material.needsUpdate = true;
    S.project.scene.panoramaData = '';
    S.project.scene.panoramaUrl = '';
    S.project.scene.panoramaName = '';
    S.panoramaDome.userData.panoramaSource = '';
    persist(); renderInspector();
  }
  // 当前视角模式下实际参与取景的机位（机位视角/对比视角右栏用它）
  function activeCameraObj() {
    // The inspector-selected camera is the sole timeline, playback and export source.
    const id=S.project.activeCameraId;
    return S.project.objects.find(o=>o.kind==='camera' && o.id===id)||S.project.objects.find(o=>o.kind==='camera')||null;
  }
  function switchMode(mode) {
    S.el.shell.querySelectorAll('[data-dt-mode]').forEach(b => b.classList.toggle('is-active', b.dataset.dtMode === mode));
    const prevMode = S.viewMode, previousCamera = activeCameraObj();
    if(mode!=='camera')S.previewCameraId='';
    S.viewMode = mode;syncObjectGizmo();
    const camObj = activeCameraObj();
    // 离开机位/对比视角回导演视角：恢复进机位视角前记录的导演相机姿态
    if (prevMode === 'camera' && mode !== 'camera') {
      if (S.savedDirectorPose && S.controls) {
        const { p, t } = S.savedDirectorPose;
        S.controls.moveTo(p[0], p[1], p[2], false);
        S.controls.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], false);
      }
    }
    if (mode === 'camera' && camObj) {
      // 机位视角：把主相机切到机位取景。直接改 camera.position 会被
      // CameraControls.update() 每帧拉回它内部缓存的目标——必须用控制器自己的
      // moveTo/setLookAt 同步内部状态，视角才能真的停住。
      if (S.controls) {
        // 记录当前导演相机姿态（只记一次：机位视角里切走不还原）
        if (prevMode === 'director') {
          const pos = S.camera.position, tgt = S.controls.getTarget();
          S.savedDirectorPose = { p: [pos.x, pos.y, pos.z], t: [tgt.x, tgt.y, tgt.z] };
        }
        const p = camObj.transform.position, t = camObj.target || [0, 1, 0];
        S.controls.moveTo(p[0], p[1], p[2], false);
        S.controls.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], false);
        // 主相机 FOV 对齐机位（回到导演视角时恢复）
        S.camera.fov = Math.max(1, Math.min(179, camObj.fov || 50));
        S.camera.updateProjectionMatrix();

        S.controls.enabled = false;
      }
      // 取景框提示 + 隐藏活动机位自己的线框（相机贴在 gizmo 里，机身线会糊满画面）
      if (S.el.viewfinder) {
        S.el.viewfinder.classList.add('is-on');
        S.el.viewfinder.dataset.dtViewfinderLabel = camObj.name;
      }
      const selfGizmo = S.sceneObjects.get(camObj.id);
      if (selfGizmo) selfGizmo.visible = false;
      toast(`机位视角 · ${camObj.name}（固定取景）`);
    } else {
      // 离开机位视角：恢复导演视角的相机控制
      if (S.controls) S.controls.enabled = true;
      if (S.el.viewfinder) S.el.viewfinder.classList.remove('is-on');
      // 离开机位视角：恢复被隐藏的机位线框 + 导演相机 FOV
      const hiddenCam = prevMode === 'camera' ? previousCamera : null;
      if (hiddenCam) {
        const g = S.sceneObjects.get(hiddenCam.id);
        if (g && hiddenCam.visible !== false) g.visible = true;
      }
      if (prevMode === 'camera') { S.camera.fov = 50; S.camera.updateProjectionMatrix(); }
    }
    // 对比视角：scissor 双视口——主画布留在 holder 原地不动（拖挪画布会把
    // 760px 绘制缓冲硬压进 380px 栏里造成横向拉伸），一帧分两次各渲染半幅。
    const compare = mode === 'compare';
    if (S.el.compareSplit) {
      S.el.compareSplit.classList.toggle('is-on', compare);
      if (compare) {
        if (S.el.compareCamTag) S.el.compareCamTag.innerHTML = camObj ? `机位视角<b>· ${esc(camObj.name)}</b>` : '机位视角<b>· 未创建机位</b>';
        ensureCompareCamera();
        bindCompareDivider();
      }
    }

    if (S.el.aspectFrameLabel) S.el.aspectFrameLabel.hidden = mode !== 'camera';
    S.poseEditor?.update();
  }

  let compareDividerBound = false;
  function bindCompareDivider() {
    if (compareDividerBound) return;
    compareDividerBound = true;
    const divider = S.el.compareSplit && S.el.compareSplit.querySelector('.dt-compare-divider');
    if (!divider) return;
    divider.style.pointerEvents = 'auto';
    divider.style.cursor = 'col-resize';
    divider.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const wrap = S.el.compareSplit.getBoundingClientRect();
      const move = (ev) => {
        const pct = Math.max(0.2, Math.min(0.8, (ev.clientX - wrap.left) / wrap.width));
        S.compareSplitRatio = pct;
        divider.style.left = (pct * 100) + '%';
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
  // 对比视角右侧机位相机（复用主 renderer，不建第二个画布）
  function ensureCompareCamera() {
    const THREE = S.three;
    if (!THREE || S.compareCamera) return;
    S.compareCamera = new THREE.PerspectiveCamera(50, 1, 0.01, 2000);
  }
  // 每帧对比渲染：主画布 scissor 一分为二，左导演相机、右机位相机。
  // 分屏比例可拖（S.compareSplitRatio，0.2~0.8），两栏各按自身宽度算 aspect——无拉伸。
  function renderCompareView() {
    const THREE = S.three;
    const camObj = activeCameraObj();
    if (!THREE || !S.renderer || !S.el.compareSplit) return;
    const canvas = S.renderer.domElement;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const dpr = S.renderer.getPixelRatio();
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      S.renderer.setSize(W, H, false);
    }
    const ratio = S.compareSplitRatio != null ? S.compareSplitRatio : 0.5;
    const leftW = Math.round(W * ratio), rightW = W - leftW;
    // 左：导演相机（主相机，含 controls 姿态）
    const leftAspect = leftW / H;
    if (Math.abs(S.camera.aspect - leftAspect) > 1e-4) { S.camera.aspect = leftAspect; S.camera.updateProjectionMatrix(); }
    // 右：机位相机与主视口机位视角同一取景基准（世界姿态 + roll，含场景变换）
    if (camObj) {
      syncRenderCameraFromGizmo(S.compareCamera, camObj);
      S.compareCamera.aspect = cameraAspect(camObj);
      S.compareCamera.updateProjectionMatrix();
    }
    // scissor 两段渲染
    S.renderer.setScissorTest(true);
    // 左段
    S.renderer.setScissor(0, 0, leftW, H);
    S.renderer.setViewport(0, 0, leftW, H);
    S.renderer.render(S.scene, S.camera);
    // 右段
    if (camObj) {
      S.renderer.setScissor(leftW, 0, rightW, H);
      S.renderer.setClearColor(0x000000,1);S.renderer.clear();
      const ar=cameraAspect(camObj);let fw=rightW,fh=rightW/ar;if(fh>H){fh=H;fw=H*ar;}
      const ox=leftW+(rightW-fw)/2,oy=(H-fh)/2;
      S.renderer.setScissor(ox, oy, fw, fh);
      S.renderer.setViewport(ox, oy, fw, fh);
      renderCameraScene(S.renderer,S.compareCamera);
    } else {
      // 无机位：右段清成底色
      const bg = new THREE.Color(S.project.scene.backgroundColor || '#141414');
      S.renderer.setScissor(leftW, 0, rightW, H);
      S.renderer.setClearColor(bg, 1);
      S.renderer.clear();
    }
    S.renderer.setScissorTest(false);
    // 恢复整幅 viewport（下一帧主渲染路径用）
    S.renderer.setViewport(0, 0, W, H);
  }




  let _aspectDim = null; // { mesh, mat } 暗化面片（正交全屏，跟随画幅外区域）
  function getAspectDim() {
    const THREE = S.three;
    if (_aspectDim && _aspectDim.THREE === THREE) return _aspectDim;
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 900;
    // 正交相机下铺满视口的单位面片（z=0 平面，相机 -1 看向原点）
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const holder = new THREE.Scene();
    holder.add(mesh);
    _aspectDim = { THREE, mesh, mat, cam, scene: holder };
    return _aspectDim;
  }
  function renderDirectorWithAspect() {
    const canvas = S.renderer.domElement;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const dpr = S.renderer.getPixelRatio();
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) S.renderer.setSize(W, H, false);
    const arRow = ASPECT_RATIOS.find(r => r[0] === (S.project.scene.aspectRatio || '16:9')) || ASPECT_RATIOS[0];
    const ar = arRow[1] > 0 ? arRow[1] : W / H;
    let fw = W, fh = W / ar;
    if (fh > H) { fh = H; fw = H * ar; }
    const ox = Math.floor((W - fw) / 2), oy = Math.floor((H - fh) / 2);
    const fullFrame = fw >= W - 1 && fh >= H - 1; // 自适应：无框
    if (Math.abs(S.camera.aspect - W/H) > 1e-4) { S.camera.aspect = W/H; S.camera.updateProjectionMatrix(); }
    // 先整幅渲染场景
    S.renderer.setScissorTest(false);
    S.renderer.setViewport(0, 0, W, H);
    S.renderer.render(S.scene, S.camera);
    if (!fullFrame) {
      // 画幅外暗化：scissor 到画幅外的四条边，用半透明面片各叠一层（正交相机独立场景）。
      // 面片渲染必须关 autoClear——否则 render 前先 clear 会把该区域清成纯黑而非半透明叠加。
      const dim = getAspectDim();
      const shade = (sx, sy, sw, sh) => {
        if (sw <= 0 || sh <= 0) return;
        S.renderer.setScissorTest(true);
        S.renderer.setScissor(sx, sy, sw, sh);
        S.renderer.setViewport(sx, sy, sw, sh);
        const prevAuto = S.renderer.autoClear;
        S.renderer.autoClear = false;
        S.renderer.render(dim.scene, dim.cam);
        S.renderer.autoClear = prevAuto;
      };
      shade(0, 0, W, oy);                    // 上
      shade(0, oy + fh, W, H - oy - fh);      // 下
      shade(0, oy, ox, fh);                   // 左
      shade(ox + fw, oy, W - ox - fw, fh);    // 右
      S.renderer.setScissorTest(false);
      S.renderer.setViewport(0, 0, W, H);
    }
    // 画幅标签跟随显示（导演视角也可见当前比例）
    if (S.el.aspectFrameLabel) {
      S.el.aspectFrameLabel.textContent = arRow[0];
      S.el.aspectFrameLabel.hidden = fullFrame; // 自适应时无框也无标签
    }
  }



  function renderCameraLetterbox() {
    const canvas = S.renderer.domElement;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const dpr = S.renderer.getPixelRatio();
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) S.renderer.setSize(W, H, false);
    const ar = cameraAspect();
    if(S.el.aspectFrameLabel){S.el.aspectFrameLabel.textContent=activeCameraObj()?.aspectRatio||'16:9';S.el.aspectFrameLabel.hidden=false;}
    // 画幅区：最大化放入 W×H，居中
    let fw = W, fh = W / ar;
    if (fh > H) { fh = H; fw = H * ar; }
    const ox = Math.floor((W - fw) / 2), oy = Math.floor((H - fh) / 2);
    // 画幅区外黑边
    S.renderer.setScissorTest(false);
    S.renderer.setClearColor(0x000000, 1);
    S.renderer.clear();
    // 画幅区渲染
    S.renderer.setScissorTest(true);
    S.renderer.setScissor(ox, oy, fw, fh);
    S.renderer.setViewport(ox, oy, fw, fh);
    if (Math.abs(S.camera.aspect - ar) > 1e-4) { S.camera.aspect = ar; S.camera.updateProjectionMatrix(); }
    // 机位视角相机对齐活动机位：统一走 syncRenderCameraFromGizmo（世界姿态含场景变换与 roll，
    // 编辑拖动、动画轨播放、撤销恢复等所有改变机位的路径都从场景 mesh 实时取）。
    const camObj2 = activeCameraObj();
    if (camObj2) {
      syncRenderCameraFromGizmo(S.camera, camObj2);
      S.camera.aspect = ar; // 保持画幅区 aspect（sync 内部 updateProjectionMatrix 前再设一次）
      S.camera.fov = Math.max(1, Math.min(179, (S.sampledObjects?.get(camObj2.id)||camObj2).fov || 50));
      S.camera.updateProjectionMatrix();
      renderCameraScene(S.renderer, S.camera);
    } else {
      S.renderer.render(S.scene, S.camera);
    }
    S.renderer.setScissorTest(false);
    S.renderer.setViewport(0, 0, W, H);
  }






  function openCamPreviewFullscreen() {
    const overlay = S.el.shell.querySelector('#dtCamPreviewFullscreen');
    if (!S.project.objects.some(o => o.id === S.selectedId && o.kind === 'camera')) return;
    overlay.hidden = false;
    renderCamPreview();
    overlay.querySelector('button').focus();
  }
  function closeCamPreviewFullscreen() {
    const overlay = S.el.shell?.querySelector('#dtCamPreviewFullscreen');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    renderCamPreview();
    S.el.inspector?.querySelector('[data-dt-preview-expand]')?.focus();
  }
  function renderCamPreview() {
    const overlay = S.el.shell?.querySelector('#dtCamPreviewFullscreen');
    const fullscreen = overlay && !overlay.hidden;
    const previsHost=S.previs?.previewHost;
    const host = fullscreen ? overlay.querySelector('#dtCamPreviewFullscreenHost') : previsHost || S.el.inspector && S.el.inspector.querySelector('#dtCamPreviewHost');
    if (!host) { if (S.camPreviewRenderer) S.camPreviewRenderer.domElement.style.display = 'none'; return; }
    const camObj = previsHost && !fullscreen ? activeCameraObj() : S.project.objects.find(o => o.id === S.selectedId && o.kind === 'camera');
    if (!camObj || !S.three || !S.scene) { if (S.camPreviewRenderer) S.camPreviewRenderer.domElement.style.display = 'none'; return; }
    const canvas = S.camPreviewRenderer ? S.camPreviewRenderer.domElement : null;
    if (canvas && canvas.parentElement !== host) {
      host.appendChild(canvas);          // 换容器不换 canvas → 不新建 WebGL 上下文
      canvas.style.display = 'block';
    }
    if(canvas)canvas.style.display='block';
    if (!S.camPreviewRenderer) {
      // 固定 288×162 内部分辨率（与检查器占位 canvas 同规格），CSS 拉伸到容器宽度
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = 288; previewCanvas.height = 162;
      host.appendChild(previewCanvas);
      // preserveDrawingBuffer 与主渲染器一致：预览画布每帧合成后会被浏览器清空缓冲
      S.camPreviewRenderer = createDirectorRenderer(S.three,{canvas:previewCanvas});
      S.camPreviewRenderer.setPixelRatio(1);
      S.camPreviewCamera = new S.three.PerspectiveCamera(50, 288 / 162, 0.01, 2000);
    }
    // 与主视口机位视角同一取景基准（世界姿态 + roll），画面严格一致
    syncRenderCameraFromGizmo(S.camPreviewCamera, camObj);
    const previewFov = Math.round(S.camPreviewCamera.fov);
    const fovLabel = S.el.inspector?.querySelector('#dtCamPreviewFov');
    if (fovLabel) fovLabel.textContent = `FOV ${previewFov}°`;
    // Size the preview window to the actual frame instead of letterboxing a fixed 16:9 canvas.
    const ar = cameraAspect(camObj);
    host.style.aspectRatio = String(ar);
    if(previsHost&&!fullscreen)host.style.width=Math.min(previsHost.parentElement.clientWidth||250,170*ar)+'px';
    if (fullscreen) {
      const width = Math.min(overlay.clientWidth - 32, (overlay.clientHeight - 100) * ar);
      host.style.width = `${Math.max(1, width)}px`;
      overlay.querySelector('#dtCamPreviewFullscreenTitle').textContent = `${camObj.name} · FOV ${previewFov}°`;
    }
    const width = Math.min(1920, Math.max(1, Math.round((host.clientWidth || 288) * Math.min(window.devicePixelRatio || 1, 2))));
    const height = Math.max(1, Math.round(width / ar));
    if (S.camPreviewRenderer.domElement.width !== width || S.camPreviewRenderer.domElement.height !== height) S.camPreviewRenderer.setSize(width, height, false);
    S.camPreviewRenderer.setScissorTest(false);
    S.camPreviewRenderer.setViewport(0, 0, width, height);
    S.camPreviewCamera.aspect = ar;
    S.camPreviewCamera.updateProjectionMatrix();
    renderCameraScene(S.camPreviewRenderer, S.camPreviewCamera);
    S.camPreviewRenderer.setScissorTest(false);
    S.camPreviewRenderer.setViewport(0, 0, width, height);
  }

  function renderCameraScene(renderer, camera) {
    const hidden=[];
    S.scene.traverse(o=>{if(o===S.transformControl||o.userData.directorHelper||o.userData.directorPath||S.project.objects.some(p=>p.kind==='camera'&&S.sceneObjects.get(p.id)===o)){hidden.push([o,o.visible]);o.visible=false;}});
    try { renderer.render(S.scene,camera); }
    finally { for(const [o,visible] of hidden)o.visible=visible; }
  }

  function renderPrevisFilm() {
    const renderer=S.renderer,cam=activeCameraObj();if(!renderer||!cam)return;
    const W=renderer.domElement.clientWidth,H=renderer.domElement.clientHeight;if(!W||!H)return;
    const ar=cameraAspect(cam),marginX=W*.1,marginY=Math.min(76,H*.13);
    let fw=W-2*marginX,fh=fw/ar;if(fh>H-2*marginY){fh=H-2*marginY;fw=fh*ar;}
    const ox=(W-fw)/2,oy=(H-fh)/2;
    ensureCompareCamera();const camera=S.compareCamera;syncRenderCameraFromGizmo(camera,cam);
    // Continue the image outside the final frame; shade the overscan like the reference viewer.
    const frameFov=camera.fov;camera.fov=2*Math.atan(Math.tan(frameFov*Math.PI/360)*H/fh)*180/Math.PI;camera.aspect=W/H;camera.updateProjectionMatrix();
    renderer.setScissorTest(false);renderer.setViewport(0,0,W,H);renderCameraScene(renderer,camera);
    const dim=getAspectDim(),auto=renderer.autoClear;
    try{renderer.autoClear=false;for(const [x,y,w,hh]of [[0,0,W,oy],[0,oy+fh,W,H-oy-fh],[0,oy,ox,fh],[ox+fw,oy,W-ox-fw,fh]]){if(w<=0||hh<=0)continue;renderer.setScissorTest(true);renderer.setScissor(x,y,w,hh);renderer.setViewport(x,y,w,hh);renderer.render(dim.scene,dim.cam);}}
    finally{renderer.autoClear=auto;renderer.setScissorTest(false);renderer.setViewport(0,0,W,H);}
  }

  function renderExportCameraFrame(renderer, camera, camObj, width, height) {
    // A video has fixed dimensions. Fit later cuts to their own optics without stretching the frame.
    const ar=cameraAspect(camObj);
    camera.aspect=ar;camera.updateProjectionMatrix();
    let fw=width,fh=width/ar;if(fh>height){fh=height;fw=height*ar;}
    renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
    renderer.setClearColor(0x000000,1);renderer.clear();
    renderer.setScissorTest(true);renderer.setScissor((width-fw)/2,(height-fh)/2,fw,fh);
    renderer.setViewport((width-fw)/2,(height-fh)/2,fw,fh);
    try { renderer.render(S.scene,camera); }
    finally { renderer.setScissorTest(false);renderer.setViewport(0,0,width,height); }
  }


  function updateRoleLabels() {
    if (!S.labelLayer || !S.camera || !S.three) return;
    const holderRect = S.el.holder.getBoundingClientRect();
    const visible = S.project.scene.showLabels !== false;
    for (const obj of S.project.objects) {
      if (obj.kind === 'geometry'||obj.kind==='group') continue;
      let el = S.labelLayer.querySelector(`[data-dt-label-id="${obj.id}"]`);
      const mesh = S.sceneObjects.get(obj.id);
      if (!visible || !mesh || !Crowd.inherited(S.project,obj.id,'visible')) { if (el) el.remove(); continue; }
      // 标签锚点：对象世界位置（跟随场景缩放/平移）+ 头顶偏移（按场景缩放同步缩放）
      const scScale = (S.project.scene.scale != null ? S.project.scene.scale : 1);
      const wp = new S.three.Vector3();
      const rig=S.rigs.get(obj.id);if(rig?.head){rig.head.getWorldPosition(wp);wp.y+=.32*mesh.getWorldScale(new S.three.Vector3()).y;}else{mesh.getWorldPosition(wp);wp.y+=(obj.kind==='character'?1.75:.55)*scScale;}
      const p = wp.project(S.camera);
      if (p.z > 1 || p.z < -1) { if (el) el.remove(); continue; } // 背面剔除
      if (!el) {
        el = document.createElement('span');
        el.className = obj.kind === 'camera' ? 'dt-role-label is-cam' : 'dt-role-label';
        el.dataset.dtLabelId = obj.id;
        el.textContent = obj.name;
        S.labelLayer.appendChild(el);
      }
      el.textContent=obj.name;
      const x = (p.x * 0.5 + 0.5) * holderRect.width;
      const y = (-p.y * 0.5 + 0.5) * holderRect.height;
      el.style.transform = `translate(-50%, -100%) translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    // 兜底:清理已删除对象残留的名称标签
    S.labelLayer.querySelectorAll('[data-dt-label-id]').forEach(el => {
      if (!S.project.objects.some(o => o.id === el.dataset.dtLabelId)) el.remove();
    });
  }


  let viewportSyncTimer = 0;
  function syncViewportFields() {
    const now = Date.now();
    if (now - viewportSyncTimer < 250) return;
    viewportSyncTimer = now;
    if (!S.el.inspector) return;
    const selected=S.project.objects.find(o=>o.id===S.selectedId);
    if(selected?.kind==='camera'){
      const value=cameraInspectorValue(selected);
      for(const input of S.el.inspector.querySelectorAll('[data-dt-axis]')){
        if(document.activeElement===input)continue;
        const arr=input.dataset.dtProp==='位置'?value.transform.position:input.dataset.dtProp==='旋转'?value.transform.rotation:value.target;
        if(arr)input.value=round3(arr['XYZ'.indexOf(input.dataset.dtAxis)]);
      }
      return;
    }
    if(S.selectedId)return;
    const set = (label, i, v) => {
      const input = S.el.inspector.querySelector(`[data-dt-prop="${label}"][data-dt-axis="${['X','Y','Z'][i]}"]`);
      if (input && document.activeElement !== input) input.value = (Math.round(v * 1000) / 1000);
    };
    const fovRange = S.el.inspector.querySelector('[data-dt-range="视野角度 (FOV)"]');
    if (S.camera) {
      set('视口位置', 0, S.camera.position.x); set('视口位置', 1, S.camera.position.y); set('视口位置', 2, S.camera.position.z);
      if (fovRange && document.activeElement !== fovRange) { fovRange.value = Math.round(S.camera.fov); fovRange.style.setProperty('--range-fill', ((S.camera.fov - 10) / 110 * 100) + '%'); }
      const numFov = S.el.inspector.querySelector('[data-dt-range-value="视野角度 (FOV)"]');
      if (numFov && document.activeElement !== numFov) numFov.value = Math.round(S.camera.fov);
    }
    if (S.controls) {
      const t = S.controls.getTarget(new S.three.Vector3());
      set('注视点', 0, t.x); set('注视点', 1, t.y); set('注视点', 2, t.z);
    }
  }

  /* ---------- 全量重建（undo/恢复后）---------- */
  function rebuildAll() {
    panoramaRequest++;
    Animation.migrate(S.project);S.workArea=S.project.sequence.workArea.slice();S.autoKey=!!S.project.timeline.autoKey;S.loopWorkArea=!!S.project.timeline.loop;S.playhead=Math.min(S.playhead,S.project.sequence.durationFrames-1);S.sampledObjects=new Map();
    // 清空场景对象
    S.sceneObjects.forEach(m => { if(m.userData.aiWhitebox){const materials=new Set();m.traverse(c=>{c.geometry?.dispose();if(c.material)materials.add(c.material);});materials.forEach(mat=>mat.dispose());}if (m.parent) m.parent.remove(m); else S.scene.remove(m); });
    S.sceneObjects.clear();
    S.rigs.clear();
    const pending=[...S.project.objects];let guard=pending.length+1;while(pending.length&&guard--){for(let i=pending.length-1;i>=0;i--){const o=pending[i];if(!o.parentId||S.sceneObjects.has(o.parentId)||!S.project.objects.some(p=>p.id===o.parentId)){createSceneObject(o);pending.splice(i,1);}}}for(const o of pending)createSceneObject(o);
    if (S.scene) {
      S.scene.background = new S.three.Color(S.project.scene.backgroundColor || '#141414');
      if (S.grid) { S.grid.material.opacity = S.project.scene.gridOpacity != null ? S.project.scene.gridOpacity : 0.6; S.grid.position.y = (S.project.scene.groundHeight || 0) + 0.001; }
    }
    restorePanorama();
    refreshPanoHistory();
    sampleAtFrame(S.playhead);
    refreshTree(); refreshTracks(); renderInspector();
    syncTimelineMeta();
    S.refreshAgentHistory?.();
    if (S.selectedId && !S.project.objects.some(o => o.id === S.selectedId)) selectObject('');
    else if (S.selectedId) { S.sceneObjects.get(S.selectedId); }
  }

  /* ============================================================
     打开 / 关闭（对外 API）
     ============================================================ */
  async function open(node,options={}) {
    if (S.open) return;
    S.open = true;S.readOnly=!!options.readOnly;S.viewportReady=false;
    // Recover missing or older helper scripts before restoring any scene objects.
    try {
      for (const [file, ready] of [
        ['director-rig.js', () => window.DirectorRig?.cloneActor && window.DirectorRig?.walkControls && window.DirectorRig?.runControls && window.DirectorRig?.AXES_VERSION === 3],
        ['director-crowd.js', () => window.DirectorCrowd?.COLORS?.length && window.DirectorCrowd?.inherited],
        ['director-tools.js', () => window.DirectorTools?.watchJob && window.DirectorTools?.scenePlan],
        ['director-scene-agent.js', () => window.DirectorSceneAgent?.run && window.DirectorSceneAgent?.meshFor],
        ['director-ground.js', () => window.DirectorGround?.bounds && window.DirectorGround?.translateMotion],
        ['director-pose-editor.js', () => window.DirectorPoseEditor?.create],
        ['director-path-editor.js', () => window.DirectorPathEditor?.create],
        ['director-annotation.js', () => window.createDirectorAnnotation],

        ['file-formats.js', () => window.CanvasFlowFileFormats?.validate],

        ['director-previs.js', () => window.createDirectorPrevis],
      ]) {
        if (ready()) continue;
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = file + (file==='director-previs.js'?'?v=20261019-blender2':(['community-editor.js','director-share.js','director-previs.js','director-annotation.js','director-scene-agent.js','director-rig.js'].includes(file)?'?v=20261014-agent-review1':'?v=20261010-path-walk1'));
          script.onload = resolve; script.onerror = () => reject(new Error(file + ' 加载失败'));
          document.head.appendChild(script);
        });
        if (!ready()) throw new Error(file + ' 未就绪');
      }
      Rig = window.DirectorRig; Crowd = window.DirectorCrowd;
    } catch (e) {
      S.open = false; toast('导演台组件加载失败：' + e.message); return;
    }
    S.nodeEl = node || null;
    let proj = null;
    if (node) {
      try { proj = JSON.parse(node.dataset.directorProject || 'null'); } catch (e) { proj = null; }
    }
    S.project = Animation.migrate(proj && proj.version === 3 ? migrateProject(proj) : defaultProject());
    S.animationEpoch=(S.animationEpoch||0)+1; S.charTab='props'; S.interpMode='linear';S.previewCameraId='';
    const openEpoch=S.animationEpoch;
    S.undoStack = []; S.redoStack = [];
    S.playhead = 0; S.playing = false; S.selectedId = '';
    S.viewMode = 'director'; S.workspace='director';S.playbackRate=1;S.navigationMode='select'; S.savedDirectorPose = null; S.hiddenGizmoId = ''; S.compareSplitRatio = null;
    const shell = buildShell();shell.classList.toggle('dt-readonly',S.readOnly);
    timeline.init();
    document.documentElement.classList.add('dt-no-scroll');
    // hidden 页面 rAF 会被冻结，open class 必须同步加（不依赖渲染帧）。
    shell.classList.add('open');
    bindShellEvents();
    refreshTree(); renderInspector();
    setPlayhead(0);
    syncTimelineMeta();
    try {
      await initViewport();
      if(!S.open||openEpoch!==S.animationEpoch)return;
      S.viewportReady=true;
      rebuildAll();
      applySceneTransform(); // 场景缩放/平移/旋转落地 + 人物基准补偿（含场景缩放≠1 的存量工程）
      updateAspectFrame();
      refreshTracks();
      refreshPanoHistory();
      const pendingPanorama=S.project.scene.panoramaJob;
      if(pendingPanorama&&!pendingPanorama.error&&window.CanvasFlowDirectorReadJob)followPanoramaJob(pendingPanorama,S.nodeEl);
      if (!S.readOnly&&!S.project.objects.length) {

        await addCharacter('sam');
        addCamera();
        S.project.activeCameraId = S.project.objects.find(o => o.kind === 'camera')?.id || '';
        persist(true);
      }
    } catch (e) {
      if(!S.open||S.animationEpoch!==openEpoch)return;
      S.viewportReady=false;releaseViewportResources();
      console.error('[director] 初始化失败', e);
      showViewportInitializationError(e);
    }
  }
  function close() {
    if (!S.open) return;
    S.axisScrubCleanup?.();
    closePanoHistory();
    closePanoAi();
    closeCrowdDialog();
    S.previs?.dispose();S.previs=null;
    S.poseEditor?.dispose(); S.poseEditor=null;
    S.pathEditor?.dispose(); S.pathEditor=null;
    clearTimeout(poseAxisPersistTimer);poseAxisPersistTimer=0;
    timeline.saveSettings();persist(true);clearTimeout(persistTimer);
    try {
      const preview=S.viewportReady?captureNodePreview():null;
      if(preview&&window.CanvasFlowDirectorPreview)Promise.resolve(window.CanvasFlowDirectorPreview(preview)).catch(error=>{
        document.dispatchEvent(new CustomEvent('director-preview-error',{detail:{message:error.message}}));
      });
    } catch(error) { document.dispatchEvent(new CustomEvent('director-preview-error',{detail:{message:error.message}})); }
    stopRecording(); timeline.dispose();S.animationEpoch++;for(const url of S.exportDownloadUrls||[])URL.revokeObjectURL(url);S.exportDownloadUrls=[];
    S.open = false;
    const shell = S.el.shell;
    shell.classList.remove('open');
    document.documentElement.classList.remove('dt-no-scroll');
    setTimeout(() => { shell.remove(); }, 200);
    releaseViewportResources();S.viewportReady=false;
    S.compareCamera=null;S.savedDirectorPose=null;
    S.el = {};
  }

  timeline=window.createDirectorTimeline({S,esc,ICONS,toast,persist,pushUndo,beginBatch,endBatch,selectObject,renderInspector,setPlayhead,setPlaying,sampleAtFrame,activeCameraObj,switchMode,uniformScaleBase,inspectorSample:cameraInspectorValue});
  window.CanvasFlowDirector = {
    sceneStatus: () => ({open:S.open,ready:S.viewportReady,epoch:S.animationEpoch,project:S.project?structuredClone(S.project):null}),
    saveBuildMetadata: (metadata,epoch,completedOperations) => {
      if(!S.open||!S.viewportReady||S.readOnly||S.recording||S.animationEpoch!==epoch)throw Error('预演台已切换，停止搭建');
      if(metadata&&(!Number.isInteger(metadata.stage)||metadata.stage<0||metadata.stage>6||metadata.version!==3||metadata.session!=='forest-walk-20261013'))throw Error('搭建进度无效');
      if(completedOperations!==undefined&&(!Number.isInteger(completedOperations)||completedOperations<0))throw Error('搭建摘要无效');
      if(metadata)S.project.forestBuild={session:metadata.session,stage:metadata.stage,version:metadata.version};
      if(completedOperations!==undefined){
        window.DirectorSceneAgent.remember(S.project,'完成这段镜头，并保留可编辑对象和动画。','已完成林间小路、56 棵林木、18 丛灌木、主角的行走与回头，以及正面机位的同向等速跟移。',{operations:completedOperations});
      }
      persist(true);S.refreshAgentHistory?.();
    },
    applyCommands: async (commands,{message='',prompt='',view='scene'}={}) => {
      if(!S.open||!S.viewportReady||S.readOnly||S.recording)throw Error('请先打开可编辑的预演台');
      const project=S.project,epoch=S.animationEpoch,baseline=JSON.stringify(project);
      const result=window.DirectorSceneAgent.apply(project,commands,Animation);
      const loaded=await Promise.all([...new Set(result.project.objects.filter(o=>o.kind==='character'&&!o.local).map(o=>o.bodyType))].map(type=>S.loadSamBody(type)));
      if(loaded.some(model=>!model))throw Error('角色模型加载失败');
      if(!S.open||S.project!==project||S.animationEpoch!==epoch||JSON.stringify(project)!==baseline)throw Error('场景已改变，本次工具操作未应用');
      for(const obj of result.project.objects.filter(o=>o.kind==='character'))if(obj.agentPose||!obj.poseControls){const preset=POSE_PRESETS.find(p=>p.label===obj.agentPose)||POSE_PRESETS[0];obj.poseControls={...preset.controls,...obj.poseControls,_rigAxes:Rig.AXES_VERSION};obj.rigVersion=2;delete obj.agentPose;}
      pushUndo();Object.assign(project,result.project);if(prompt)window.DirectorSceneAgent.remember(project,prompt,message||result.message,{operations:result.operations});
      rebuildAll();setPlayhead(0);S.previs.setWorkspace(true);S.previs.setMode(view==='film'?'film':'scene');
      if(view==='scene'){S.controls.setLookAt(12,12,19,0,.5,4,false);S.controls.update(0);}
      S.refreshAgentHistory?.();persist(true);toast(message||result.message);
      return {created:result.created,changed:result.changed,operations:result.operations,objects:project.objects.length};
    },
    open, close, assetPreview,viewPrevis:()=>{S.previs.setWorkspace(true);if(activeCameraObj())S.previs.setMode('film');},
    debug: () => {
      const sceneRef = S.scene; // 仅供页面内调试使用（不序列化）
      const objTree = S.scene ? S.scene.children.filter(c => !c.isLight && !c.userData.isGrid && !c.userData.isPanorama).map(c => ({
        type: c.type, name: c.name || '', visible: c.visible, childCount: c.children.length,
        hasLine: (c.children || []).some(k => k.isLine || (k.children || []).some(g => g.isLine)),
      })) : null;
      return {
        open: S.open, selectedId: S.selectedId, sceneRef,
        project: S.project,
        persistNow: () => persist(true),
        objects: (S.project && S.project.objects || []).map(o => ({ id: o.id, kind: o.kind, visible: o.visible, pos: o.transform ? o.transform.position : null })),
        sceneCounts: S.scene ? { children: S.scene.children.length, objects: S.sceneObjects.size } : null,
        objectTree: objTree,
        roots: S.sceneObjects ? [...S.sceneObjects.entries()].map(([id, m]) => ({
          id, type: m.type, visible: m.visible,
          depth: (() => { const walk = (o, d) => { if (d > 3) return null; const kids = (o.children || []).map(c => walk(c, d + 1)); return { t: o.type, mesh: !!o.isMesh, verts: o.geometry && o.geometry.attributes && o.geometry.attributes.position ? o.geometry.attributes.position.count : null, k: kids.some(x => x) ? kids : undefined }; }; return walk(m, 0); })(),
        })) : null,
        cameraInfo: S.camera ? { pos: [Math.round(S.camera.position.x * 10) / 10, Math.round(S.camera.position.y * 10) / 10, Math.round(S.camera.position.z * 10) / 10], fov: S.camera.fov } : null,
      };
    },
  };
})();
