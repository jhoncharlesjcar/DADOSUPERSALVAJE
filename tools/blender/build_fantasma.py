"""La Fantasma revision 2. Creates a candidate; never overwrites public assets."""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT, SOURCE, mat, die
from reference_pipeline import Sculpt, bake_surfaces, ground_fast, render_review
from glb_textures import deduplicate_textures

OUT=ROOT/'assets/mascots3d/fantasma/revision2';OUT.mkdir(parents=True,exist_ok=True)
random.seed(94)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['Demonio_Salvaje'];rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
for obj in list(bpy.data.objects):
    if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
rig.name='La_Fantasma';bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name,color,metal,rough,grain=140):
    material=mat(name,color,metal,rough);nt=material.node_tree;n=nt.nodes;l=nt.links;p=n['Principled BSDF']
    coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=grain;noise.inputs['Detail'].default_value=2
    l.new(coord.outputs['Object'],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=tuple(c*.75 for c in color)+(1,)
    ramp.color_ramp.elements[1].color=tuple(min(1,c*1.15) for c in color)+(1,)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.001
    l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
    return material

silver=surface('Acero plateado satinado',(.44,.50,.56),.50,.38)
edge=mat('Aristas de plata',(.58,.69,.76),.75,.24)
steel=surface('Acero de los grabados',(.075,.10,.14),.72,.43)
under=surface('Malla oscura bajo placas',(.027,.039,.052),.28,.72,230)
cloth=surface('Tejido espectral',(.25,.30,.34),.08,.80,210)
mist=mat('Velos pálidos',(.34,.48,.55),.05,.75,.12)
mist.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.22
mist.surface_render_method='DITHERED'
glow=mat('Runas blancas',(.64,.86,1),.1,.30,1.7)
black=mat('Vacío del visor',(.002,.004,.007),0,.86)
m=Sculpt()

def solid(obj,thickness=.025):
    mod=obj.modifiers.new('Espesor de placa','SOLIDIFY');mod.thickness=thickness;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def panel(name,points,bone,material=silver,depth=.035):
    obj=m.plate(name,points,material,bone,depth)
    m.line(name+' borde',[(x,y-.01,z) for x,y,z in points+[points[0]]],.009,edge,bone)
    return obj

def rune(at,size,bone,kind=0):
    # Original angular sigils; thin geometry survives the glTF material bake.
    x,y,z=at
    shapes=[[[(-.4,-.5),(0,.5),(.4,-.5)],[(-.2,0),(.2,0)]],[[(-.3,-.5),(-.3,.5),(.35,.2),(-.3,0),(.35,-.5)]],[[(-.4,.35),(0,0),(.4,.35)],[(0,.5),(0,-.5)]],[[(-.35,-.5),(-.35,.4),(.35,.4),(.35,-.5)],[(0,.4),(0,-.2)]],[[(-.3,-.5),(.3,0),(-.3,.5)],[(-.3,0),(.3,0)]]]
    for stroke in shapes[kind%len(shapes)]:m.line('Sigilo luminoso',[(x+u*size,y,z+v*size) for u,v in stroke],.006,glow,bone,6)

def breastplate():
    levels=[(2.78,.29,.19),(2.64,.43,.27),(2.43,.41,.28),(2.22,.29,.24)]
    vs=[];fs=[];cols=25
    for r,(z,w,d) in enumerate(levels):
        for c in range(cols):
            u=c/(cols-1)*2-1
            zz=z-(.14*(1-abs(u)) if r==3 else 0)
            vs.append((u*w,-d*math.sqrt(max(.08,1-u*u))-.02,zz))
            if r and c:a=(r-1)*cols+c-1;b=r*cols+c-1;fs.append((a,a+1,b+1,b))
    solid(m.mesh('Coraza curva',vs,fs,silver,'chest'),.04)
    for row in [0,3]:m.line('Borde coraza',[(x,y-.012,z) for x,y,z in vs[row*cols:(row+1)*cols]],.011,edge,'chest')
    m.line('Quilla central',[(0,-.235,2.78),(0,-.31,2.48),(0,-.275,2.09)],.009,edge,'chest')
    for s in [-1,1]:
        m.line('Nervadura pecho',[(s*.33,-.19,2.71),(s*.25,-.28,2.56),(s*.07,-.315,2.39)],.010,edge,'chest')
        for k in range(3):rune((s*(.10+k*.075),-.32+.05*k/2,2.67-k*.038),.095,'chest',k)
    rune((0,-.335,2.48),.18,'chest',1)

# Slim base and fitted armor leave no exposed toy-like skin spheres.
m.ball('Torso de malla',(0,.02,2.43),(.40,.23,.41),under,'chest')
m.ball('Cintura',(0,.01,2.04),(.28,.20,.29),under,'spine')
m.ball('Caderas',(0,.015,1.65),(.32,.23,.23),under,'hips')
m.tube('Cuello cubierto',[(0,0,2.74),(0,0,3.10)],[.17,.16],under,'neck',24)
for k in range(5):
    z=2.82+k*.043;radius=.21-k*.006
    m.line('Pliegue de cuello',[(radius*math.sin(i*math.tau/48),-.17*math.cos(i*math.tau/48),z+.018*math.sin(i*math.tau/48+1.1)) for i in range(49)],.032,cloth,'neck',10)
breastplate()
for s in [-1,1]:
    for layer in range(3):
        z=2.28-layer*.15
        panel('Lámina abdominal',[(s*.02,-.25,z),(s*.25,-.19,z+.07),(s*.25,-.20,z-.08),(s*.03,-.28,z-.19)],'spine')
    panel('Cinturón',[(s*.015,-.245,1.91),(s*.29,-.15,1.96),(s*.32,-.16,1.79),(s*.02,-.28,1.75)],'hips')
    for k in range(2):rune((s*(.12+k*.09),-.28+.025*k,1.86),.065,'hips',k+2)
m.ball('Broche cinturón',(0,-.30,1.83),(.075,.023,.09),edge,'hips')
rune((0,-.331,1.83),.10,'hips',1)

# Helmet dome and cheek shells frame a single black T-shaped opening.
m.ball('Vacío interior',(0,.01,3.35),(.235,.205,.29),black)
vs=[];fs=[];cols=49
for r,(z,rx,ry) in enumerate([(3.43,.255,.225),(3.54,.255,.22),(3.66,.23,.205),(3.76,.16,.15),(3.84,.065,.065),(3.91,.003,.003)]):
    for c in range(cols):
        a=c/(cols-1)*math.tau
        vs.append((rx*math.sin(a),-ry*math.cos(a),z+.045*math.cos(a) if r==0 else z))
        if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
solid(m.mesh('Bóveda del yelmo',vs,fs,silver,'head'),.025)
for s in [-1,1]:
    vs=[];fs=[];rows=10;cols=17
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);a=.25+u*2.75
            x=s*(.255-.035*t)*math.sin(a);y=-(.223-.015*t)*math.cos(a)
            z=3.37-.30*t+.06*u
            vs.append((x,y,z))
            if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    solid(m.mesh('Faldón del yelmo',vs,fs,silver,'head'),.025)
    m.line('Borde de visor',[vs[r*cols] for r in range(rows)],.008,edge,'head')
    m.line('Límite ocular',[(x,y-.008,z) for x,y,z in vs[:cols]],.009,edge,'head')
    m.ball('Ojo espectral',(s*.115,-.215,3.405),(.065,.014,.024),glow)
    m.line('Grabado yelmo',[(s*.20,-.16,3.38),(s*.15,-.19,3.27),(s*.14,-.18,3.12)],.004,steel,'head')
    m.tube('Ala del casco',[(s*.22,.02,3.52),(s*.29,.025,3.72),(s*.25,.035,3.88)],[.022,.019,.001],edge,'head',10)
