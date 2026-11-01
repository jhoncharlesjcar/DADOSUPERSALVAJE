"""Emperador del Viento, reference revision 2. Candidate outputs only."""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT, SOURCE, mat, die
from reference_pipeline import Sculpt, bake_surfaces, ground_fast, render_review
from glb_textures import deduplicate_textures

OUT=ROOT/'assets/mascots3d/emperador_viento/revision2';OUT.mkdir(parents=True,exist_ok=True)
random.seed(164)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['Demonio_Salvaje'];rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
for obj in list(bpy.data.objects):
    if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
rig.name='Emperador_del_Viento';bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name,color,metal,rough):
    material=mat(name,color,metal,rough);n=material.node_tree.nodes;l=material.node_tree.links;p=n['Principled BSDF']
    coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=110;noise.inputs['Detail'].default_value=2
    l.new(coord.outputs['Object'],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=tuple(c*.75 for c in color)+(1,);ramp.color_ramp.elements[1].color=tuple(c*1.15 for c in color)+(1,)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.15;bump.inputs['Distance'].default_value=.001
    l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal']);return material

armor=surface('Acero guinda',(.16,.022,.048),.62,.35)
edge=mat('Grabados de cobre rosado',(.34,.15,.20),.65,.37)
darkmetal=surface('Acero oscuro',(.045,.020,.032),.60,.44)
cloth=surface('Tejido borgoña',(.080,.008,.022),.02,.87)
black=mat('Órbita negra',(.003,.004,.006),0,.85)
plume=surface('Plumas de grafito',(.028,.033,.040),.05,.73)
silver=surface('Plumas grises',(.13,.145,.15),.04,.70)
shaft=mat('Raquis de plumas',(.16,.17,.17),.06,.66)
skin=surface('Escamas de las garras',(.035,.032,.037),.03,.66)
beakmat=surface('Queratina del pico',(.020,.028,.038),.10,.38)
cere=mat('Cera del pico',(.33,.27,.095),.05,.58)
glow=mat('Sellos de viento',(.85,.14,.32),.08,.35,1.3)
eye=mat('Iris carmesí',(.95,.018,.13),0,.32,1.8)
m=Sculpt()

def solid(obj,thickness=.018):
    mod=obj.modifiers.new('Espesor','SOLIDIFY');mod.thickness=thickness;bpy.ops.object.modifier_apply(modifier=mod.name);return obj

def panel(name,points,bone,material=armor,depth=.035):
    obj=m.plate(name,points,material,bone,depth)
    m.line(name+' borde',[(x,y-.010,z) for x,y,z in points+[points[0]]],.009,edge,bone);return obj

def feather(name,base,tip,width,bone,material=plume,normal=(0,-1,0),detail=False):
    a=Vector(base);b=Vector(tip);d=(b-a).normalized();n=Vector(normal).normalized();u=d.cross(n).normalized()
    vs=[];fs=[];rows=8;cols=5
    for r in range(rows):
        t=r/(rows-1);w=width*(math.sin(math.pi*t)**.70+.015)
        for c in range(cols):
            v=c/(cols-1)*2-1
            vs.append(a.lerp(b,t)+u*w*v+n*(.012*(1-v*v)*math.sin(math.pi*t)+.018*t*t))
            if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    obj=m.mesh(name,vs,fs,material,bone)
    m.line('Raquis', [a+n*.003,a.lerp(b,.48)+n*.018,b+n*.019],.0025,shaft if material in [plume,silver] else edge,bone,5)
    if detail:
        for k in range(1,6):
            t=k/7;w=width*math.sin(math.pi*t)**.70
            for s in [-1,1]:m.line('Barbas de pluma',[a.lerp(b,t)+n*.018,a.lerp(b,t+.09)+u*w*s*.82+n*.012],.0015,shaft,bone,4)
    return obj

def spiral(at,radius,bone,material=edge,turns=1.4):
    x,y,z=at;pts=[]
    for i in range(33):
        t=i/32;a=t*math.tau*turns;r=radius*(1-.85*t);pts.append((x+r*math.cos(a),y,z+r*math.sin(a)))
    m.line('Filigrana espiral',pts,.0045,material,bone,6)

def windseal(at,size,bone):
    x,y,z=at
    for k in range(4):
        r=size*(.5-.105*k);h=z+size*(.32-.20*k)
        m.line('Sello de viento',[(x+r*math.cos(a),y,h+r*.30*math.sin(a)) for a in [j*math.tau/24 for j in range(25)]],.0045,glow,bone,6)
    m.line('Cola del sello',[(x,y,z-size*.35),(x+.04*size,y,z-size*.60),(x-.08*size,y,z-size*.72)],.004,glow,bone,6)

# Streamlined eagle skull. The forehead overhang and hooked beak define the silhouette.
start=len(m.parts)
m.ball('Cráneo de águila',(0,.015,3.30),(.255,.235,.285),plume)
m.ball('Frente',(0,-.10,3.45),(.235,.17,.145),plume)
m.ball('Mandíbula',(0,-.12,3.17),(.19,.18,.16),plume)
m.unify(start,'Cabeza esculpida','head',.012)
m.tube('Cuello emplumado',[(0,.035,2.76),(0,.025,3.23)],[.18,.20],plume,'neck',28)
# Contour feathers point backward from the crown and downward on cheeks and neck.
for row in range(7):
    for k in range(15):
        a=(k+.45*(row%2))*math.tau/15
        z=3.59-row*.055;f=math.sqrt(max(.07,1-((z-3.30)/.31)**2));rx=.282*f;ry=.255*f
        base=(rx*math.sin(a),-.015+ry*math.cos(a),z)
        tip=(base[0]*1.04,base[1]+.065,z-.13)
        if base[1]<-.14 and row in [3,4]:continue
        feather('Pluma de cabeza',base,tip,.037,'head',silver if row==0 or k%5==0 else plume,normal=(math.sin(a),math.cos(a),.1))
for row in range(4):
    for k in range(7):
        x=(k-3)*.047;y=-.18+row*.055;z=3.585-.10*(x/.24)**2-.02*row
        feather('Pluma de coronilla',(x,y,z),(x*1.06,y+.12,z-.025),.027,'head',silver if (k+row)%4==0 else plume,normal=(0,-.15,1),detail=True)
for row in range(4):
    for k in range(16):
        a=(k+.5*(row%2))*math.tau/16;z=3.17-row*.085
        base=(.185*math.sin(a),.025+.175*math.cos(a),z)
        feather('Pluma del cuello',base,(base[0]*1.14,base[1]*1.10,z-.17),.040,'neck',silver if k%4==0 else plume,normal=(math.sin(a),math.cos(a),0))
# Broad cere, curved upper bill, dark tip and a separate lower mandible.
m.ball('Cera',(0,-.245,3.33),(.115,.095,.080),cere)
m.tube('Pico ganchudo',[(0,-.27,3.32),(0,-.37,3.34),(0,-.47,3.30),(0,-.51,3.23),(0,-.49,3.13)],[.10,.105,.075,.041,.001],beakmat,'head',28)
m.tube('Mandíbula inferior',[(0,-.25,3.23),(0,-.37,3.22),(0,-.445,3.215)],[.071,.048,.002],beakmat,'head',24)
for s in [-1,1]:
    m.ball('Orificio nasal',(s*.075,-.315,3.35),(.014,.018,.010),black)
    m.ball('Órbita',(s*.175,-.196,3.385),(.080,.035,.046),black)
    m.ball('Iris',(s*.174,-.231,3.383),(.024,.012,.021),eye)
    m.ball('Pupila',(s*.175,-.243,3.383),(.008,.004,.015),black)
    m.line('Ceja de águila',[(s*.088,-.245,3.401),(s*.17,-.24,3.417),(s*.245,-.17,3.44)],.019,plume,'head')
    for k in range(4):
        feather('Pluma facial',(s*(.17+k*.018),-.14,3.33-k*.035),(s*(.24+k*.012),-.105,3.19-k*.035),.026,'head',silver if k==0 else plume,detail=True)

m.ball('Torso',(0,.025,2.42),(.41,.24,.43),plume,'chest')
m.ball('Cintura',(0,.01,2.02),(.29,.21,.30),cloth,'spine')
m.ball('Cadera',(0,.015,1.64),(.33,.23,.25),cloth,'hips')
for s in [-1,1]:
    # Curved, close-fitting breastplates keep the engraved scrolls on their surface.
    vs=[];fs=[];rows=11;cols=19
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);x=s*(.025+.38*u);y=-.29+.09*u*u-.025*math.sin(math.pi*t)
            z=2.79-.42*t-.12*u*t;vs.append((x,y,z))
            if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    solid(m.mesh('Coraza curva',vs,fs,armor,'chest'),.035)
    for row in [0,rows-1]:m.line('Ribete del pecho',[(x,y-.012,z) for x,y,z in vs[row*cols:(row+1)*cols]],.009,edge,'chest')
    spiral((s*.215,-.325,2.57),.10,'chest')
    for k in range(3):
        z=2.36-k*.16
        panel('Lámina abdominal',[(s*.025,-.29,z),(s*.25,-.21,z+.055),(s*.29,-.22,z-.07),(s*.04,-.32,z-.18)],'spine')
        spiral((s*.13,-.34,z-.045),.055,'spine',turns=1.2)
    panel('Cinturón',[(s*.02,-.28,1.96),(s*.30,-.18,2.0),(s*.33,-.19,1.82),(s*.025,-.31,1.76)],'hips')
    for k in range(3):spiral((s*(.095+k*.075),-.32+k*.024,1.88),.023,'hips',turns=1)
    panel('Cuello alto',[(s*.17,.10,2.76),(s*.20,.09,3.04),(s*.27,.10,3.08),(s*.38,.13,2.78)],'chest')
