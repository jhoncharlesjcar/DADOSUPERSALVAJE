"""Poseidon reference revision 3. Writes a review candidate, never public assets."""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT, SOURCE, mat, die
from reference_pipeline import Sculpt, bake_surfaces, ground_fast, render_review
from glb_textures import deduplicate_textures

OUT=ROOT/'assets/mascots3d/poseidon/revision3';OUT.mkdir(parents=True,exist_ok=True)
random.seed(309)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['Demonio_Salvaje'];rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
for obj in list(bpy.data.objects):
    if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
rig.name='Poseidon';bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name,color,metal,rough,grain=110):
    material=mat(name,color,metal,rough);n=material.node_tree.nodes;l=material.node_tree.links;p=n['Principled BSDF']
    coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=grain;noise.inputs['Detail'].default_value=2
    l.new(coord.outputs['Object'],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=tuple(c*.82 for c in color)+(1,);ramp.color_ramp.elements[1].color=tuple(c*1.12 for c in color)+(1,)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.0008
    l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal']);return material

armor=surface('Acero azul abisal',(.018,.060,.13),.68,.34)
edge=surface('Oro envejecido',(.36,.28,.13),.72,.38)
silver=mat('Grabado plateado',(.14,.21,.26),.65,.47)
cloth=surface('Tejido azul noche',(.010,.026,.075),0,.86)
skin=surface('Piel del rey',(.25,.125,.078),0,.58,160)
lip=mat('Labios',(.19,.085,.062),0,.66)
hair=surface('Cabello grafito',(.022,.027,.033),.02,.74)
hairlight=mat('Hebras grises',(.045,.052,.06),.02,.75)
dark=mat('Cavidades',(.003,.005,.009),0,.85)
glow=mat('Energía cian',(.035,.55,.85),.08,.30,2.4)
eye=mat('Mirada azul',(.11,.65,1),0,.28,3)
m=Sculpt()

def solid(obj,thickness=.02):
    mod=obj.modifiers.new('Espesor','SOLIDIFY');mod.thickness=thickness;bpy.ops.object.modifier_apply(modifier=mod.name);return obj

def panel(name,points,bone,material=armor,depth=.035,trim=edge):
    obj=m.plate(name,points,material,bone,depth)
    m.line(name+' ribete',[(x,y-.004,z) for x,y,z in points+[points[0]]],.004,trim,bone);return obj

def strand(name,points,width,bone='head',material=hair):
    a,b,c=map(Vector,points);curve=[];radii=[]
    for k in range(9):
        t=k/8;curve.append((1-t)**2*a+2*(1-t)*t*b+t*t*c)
        radii.append(max(.0007,width*(1-t)**.7))
    m.tube(name,curve,radii,material,bone,6)

def wave(at,size,bone,material=silver):
    x,y,z=at
    for s in [-1,1]:
        m.line('Grabado de oleaje',[(x+s*size*t,y,z+size*(.24*math.sin(t*5)-.35*t)) for t in [k/16 for k in range(17)]],.0035,material,bone,5)

def seal(at,size,bone):
    x,y,z=at
    m.line('Sello de tridente',[(x,y,z-size*.6),(x,y,z+size*.5)],.0045,glow,bone,6)
    for s in [-1,1]:m.line('Rama del sello',[(x,y,z),(x+s*size*.25,y,z+size*.2),(x+s*size*.25,y,z+size*.42)],.004,glow,bone,6)

# One continuous facial envelope: flatter forehead, defined cheek planes and jaw.
start=len(m.parts)
profile=[(3.065,.09,.145),(3.10,.135,.18),(3.16,.18,.184),(3.22,.19,.185),(3.28,.212,.193),(3.34,.202,.17),(3.39,.208,.197),(3.45,.218,.19),(3.53,.215,.17),(3.61,.145,.12),(3.64,.04,.04)]
vs=[];fs=[];segments=48
for r,(z,w,depth) in enumerate(profile):
    for k in range(segments):
        a=k*math.tau/segments;front=math.cos(a)
        y=.01-depth*front**.45 if front>=0 else .01+.20*(-front)
        vs.append((w*math.sin(a),y,z))
        if r:q=(r-1)*segments+k;n=(k+1)%segments;fs.append((q,(r-1)*segments+n,r*segments+n,r*segments+k))
fs.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+k for k in range(segments))])
face=m.mesh('Planos del rostro',vs,fs,skin,'head')
sub=face.modifiers.new('Continuidad facial','SUBSURF');sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name)
m.ball('Puente nasal',(0,-.206,3.32),(.035,.05,.105),skin)
m.ball('Punta nasal',(0,-.256,3.235),(.037,.041,.027),skin)
for s in [-1,1]:m.ball('Ala nasal',(s*.039,-.237,3.225),(.024,.032,.023),skin)
m.unify(start,'Rostro continuo','head',.005)
m.tube('Cuello',[(0,.02,2.78),(0,.02,3.17)],[.15,.135],skin,'neck',28)
for s in [-1,1]:
    m.ball('Fosa nasal',(s*.029,-.266,3.215),(.012,.010,.006),dark)
    m.ball('Órbita',(s*.104,-.184,3.36),(.062,.025,.027),dark)
    m.ball('Ojo',(s*.106,-.210,3.36),(.044,.010,.014),eye)
    m.line('Párpado superior',[(s*.046,-.226,3.369),(s*.105,-.239,3.384),(s*.16,-.205,3.382)],.009,skin,'head')
    m.line('Párpado inferior',[(s*.052,-.227,3.350),(s*.107,-.238,3.340),(s*.158,-.207,3.354)],.006,skin,'head')
    m.tube('Ceja firme',[(s*.04,-.214,3.405),(s*.10,-.222,3.425),(s*.173,-.174,3.417)],[.013,.019,.005],hair)
    m.line('Pliegue nasolabial',[(s*.055,-.183,3.24),(s*.08,-.178,3.20),(s*.085,-.163,3.15)],.0014,lip,'head',5)
    m.ball('Oreja',(s*.23,.015,3.29),(.037,.055,.08),skin)