panel('Protector nasal',[(-.04,-.236,3.48),(.04,-.236,3.48),(0,-.268,3.33)],'head',silver,.012)
m.line('Eje grabado del casco',[(0,-.24,3.49),(0,-.225,3.65),(0,-.11,3.81)],.004,steel,'head')

for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    m.tube('Brazo de malla',[(s*.57,0,2.63),(s*.77,0,2.41),(s*.96,0,2.16)],[.17,.15,.12],under,ua,20)
    m.ball('Cúpula de hombrera',(s*.61,.01,2.66),(.23,.265,.23),silver,ua)
    # Curved overlapping pauldrons, with a small upward point on the outer rim.
    for layer in range(3):
        vs=[];fs=[];rows=8;cols=21
        for r in range(rows):
            t=r/(rows-1)
            for c in range(cols):
                a=c/(cols-1)*math.pi
                x=s*(.57+layer*.065+.22*t)
                y=-.255*math.cos(a)
                z=2.69-layer*.09+.10*math.sin(a)+.10*(1-t)-.10*t
                vs.append((x,y,z))
                if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
        solid(m.mesh('Hombrera curva',vs,fs,silver,ua),.025)
        m.line('Ribete hombrera',[(x,y-.008,z+.006) for x,y,z in vs[-cols:]],.011,edge,ua)
    m.tube('Punta de hombrera',[(s*.68,.07,2.78),(s*.72,.07,2.91),(s*.69,.07,2.97)],[.065,.03,.001],silver,ua,14)
    for k in range(2):rune((s*(.60+k*.10),-.265,2.78-k*.035),.065,ua,k+3)
    # Clasps and a shallow draped chain across the chest.
    m.ball('Broche de capa',(s*.38,-.19,2.76),(.075,.025,.085),edge,'chest')
    m.ball('Sello de broche',(s*.38,-.215,2.76),(.052,.01,.061),steel,'chest')
    rune((s*.38,-.229,2.76),.065,'chest',4)
    end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    a=Vector((s*.96,0,2.16));m.tube('Manga de antebrazo',[a,end],[.13,.095],under,fa,20)
    m.tube('Brazal de plata',[a.lerp(end,.15),end],[.16,.12],silver,fa,24)
    d=(end-a).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    for t in [.16,.30,.82,1]:
        p=a.lerp(end,t);radius=.17-.045*t
        m.line('Anillo de brazal',[p+radius*(u*math.cos(i*math.tau/32)+v*math.sin(i*math.tau/32)) for i in range(33)],.008,edge,fa)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Guante articulado',palm,(.135,.15,.08) if s==1 else (.13,.10,.17),steel,hand)
    for k in range(4):
        x=palm.x+(k-1.5)*.061
        points=[(x,-.61,1.97),(x,-.74,2.00),(x,-.76,2.12)] if s==1 else [(x,-.10,1.48),(x,-.16,1.32),(x+.01,-.23,1.30)]
        m.tube('Dedo de guante',points,[.026,.024,.014],silver,hand,10)
        m.ball('Nudillo',points[1],(.028,.026,.025),edge,hand)
    m.tube('Pulgar',[(palm.x-s*.09,palm.y-.02,palm.z),(palm.x-s*.18,palm.y-.08,palm.z-.04),(palm.x-s*.19,palm.y-.14,palm.z+.015)],[.033,.029,.018],silver,hand,10)
    # Slender legs and pointed sabatons, rather than broad clawed feet.
    m.tube('Muslo de malla',[(s*.29,.02,1.52),(s*.36,.01,.98)],[.17,.13],under,th,20)
    panel('Quijote',[(s*.20,-.15,1.49),(s*.41,-.12,1.49),(s*.47,-.14,1.12),(s*.32,-.19,1.05)],th,steel)
    for k in range(2):
        z=1.72-k*.18
        panel('Faldón lateral',[(s*.15,-.23,z),(s*.38,-.17,z+.02),(s*.50,-.14,z-.25),(s*.25,-.26,z-.20)],th)
        for q in range(2):rune((s*(.25+q*.075),-.29+q*.022,z-.09),.065,th,k+q)
    m.tube('Pierna',[(s*.38,.01,.91),(s*.40,.01,.26)],[.14,.095],under,sh,20)
    panel('Rodillera',[(s*.24,-.17,1.0),(s*.38,-.23,1.10),(s*.52,-.17,1.0),(s*.45,-.25,.80),(s*.38,-.28,.75),(s*.28,-.23,.82)],sh)
    panel('Greba alargada',[(s*.27,-.18,.82),(s*.49,-.18,.82),(s*.48,-.18,.47),(s*.45,-.19,.24),(s*.34,-.22,.19),(s*.30,-.20,.49)],sh)
    for k in range(4):rune((s*.38,-.251,.68-k*.085),.055,sh,k)
    m.tube('Escarpe puntiagudo',[(s*.40,0,.23),(s*.40,-.12,.14),(s*.40,-.28,.035)],[.11,.10,.005],silver,foot,18)
    for k in range(3):m.line('Articulación escarpe',[(s*.40-.08,-.09-k*.04,.19-k*.025),(s*.40,-.12-k*.04,.20-k*.025),(s*.40+.08,-.09-k*.04,.19-k*.025)],.007,edge,foot)

