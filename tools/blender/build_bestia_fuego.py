"""Bestia de Fuego reference study. Outputs candidates, never public assets."""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT, SOURCE, mat, die
from reference_pipeline import Sculpt, bake_surfaces, ground_fast, render_review
from glb_textures import deduplicate_textures

OUT=ROOT/'assets/mascots3d/bestia_fuego/revision2';OUT.mkdir(parents=True,exist_ok=True)
random.seed(187)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['Demonio_Salvaje'];rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
for obj in list(bpy.data.objects):
    if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
rig.name='Bestia_de_Fuego';bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name,color,metal,rough,furry=False):
    material=mat(name,color,metal,rough);n=material.node_tree.nodes;l=material.node_tree.links;p=n['Principled BSDF']
    coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(3,3,.6) if furry else (1,1,1)
    l.new(coord.outputs['Object'],mapping.inputs[0]);noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=52 if furry else 100;noise.inputs['Detail'].default_value=2
    l.new(mapping.outputs['Vector'],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=tuple(c*.65 for c in color)+(1,);ramp.color_ramp.elements[1].color=tuple(min(1,c*1.15) for c in color)+(1,)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.20;bump.inputs['Distance'].default_value=.0018 if furry else .001
    l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal']);return material

fur=surface('Pelaje rojo anaranjado',(.40,.095,.016),0,.78,True)
darkfur=surface('Pelaje oscuro',(.045,.018,.008),0,.82,True)
ivory=surface('Pelaje marfil',(.55,.49,.36),0,.86,True)
hair=mat('Hebras doradas',(.40,.19,.055),0,.83)
armor=surface('Cobre envejecido',(.18,.052,.018),.65,.38)
edge=surface('Grabados de bronce',(.42,.22,.065),.70,.34)
under=surface('Cuero oscuro',(.024,.012,.008),0,.84)
black=mat('Nariz y labios',(.006,.005,.004),0,.6)
claw=mat('Garras de obsidiana',(.014,.010,.009),.15,.37)
eye=mat('Ojos ámbar',(.95,.38,.012),0,.30,2)
ember=mat('Surcos incandescentes',(.95,.16,.007),.1,.4,1.6)
flame=mat('Llama exterior',(.95,.09,.004),0,.45,2.4)
heart=mat('Núcleo de llama',(1,.52,.045),0,.4,2.8)
m=Sculpt()

def panel(name,points,bone,material=armor,depth=.035):
    obj=m.plate(name,points,material,bone,depth)
    m.line(name+' ribete',[(x,y-.010,z) for x,y,z in points+[points[0]]],.009,edge,bone);return obj

def tuft(name,base,tip,width,material,bone='head',fibers=2):
    a=Vector(base);b=Vector(tip);mid=a.lerp(b,.43)+Vector((0,-width*.35,.012))
    m.tube(name,[a,mid,a.lerp(b,.82),b],[width*.6,width,width*.4,.0007],material,bone,9)
    for j in range(fibers):
        dx=(j-(fibers-1)/2)*width*.4
        m.tube('Hebra',[a+Vector((dx,-width*.65,.005)),mid+Vector((dx,-width*.95,0)),b+Vector((dx*.1,-.003,0))],[.002,.0017,.0002],ivory if material==ivory else hair,bone,5)

def tongues(base,height,width,bone,lean=0):
    """Curved tapered ribbons, with warm inner cores; no smoke simulation."""
    origin=Vector(base)
    for layer,material,mult,depth in [(0,flame,1,0),(1,heart,.53,-.008)]:
        vs=[];fs=[];rows=19;cols=5
        for r in range(rows):
            t=r/(rows-1);h=height*(1 if layer==0 else .72)
            center=origin+Vector((lean*t+width*.6*math.sin(t*math.pi*2),depth+.04*math.sin(t*math.pi),h*t))
            w=width*mult*math.sin(math.pi*(.12+.88*t))**.8
            for c in range(cols):
                u=c/(cols-1)*2-1;vs.append(center+Vector((w*u,-.012*(1-u*u),0)))
                if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
        m.mesh('Lengua de fuego',vs,fs,material,bone)

def flame_mark(at,size,bone,material=ember):
    x,y,z=at
    pts=[(0,-.5),(-.30,-.15),(-.24,.17),(-.08,.0),(.08,.50),(.32,.08),(.27,-.23),(0,-.5)]
    m.line('Grabado de llama',[(x+u*size,y,z+v*size) for u,v in pts],.005,material,bone,6)
    m.line('Núcleo grabado',[(x,y,z-size*.28),(x+size*.08,y,z),(x,y,z+size*.17)],.004,material,bone,6)

# Narrow fox head: tapered snout, white cheeks, dark muzzle seam and pointed ears.
start=len(m.parts)
m.ball('Cráneo',(0,.025,3.28),(.255,.215,.29),fur)
m.ball('Frente',(0,-.105,3.40),(.205,.145,.16),fur)
for s in [-1,1]:
    m.ball('Pómulo',(s*.17,-.115,3.18),(.135,.13,.17),fur)
    m.ball('Puente del hocico',(s*.045,-.255,3.22),(.066,.15,.105),fur)
m.unify(start,'Cabeza esculpida','head',.010)
start=len(m.parts)
for s in [-1,1]:
    m.ball('Mejilla blanca',(s*.17,-.15,3.12),(.13,.12,.105),ivory)
    m.ball('Hocico blanco',(s*.045,-.33,3.13),(.068,.14,.06),ivory)
m.ball('Barbilla',(0,-.26,3.055),(.10,.12,.055),ivory)
m.unify(start,'Hocico blanco continuo','head',.009)
m.ball('Nariz',(0,-.464,3.185),(.060,.031,.036),black)
m.mesh('Trufa triangular',[(-.058,-.486,3.20),(.058,-.486,3.20),(0,-.497,3.15)],[(0,1,2)],black,'head',False)
m.line('Labio central',[(0,-.479,3.16),(0,-.463,3.12),(0,-.42,3.09)],.005,black,'head')
for s in [-1,1]:
    m.line('Boca',[(0,-.43,3.09),(s*.065,-.39,3.075),(s*.15,-.28,3.095)],.005,black,'head')
    m.ball('Órbita',(s*.135,-.234,3.345),(.071,.025,.036),darkfur)
    m.plate('Ojo afilado',[(s*.075,-.270,3.346),(s*.182,-.266,3.368),(s*.19,-.264,3.344),(s*.12,-.272,3.325)],eye,'head',.006)
    m.line('Párpado',[(s*.066,-.275,3.355),(s*.13,-.279,3.38),(s*.20,-.25,3.38)],.012,fur,'head')
    m.line('Marca ocular',[(s*.075,-.27,3.33),(s*.105,-.286,3.26),(s*.17,-.24,3.23)],.007,darkfur,'head')
    # Three-dimensional ear shell, with inset triangular interior and fine fur.
    shell=m.mesh('Oreja puntiaguda',[(s*.12,-.04,3.46),(s*.33,.02,3.96),(s*.37,.07,3.43),(s*.245,-.09,3.65),(s*.25,.10,3.64)],[(0,1,3),(1,2,3),(2,0,3),(0,4,1),(1,4,2),(2,4,0)],fur,'head')
    m.plate('Interior de oreja',[(s*.17,-.115,3.50),(s*.32,-.04,3.87),(s*.325,-.095,3.50)],darkfur,'head',.012)
    for k in range(6):
        t=k/5;tuft('Pelo de oreja',(s*(.185+.10*t),-.125+.045*t,3.52+.22*t),(s*(.22+.095*t),-.123+.045*t,3.57+.23*t),.010,ivory,fibers=1)
    for row in range(3):
        for k in range(6):
            x=s*(.14+k*.023);z=3.23-row*.052
            tuft('Mechón de mejilla',(x,-.18+row*.018,z),(x+s*.065,-.17+row*.012,z-.075),.025,fur if row==0 else ivory,fibers=2)
    for k in range(4):
        m.tube('Bigote',[(s*.075,-.42,3.13-k*.011),(s*.19,-.41,3.15-k*.018),(s*.30,-.34,3.17-k*.025)],[.0018,.0012,.0002],ivory,'head',5)
for row in range(5):
    theta=.35+row*.18
    for k in range(9):
        a=(k-4)*.19
        def on_forehead(t):return Vector((.212*math.sin(t)*math.sin(a),-.105-.153*math.sin(t)*math.cos(a),3.40+.166*math.cos(t)))
        base=on_forehead(theta);tip=on_forehead(max(.05,theta-.25))+Vector((0,-.006,.004))
        tuft('Pelo de frente',base,tip,.011,fur,fibers=1)
m.tube('Cuello oscuro',[(0,.02,2.72),(0,.02,3.12)],[.19,.17],darkfur,'neck',24)
for k in range(15):
    a=(k/14-.5)*math.pi; x=.18*math.sin(a);y=-.15*math.cos(a)
    tuft('Gorguera',(x,y,3.04),(x*1.17,y-.015,2.94+.02*abs(math.sin(a))),.023,darkfur,'neck',2)
for k in range(7):
    x=(k-3)*.045;tongues((x,.06,3.48),.35+.14*(1-abs(k-3)/3),.045,'head',lean=.04*(1 if k%2 else -1))

# Close-fitting bronze plates with curved ribs and branching ember inlays.
m.ball('Torso',(0,.025,2.40),(.43,.245,.44),fur,'chest')
m.ball('Cintura',(0,.01,2.0),(.29,.21,.29),under,'spine')
m.ball('Cadera',(0,.02,1.64),(.34,.23,.25),fur,'hips')
for s in [-1,1]:
    vs=[];fs=[];rows=11;cols=19
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);x=s*(.025+.38*u);y=-.28+.08*u*u-.04*math.sin(math.pi*t);z=2.78-.42*t-.13*u*t
            vs.append((x,y,z))
            if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    obj=m.mesh('Coraza curva',vs,fs,armor,'chest');mod=obj.modifiers.new('Espesor','SOLIDIFY');mod.thickness=.035;bpy.ops.object.modifier_apply(modifier=mod.name)
    for row in [0,rows-1]:m.line('Ribete de coraza',[(x,y-.012,z) for x,y,z in vs[row*cols:(row+1)*cols]],.011,edge,'chest')
    m.line('Nervadura incandescente',[(s*.025,-.33,2.41),(s*.14,-.34,2.53),(s*.25,-.30,2.55),(s*.36,-.25,2.67)],.009,ember,'chest')
    m.line('Grabado del pecho',[(s*.07,-.33,2.74),(s*.12,-.34,2.65),(s*.22,-.32,2.67),(s*.30,-.28,2.74)],.005,edge,'chest')
    for k in range(3):
        z=2.37-k*.16
        panel('Lámina abdominal',[(s*.02,-.29,z),(s*.24,-.21,z+.06),(s*.29,-.22,z-.06),(s*.04,-.32,z-.18)],'spine')
        m.line('Surco abdominal',[(s*.035,-.34,z-.12),(s*.10,-.34,z-.035),(s*.21,-.28,z+.015)],.006,ember,'spine')
    panel('Cinturón',[(s*.025,-.27,1.96),(s*.30,-.18,2.0),(s*.33,-.19,1.81),(s*.025,-.31,1.76)],'hips')
    for k in range(3):flame_mark((s*(.10+k*.07),-.32+k*.025,1.88),.065,'hips',edge)
