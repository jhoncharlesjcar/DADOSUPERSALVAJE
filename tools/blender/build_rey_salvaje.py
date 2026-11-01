"""Individual lion reference study. Outputs review candidates, never public assets."""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT, SOURCE, mat, die
from reference_pipeline import Sculpt, bake_surfaces, ground_fast, render_review
from glb_textures import deduplicate_textures

OUT=ROOT/'assets/mascots3d/rey_salvaje/revision2';OUT.mkdir(parents=True,exist_ok=True)
random.seed(125)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['Demonio_Salvaje'];rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
for obj in list(bpy.data.objects):
    if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
rig.name='El_Rey_Salvaje';bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name,color,metal,rough,furry=False):
    material=mat(name,color,metal,rough);nt=material.node_tree;n=nt.nodes;l=nt.links;p=n['Principled BSDF']
    coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=38 if furry else 75;noise.inputs['Detail'].default_value=3
    mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(3,3,.5) if furry else (1,1,1)
    l.new(coord.outputs['Object'],mapping.inputs[0]);l.new(mapping.outputs['Vector'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=tuple(c*.5 for c in color)+(1,)
    ramp.color_ramp.elements[1].color=tuple(min(1,c*1.25) for c in color)+(1,)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28 if furry else .16;bump.inputs['Distance'].default_value=.0025 if furry else .001
    l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
    return material

fur=surface('Pelaje ocre',(.32,.19,.075),0,.78,True)
lightfur=surface('Hocico marfil',(.48,.41,.26),0,.85,True)
mane=surface('Melena castaña',(.075,.032,.009),0,.82,True)
mane_light=surface('Mechas doradas',(.155,.073,.020),0,.79,True)
hair=mat('Fibras de pelo',(.29,.185,.076),0,.85)
armor=surface('Acero verde bosque',(.012,.085,.038),.65,.36)
edge=surface('Bronce patinado',(.15,.19,.075),.63,.43)
vine=surface('Enredadera',(.055,.095,.023),0,.85)
dark=mat('Nariz y labios',(.009,.008,.005),0,.65)
claw=mat('Garras oscuras',(.025,.035,.025),.25,.37)
gem=mat('Esmeralda facetada',(.008,.30,.12),.38,.19,.18)
gemlight=mat('Facetas claras',(.035,.52,.24),.38,.20,.22)
glow=mat('Runas verdes',(.075,.80,.24),.1,.4,1.3)
eye=mat('Ojos esmeralda',(.15,1,.31),0,.3,2)
m=Sculpt()

def panel(name,points,bone,material=armor,depth=.035):
    obj=m.plate(name,points,material,bone,depth)
    m.line(name+' borde',[(x,y-.012,z) for x,y,z in points+[points[0]]],.010,edge,bone)
    return obj

def crystal(name,base,tip,width,bone):
    a=Vector(base);b=Vector(tip);d=(b-a).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    vs=[];fs=[];sides=6
    for t,w in [(0,.65),(.72,1)]:
        for j in range(sides):
            angle=j*math.tau/sides;vs.append(a.lerp(b,t)+width*w*(u*math.cos(angle)+v*math.sin(angle)))
    vs.append(b)
    fs.append(tuple(reversed(range(sides))))
    for j in range(sides):k=(j+1)%sides;fs.extend([(j,k,k+sides,j+sides),(j+sides,k+sides,12)])
    obj=m.mesh(name,vs,fs,gem,bone,False);obj.data.materials.append(gemlight)
    for face in obj.data.polygons:face.material_index=1 if face.index%4==1 else 0
    return obj

def jewel(name,at,size,bone):
    x,y,z=at;w,h=size
    m.gem(name+' engaste',(x,y+.02,z),(w*1.20,h*1.13),edge,bone)
    m.gem(name,at,(w,h),gem,bone)
    m.line('Corte de esmeralda',[(x-w*.72,y-.045,z),(x,y-.085,z+h*.75),(x+w*.72,y-.045,z)],.004,gemlight,bone,6)

def rune(at,size,bone,kind=0):
    x,y,z=at
    shapes=[[[(-.3,-.5),(-.3,.5),(.3,.15),(-.3,-.05)],[(0,-.05),(.3,-.5)]],[[(-.3,.4),(0,0),(.3,.4)],[(0,0),(0,-.5)]],[[(-.3,-.4),(.3,.4)],[(-.3,.4),(-.3,-.4),(.3,-.4)]],[[(-.3,0),(0,.5),(.3,0),(0,-.5),(-.3,0)]],[[(-.3,-.5),(-.3,.5)],[(-.3,0),(.3,.4)],[(-.3,0),(.3,-.4)]]]
    for stroke in shapes[kind%5]:m.line('Sigilo real',[(x+u*size,y,z+v*size) for u,v in stroke],.005,glow,bone,6)

def tuft(name,base,tip,width,material,bone='head',fibers=3):
    a=Vector(base);b=Vector(tip);mid=a.lerp(b,.42)+Vector((0,-width*.4,.025))
    m.tube(name,[a,mid,a.lerp(b,.82),b],[width*.65,width,width*.45,.001],material,bone,10)
    for j in range(fibers):
        dx=(j-(fibers-1)/2)*width*.34
        m.tube('Hebra de '+name,[a+Vector((dx,-width*.65,.01)),mid+Vector((dx,-width*.95,0)),b+Vector((dx*.1,-.004,.012))],[.0028,.0022,.0003],hair,bone,5)

# Continuous lion skull and muzzle with broad nasal bridge and feline cheeks.
start=len(m.parts)
m.ball('Cráneo',(0,.025,3.25),(.29,.23,.31),fur)
m.ball('Frente',(0,-.12,3.42),(.235,.18,.18),fur)
for s in [-1,1]:
    m.ball('Mejilla',(s*.18,-.13,3.19),(.16,.18,.205),fur)
    m.ball('Puente nasal',(s*.065,-.26,3.24),(.09,.135,.20),fur)
    brow=m.ball('Arco superciliar',(s*.145,-.235,3.415),(.15,.065,.05),fur)
m.unify(start,'Cabeza esculpida','head',.010)
start=len(m.parts)
for s in [-1,1]:m.ball('Almohadilla de bigote',(s*.095,-.34,3.105),(.13,.105,.095),lightfur)
m.ball('Barbilla',(0,-.25,3.005),(.15,.11,.095),lightfur)
m.unify(start,'Hocico continuo','head',.009)
# Flat upper triangle and curved lobes give the characteristic lion nose.
m.ball('Base de nariz',(0,-.405,3.185),(.104,.044,.049),dark)
m.mesh('Trufa triangular',[(-.10,-.433,3.205),(.10,-.433,3.205),(.055,-.458,3.17),(0,-.463,3.13),(-.055,-.458,3.17)],[(0,1,2,3,4)],dark,'head',False)
m.line('Labio central',[(0,-.435,3.14),(0,-.43,3.075),(0,-.405,3.046)],.007,dark,'head')
for s in [-1,1]:
    m.line('Boca felina',[(0,-.414,3.06),(s*.075,-.422,3.04),(s*.15,-.37,3.075)],.006,dark,'head')
    m.ball('Órbita',(s*.15,-.30,3.36),(.096,.025,.045),dark)
    m.plate('Ojo afilado',[(s*.075,-.341,3.365),(s*.20,-.34,3.38),(s*.218,-.335,3.358),(s*.13,-.342,3.337)],eye,'head',.006)
    m.line('Párpado',[(s*.065,-.347,3.377),(s*.14,-.35,3.398),(s*.22,-.34,3.389)],.012,fur,'head')
    m.line('Marca lagrimal',[(s*.075,-.30,3.35),(s*.09,-.341,3.27),(s*.14,-.356,3.21)],.008,mane,'head')
    m.ball('Oreja',(s*.285,.0,3.48),(.105,.07,.115),fur)
    m.ball('Interior de oreja',(s*.29,-.057,3.49),(.073,.022,.078),mane)
    for row in range(3):
        for k in range(3):m.ball('Folículo',(s*(.055+k*.033),-.437+.008*k,3.11-row*.025),(.004,.003,.004),dark)
    for k in range(5):
        m.tube('Bigote',[(s*.09,-.438,3.10-k*.014),(s*.22,-.45,3.12-k*.025),(s*(.34+k*.012),-.40,3.14-k*.035)],[.0028,.0015,.0002],lightfur,'head',5)

# Dense layered mane, hanging below the jaw; small fibers break up the contour.
m.ball('Volumen de melena',(0,.075,3.19),(.44,.31,.50),mane)
# Keep the face in front of the mane. Tufts run outward and downward in three staggered layers.
for layer in range(3):
    count=30
    for k in range(count):
        a=(k+.33*layer)*math.tau/count
        x=(.31+layer*.045)*math.sin(a);z=3.25+(.32+layer*.026)*math.cos(a)
        y=-.095+layer*.085
        side=1 if x>=0 else -1
        end=(x+side*(.075+.025*layer)*abs(math.sin(a)),y-.075,z-.20-.09*abs(math.sin(a)))
        tuft('Mechón de melena',(x,y,z),end,.060+.009*layer,mane_light if (k+layer)%3 else mane,fibers=4)
for k in range(13):
    x=(k-6)*.022
    tuft('Barba',(x,-.31,2.992),(x*1.05,-.30,2.93-.012*math.cos(k)),.014,lightfur,fibers=2)

# An open crown of patinated branches, faceted emeralds and slender points.
for z,rx,ry in [(3.56,.30,.225),(3.65,.33,.245)]:
    m.line('Aro de corona',[(rx*math.sin(a),ry*math.cos(a),z+.018*math.sin(a*6)) for a in [i*math.tau/72 for i in range(73)]],.022,edge,'head',10)
for k in range(9):
    a=(k+.5)*math.tau/9;x=.32*math.sin(a);y=-.24*math.cos(a);height=.23+(.07 if k in [0,8] else 0)
    m.tube('Punta de corona',[(x*.9,y*.9,3.58),(x,y,3.72),(x*1.12,y*1.12,3.65+height)],[.025,.021,.001],edge,'head',9)
    if y<.12:jewel('Esmeralda corona',(x,y-.025,3.73),(.045,.09),'head')
    nexta=a+math.tau/9
    m.line('Arco vegetal de corona',[(x,y,3.65),(x*.98,y*.98,3.79),(.32*math.sin(nexta),-.24*math.cos(nexta),3.65)],.010,vine,'head',8)
jewel('Joya central corona',(0,-.275,3.73),(.07,.115),'head')
m.line('Soporte de punta central',[(0,-.25,3.78),(0,-.25,3.96)],.016,edge,'head',8)
jewel('Punta central corona',(0,-.25,3.96),(.043,.09),'head')
jewel('Sello frontal',(0,-.24,3.53),(.035,.057),'head')

# Muscular covered torso with gem-like armor facets instead of a bare toy belly.
m.ball('Torso',(0,.025,2.39),(.46,.25,.46),fur,'chest')
m.ball('Cintura',(0,0,1.99),(.31,.21,.30),fur,'spine')
m.ball('Cadera',(0,.025,1.63),(.36,.25,.26),fur,'hips')
m.tube('Cuello',[(0,.02,2.70),(0,.02,3.10)],[.21,.20],mane,'neck',24)
for s in [-1,1]:
    panel('Coraza pectoral',[(s*.025,-.285,2.75),(s*.35,-.19,2.77),(s*.46,-.17,2.51),(s*.20,-.29,2.36),(s*.03,-.31,2.43)],'chest')
    jewel('Faceta pectoral',(s*.235,-.28,2.57),(.16,.15),'chest')
    for k in range(3):
        z=2.38-k*.15
        panel('Placa abdominal',[(s*.02,-.28,z),(s*.24,-.22,z+.04),(s*.28,-.22,z-.07),(s*.04,-.31,z-.18)],'spine')
        m.gem('Faceta abdominal',(s*.135,-.30,z-.065),(.080,.092),gem,'spine')
    m.line('Enredadera del torso',[(s*.35,-.22,2.75),(s*.32,-.30,2.59),(s*.21,-.35,2.45),(s*.31,-.28,2.30),(s*.25,-.28,2.08),(s*.31,-.22,1.96)],.018,vine,'chest',9)
    m.line('Rama del pecho',[(s*.30,-.29,2.31),(s*.13,-.34,2.40),(s*.08,-.33,2.57)],.010,vine,'chest',7)
    panel('Cinturón',[(s*.03,-.27,1.94),(s*.31,-.18,1.99),(s*.34,-.19,1.80),(s*.03,-.31,1.74)],'hips')
    for k in range(3):rune((s*(.10+k*.07),-.315+.025*k,1.86),.075,'hips',k)
jewel('Esmeralda del pecho',(0,-.34,2.62),(.08,.14),'chest')
jewel('Hebilla real',(0,-.34,1.83),(.16,.22),'hips')
rune((0,-.44,1.84),.14,'hips',1)

for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    start=len(m.parts)
    m.ball('Hombro',(s*.61,.01,2.61),(.23,.23,.24),fur,ua)
    m.ball('Bíceps',(s*.79,0,2.38),(.19,.18,.29),fur,ua)
    m.unify(start,'Brazo esculpido',ua,.014)
    for k in range(4):
        z=2.78-k*.10
        panel('Hombrera en hojas',[(s*(.43+k*.045),-.22,z+.06),(s*(.68+k*.055),-.21,z+.08),(s*(.86+k*.035),-.17,z-.13),(s*(.60+k*.065),-.27,z-.18),(s*(.43+k*.045),-.24,z-.10)],ua,armor,.30)
    for k in range(3):
        x=s*(.61+k*.12);z=2.78-k*.04
        crystal('Cristal de hombro',(x,.04,z),(x+s*(.09+k*.035),.04,z+.32+.10*(1-k/2)),.065,ua)
        m.line('Raíz del cristal',[(x-s*.12,-.23,z-.13),(x,-.18,z-.02),(x+s*.03,.01,z+.04)],.022,vine,ua)
    jewel('Sello del hombro',(s*.45,-.29,2.73),(.065,.09),'chest')
    elbow=Vector((s*.96,0,2.16));end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    m.tube('Antebrazo',[elbow,end],[.14,.105],fur,fa,24)
    m.tube('Brazal',[elbow.lerp(end,.12),end],[.18,.13],armor,fa,24)
    d=(end-elbow).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    for t in [.14,.26,.82,1]:
        p=elbow.lerp(end,t);rad=.19-.05*t
        m.line('Anillo de brazal',[p+rad*(u*math.cos(j*math.tau/36)+v*math.sin(j*math.tau/36)) for j in range(37)],.013,edge,fa)
    crystal('Cristal del brazal',(s*1.01,-.16,2.02),(s*1.09,-.17,2.34),.055,fa)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Palma',palm,(.14,.15,.085) if s==1 else (.14,.11,.18),fur,hand)
    for k in range(4):
        x=palm.x+(k-1.5)*.07
        pts=[(x,-.61,1.98),(x,-.74,2.02),(x,-.76,2.13)] if s==1 else [(x,-.10,1.48),(x,-.16,1.32),(x,-.23,1.29)]
        m.tube('Dedo felino',pts,[.033,.031,.023],fur,hand,12)
        endclaw=Vector(pts[-1])+Vector((0,.03,.075) if s==1 else (0,-.04,.04))
        m.tube('Garra de mano',[pts[-1],endclaw],[.024,.001],claw,hand,10)
    m.tube('Pulgar',[(palm.x-s*.11,palm.y,palm.z),(palm.x-s*.20,palm.y-.07,palm.z-.04),(palm.x-s*.21,palm.y-.14,palm.z+.025)],[.043,.033,.003],fur,hand,12)
    m.ball('Muslo',(s*.32,.015,1.25),(.22,.22,.36),fur,th)
    for k in range(2):
        z=1.73-k*.21
        panel('Faldón lateral',[(s*.19,-.25,z),(s*.40,-.16,z+.025),(s*.55,-.14,z-.27),(s*.29,-.27,z-.22)],th)
        rune((s*.33,-.29,z-.12),.11,th,k)
    m.tube('Pierna',[(s*.38,.015,.95),(s*.40,.015,.25)],[.17,.125],fur,sh,24)
    panel('Rodillera',[(s*.22,-.16,1.03),(s*.37,-.23,1.18),(s*.54,-.16,1.02),(s*.48,-.23,.82),(s*.38,-.27,.75),(s*.24,-.22,.84)],sh)
    jewel('Cristal de rodilla',(s*.38,-.26,.98),(.11,.16),sh)
    panel('Greba tallada',[(s*.24,-.19,.77),(s*.52,-.17,.77),(s*.50,-.17,.31),(s*.40,-.24,.23),(s*.29,-.21,.31)],sh)
    m.line('Rama de greba',[(s*.29,-.23,.28),(s*.45,-.23,.45),(s*.32,-.24,.64),(s*.47,-.22,.77)],.018,vine,sh)
    m.ball('Pata de león',(s*.4,-.13,.14),(.20,.27,.13),fur,foot)
    for k in range(4):
        x=s*.4+(k-1.5)*.088
        m.ball('Dedo de pata',(x,-.31,.12),(.057,.11,.083),fur,foot)
        m.tube('Uña de pata',[(x,-.38,.12),(x,-.43,.10),(x,-.46,.045)],[.024,.020,.001],claw,foot,10)
    # Small tufts on exposed limbs prevent smooth plastic-looking boundaries.
    for k in range(8):
        x=s*(.24+random.random()*.19);z=1.14+random.random()*.30
        tuft('Pelo del muslo',(x,-.19,z),(x+s*.02,-.20,z-.08),.018,fur,th,1)
    for k in range(7):
        x=s*(.71+random.random()*.13);z=2.29+random.random()*.13
        tuft('Pelo del brazo',(x,-.17,z),(x+s*.035,-.17,z-.075),.017,fur,ua,1)

# Split hanging armor, the illustration has no broad fabric cape.
for k in range(3):
    z=1.70-k*.14
    panel('Tabardo laminado',[(-.15,-.31,z),(.15,-.31,z),(.11,-.35,z-.15),(0,-.38,z-.25),(-.11,-.35,z-.15)],'hips')
    m.gem('Faceta del tabardo',(0,-.38,z-.10),(.07,.11),gem,'hips')
for s in [-1,0,1]:
    x=s*.15;z=1.29
    panel('Tira ceremonial',[(x-.045,-.30,z),(x+.045,-.30,z),(x+.04,-.34,.78),(x,-.35,.66+abs(s)*.08),(x-.04,-.34,.78)],'hips',armor,.02)
    for k in range(4):rune((x,-.37,1.20-k*.12),.065,'hips',k+abs(s))

# Smooth curling tail, with a fiber-covered tuft at its tip.
tail=[]
for i in range(33):
    t=i/32
    tail.append((1.07*math.sin(t*math.pi*.55),.27+.33*math.sin(t*math.pi*.7),1.61-.72*math.sin(t*math.pi)+.02*t))
m.tube('Cola curva',tail,[.052-.022*i/32 for i in range(33)],fur,'hips',14)
tip=Vector(tail[-1])
for k in range(13):
    a=k*math.tau/13;base=tip+Vector((.04*math.cos(a),.04*math.sin(a),-.015))
    tuft('Borla de cola',base,tip+Vector((.025*math.cos(a),.025*math.sin(a),.23)),.035,mane_light,'hips',2)

die_start=len(m.parts)
die(m,mat('Dado esmeralda',(.012,.24,.075),.40,.23,.08),mat('Puntos verdes',(.20,.85,.36),.1,.3,1.3))
center=Vector((1.10,-.59,2.30))
for obj in m.parts[die_start:]:
    for vx in obj.data.vertices:vx.co=center+(vx.co-center)*.90
pivot=rig.data.bones['forearm.L'].head_local.copy();turn=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-56),4,'X')@Matrix.Translation(-pivot)
head=rig.data.bones['hand.L'].head_local.copy();handmove=Matrix.Translation(turn@head-head)
for obj in m.parts:
    if any(g.name in ['forearm.L','hand.L'] for g in obj.vertex_groups):
        transform=handmove if 'hand.L' in obj.vertex_groups else turn
        for vx in obj.data.vertices:vx.co=transform@vx.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:rig.data.edit_bones[name].transform(handmove if name=='hand.L' else turn)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig);print('REY_GEOMETRY_READY',len(mesh.data.vertices),flush=True)
bake_surfaces(mesh,'rey_salvaje_v2');ground_fast(rig,mesh)
rig['reference']='public/mascots/rey_salvaje.webp';rig['revision']=2
scene=bpy.context.scene;scene.render.fps=30;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'rey_salvaje.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'rey_salvaje.glb')
(OUT/'model.json').write_text(json.dumps({'name':'El Rey Salvaje','revision':2,'reference':'/mascots/rey_salvaje.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
render_review(OUT,rig,accent=(.10,1,.38),height=2,scale=4.7,face_target=3.37)
print('REY_V2_READY',flush=True)
