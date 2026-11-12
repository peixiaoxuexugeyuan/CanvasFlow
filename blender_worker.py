"""Trusted Blender worker. Accept data operations, export GLB plus editable blend."""
import json
import math
from pathlib import Path
import sys
import importlib.util

# Do not add the native backend directory to Blender's Python search path.
# It also contains Python 3.12 extensions; Blender 4.5 uses Python 3.11.
worker_root = Path(__file__).resolve().parent
sys.path[:] = [entry for entry in sys.path if Path(entry or '.').resolve() != worker_root]
protocol_spec = importlib.util.spec_from_file_location('canvasflow_blender_protocol', worker_root / 'blender_protocol.py')
protocol_module = importlib.util.module_from_spec(protocol_spec)
protocol_spec.loader.exec_module(protocol_module)
validate_plan = protocol_module.validate_plan
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix


def choose(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def find(id):
    obj = next((o for o in bpy.data.objects if o.get('canvasflow_id') == id), None)
    if obj is None: raise ValueError('找不到对象：' + id)
    return obj


def tint(obj, color, roughness=.5, metallic=0):
    rgb = [int(color[i:i+2], 16)/255 for i in (1, 3, 5)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    material = bpy.data.materials.new(obj.name + ' material')
    material.diffuse_color = (*linear, 1)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    obj.data.materials.clear();obj.data.materials.append(material)


def transform(obj, op):
    if 'name' in op: obj.name = op['name']
    if 'rotation' in op:
        basis = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
        obj.rotation_euler = (basis @ Euler([math.radians(v) for v in op['rotation']], 'XYZ').to_matrix() @ basis.transposed()).to_euler()
    if 'size' in op:
        # Dimensions are object-local metres, independent of its world rotation.
        old = obj.rotation_euler.copy();obj.rotation_euler = (0,0,0)
        bpy.context.view_layer.update()
        size = op['size'];obj.dimensions = (size[0], size[2], size[1])
        choose(obj);bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.rotation_euler = old
    if 'position' in op:
        x,y,z = op['position'];obj.location = (x,-z,y)


def create(op):
    if any(o.get('canvasflow_id') == op['id'] for o in bpy.data.objects): raise ValueError('对象 ID 已存在：' + op['id'])
    shape = op['shape']
    if shape == 'box': bpy.ops.mesh.primitive_cube_add(size=1)
    elif shape == 'cylinder': bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=.5, depth=1)
    elif shape == 'sphere': bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=.5)
    elif shape == 'torus': bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=24, major_radius=.35, minor_radius=.15)
    else:
        outline = op['outline'];n=len(outline)
        cx=(min(p[0] for p in outline)+max(p[0] for p in outline))/2
        cz=(min(p[1] for p in outline)+max(p[1] for p in outline))/2
        vertices=[(x-cx,-(z-cz),h) for h in (-.5,.5) for x,z in outline]
        faces=[tuple(reversed(range(n))), tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh=bpy.data.meshes.new(op['id']);mesh.from_pydata(vertices,[],faces);mesh.update()
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        obj=bpy.data.objects.new(op['id'],mesh);bpy.context.collection.objects.link(obj);choose(obj)
    obj=bpy.context.object;obj.name=op.get('name',op['id']);obj['canvasflow_id']=op['id']
    transform(obj, {'size':op.get('size',[1,1,1]), **op})
    tint(obj, op.get('color','#b8c4d4'))
    return obj


def execute(plan):
    for op in plan['operations']:
        tool=op['op']
        if tool == 'create': create(op);continue
        obj=find(op['id']);choose(obj)
        if tool == 'update': transform(obj,op)
        elif tool == 'remove': bpy.data.objects.remove(obj,do_unlink=True)
        elif tool == 'material':
            tint(obj,op.get('color','#b8c4d4'),op.get('roughness',.5),op.get('metallic',0))
        elif tool in ('bevel','subdivide'):
            key='CanvasFlow '+tool
            previous=obj.modifiers.get(key)
            if previous:obj.modifiers.remove(previous)
            mod=obj.modifiers.new(key,'BEVEL' if tool=='bevel' else 'SUBSURF')
            if tool=='bevel':mod.width=op.get('width',.02);mod.segments=int(op.get('segments',3))
            else:mod.levels=mod.render_levels=int(op.get('levels',1))
        elif tool == 'smooth':
            for poly in obj.data.polygons:poly.use_smooth=True
        elif tool == 'boolean':
            cutter=find(op['toolId']);mod=obj.modifiers.new('CanvasFlow boolean','BOOLEAN')
            mod.operation=op['operation'];mod.solver='EXACT';mod.object=cutter
            bpy.ops.object.modifier_apply(modifier=mod.name)
            if not op['keepTool']:bpy.data.objects.remove(cutter,do_unlink=True)


def result_metadata(objects):
    depsgraph=bpy.context.evaluated_depsgraph_get();rows=[]
    for obj in objects:
        evaluated=obj.evaluated_get(depsgraph);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
        bounds=[evaluated.matrix_world @ Vector(v) for v in evaluated.bound_box]
        points=[[p.x,p.z,-p.y] for p in bounds]
        bm=bmesh.new();bm.from_mesh(mesh);volume=bm.calc_volume(signed=True);bm.free()
        rows.append({'id':obj['canvasflow_id'],'name':obj.name,'signedVolume':volume,
            'vertices':len(mesh.vertices),'triangles':len(mesh.loop_triangles),
            'bounds':{'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]},
            'modifiers':[{'type':m.type,'width':m.width,'segments':m.segments} if m.type=='BEVEL' else {'type':m.type} for m in obj.modifiers],
            'materials':[{'name':m.name,'color':list(m.diffuse_color)} for m in obj.data.materials if m]})
        evaluated.to_mesh_clear()
    return {'objects':rows,'objectCount':len(rows),'vertices':sum(r['vertices'] for r in rows),'triangles':sum(r['triangles'] for r in rows)}


def preview(objects,path):
    points=[obj.matrix_world @ Vector(v) for obj in objects for v in obj.bound_box]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    center=(lo+hi)/2;radius=max((hi-lo).length/2,.1)
    bpy.ops.object.camera_add(location=center+Vector((1,-1.45,1.1)).normalized()*radius*3.3)
    camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=radius*2.6;bpy.context.scene.camera=camera
    scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO';scene.display.shading.studiolight_rotate_z=.4
    scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
    scene.display.shading.background_type='WORLD';scene.world.color=(.035,.045,.065)
    scene.render.resolution_x=900;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(path)
    try:bpy.ops.render.render(write_still=True)
    finally:bpy.data.objects.remove(camera,do_unlink=True)


def main():
    task_path=Path(sys.argv[sys.argv.index('--')+1]);task=json.loads(task_path.read_text(encoding='utf-8'))
    directory=task_path.parent
    try:
        plan=validate_plan(task['plan'])
        if task.get('sourceBlend'):bpy.ops.wm.open_mainfile(filepath=task['sourceBlend'],use_scripts=False)
        else:bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        execute(plan);bpy.context.view_layer.update()
        objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('canvasflow_id')]
        if not objects:raise ValueError('模型没有可导出的对象')
        if len(objects)>600:raise ValueError('模型对象过多')
        info=result_metadata(objects)
        if info['triangles']>1_500_000:raise ValueError('模型面数超过预演台预算')
        bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
        preview(objects,directory/'preview.png')
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(directory/'model.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(directory/'model.blend'),check_existing=False)
        (directory/'result.json').write_text(json.dumps({'ok':True,**info},ensure_ascii=False,indent=2),encoding='utf-8')
    except Exception as error:
        (directory/'result.json').write_text(json.dumps({'ok':False,'error':str(error)},ensure_ascii=False),encoding='utf-8')
        raise


if __name__=='__main__':main()
