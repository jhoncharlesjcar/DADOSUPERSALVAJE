"""Build lightweight review GLBs from the public originals, without replacing them.
Run with -- slug to rebuild a single mascot. Import keeps the glTF animation tracks.
"""
import bpy, sys, json, argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT
from glb_textures import deduplicate_textures

out=ROOT/'assets/mascots3d/lite';out.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('slugs',nargs='*')
parser.add_argument('--source-dir',default='public/models/mascots')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
selected=args.slugs
files=sorted((ROOT/args.source_dir).glob('*.glb'))
for file in files:
    if selected and file.stem not in selected:continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=30
    bpy.ops.import_scene.gltf(filepath=str(file))
    before=0;after=0
    for obj in list(bpy.context.scene.objects):
        if obj.type!='MESH':continue
        obj.data.calc_loop_triangles();before+=len(obj.data.loop_triangles)
        if len(obj.data.polygons)>500:
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('LOD móvil','DECIMATE');mod.ratio=.30;mod.use_collapse_triangulate=True
            while obj.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.data.calc_loop_triangles();after+=len(obj.data.loop_triangles)
    for img in bpy.data.images:
        if img.size[0]>1024 or img.size[1]>1024:
            ratio=min(1024/img.size[0],1024/img.size[1]);img.scale(round(img.size[0]*ratio),round(img.size[1]*ratio));img.pack()
    bpy.ops.object.select_all(action='SELECT')
    target=out/file.name
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,
        export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,
        export_skins=True,export_image_format='WEBP',export_image_quality=82)
    deduplicate_textures(target)
    data={'name':file.stem,'source':str(file.relative_to(ROOT)),'trianglesBefore':before,'trianglesAfter':after,
          'sourceBytes':file.stat().st_size,'liteBytes':target.stat().st_size,'textureMaxSize':1024}
    (out/(file.stem+'.json')).write_text(json.dumps(data,indent=2),encoding='utf8')
    print('LOD_READY',json.dumps(data),flush=True)