m.line('Boca seria',[(-.082,-.217,3.162),(0,-.237,3.172),(.082,-.217,3.162)],.007,lip,'head')
m.line('Labio inferior',[(-.062,-.218,3.151),(0,-.235,3.148),(.062,-.218,3.151)],.009,skin,'head')
# Continuous beard silhouette with curved, tapered surface strands, not stacked rods.
vs=[];fs=[];rows=15;cols=33
for r in range(rows):
    t=r/(rows-1)
    for k in range(cols):
        a=-1.40+k*2.80/(cols-1);x=.176*math.sin(a)*(1-.75*t*t)
        y=-.027-.177*math.cos(a)-.018*math.sin(math.pi*t)+.035*t*t
        z=3.165+.10*abs(math.sin(a))-.23*t
        vs.append((x,y,z))
        if r and k:q=(r-1)*cols+k-1;fs.append((q,q+1,q+cols+1,q+cols))
solid(m.mesh('Masa de barba',vs,fs,hair,'head'),.012)
for k in range(110):
    a=-1.37+k*2.74/109;end=.88+random.random()*.12;points=[];radii=[]
    for j in range(12):
        t=end*j/11;angle=a+.018*math.sin(t*7+k)
        x=.176*math.sin(angle)*(1-.75*t*t)
        y=-.027-.177*math.cos(angle)-.018*math.sin(math.pi*t)+.035*t*t-.014
        z=3.165+.10*abs(math.sin(angle))-.23*t
        points.append((x,y,z));radii.append(.0028*(1-.7*t))
    m.tube('Hebra de barba',points,radii,hairlight if k%3==0 else hair,'head',5)
for s in [-1,1]:
    for k in range(6):
        x=s*(.012+k*.012)
        strand('Bigote',[(x,-.25+k*.004,3.202),(x+s*.028,-.258+k*.004,3.185),(x+s*.05,-.223,3.16)],.006)
    for row in range(3):
        for k in range(9):
            a=-.30+k*.22;x=s*(.21+.025*math.sin(a));y=.02+.15*math.sin(a);z=3.56-row*.16
            strand('Cabello lateral',[(x,y,z),(x+s*.025,y+.055,z-.20),(x+s*.015,y+.09,z-.36)],.025)

# Close-fitting crown/helmet, central spear and swept lateral blades.
vs=[];fs=[]
for r in range(5):
    t=r/4
    for k in range(41):
        a=k*math.tau/40;x=.254*math.sin(a);y=.017-.218*math.cos(a)
        z=3.47+.14*t+.07*abs(math.sin(a))-.075*math.cos(a)**8*(1-t)
        vs.append((x,y,z))
        if r and k:q=(r-1)*41+k-1;fs.append((q,q+1,q+42,q+41))
