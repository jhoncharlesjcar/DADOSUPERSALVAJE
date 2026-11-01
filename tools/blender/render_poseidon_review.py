"""Resume Poseidon review renders from a saved revision (default: revision3)."""
import bpy, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT, aim

revision=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'revision3'
out=ROOT/'assets/mascots3d/poseidon'/revision
bpy.ops.wm.open_mainfile(filepath=str(out/'model.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['Poseidon'];camera=scene.camera
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
scene.render.filepath=str(out/'preview.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Celebrate'];scene.frame_set(32)
camera.location=(2,-10,4.4);aim(camera,(0,0,2.4));camera.data.ortho_scale=6.3
scene.render.filepath=str(out/'celebrate.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
camera.location=(1,-6,3.59);aim(camera,(0,-.1,3.39));camera.data.ortho_scale=1.5
scene.render.resolution_x=900;scene.render.resolution_y=900
scene.render.filepath=str(out/'detail.png');bpy.ops.render.render(write_still=True)
print('POSEIDON_REVIEW_READY',flush=True)