panel('Peto triangular',[(-.13,-.325,2.79),(.13,-.325,2.79),(0,-.36,2.45)],'chest')
windseal((0,-.375,2.68),.14,'chest')
panel('Hebilla',[(-.18,-.31,1.86),(0,-.37,2.02),(.18,-.31,1.86),(0,-.39,1.65)],'hips')
windseal((0,-.43,1.85),.15,'hips')

for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    start=Vector((s*.60,0,2.63));elbow=Vector((s*.96,0,2.16))
    m.tube('Brazo',[start,elbow],[.17,.13],plume,ua,24)
    for row in range(4):
        p=start.lerp(elbow,.27+row*.17)
        for k in range(10):
            a=k*math.tau/10;base=p+Vector((.14*math.sin(a),.15*math.cos(a),.035))
            feather('Pluma de brazo',base,base+Vector((s*.075,.015,-.17)),.037,ua,silver if k%5==0 else plume,normal=(math.sin(a),math.cos(a),0))
    for layer in range(3):
        z=2.80-layer*.11
        panel('Hombrera laminada',[(s*(.43+layer*.055),-.23,z+.04),(s*(.67+layer*.06),-.22,z+.06),(s*(.85+layer*.04),-.17,z-.13),(s*(.60+layer*.07),-.28,z-.18),(s*(.43+layer*.055),-.25,z-.11)],ua,armor,.38)
        spiral((s*(.63+layer*.055),-.30,z-.04),.055,ua)
    m.ball('Broche de capa',(s*.38,-.23,2.78),(.075,.025,.085),edge,'chest')
    m.ball('Sello del broche',(s*.38,-.259,2.78),(.058,.010,.069),armor,'chest')
    windseal((s*.38,-.275,2.79),.075,'chest')
    end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    m.tube('Antebrazo',[elbow,end],[.135,.10],plume,fa,24)
    m.tube('Brazal',[elbow.lerp(end,.10),end],[.17,.115],armor,fa,24)
    d=(end-elbow).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    for t in [.12,.27,.83,1]:
        p=elbow.lerp(end,t);rad=.18-.05*t
        m.line('Ribete de brazal',[p+rad*(u*math.cos(j*math.tau/32)+v*math.sin(j*math.tau/32)) for j in range(33)],.010,edge,fa)
    panel('Frente del brazal',[(s*.84,-.11,2.15),(s*.94,-.17,2.29),(s*1.09,-.12,2.12),(s*1.17,end.y-.12,end.z),(s*1.04,end.y-.15,end.z-.04)],fa)
    spiral((s*.99,-.20,2.10),.06,fa)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Mano escamosa',palm,(.13,.14,.075) if s==1 else (.12,.10,.15),skin,hand)
    for k in range(4):
        x=palm.x+(k-1.5)*.062
        pts=[(x,-.61,1.98),(x,-.73,2.03),(x,-.74,2.14)] if s==1 else [(x,-.09,1.59-k*.009),(x,-.19,1.54-k*.009),(x+.035,-.19,1.48-k*.009)]
        m.tube('Dedo escamoso',pts,[.028,.025,.017],skin,hand,12)
        m.tube('Garra curvada',[pts[-1],Vector(pts[-1])+Vector((.015,.025,.065) if s==1 else (.04,.055,.015))],[.019,.001],beakmat,hand,12)
        for q in range(3):
            p=Vector(pts[0]).lerp(Vector(pts[1]),(q+1)/4)
            m.line('Escama de dedo',[p+Vector((-.020,-.007,.016)),p+Vector((0,-.013,.020)),p+Vector((.020,-.007,.016))],.003,shaft,hand,5)
    m.tube('Pulgar',[(palm.x-s*.09,palm.y,palm.z),(palm.x-s*.17,palm.y-.06,palm.z-.04),(palm.x-s*.17,palm.y-.15,palm.z+.02)],[.034,.028,.001],skin,hand,12)
    m.tube('Muslo vestido',[(s*.29,.015,1.53),(s*.37,0,.97)],[.18,.14],cloth,th,24)
    for k in range(3):
        z=1.75-k*.19
        panel('Faldón lateral',[(s*.16,-.24,z),(s*.36,-.17,z+.03),(s*.51,-.13,z-.26),(s*.25,-.26,z-.21)],th)
        spiral((s*.29,-.285,z-.10),.052,th)
    m.tube('Pierna',[(s*.38,.01,.96),(s*.40,.01,.24)],[.15,.105],cloth,sh,24)
    panel('Rodillera',[(s*.24,-.17,1.02),(s*.38,-.23,1.16),(s*.52,-.17,1.02),(s*.47,-.24,.83),(s*.38,-.27,.77),(s*.26,-.23,.84)],sh)
    spiral((s*.38,-.285,.97),.070,sh)
    panel('Greba tallada',[(s*.25,-.18,.78),(s*.51,-.17,.78),(s*.48,-.19,.30),(s*.39,-.25,.23),(s*.29,-.21,.31)],sh)
    for k in range(3):spiral((s*.38,-.26,.67-k*.12),.038,sh)
    m.ball('Pie de ave',(s*.40,-.10,.13),(.14,.21,.11),skin,foot)
    for k in range(3):
        x=s*.40+(k-1)*.10
        m.tube('Dedo de pie',[(x,-.13,.14),(x+(k-1)*.02,-.31,.095),(x+(k-1)*.03,-.40,.07)],[.045,.038,.025],skin,foot,14)
        m.tube('Garra de pie',[(x+(k-1)*.03,-.39,.09),(x+(k-1)*.03,-.48,.06),(x+(k-1)*.03,-.50,.015)],[.028,.020,.001],beakmat,foot,12)
        for q in range(3):
            y=-.20-q*.05;m.line('Anillo de escama',[(x-.035,y,.115),(x,y-.005,.145),(x+.035,y,.115)],.004,shaft,foot,6)

