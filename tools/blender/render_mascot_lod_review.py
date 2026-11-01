"""Render the actual lite GLB in the matching full-model review scene."""
import bpy, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT

slug=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'poseidon'
folder=ROOT/'assets/mascots3d'/slug
bpy.ops.wm.open_mainfile(filepath=str(folder/'model.blend'))
scene=bpy.context.scene
# Preserve the original camera, stage and lights; replace only the rig and meshes it drives.
rigs=[obj for obj in scene.objects if obj.type=='ARMATURE']
parts=[obj for obj in scene.objects if obj.parent in rigs or any(mod.type=='ARMATURE' and mod.object in rigs for mod in obj.modifiers)]
for obj in parts+rigs:bpy.data.objects.remove(obj,do_unlink=True)
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/mascots3d/lite'/f'{slug}.glb'))
scene.frame_set(1)
scene.render.filepath=str(ROOT/'assets/mascots3d/lite'/f'{slug}-preview.png')
bpy.ops.render.render(write_still=True)
print('LOD_REVIEW_READY',slug,flush=True)
