"""Titán del Océano, individual revision 2. Candidate only; no public overwrite."""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).parent))
from build_roster import ROOT, SOURCE, mat, die
from reference_pipeline import Sculpt, bake_surfaces, ground_fast, render_review
from glb_textures import deduplicate_textures

OUT=ROOT/'assets/mascots3d/oceano/revision2';OUT.mkdir(parents=True,exist_ok=True)
random.seed(73)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['Demonio_Salvaje'];rig.animation_data.action=None
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
for obj in list(bpy.data.objects):
    if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
rig.name='Titan_del_Oceano';bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name,color,kind,metal=0,rough=.45):
    material=mat(name,color,metal,rough);nt=material.node_tree;n=nt.nodes;l=nt.links;p=n['Principled BSDF']
    coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=7 if kind=='skin' else 45;noise.inputs['Detail'].default_value=4
    l.new(coord.outputs['Object'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=tuple(c*.35 for c in color)+(1,)
    ramp.color_ramp.elements[1].color=tuple(min(1,c*1.6) for c in color)+(1,)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    cells=n.new('ShaderNodeTexVoronoi');cells.feature='DISTANCE_TO_EDGE';cells.inputs['Scale'].default_value=95 if kind=='skin' else 180
    l.new(coord.outputs['Object'],cells.inputs['Vector'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.25 if kind=='skin' else .18
    bump.inputs['Distance'].default_value=.002 if kind=='skin' else .0015
    l.new(cells.outputs['Distance'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
    if kind=='skin':
        scale=n.new('ShaderNodeValToRGB');scale.color_ramp.elements[0].position=.015;scale.color_ramp.elements[0].color=(.12,.25,.32,1)
        scale.color_ramp.elements[1].position=.09;scale.color_ramp.elements[1].color=(1,1,1,1)
        l.new(cells.outputs['Distance'],scale.inputs[0]);mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.55
        l.new(ramp.outputs['Color'],mix.inputs[1]);l.new(scale.outputs['Color'],mix.inputs[2]);l.new(mix.outputs[0],p.inputs['Base Color'])
    return material

skin=surface('Escamas azul profundo',(.013,.13,.19),'skin',.06,.44)
armor=surface('Bronce marino patinado',(.022,.074,.085),'metal',.78,.40)
edge=mat('Relieve de plata envejecida',(.17,.28,.29),.78,.34)
finmat=surface('Membrana azul violeta',(.075,.055,.17),'skin',.10,.48)
raymat=mat('Radios de aleta',(.06,.25,.28),.3,.35)
coral=surface('Coral púrpura',(.26,.09,.19),'coral',.05,.73)
coraltip=surface('Puntas de coral',(.36,.23,.29),'coral',0,.70)
algae=surface('Incrustación verde',(.12,.23,.12),'coral',0,.85)
shellmat=surface('Concha turquesa nacarada',(.04,.43,.47),'metal',.48,.28)
dark=mat('Surcos y cavidades',(.003,.014,.025),0,.6)
eye=mat('Ojos bioluminiscentes',(.035,.80,1),.1,.25,2.2)
claw=mat('Uñas oscuras',(.025,.045,.07),.35,.3)
m=Sculpt()

def panel(name,points,bone,material=armor,depth=.045):
    obj=m.plate(name,points,material,bone,depth)
    m.line(name+' ribete',[(x,y-.014,z) for x,y,z in points+[points[0]]],.012,edge,bone)
    return obj

def shell(name,at,width,height,bone):
    center=Vector(at);vs=[];fs=[];rows=11;cols=25
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            angle=(c/(cols-1)-.5)*2.3
            x=width*t*math.sin(angle);z=height*t*math.cos(angle)
            y=-.09*math.sin(math.pi*t*.8)-.012*math.cos(angle*14)*t
            vs.append(center+Vector((x,y,z)))
            if r and c:a=(r-1)*cols+c-1;b=r*cols+c-1;fs.append((a,a+1,b+1,b))
    obj=m.mesh(name,vs,fs,shellmat,bone)
    solid=obj.modifiers.new('Concha sólida','SOLIDIFY');solid.thickness=.018;bpy.ops.object.modifier_apply(modifier=solid.name)
    for k in range(13):
        angle=(k/12-.5)*2.3
        points=[center+Vector((width*t*math.sin(angle),-.09*math.sin(math.pi*t*.8)-.017,height*t*math.cos(angle))) for t in [i/12 for i in range(1,13)]]
        m.line('Costilla concha',points,.007,edge,bone,6)

def fin(name,base,tips,bone):
    base=Vector(base);vs=[base];fs=[]
    for i,tip in enumerate(tips):
        tip=Vector(tip)
        if i:
            previous=Vector(tips[i-1]);valley=(previous+tip)*.5
            valley=base+(valley-base)*.73
            vs.append(valley);fs.append((0,len(vs)-2,len(vs)-1))
        vs.append(tip)
        if len(vs)>2:fs.append((0,len(vs)-2,len(vs)-1))
        m.tube('Radio de '+name,[base,base.lerp(tip,.55)+Vector((0,-.012,0)),tip],[.022,.016,.001],raymat,bone,8)
    obj=m.mesh(name,vs,fs,finmat,bone)
    mod=obj.modifiers.new('Membrana sólida','SOLIDIFY');mod.thickness=.012;bpy.ops.object.modifier_apply(modifier=mod.name)

def coral_branch(base,sign,bone,length=.32):
    p=Vector(base);bend=p+Vector((sign*.07,.02,length*.52));tip=p+Vector((sign*.035,.03,length))
    m.tube('Rama coral',[p,bend,tip],[.043,.034,.016],coral,bone,10)
    for t,d in [(.40,1),(.65,-1)]:
        start=p.lerp(tip,t);end=start+Vector((sign*d*.12,-.015,length*.34))
        m.tube('Ramificación coral',[start,start.lerp(end,.5)+Vector((0,0,-.018)),end],[.029,.022,.010],coral,bone,9)
        m.ball('Yema coral',end,(.017,.017,.02),coraltip,bone)
    m.ball('Punta coral',tip,(.021,.021,.024),coraltip,bone)

def encrust(at,bone,count=8):
    center=Vector(at)
    for k in range(count):
        p=center+Vector((random.uniform(-.09,.09),random.uniform(-.035,.01),random.uniform(-.055,.055)))
        radius=random.uniform(.014,.035)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=radius,location=p)
        m.finish(bpy.context.object,'Incrustación coralina',algae if k%3 else coraltip,bone,False)

# One sculpted torso with soft chest/spine weights, not separate abdominal plates.
start=len(m.parts)
m.ball('Caja torácica',(0,.035,2.42),(.52,.28,.44),skin,'chest')
m.ball('Cintura',(0,.035,2.04),(.33,.235,.35),skin,'chest')
for s in [-1,1]:
    m.ball('Pectoral',(s*.24,-.17,2.54),(.28,.195,.21),skin,'chest')
    m.tube('Clavícula',[(s*.08,-.13,2.80),(s*.32,-.11,2.78),(s*.55,.01,2.67)],[.07,.085,.10],skin,'chest',16)
    for row in range(3):m.ball('Abdominal',(s*.115,-.20,2.29-row*.17),(.135,.07,.105),skin,'chest')
    for row in range(3):m.ball('Oblicuo',(s*(.33-row*.025),-.115,2.33-row*.13),(.12,.12,.10),skin,'chest')
torso=m.unify(start,'Torso esculpido','chest',.018)
spine=torso.vertex_groups.new(name='spine');chest=torso.vertex_groups['chest']
for v in torso.data.vertices:
    w=max(0,min(1,(v.co.z-2.10)/.40));chest.add([v.index],w,'REPLACE');spine.add([v.index],1-w,'REPLACE')
m.ball('Pelvis',(0,.015,1.65),(.38,.26,.25),skin,'hips')
m.tube('Cuello',[(0,.035,2.72),(0,.035,3.14)],[.19,.17],skin,'neck',24)
for s in [-1,1]:
    m.tube('Tendón cuello',[(s*.05,-.14,2.78),(s*.12,-.13,3.11)],[.035,.027],skin,'neck',12)
shell('Concha pectoral',(0,-.365,2.40),.22,.31,'chest')

for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    start=len(m.parts)
    m.ball('Deltoides',(s*.61,.015,2.62),(.25,.25,.26),skin,ua)
    m.ball('Bíceps',(s*.81,-.04,2.39),(.20,.22,.30),skin,ua)
    m.tube('Brazo muscular',[(s*.61,.015,2.64),(s*.82,0,2.37),(s*.96,0,2.16)],[.20,.19,.14],skin,ua,22)
    m.unify(start,'Brazo unido',ua,.019)
    end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    m.tube('Antebrazo',[(s*.96,0,2.16),end],[.17,.12],skin,fa,22)
    m.tube('Brazal marino',[(s*.99,-.01,2.10),end],[.195,.15],armor,fa,24)
    a=Vector((s*.99,-.01,2.10));d=(end-a).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    for t in [0,.1,.85,1]:
        p=a.lerp(end,t);r=.199-.045*t
        m.line('Anillo brazal',[p+(u*math.cos(k*math.tau/32)+v*math.sin(k*math.tau/32))*r for k in range(33)],.012,edge,fa)
    fin('Aleta antebrazo',(s*1.06,.02,1.92),[(s*1.39,.02,2.20),(s*1.37,.02,1.98),(s*1.30,.02,1.72)],fa)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Palma con escamas',palm,(.15,.17,.09) if s==1 else (.15,.11,.19),skin,hand)
    for k in range(4):
        x=palm.x+(k-1.5)*.075
        points=[(x,-.64,1.97),(x,-.77,2.02),(x,-.79,2.16)] if s==1 else [(x,-.10,1.45),(x,-.16,1.28),(x+.025,-.22,1.25)]
        m.tube('Dedo curvo',points,[.035,.03,.018],skin,hand,12)
        tip=Vector(points[-1]);m.tube('Uña', [tip,tip+Vector((0,-.045,.06 if s==1 else -.035))],[.023,.001],claw,hand,8)
    # Overlapping, pointed shoulder plates support branching purple coral.
    for layer in range(3):
        x=s*(.60+layer*.07);z=2.87-layer*.13
        panel('Hombrera de arrecife',[(x-s*.19,-.19,z),(x+s*.04,-.20,z+.09),(x+s*.33,-.08,z-.12),(x+s*.38,-.14,z-.21),(x-s*.16,-.26,z-.16)],ua,depth=.35)
        encrust((x+s*.05,-.28,z-.10),ua,10)
    for k in range(4):coral_branch((s*(.56+k*.12),.07,2.85-k*.025),s,ua,.28+random.random()*.22)
    m.ball('Broche redondo',(s*.47,-.25,2.76),(.10,.035,.11),edge,'chest')
    m.ball('Broche turquesa',(s*.47,-.28,2.76),(.075,.017,.083),shellmat,'chest')
    # Open collar and hip plates keep the scaled torso exposed.
    panel('Cuello de armadura',[(s*.18,.02,2.79),(s*.27,.08,3.03),(s*.39,.12,3.01),(s*.48,.12,2.77)],'chest')
    m.ball('Muslo',(s*.33,.025,1.26),(.24,.25,.38),skin,th)
    m.ball('Rodilla',(s*.38,-.01,.90),(.18,.19,.18),skin,sh)
    m.tube('Pantorrilla',[(s*.38,.02,.86),(s*.41,.02,.28)],[.17,.12],skin,sh,22)
    for layer in range(3):
        z=1.72-layer*.15
        panel('Escama de cadera',[(s*.18,-.23,z),(s*.42,-.18,z+.03),(s*.56,-.12,z-.20),(s*.53,-.19,z-.26),(s*.26,-.30,z-.17)],th)
        encrust((s*.40,-.27,z-.07),th,6)
    panel('Greba marina',[(s*.24,-.18,.83),(s*.53,-.15,.83),(s*.57,-.15,.55),(s*.49,-.17,.20),(s*.33,-.22,.16),(s*.25,-.22,.49)],sh)
    for k in range(3):
        z=.68-k*.15
        m.line('Grabado greba',[(s*.29,-.242,z+.05),(s*.39,-.27,z),(s*.50,-.20,z+.07)],.009,edge,sh)
    shell('Concha rodillera',(s*.38,-.22,.76),.16,.24,sh)
    fin('Aleta pantorrilla',(s*.48,.02,.45),[(s*.72,.04,.87),(s*.74,.04,.64),(s*.66,.02,.37)],sh)
    m.ball('Pie',(s*.41,-.15,.13),(.20,.34,.13),skin,foot)
    for k in range(4):
        x=s*.41+(k-1.5)*.10
        m.tube('Dedo del pie',[(x,-.32,.13),(x,-.48,.10),(x,-.54,.07)],[.055,.045,.019],skin,foot,10)
        m.tube('Garra',[ (x,-.53,.08),(x,-.61,.055)],[.025,.001],claw,foot,8)

for row in range(3):
    z=1.70-row*.18
    panel('Faldón central',[(-.18,-.30,z),(.18,-.30,z),(.15,-.36,z-.25),(0,-.40,z-.40),(-.15,-.36,z-.25)],'hips')
    m.line('Filigrana faldón',[(-.11,-.39,z-.12),(0,-.425,z-.28),(.11,-.39,z-.12)],.007,shellmat,'hips')
shell('Concha cinturón',(0,-.42,1.61),.18,.26,'hips')
for s in [-1,1]:
    for k in range(3):coral_branch((s*(.19+k*.07),-.22,1.74),s,'hips',.12+k*.035)

# Continuous stern face, heavy brow and cheek ridges; fins replace the generic ears.
start=len(m.parts)
m.ball('Cráneo',(0,.02,3.38),(.25,.215,.32),skin)
m.ball('Mandíbula',(0,-.035,3.15),(.20,.19,.17),skin)
m.ball('Mentón',(0,-.16,3.09),(.12,.10,.085),skin)
m.tube('Nariz plana',[(0,-.19,3.41),(0,-.265,3.29),(0,-.30,3.25)],[.045,.055,.05],skin,'head',16)
for s in [-1,1]:
    m.ball('Pómulo',(s*.175,-.105,3.31),(.09,.10,.10),skin)
    m.tube('Ceja ósea',[(s*.025,-.21,3.43),(s*.13,-.22,3.47),(s*.225,-.13,3.48)],[.04,.055,.03],skin,'head',16)
    m.tube('Mandíbula lateral',[(s*.21,-.01,3.29),(s*.17,-.13,3.14),(s*.06,-.20,3.10)],[.07,.06,.04],skin,'head',14)
m.unify(start,'Rostro esculpido','head',.010)
for s in [-1,1]:
    m.ball('Órbita',(s*.115,-.216,3.40),(.085,.03,.045),dark)
    m.ball('Ojo luminoso',(s*.115,-.244,3.402),(.059,.013,.022),eye)
    m.line('Párpado',[(s*.053,-.246,3.414),(s*.13,-.253,3.432),(s*.19,-.21,3.43)],.012,skin,'head')
    m.ball('Fosa nasal',(s*.035,-.294,3.25),(.013,.010,.007),dark)
    fin('Aleta temporal',(s*.22,.01,3.36),[(s*.34,.04,3.69),(s*.46,.05,3.58),(s*.43,.05,3.40),(s*.39,.05,3.22),(s*.30,.04,3.12)],'head')
    for k in range(3):m.line('Branquia',[(s*.205,-.126,3.28-k*.047),(s*.245,-.08,3.25-k*.047),(s*.22,-.01,3.21-k*.047)],.007,dark,'head',6)
m.line('Boca firme',[(-.12,-.225,3.18),(-.065,-.25,3.195),(0,-.262,3.19),(.065,-.25,3.195),(.12,-.225,3.18)],.009,dark,'head',8)
# Longitudinal forehead crests taper into the back of the skull.
for x in [-.15,-.075,0,.075,.15]:
    peak=3.93-abs(x)*1.6
    m.tube('Cresta craneal',[(x,-.17,3.48),(x,-.12,3.66),(x,.02,peak),(x,.16,3.61),(x,.20,3.43)],[.012,.035,.004,.026,.005],skin,'head',10)
die(m,mat('Dado de agua',(.02,.46,.62),.30,.20,.35),mat('Puntos de luz',(.30,.95,1),.1,.25,1.8))

# Raise the left offering forearm while keeping the cupped hand horizontal.
pivot=rig.data.bones['forearm.L'].head_local.copy()
turn=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-58),4,'X')@Matrix.Translation(-pivot)
handhead=rig.data.bones['hand.L'].head_local.copy();handmove=Matrix.Translation(turn@handhead-handhead)
for obj in m.parts:
    if any(g.name in ['forearm.L','hand.L'] for g in obj.vertex_groups):
        transform=handmove if 'hand.L' in obj.vertex_groups else turn
        for v in obj.data.vertices:v.co=transform@v.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:rig.data.edit_bones[name].transform(handmove if name=='hand.L' else turn)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig);print('OCEANO_GEOMETRY_READY',len(mesh.data.vertices),flush=True)
bake_surfaces(mesh,'oceano_v2');ground_fast(rig,mesh)
rig['reference']='public/mascots/oceano.webp';rig['revision']=2
scene=bpy.context.scene;scene.render.fps=30;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'oceano.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'oceano.glb')
(OUT/'model.json').write_text(json.dumps({'name':'Titán del Océano','revision':2,'reference':'/mascots/oceano.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
render_review(OUT,rig,height=2,scale=4.6,face_target=3.43)
print('OCEANO_V2_READY',flush=True)