# The burgundy cape has actual perforations and a flowing asymmetric hem.
for s in [-1,1]:
    vs=[];fs=[];rows=27;cols=23
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);x=s*(.03+u*(.42+.55*t)+.08*math.sin(t*4+u*2)*t)
            y=.24+.43*t+.08*math.sin(u*math.pi*5+t*2)*t;z=2.79-2.40*t-.19*math.sin(u*17)**2*t**7
            vs.append((x,y,z))
            if r and c:
                hole=(r in [17,18,19] and c in [6,7]) or (r in [20,21] and c in [14,15]) or (r>20 and c in [3,10,18,21] and r>23-c%3)
                if not hole:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    cape=solid(m.mesh('Capa rasgada',vs,fs,cloth,'chest'),.008)
    hips=cape.vertex_groups.new(name='hips');chest=cape.vertex_groups['chest']
    for vx in cape.data.vertices:
        w=max(0,min(.8,(2.45-vx.co.z)/1.25));chest.add([vx.index],1-w,'REPLACE');hips.add([vx.index],w,'REPLACE')
panel('Tabardo',[(-.17,-.30,1.69),(.17,-.30,1.69),(.14,-.35,.87),(0,-.37,.68),(-.14,-.35,.87)],'hips',cloth,.018)
for s in [-1,1]:
    m.line('Bordado de tabardo',[(s*.12,-.325,1.61),(s*.10,-.38,.92),(0,-.40,.75)],.005,edge,'hips')
    for k in range(4):spiral((s*.065,-.40,1.48-k*.14),.025,'hips',turns=1)