solid(m.mesh('Diadema ajustada',vs,fs,armor,'head'),.015)
for row in [0,4]:m.line('Borde diadema',[(x,y-.004,z) for x,y,z in vs[row*41:(row+1)*41]],.008,silver,'head')
panel('Punta central',[(-.065,-.205,3.58),(0,-.11,3.98),(.065,-.205,3.58),(0,-.245,3.47)],'head',armor,.025,silver)
m.gem('Gema frontal',(0,-.267,3.56),(.031,.065),glow,'head')
for s in [-1,1]:
    panel('Protector de sien',[(s*.18,-.17,3.50),(s*.26,-.09,3.60),(s*.265,-.08,3.31),(s*.20,-.14,3.19)],'head',armor,.018,silver)
    for k in range(3):
        panel('Aleta de corona',[(s*(.14+k*.035),-.14+k*.055,3.53),(s*(.25+k*.045),-.09+k*.045,3.65),(s*(.26+k*.045),.015+k*.05,3.88-k*.045),(s*(.21+k*.035),-.05+k*.05,3.69)],'head',armor,.022,silver)

m.ball('Torso cubierto',(0,.025,2.42),(.43,.25,.43),armor,'chest')
m.ball('Cintura',(0,.01,2.02),(.30,.22,.30),armor,'spine')
m.ball('Cadera',(0,.015,1.64),(.34,.24,.26),cloth,'hips')
for s in [-1,1]:
    vs=[];fs=[];rows=13;cols=19
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);x=s*(.018+.405*u);y=-.28-.075*math.sin(math.pi*u)*math.sin(math.pi*t)+.095*u*u
            z=2.79-.44*t-.12*u*t;vs.append((x,y,z))
            if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    solid(m.mesh('Coraza pectoral curva',vs,fs,armor,'chest'),.035)
    for row in [0,rows-1]:m.line('Ribete pectoral',[(x,y-.012,z) for x,y,z in vs[row*cols:(row+1)*cols]],.008,silver,'chest')
    for k in range(4):
        x=s*(.09+k*.055);z=2.70-k*.065
        engraving=[]
        for px,pz in [(x,z),(x+s*.045,z-.03),(x+s*.06,z-.08)]:
            u=(abs(px)-.018)/.405;t=(2.79-pz)/(.44+.12*u)
            py=-.28-.075*math.sin(math.pi*u)*math.sin(math.pi*t)+.095*u*u
            engraving.append((px,py-.002,pz))
        m.line('Grabado del pecho',engraving,.002,silver,'chest',5)
    for k in range(4):
        z=2.39-k*.14
        panel('Abdominal articulado',[(s*.015,-.31,z),(s*.14,-.31,z+.035),(s*.28,-.31,z-.02),(s*.25,-.31,z-.12),(s*.035,-.31,z-.16)],'spine',armor,.035,silver)
    panel('Cuello alto',[(s*.16,.09,2.76),(s*.20,.08,3.04),(s*.28,.12,3.10),(s*.40,.13,2.79)],'chest',armor,.035,silver)
    panel('Cinturón alado',[(s*.03,-.31,1.98),(s*.37,-.19,2.05),(s*.30,-.25,1.85),(s*.05,-.34,1.75)],'hips')
panel('Hebilla real',[(-.15,-.34,1.89),(0,-.40,2.07),(.15,-.34,1.89),(0,-.42,1.69)],'hips')
seal((0,-.45,1.88),.18,'hips')