panel('Peto de llama',[(-.12,-.32,2.77),(0,-.35,2.87),(.12,-.32,2.77),(.08,-.35,2.53),(0,-.37,2.43),(-.08,-.35,2.53)],'chest')
flame_mark((0,-.40,2.67),.26,'chest')
panel('Hebilla',[(-.16,-.31,1.87),(0,-.36,2.02),(.16,-.31,1.87),(0,-.38,1.66)],'hips')
flame_mark((0,-.42,1.86),.19,'hips')

for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    start=len(m.parts)
    m.ball('Hombro',(s*.61,.01,2.61),(.22,.22,.23),fur,ua)
    m.ball('Bíceps',(s*.79,0,2.38),(.18,.17,.28),fur,ua)
    m.unify(start,'Brazo esculpido',ua,.014)
    for k in range(3):
        z=2.80-k*.11
        panel('Hombrera de cobre',[(s*(.43+k*.05),-.23,z+.05),(s*(.67+k*.06),-.22,z+.07),(s*(.86+k*.04),-.17,z-.12),(s*(.60+k*.07),-.28,z-.18),(s*(.43+k*.05),-.25,z-.11)],ua,armor,.36)
        flame_mark((s*(.62+k*.06),-.30,z-.04),.09,ua,edge)
    for k in range(3):tongues((s*(.58+k*.10),.035,2.80-k*.035),.24+.09*(k%2),.050,ua,lean=s*.05)
    m.ball('Broche',(s*.38,-.22,2.78),(.072,.025,.080),edge,'chest')
    m.ball('Centro de broche',(s*.38,-.25,2.78),(.053,.010,.061),armor,'chest')
    flame_mark((s*.38,-.27,2.78),.085,'chest')
    elbow=Vector((s*.96,0,2.16));end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    m.tube('Antebrazo',[elbow,end],[.13,.10],fur,fa,24)
    m.tube('Brazal',[elbow.lerp(end,.12),end],[.17,.12],armor,fa,24)
    d=(end-elbow).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    for t in [.13,.26,.83,1]:
        p=elbow.lerp(end,t);rad=.18-.05*t
        m.line('Anillo de brazal',[p+rad*(u*math.cos(j*math.tau/32)+v*math.sin(j*math.tau/32)) for j in range(33)],.010,edge,fa)
    panel('Frente del brazal',[(s*.84,-.12,2.16),(s*.94,-.17,2.29),(s*1.10,-.12,2.12),(s*1.17,end.y-.12,end.z),(s*1.04,end.y-.15,end.z-.04)],fa)
    flame_mark((s*.99,-.21,2.08),.17,fa)
    tongues((s*1.02,-.15,2.18),.24,.043,fa,lean=s*.04)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Palma',palm,(.13,.14,.075) if s==1 else (.13,.10,.16),darkfur,hand)
    for k in range(4):
        x=palm.x+(k-1.5)*.064
        pts=[(x,-.61,1.98),(x,-.73,2.03),(x,-.75,2.13)] if s==1 else [(x,-.10,1.48),(x,-.15,1.33),(x,-.23,1.30)]
        m.tube('Dedo',pts,[.030,.027,.019],darkfur,hand,12)
        m.tube('Garra',[pts[-1],Vector(pts[-1])+Vector((0,.025,.065) if s==1 else (0,-.025,.035))],[.021,.001],claw,hand,10)
    m.tube('Pulgar',[(palm.x-s*.10,palm.y,palm.z),(palm.x-s*.18,palm.y-.07,palm.z-.04),(palm.x-s*.19,palm.y-.14,palm.z+.02)],[.038,.03,.001],darkfur,hand,12)
    m.ball('Muslo',(s*.31,.01,1.25),(.21,.22,.36),fur,th)
    for k in range(3):
        z=1.74-k*.18
        panel('Faldón lateral',[(s*.17,-.24,z),(s*.37,-.16,z+.03),(s*.52,-.13,z-.25),(s*.26,-.26,z-.21)],th)
        flame_mark((s*.31,-.285,z-.10),.09,th,edge)
    m.tube('Pierna',[(s*.38,.01,.95),(s*.40,.01,.24)],[.16,.11],fur,sh,24)
    panel('Rodillera',[(s*.23,-.17,1.03),(s*.38,-.23,1.17),(s*.53,-.17,1.03),(s*.47,-.24,.83),(s*.38,-.27,.76),(s*.25,-.23,.84)],sh)
    flame_mark((s*.38,-.29,.98),.19,sh)
    panel('Greba',[(s*.25,-.18,.78),(s*.51,-.17,.78),(s*.48,-.18,.30),(s*.39,-.24,.23),(s*.29,-.21,.31)],sh)
    m.line('Surco de greba',[(s*.37,-.265,.27),(s*.42,-.25,.43),(s*.32,-.25,.56),(s*.40,-.245,.72)],.007,ember,sh)
    m.ball('Pata de zorro',(s*.4,-.13,.13),(.17,.25,.12),fur,foot)
    for k in range(4):
        x=s*.4+(k-1.5)*.078
        m.ball('Dedo de pata',(x,-.30,.11),(.048,.10,.075),fur,foot)
        m.tube('Uña de pata',[(x,-.36,.12),(x,-.42,.08),(x,-.44,.035)],[.022,.018,.001],claw,foot,10)
    for k in range(14):
        x=s*(.23+random.random()*.19);z=1.10+random.random()*.37
        tuft('Pelo de muslo',(x,-.19,z),(x+s*.035,-.20,z-.09),.020,fur,th,1)
    for k in range(10):
        x=s*(.70+random.random()*.14);z=2.26+random.random()*.18
        tuft('Pelo de brazo',(x,-.16,z),(x+s*.03,-.17,z-.08),.018,fur,ua,1)