# Sceptre aligned with the right grip; miniature eagle spreads individual feathers.
grip=Vector((-1.14,-.12,1.55));bottom=grip+Vector((.32,0,-1.25));top=grip+Vector((-.30,0,.95))
m.tube('Cetro',[bottom,grip,top],[.018,.028,.027],darkmetal,'hand.R',16)
for k in range(6):
    p=grip+Vector((-.012*k,0,.045*k))
    m.line('Anillo de empuñadura',[(p.x+.037*math.cos(a),p.y+.037*math.sin(a),p.z) for a in [i*math.tau/24 for i in range(25)]],.006,edge,'hand.R',6)
center=top+Vector((0,0,.20))
m.ball('Cuerpo del águila del cetro',center,(.070,.055,.12),armor,'hand.R')
m.ball('Cabeza del águila del cetro',center+Vector((-.025,-.005,.13)),(.055,.045,.05),edge,'hand.R')
m.tube('Pico del emblema',[center+Vector((-.06,-.02,.14)),center+Vector((-.105,-.02,.11))],[.022,.001],edge,'hand.R',10)
for s in [-1,1]:
    root=center+Vector((s*.04,0,.06));bend=center+Vector((s*.19,0,.14));end=center+Vector((s*.34,0,.27))
    m.tube('Ala del emblema',[root,bend,end],[.04,.027,.003],armor,'hand.R',10)
    for k in range(8):
        t=k/7;base=root.lerp(bend,.25+.75*t)
        feather('Pluma del cetro',base,center+Vector((s*(.13+.22*t),-.012,.01+.34*t)),.023,'hand.R',armor,detail=False)
    feather('Cola del emblema',center+Vector((s*.025,0,-.04)),center+Vector((s*.06,0,-.21)),.025,'hand.R',armor)