for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    shoulder=Vector((s*.61,0,2.64));elbow=Vector((s*.96,0,2.16))
    start=len(m.parts)
    m.ball('Deltoides',shoulder,(.22,.22,.23),skin,ua)
    m.tube('Brazo musculoso',[shoulder,shoulder.lerp(elbow,.50),elbow],[.175,.185,.125],skin,ua,28)
    m.ball('Bíceps',shoulder.lerp(elbow,.52)+Vector((0,-.07,0)),(.155,.16,.205),skin,ua)
    m.unify(start,'Musculatura del brazo',ua,.011)
    for layer in range(3):
        z=2.82-layer*.11
        panel('Hombrera marina',[(s*(.42+layer*.055),-.23,z+.04),(s*(.67+layer*.06),-.22,z+.08),(s*(.87+layer*.04),-.15,z-.08),(s*(.65+layer*.07),-.29,z-.17),(s*(.43+layer*.055),-.25,z-.10)],ua,armor,.37,silver)
        wave((s*(.65+layer*.045),-.31,z-.045),.10,ua)
    m.ball('Broche de capa',(s*.39,-.245,2.79),(.078,.026,.078),edge,'chest')
    m.ball('Medallón',(s*.39,-.273,2.79),(.061,.010,.061),armor,'chest');seal((s*.39,-.289,2.79),.075,'chest')
    end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    m.tube('Antebrazo',[elbow,end],[.137,.10],skin,fa,24)
    m.tube('Brazal ajustado',[elbow.lerp(end,.12),end],[.17,.115],armor,fa,28)
    d=(end-elbow).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    for t in [.12,.25,.83,1]:
        p=elbow.lerp(end,t);radius=.18-.05*t
        m.line('Anillo de brazal',[p+radius*(u*math.cos(j*math.tau/32)+v*math.sin(j*math.tau/32)) for j in range(33)],.008,silver,fa)
    panel('Aleta de brazal',[(s*.91,-.13,2.17),(s*.84,-.12,2.48),(s*1.04,-.11,2.22),(s*1.15,end.y-.11,end.z+.03),(s*1.04,end.y-.15,end.z-.03)],fa,armor,.025,silver)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Palma',palm,(.13,.14,.073) if s==1 else (.12,.09,.15),skin,hand)
    for k in range(4):
        x=palm.x+(k-1.5)*.061
        pts=[(x,-.61,1.98),(x,-.73,2.025),(x,-.735,2.14)] if s==1 else [(x,-.09,1.59-k*.008),(x,-.19,1.54-k*.008),(x+.035,-.18,1.48-k*.008)]
        m.tube('Dedo',pts,[.027,.024,.015],skin,hand,12)
        m.ball('Nudillo',pts[1],(.026,.024,.027),skin,hand)
    m.tube('Pulgar',[(palm.x-s*.085,palm.y,palm.z),(palm.x-s*.17,palm.y-.06,palm.z-.035),(palm.x-s*.17,palm.y-.14,palm.z+.02)],[.032,.027,.016],skin,hand,12)
    m.tube('Muslo cubierto',[(s*.29,.015,1.53),(s*.37,0,.97)],[.185,.15],cloth,th,24)
    for k in range(3):
        z=1.75-k*.17
        panel('Escama del faldón',[(s*.17,-.25,z),(s*.37,-.16,z+.04),(s*.53,-.14,z-.24),(s*.28,-.28,z-.20)],th,armor,.035,silver)
        wave((s*.32,-.30,z-.08),.07,th)
    m.tube('Bota alta',[(s*.38,.01,.96),(s*.40,.01,.24)],[.165,.12],armor,sh,28)
    panel('Rodillera',[(s*.24,-.18,1.02),(s*.38,-.24,1.17),(s*.52,-.18,1.02),(s*.48,-.25,.83),(s*.38,-.28,.77),(s*.26,-.24,.84)],sh,armor,.035,silver)
    panel('Relieve de rodillera',[(s*.31,-.27,1.00),(s*.38,-.28,1.09),(s*.45,-.27,1.00),(s*.38,-.30,.88)],sh,armor,.018,silver)
    panel('Greba',[(s*.25,-.18,.79),(s*.51,-.18,.79),(s*.48,-.20,.29),(s*.39,-.26,.22),(s*.29,-.22,.30)],sh,armor,.035,silver)
    for k in range(3):wave((s*.38,-.275,.68-k*.12),.065,sh)
    m.ball('Bota',(s*.40,-.16,.13),(.18,.32,.13),armor,foot)
    for k in range(4):
        y=-.12-k*.073
        m.line('Lámina del escarpe',[(s*.4+.16*math.cos(a),y,.13+.10*math.sin(a)) for a in [j*math.pi/16 for j in range(17)]],.009,silver,foot)

# Woven cape; blended chest/hip weights follow the shared animation skeleton.
for s in [-1,1]:
    vs=[];fs=[];rows=26;cols=24
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);x=s*(.03+u*(.43+.56*t)+.065*math.sin(t*4+u*2)*t)
            y=.24+.40*t+.075*math.sin(u*math.pi*6+t*2)*t;z=2.80-2.43*t-.10*math.sin(u*21)**2*t**8
            vs.append((x,y,z))
            if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    cape=solid(m.mesh('Capa azul plisada',vs,fs,cloth,'chest'),.009)
    hips=cape.vertex_groups.new(name='hips');chest=cape.vertex_groups['chest']
    for vx in cape.data.vertices:
        w=max(0,min(.80,(2.45-vx.co.z)/1.25));chest.add([vx.index],1-w,'REPLACE');hips.add([vx.index],w,'REPLACE')
panel('Tabardo real',[(-.18,-.31,1.73),(.18,-.31,1.73),(.16,-.36,.88),(0,-.39,.69),(-.16,-.36,.88)],'hips',cloth,.018)
for k in range(4):
    z=1.68-k*.14
    m.line('Chevron del tabardo',[(-.13,-.39,z),(0,-.41,z-.15),(.13,-.39,z)],.007,silver,'hips')
