"""Render the saved candidate without rebuilding geometry or baked textures."""
import bpy, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/mascots3d/pantera/revision2'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'model.blend'))
scene=bpy.context.scene;camera=scene.camera
rig=bpy.data.objects['Pantera_Rosada'];rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
scene.cycles.samples=32;scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Celebrate'];scene.frame_set(32)
scene.render.filepath=str(OUT/'celebrate.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
camera.location=(1,-6,3.65);camera.rotation_euler=(Vector((0,-.10,3.27))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.35
scene.render.resolution_x=900;scene.render.resolution_y=900
scene.render.filepath=str(OUT/'detail.png');bpy.ops.render.render(write_still=True)
print('PANTERA_REVIEW_RENDERED',flush=True)