m.gem('Sello del cetro',top-Vector((0,.035,0)),(.047,.055),glow,'hand.R')

die_start=len(m.parts)
die(m,mat('Dado guinda',(.23,.012,.055),.40,.24,.08),mat('Puntos rosados',(.85,.33,.46),.1,.30,1.3))
center=Vector((1.10,-.59,2.30))
for obj in m.parts[die_start:]:
    for vx in obj.data.vertices:vx.co=center+(vx.co-center)*.90
pivot=rig.data.bones['forearm.L'].head_local.copy();turn=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-57),4,'X')@Matrix.Translation(-pivot)
head=rig.data.bones['hand.L'].head_local.copy();handmove=Matrix.Translation(turn@head-head)
headturn=Matrix.Rotation(math.radians(38),4,'Z')
for obj in m.parts:
    if 'head' in obj.vertex_groups:
        for vx in obj.data.vertices:vx.co=headturn@vx.co
    if any(g.name in ['forearm.L','hand.L'] for g in obj.vertex_groups):
        transform=handmove if 'hand.L' in obj.vertex_groups else turn
        for vx in obj.data.vertices:vx.co=transform@vx.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:rig.data.edit_bones[name].transform(handmove if name=='hand.L' else turn)
rig.data.edit_bones['head'].transform(headturn)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig);print('EMPERADOR_GEOMETRY_READY',len(mesh.data.vertices),flush=True)
bake_surfaces(mesh,'emperador_viento_v2');ground_fast(rig,mesh)
rig['reference']='public/mascots/emperador_viento.webp';rig['revision']=2
scene=bpy.context.scene;scene.render.fps=30;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'emperador_viento.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'emperador_viento.glb')
(OUT/'model.json').write_text(json.dumps({'name':'Emperador del Viento','revision':2,'reference':'/mascots/emperador_viento.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
render_review(OUT,rig,accent=(1,.12,.28),height=2,scale=4.6,face_target=3.32,celebration_scale=5.4,celebration_height=2.30)
print('EMPERADOR_V2_READY',flush=True)
