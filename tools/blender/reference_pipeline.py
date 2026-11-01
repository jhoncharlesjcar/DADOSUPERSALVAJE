"""Blender helpers for individual review candidates. No scene changes on import."""
import bpy, math
import numpy as np
from mathutils import Vector
from build_roster import Model, mat, aim

class Sculpt(Model):
    def ball(self,name,at,scale,material,bone='head'):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=18,location=at)
        obj=bpy.context.object;obj.scale=scale
        return self.finish(obj,name,material,bone)

    def line(self,name,points,radius,material,bone='chest',sides=8):
        return self.tube(name,points,[radius]*len(points),material,bone,sides)

    def unify(self,start,name,bone,voxel=.017):
        parts=self.parts[start:];bpy.ops.object.select_all(action='DESELECT')
        for obj in parts:obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=bpy.context.object
        obj.name=name;obj.data.remesh_voxel_size=voxel;bpy.ops.object.voxel_remesh()
        smooth=obj.modifiers.new('Escultura continua','SMOOTH');smooth.factor=.60;smooth.iterations=4
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        simplify=obj.modifiers.new('Escultura optimizada','DECIMATE');simplify.ratio=.60
        bpy.ops.object.modifier_apply(modifier=simplify.name)
        obj.vertex_groups.clear();obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))),1,'REPLACE')
        for face in obj.data.polygons:face.use_smooth=True
        self.parts=self.parts[:start]+[obj]
        return obj

def bake_surfaces(obj,prefix,resolution=2048):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.002)
    bpy.ops.object.mode_set(mode='OBJECT')
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.margin=4
    materials=list(obj.data.materials);targets=[];images={}
    for material in materials:
        target=material.node_tree.nodes.new('ShaderNodeTexImage');material.node_tree.nodes.active=target;targets.append(target)
    for key,kind,options,space in [('color','DIFFUSE',{'pass_filter':{'COLOR'}},'sRGB'),('normal','NORMAL',{},'Non-Color')]:
        img=bpy.data.images.new(prefix+'_'+key,resolution,resolution);img.colorspace_settings.name=space
        for target in targets:target.image=img
        bpy.ops.object.bake(type=kind,**options);img.pack();images[key]=img
    for material in materials:
        nt=material.node_tree;p=nt.nodes['Principled BSDF']
        for name in ['Base Color','Normal']:
            for link in list(p.inputs[name].links):nt.links.remove(link)
        color=nt.nodes.new('ShaderNodeTexImage');color.image=images['color'];nt.links.new(color.outputs['Color'],p.inputs['Base Color'])
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=images['normal'];norm=nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tex.outputs['Color'],norm.inputs['Color']);nt.links.new(norm.outputs['Normal'],p.inputs['Normal'])
    print('REFERENCE_TEXTURES_BAKED',prefix,flush=True)

def ground_fast(rig,mesh):
    """Same per-frame root compensation as ground(), with bulk vertex reads."""
    scene=bpy.context.scene
    for action in list(bpy.data.actions):
        rig.animation_data.action=action
        for frame in range(int(action.frame_range[0]),int(action.frame_range[1])+1):
            scene.frame_set(frame)
            evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            coords=np.empty(len(evaluated.data.vertices)*3,dtype=np.float32)
            evaluated.data.vertices.foreach_get('co',coords)
            matrix=evaluated.matrix_world
            low=float(np.min(coords.reshape(-1,3) @ np.array(matrix[2][:3])))+matrix[2][3]
            root=rig.pose.bones['root'];root.location.y-=low
            root.keyframe_insert(data_path='location',frame=frame,group='root')
        print('GROUNDED',action.name,flush=True)

def render_review(out,rig,accent=(.15,.75,1),height=2.0,scale=4.6,face_target=3.38,celebration_scale=None,celebration_height=None):
    scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=61
    rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
    stage=mat('Escenario mate',(.010,.016,.025),.15,.55)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.8,depth=.09,location=(0,0,-.065));bpy.context.object.data.materials.append(stage)
    bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.12));bpy.context.object.data.materials.append(stage)
    for name,loc,color,power,size in [('Principal',(2,-4,6),(.82,.92,1),700,4),('Relleno',(-3,-3,3),(.48,.68,1),330,3),('Borde',(-2,2,4),accent,800,3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,height))
    data=bpy.data.cameras.new('Cámara');camera=bpy.data.objects.new('Cámara',data);scene.collection.objects.link(camera);scene.camera=camera
    camera.location=(2,-10,4);aim(camera,(0,0,height));data.type='ORTHO';data.ortho_scale=scale
    scene.world.color=(.025,.025,.035);scene.use_nodes=False;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'model.blend'),compress=True)
    scene.render.filepath=str(out/'preview.png');bpy.ops.render.render(write_still=True)
    rig.animation_data.action=bpy.data.actions['Celebrate'];scene.frame_set(32)
    if celebration_scale is not None:data.ortho_scale=celebration_scale
    if celebration_height is not None:
        camera.location.z+=celebration_height-height;aim(camera,(0,0,celebration_height))
    scene.render.filepath=str(out/'celebrate.png');bpy.ops.render.render(write_still=True)
    rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
    camera.location=(1,-6,face_target+.2);aim(camera,(0,-.1,face_target));data.ortho_scale=1.5
    scene.render.resolution_x=900;scene.render.resolution_y=900
    scene.render.filepath=str(out/'detail.png');bpy.ops.render.render(write_still=True)