panel('Tabardo',[(-.15,-.30,1.64),(.15,-.30,1.64),(.13,-.35,.89),(0,-.38,.70),(-.13,-.35,.89)],'hips',under,.025)
for s in [-1,1]:
    m.line('Bordado de tabardo',[(s*.11,-.33,1.57),(s*.09,-.38,.94),(0,-.40,.78)],.005,edge,'hips')
    for k in range(3):flame_mark((s*.055,-.40,1.42-k*.17),.070,'hips',edge)

# Voluminous sweeping tail with a real ivory tip, separated by overlapping tufts.
tail=[];radii=[]
for i in range(33):
    t=i/32;tail.append((1.28*t,.27+.33*math.sin(math.pi*t*.85),1.60-.67*math.sin(math.pi*t)+.02*t))
    radii.append(.09+.20*math.sin(math.pi*t)**.8 if i<32 else .003)
split=23
m.tube('Cola roja',tail[:split+1],radii[:split+1],fur,'hips',28)
m.tube('Punta blanca',tail[split:],radii[split:],ivory,'hips',28)
for i in range(4,31,2):
    center=Vector(tail[i]);direction=(Vector(tail[min(32,i+2)])-Vector(tail[max(0,i-2)])).normalized()
    for k in range(7):
        a=(k/6-.5)*math.pi*1.4;normal=Vector((0,-math.cos(a),math.sin(a)))
        base=center+normal*radii[i]*.93
        tuft('Mechón de cola',base,base+direction*.16+normal*.035,.029,ivory if i>=22 else fur,'hips',2)
