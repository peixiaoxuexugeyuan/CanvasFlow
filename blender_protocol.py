"""Bounded data tools shared by the server and Blender; never execute model code."""
import math
import re

TOOLS = ('create', 'update', 'material', 'bevel', 'subdivide', 'boolean', 'smooth', 'remove')
SHAPES = ('box', 'cylinder', 'sphere', 'torus', 'extrude')


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', value):
        raise ValueError('对象 ID 只能包含字母、数字、下划线和短横线')
    return value


def number(value, low, high, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(label + '超出范围')
    return value


def vector(value, low, high, label):
    if not isinstance(value, list) or len(value) != 3:
        raise ValueError(label + '需要三个数值')
    return [number(v, low, high, label) for v in value]


def validate_plan(raw):
    if not isinstance(raw, dict) or set(raw) - {'name', 'operations', 'sourceJobId'}:
        raise ValueError('建模指令格式无效，只接受名称、工具操作和源版本')
    name = raw.get('name', 'Blender 模型')
    if not isinstance(name, str) or not name.strip() or len(name) > 120:
        raise ValueError('请填写 1–120 字的模型名称')
    operations = raw.get('operations')
    if not isinstance(operations, list) or not 1 <= len(operations) <= 160:
        raise ValueError('一次需要 1–160 条建模操作')
    cleaned = []
    for op in operations:
        if not isinstance(op, dict) or op.get('op') not in TOOLS:
            raise ValueError('不支持的建模工具')
        tool = op['op']
        allowed = {'op', 'id'}
        allowed |= {'shape', 'name', 'size', 'position', 'rotation', 'color', 'outline'} if tool == 'create' else set()
        allowed |= {'name', 'size', 'position', 'rotation'} if tool == 'update' else set()
        allowed |= {'color', 'roughness', 'metallic'} if tool == 'material' else set()
        allowed |= {'width', 'segments'} if tool == 'bevel' else set()
        allowed |= {'levels'} if tool == 'subdivide' else set()
        allowed |= {'toolId', 'operation', 'keepTool'} if tool == 'boolean' else set()
        if set(op) - allowed:
            raise ValueError('工具包含未声明的参数：' + ', '.join(set(op) - allowed))
        out = {'op': tool, 'id': identifier(op.get('id'))}
        if 'name' in op:
            if not isinstance(op['name'], str) or not op['name'].strip() or len(op['name']) > 120:
                raise ValueError('对象名称无效')
            out['name'] = op['name'].strip()
        for key, low, high in [('size', .001, 200), ('position', -500, 500), ('rotation', -3600, 3600)]:
            if key in op: out[key] = vector(op[key], low, high, key)
        if 'color' in op:
            if not isinstance(op['color'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', op['color']):
                raise ValueError('颜色需要 #RRGGBB 格式')
            out['color'] = op['color']
        if tool == 'create':
            if op.get('shape') not in SHAPES: raise ValueError('不支持的基础形状')
            out['shape'] = op['shape']
            if out['shape'] == 'extrude':
                points = op.get('outline')
                if not isinstance(points, list) or not 3 <= len(points) <= 128:
                    raise ValueError('挤出轮廓需要 3–128 个点')
                out['outline'] = []
                for point in points:
                    if not isinstance(point, list) or len(point) != 2: raise ValueError('轮廓点需要两个数值')
                    out['outline'].append([number(v, -100, 100, '轮廓') for v in point])
                area = sum(points[i][0]*points[(i+1)%len(points)][1]-points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points)))
                if abs(area) < .000001: raise ValueError('轮廓面积为零')
            elif 'outline' in op: raise ValueError('仅挤出形状支持轮廓')
        for key, low, high in [('roughness', 0, 1), ('metallic', 0, 1), ('width', .0001, 2), ('segments', 1, 12), ('levels', 0, 3)]:
            if key in op:
                out[key] = number(op[key], low, high, key)
                if key in ('segments', 'levels') and int(out[key]) != out[key]: raise ValueError(key + '需要整数')
        if tool == 'boolean':
            out['toolId'] = identifier(op.get('toolId'))
            out['operation'] = op.get('operation', 'DIFFERENCE')
            if out['operation'] not in ('DIFFERENCE', 'UNION', 'INTERSECT'): raise ValueError('布尔运算无效')
            if 'keepTool' in op and not isinstance(op['keepTool'], bool): raise ValueError('keepTool 需要布尔值')
            out['keepTool'] = op.get('keepTool', False)
            if out['id'] == out['toolId']: raise ValueError('布尔目标和切割体不能相同')
        cleaned.append(out)
    source = raw.get('sourceJobId') or ''
    if not isinstance(source, str) or source and not re.fullmatch(r'blend-[a-f0-9]{32}', source): raise ValueError('源版本 ID 无效')
    return {'name': name.strip(), 'operations': cleaned, 'sourceJobId': source}