for s in [-1,1]:
    for k in range(4):wave((s*.09,-.405,1.05-k*.06),.027,'hips',edge)

# Double-ended trident, in the right hand. Three curved, edged tines at each end.
grip=Vector((-1.14,-.13,1.55));axis=Vector((-.16,0,1)).normalized()
bottom=grip-axis*1.10;top=grip+axis*1.66
m.tube('Asta del tridente',[bottom,grip,top],[.024,.034,.029],armor,'hand.R',20)
for k in range(12):
    p=grip+axis*(-.22+k*.04)
    m.line('Empuñadura del tridente',[(p.x+.042*math.cos(a),p.y+.042*math.sin(a),p.z) for a in [j*math.tau/24 for j in range(25)]],.006,edge,'hand.R',6)

def trident_head(center,direction,size):
    u=Vector((axis.z,0,-axis.x));v=axis*direction
    def pt(x,z):return center+u*x*size+v*z*size
    for s in [-1,1]:
        outline=[pt(0,-.08),pt(s*.12,.15),pt(s*.32,.25),pt(s*.37,.52),pt(s*.31,.76),pt(s*.47,.49),pt(s*.42,.22),pt(s*.17,.07)]
        panel('Horquilla ornamentada',[tuple(p) for p in outline],'hand.R',armor,.033,edge)
        wave(tuple(pt(s*.28,.27)-Vector((0,.03,0))),.06*size,'hand.R',silver)
    panel('Punta central',[tuple(pt(-.055,.15)),tuple(pt(-.075,.67)),tuple(pt(0,1.00)),tuple(pt(.075,.67)),tuple(pt(.055,.15)),tuple(pt(0,.02))],'hand.R',armor,.035,edge)
    m.line('Filo central',[pt(0,.16)-Vector((0,.025,0)),pt(0,.90)-Vector((0,.025,0))],.005,glow,'hand.R',6)
    m.gem('Gema del tridente',center-Vector((0,.06,0)),(.06*size,.105*size),glow,'hand.R')
trident_head(top,1,.85)
trident_head(bottom,-1,.42)

die_start=len(m.parts)
die(m,mat('Dado de zafiro',(.012,.10,.32),.38,.22,.14),mat('Puntos cian',(.22,.75,1),.05,.3,1.5))
center=Vector((1.10,-.59,2.30))
for obj in m.parts[die_start:]:
    for vx in obj.data.vertices:vx.co=center+(vx.co-center)*.86
# Raise the offering forearm while keeping the die and palm upright.
pivot=rig.data.bones['forearm.L'].head_local.copy();turn=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-57),4,'X')@Matrix.Translation(-pivot)
head=rig.data.bones['hand.L'].head_local.copy();handmove=Matrix.Translation(turn@head-head)
for obj in m.parts:
    if any(g.name in ['forearm.L','hand.L'] for g in obj.vertex_groups):
        transform=handmove if 'hand.L' in obj.vertex_groups else turn
        for vx in obj.data.vertices:vx.co=transform@vx.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:rig.data.edit_bones[name].transform(handmove if name=='hand.L' else turn)
bpy.ops.object.mode_set(mode='OBJECT')
# Seat the head closer to the collar while preserving the neck's lower attachment.
for obj in m.parts:
    if 'head' in obj.vertex_groups:
        for vx in obj.data.vertices:vx.co.z-=.12
    elif 'neck' in obj.vertex_groups:
        for vx in obj.data.vertices:vx.co.z-=.12*max(0,min(1,(vx.co.z-2.78)/.39))
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
rig.data.edit_bones['head'].translate(Vector((0,0,-.12)))
rig.data.edit_bones['neck'].tail.z-=.12
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig);print('POSEIDON_GEOMETRY_READY',len(mesh.data.vertices),flush=True)
bake_surfaces(mesh,'poseidon_v3');ground_fast(rig,mesh)
rig['reference']='public/mascots/poseidon.webp';rig['revision']=3
scene=bpy.context.scene;scene.render.fps=30;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'poseidon.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'poseidon.glb')
(OUT/'model.json').write_text(json.dumps({'name':'Poseidón','revision':3,'reference':'/mascots/poseidon.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
render_review(OUT,rig,accent=(.04,.40,1),height=2,scale=4.8,face_target=3.39,celebration_scale=6.3,celebration_height=2.4)
print('POSEIDON_V3_READY',flush=True)