for k in range(3):tongues((.72+k*.13,.55,1.12+k*.025),.22,.043,'hips',lean=.07)

die_start=len(m.parts)
die(m,mat('Dado de fuego',(.65,.15,.012),.35,.25,.25),mat('Puntos dorados',(1,.67,.13),.05,.30,1.6))
center=Vector((1.10,-.59,2.30))
for obj in m.parts[die_start:]:
    for vx in obj.data.vertices:vx.co=center+(vx.co-center)*.90
for k in range(5):
    a=k*math.tau/5;tongues((1.10+.15*math.sin(a),-.59+.15*math.cos(a),2.40),.16+.04*(k%2),.032,'hand.L',lean=.02*math.sin(a))
pivot=rig.data.bones['forearm.L'].head_local.copy();turn=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-56),4,'X')@Matrix.Translation(-pivot)
head=rig.data.bones['hand.L'].head_local.copy();handmove=Matrix.Translation(turn@head-head)
for obj in m.parts:
    if any(g.name in ['forearm.L','hand.L'] for g in obj.vertex_groups):
        transform=handmove if 'hand.L' in obj.vertex_groups else turn
        for vx in obj.data.vertices:vx.co=transform@vx.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:rig.data.edit_bones[name].transform(handmove if name=='hand.L' else turn)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig);print('BESTIA_GEOMETRY_READY',len(mesh.data.vertices),flush=True)
bake_surfaces(mesh,'bestia_fuego_v2');ground_fast(rig,mesh)
rig['reference']='public/mascots/bestia_fuego.webp';rig['revision']=2
scene=bpy.context.scene;scene.render.fps=30;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'bestia_fuego.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'bestia_fuego.glb')
(OUT/'model.json').write_text(json.dumps({'name':'Bestia de Fuego','revision':2,'reference':'/mascots/bestia_fuego.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
render_review(OUT,rig,accent=(1,.22,.035),height=2,scale=4.8,face_target=3.40)
print('BESTIA_V2_READY',flush=True)