for k in range(17):
    t=k/16;x=-.33+t*.66;z=2.74-.10*math.sin(math.pi*t);y=-.24-.045*math.sin(math.pi*t)
    pts=[]
    for q in range(13):
        a=q/12*math.tau
        pts.append((x+.022*math.cos(a),y+(.009*math.sin(a) if k%2 else 0),z+.015*math.sin(a)))
    m.line('Eslabón de cadena',pts,.004,edge,'chest',5)

# Flowing, genuinely perforated cape meshes: skipped quads form ragged holes.
for s in [-1,1]:
    vs=[];fs=[];rows=25;cols=19
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1)
            x=s*(.07+u*(.43+.68*t)+.05*math.sin(t*5+u*2))
            y=.22+.42*t+.09*math.sin(u*math.pi*5+t*4)*t
            z=2.80-2.45*t-.22*math.sin(u*19)**2*t**7
            vs.append((x,y,z))
            if r and c:
                hole=(r in [16,17,18] and c in [5,6]) or (r in [19,20,21] and c==13) or (r>19 and c in [3,10,16] and r>22-(c%3))
                if not hole:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    cape=solid(m.mesh('Capa rasgada',vs,fs,cloth,'chest'),.009)
    # Blend the lower fabric into the hips so it follows the torso's bend.
    hips=cape.vertex_groups.new(name='hips');chest=cape.vertex_groups['chest']
    for vtx in cape.data.vertices:
        w=max(0,min(.8,(2.4-vtx.co.z)/1.1));chest.add([vtx.index],1-w,'REPLACE');hips.add([vtx.index],w,'REPLACE')
    m.line('Borde de capa',[vs[r*cols+cols-1] for r in range(rows)],.006,mist,'chest',6)
    # Two attenuated wisps per side follow a continuous curved strip.
    for band in range(2):
        vs=[];fs=[]
        for r in range(33):
            t=r/32;x=s*(.50+1.08*t);y=.22+.25*t+.10*math.sin(t*math.pi*2)
            z=2.50-band*.20-.36*math.sin(t*math.pi)+.12*t
            width=.08*math.sin(math.pi*t)**.7
            vs.extend([(x,y,z-width),(x,y+.05*math.sin(t*5),z+width)])
            if r:q=(r-1)*2;fs.append((q,q+1,q+3,q+2))
        m.mesh('Velo lateral',vs,fs,mist,'chest')

# Split tabard with folds and irregular hanging strips.
vs=[];fs=[];rows=19;cols=17
for r in range(rows):
    t=r/(rows-1)
    for c in range(cols):
        u=c/(cols-1)*2-1
        x=u*(.18+.15*t);y=-.24-.09*t+.045*math.cos(u*math.pi*3)*t
        z=1.75-.98*t-.16*math.cos(c*1.8)**2*t**7
        vs.append((x,y,z))
        if r and c and not(r>12 and c in [4,10,14] and r>15-c%3):q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
solid(m.mesh('Tabardo desgarrado',vs,fs,cloth,'hips'),.008)

die(m,mat('Dado marfil espectral',(.52,.66,.74),.45,.22,.16),mat('Puntos blancos',(.7,.91,1),.1,.25,1.7))
# Raised offering hand, its die aligned with the cupped palm.
pivot=rig.data.bones['forearm.L'].head_local.copy()
turn=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-48),4,'X')@Matrix.Translation(-pivot)
handhead=rig.data.bones['hand.L'].head_local.copy();handmove=Matrix.Translation(turn@handhead-handhead)
for obj in m.parts:
    if any(g.name in ['forearm.L','hand.L'] for g in obj.vertex_groups):
        transform=handmove if 'hand.L' in obj.vertex_groups else turn
        for vtx in obj.data.vertices:vtx.co=transform@vtx.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:rig.data.edit_bones[name].transform(handmove if name=='hand.L' else turn)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig);print('FANTASMA_GEOMETRY_READY',len(mesh.data.vertices),flush=True)
bake_surfaces(mesh,'fantasma_v2');ground_fast(rig,mesh)
rig['reference']='public/mascots/fantasma.webp';rig['revision']=2
scene=bpy.context.scene;scene.render.fps=30;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'fantasma.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'fantasma.glb')
(OUT/'model.json').write_text(json.dumps({'name':'La Fantasma','revision':2,'reference':'/mascots/fantasma.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
render_review(OUT,rig,accent=(.70,.85,1),height=2,scale=4.6,face_target=3.47)
print('FANTASMA_V2_READY',flush=True)
