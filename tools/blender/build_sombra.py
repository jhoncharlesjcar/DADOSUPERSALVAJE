"""La Sombra: individual reference study. Writes review candidates only."""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0, str(Path(__file__).parent))
from build_roster import ROOT, SOURCE, mat, die
from reference_pipeline import Sculpt, bake_surfaces, ground_fast, render_review
from glb_textures import deduplicate_textures

OUT = ROOT/'assets/mascots3d/sombra/revision2'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig = bpy.data.objects['Demonio_Salvaje']; rig.animation_data.action = None
for b in rig.pose.bones: b.rotation_euler=(0,0,0); b.location=(0,0,0)
for obj in list(bpy.data.objects):
    if obj != rig: bpy.data.objects.remove(obj, do_unlink=True)
rig.name='La_Sombra'; bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name, color, metal, rough, grain=180):
    material=mat(name,color,metal,rough); nt=material.node_tree; n=nt.nodes; l=nt.links; p=n['Principled BSDF']
    coord=n.new('ShaderNodeTexCoord'); noise=n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=grain
    noise.inputs['Detail'].default_value=2; l.new(coord.outputs['Object'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=tuple(c*.75 for c in color)+(1,)
    ramp.color_ramp.elements[1].color=tuple(c*1.15 for c in color)+(1,)
    l.new(noise.outputs['Fac'],ramp.inputs[0]); l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.18; bump.inputs['Distance'].default_value=.0015
    l.new(noise.outputs['Fac'],bump.inputs['Height']); l.new(bump.outputs['Normal'],p.inputs['Normal'])
    return material

armor=surface('Acero negro violeta',(.035,.025,.055),.62,.39)
edge=mat('Acero grabado',(.18,.12,.24),.66,.38)
cloth=surface('Tela de la capucha',(.017,.012,.028),.03,.88,220)
lining=surface('Tela interior violeta',(.035,.012,.057),.02,.92)
under=surface('Cuero de las mangas',(.018,.014,.023),.08,.65)
black=mat('Vacío sin rostro',(.00015,.0001,.0003),0,1)
black.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=0
glow=mat('Runas amatista',(.47,.045,.82),.10,.40,1.5)
eyes=mat('Ojos de energía',(.69,.13,1),0,.38,3.2)
m=Sculpt()

def solid(obj, thickness=.018):
    mod=obj.modifiers.new('Espesor','SOLIDIFY'); mod.thickness=thickness
    bpy.ops.object.modifier_apply(modifier=mod.name); return obj

def panel(name, points, bone, material=armor, depth=.03, rim=True):
    obj=m.plate(name,points,material,bone,depth)
    if rim: m.line(name+' ribete',[(x,y-.009,z) for x,y,z in points+[points[0]]],.008,edge,bone)
    return obj

def rune(at, size, bone, kind=0):
    x,y,z=at
    shapes=[[[(-.3,.45),(0,.15),(.3,.45),(0,-.45)],[(0,.15),(-.3,-.05)]],
            [[(-.3,-.5),(-.3,.5),(.3,.12),(-.3,-.08)],[(.05,.0),(.3,-.4)]],
            [[(-.35,.35),(0,0),(.35,.35)],[(0,0),(0,-.5)],[(-.18,-.25),(.18,-.25)]],
            [[(0,.5),(-.3,0),(0,-.5),(.3,0),(0,.5)],[(0,.1),(0,-.2)]],
            [[(-.25,.4),(.2,.2),(-.2,-.2),(.25,-.4)],[(.2,.2),(.25,.45)]]]
    for stroke in shapes[kind%5]:
        m.line('Sigilo',[(x+u*size,y,z+v*size) for u,v in stroke],.005,glow,bone,6)

# A hollow hood, with a draped pointed aperture instead of a visible head.
# Front aperture runs top -> right cheek -> chin -> left cheek -> top.
outline=[(0,-.30,3.87),(.10,-.325,3.79),(.20,-.35,3.62),(.28,-.34,3.43),(.30,-.30,3.23),(.19,-.28,3.06),(0,-.28,2.99),(-.19,-.28,3.06),(-.30,-.30,3.23),(-.28,-.34,3.43),(-.20,-.35,3.62),(-.10,-.325,3.79)]
# Smooth subdivision of a fabric surface from the opening to the back pole.
vs=[]; fs=[]; rings=13; cols=len(outline)
for r in range(rings):
    t=r/(rings-1)
    for c,(x,y,z) in enumerate(outline):
        bulge=1+.25*math.sin(math.pi*t)
        vs.append((x*(1-t)*bulge,y*(1-t)+.24*t+.22*math.sin(math.pi*t),3.43+(z-3.43)*(1-t)*bulge+.08*math.sin(math.pi*t)))
        if r:
            p=(r-1)*cols+c; q=(r-1)*cols+(c+1)%cols; fs.append((p,q,q+cols,p+cols))
hood=m.mesh('Capucha hueca',vs,fs,cloth,'head')
sub=hood.modifiers.new('Pliegues suaves','SUBSURF');sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name)
solid(hood,.022)
# Aperture piping follows the same subdivided edge, not a polygonal metal frame.
curve=bpy.data.curves.new('Costura curva','CURVE');curve.dimensions='3D';curve.resolution_u=10;curve.bevel_depth=.005;curve.bevel_resolution=2
spline=curve.splines.new('NURBS');spline.points.add(cols-1)
for p,co in zip(spline.points,outline):p.co=(*co,1)
spline.use_cyclic_u=True;spline.order_u=3
obj=bpy.data.objects.new('Costura del borde',curve);bpy.context.collection.objects.link(obj)
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH');m.finish(bpy.context.object,'Costura del borde',edge,'head')
# Recessed, flat black cavity prevents skin, nose, lips or chin from appearing.
cavity=[(x*.94,y+.10,3.43+(z-3.43)*.90) for x,y,z in outline]
m.mesh('Oscuridad interior',cavity,[tuple(range(cols))],black,'head',False)
for s in [-1,1]:
    panel('Mirada afilada',[(s*.055,-.29,3.47),(s*.19,-.275,3.52),(s*.15,-.287,3.465),(s*.085,-.295,3.452)],'head',eyes,.009,False)
    # Subtle sewn folds extend along either side of the hood.
    m.line('Costura lateral',[(s*.09,-.21,3.79),(s*.24,-.20,3.57),(s*.31,-.13,3.30),(s*.22,-.06,3.08)],.004,edge,'head',6)

# Compact the hood and seat it into the cowl instead of on an exposed tall neck.
for obj in m.parts:
    for vx in obj.data.vertices:vx.co.z=3.43+(vx.co.z-3.43)*.92-.12

m.ball('Torso vestido',(0,.02,2.43),(.40,.23,.41),under,'chest')
m.ball('Cintura',(0,0,2.03),(.28,.21,.30),under,'spine')
m.ball('Cadera',(0,.01,1.65),(.32,.22,.24),under,'hips')
m.tube('Cuello oculto',[(0,.03,2.75),(0,.03,3.10)],[.17,.16],black,'neck',24)
for k in range(4):
    z=2.82+k*.047; rx=.38-k*.025; ry=.24-k*.013
    m.line('Pliegue del cuello',[(rx*math.sin(a),-ry*math.cos(a),z-.065*math.cos(a)+.012*math.sin(a*3)) for a in [i*math.tau/64 for i in range(65)]],.034,cloth,'neck',10)

# The chest has continuous curved plates, narrow ribs and inset luminous glyphs.
for s in [-1,1]:
    vs=[];fs=[];rows=10;cols=17
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);x=s*(.025+u*(.38-.02*t));z=2.77-.41*t-.12*u*t
            y=-.26-.045*math.sin(u*math.pi)+.10*u*u
            vs.append((x,y,z))
            if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    solid(m.mesh('Pectoral curvo',vs,fs,armor,'chest'),.035)
    for row in [0,rows-1]:m.line('Ribete del pecho',[(x,y-.01,z) for x,y,z in vs[row*cols:(row+1)*cols]],.009,edge,'chest')
    for k in range(3):rune((s*(.11+k*.09),-.31+.016*k,2.68-k*.04),.09,'chest',k)
    for k in range(3):
        z=2.39-k*.16
        panel('Lámina oblicua',[(s*.025,-.29,z),(s*.29,-.20,z+.06),(s*.30,-.20,z-.05),(s*.04,-.30,z-.20)],'spine')
        rune((s*.13,-.30,z-.07),.10,'spine',k+2)
    panel('Cinturón angular',[(s*.02,-.27,1.95),(s*.30,-.18,2.02),(s*.34,-.19,1.83),(s*.04,-.30,1.74)],'hips')
    for k in range(3):rune((s*(.10+k*.07),-.31+.025*k,1.88+k*.01),.07,'hips',k)
panel('Peto central',[(-.09,-.305,2.76),(0,-.34,2.83),(.09,-.305,2.76),(.065,-.33,2.47),(0,-.35,2.36),(-.065,-.33,2.47)],'chest')
rune((0,-.365,2.66),.15,'chest',3)
m.gem('Hebilla tallada',(0,-.32,1.86),(.16,.22),edge,'hips')
m.gem('Inserto de hebilla',(0,-.405,1.86),(.11,.16),armor,'hips')
rune((0,-.49,1.86),.17,'hips',2)

for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    start=Vector((s*.59,0,2.63));elbow=Vector((s*.96,0,2.16))
    m.tube('Manga',[start,start.lerp(elbow,.5),elbow],[.17,.155,.125],under,ua,24)
    for k in range(8):
        p=start.lerp(elbow,.12+k*.10)
        m.line('Arruga de manga',[(p.x+s*.13*math.sin(a),-.14*math.cos(a),p.z+.045*math.sin(a)) for a in [j*math.tau/32 for j in range(33)]],.017,cloth,ua,8)
    m.ball('Base de hombrera',(s*.60,.015,2.64),(.20,.17,.18),under,ua)
    for k in range(4):
        vs=[];fs=[];rows=7;cols=17
        for r in range(rows):
            t=r/(rows-1)
            for c in range(cols):
                a=c/(cols-1)*math.pi
                x=s*(.49+k*.075+.23*t);y=-.23*math.cos(a)
                z=2.79-k*.105+.12*math.sin(a)+.11*(1-t)-.10*t
                vs.append((x,y,z))
                if r and c:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
        solid(m.mesh('Hombrera laminada',vs,fs,armor,ua),.025)
        m.line('Ribete de hombrera',[(x,y-.008,z) for x,y,z in vs[-cols:]],.009,edge,ua)
        z=2.80-k*.105
        panel('Escama frontal del hombro',[(s*(.46+k*.045),-.245,z+.035),(s*(.69+k*.055),-.245,z+.035),(s*(.81+k*.04),-.235,z-.12),(s*(.60+k*.055),-.27,z-.18),(s*(.46+k*.045),-.26,z-.10)],ua,armor,.025)
        if k<3:rune((s*(.61+k*.055),-.285,z-.05),.075,ua,k+1)
    # Raised inner shoulder fins are cloth-backed metal, rather than horns.
    panel('Cuello de hombrera',[(s*.37,.10,2.73),(s*.43,.09,3.04),(s*.52,.08,3.00),(s*.63,.08,2.69)],ua)
    m.ball('Broche circular',(s*.39,-.22,2.78),(.074,.025,.081),edge,'chest')
    m.ball('Centro del broche',(s*.39,-.249,2.78),(.052,.010,.059),armor,'chest')
    rune((s*.39,-.263,2.78),.075,'chest',4)
    end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    m.tube('Antebrazo vestido',[elbow,end],[.13,.10],under,fa,24)
    m.tube('Brazal tallado',[elbow.lerp(end,.1),end],[.165,.115],armor,fa,24)
    d=(end-elbow).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    for t in [.12,.23,.8,1]:
        p=elbow.lerp(end,t);rad=.17-.045*t
        m.line('Ribete de brazal',[p+rad*(u*math.cos(j*math.tau/32)+v*math.sin(j*math.tau/32)) for j in range(33)],.009,edge,fa)
    front=[(s*.84,-.10,2.15),(s*.96,-.18,2.24),(s*1.11,-.13,2.12),(s*1.19,end.y-.11,end.z),(s*1.04,end.y-.14,end.z-.04)]
    panel('Placa del guante',front,fa)
    rune((s*1.00,-.205,2.08),.15,fa,3)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Guante',palm,(.13,.14,.075) if s==1 else (.13,.095,.16),under,hand)
    for k in range(4):
        x=palm.x+(k-1.5)*.062
        pts=[(x,-.61,1.98),(x,-.73,2.02),(x,-.76,2.14),(x,-.72,2.21)] if s==1 else [(x,-.08,1.48),(x,-.13,1.33),(x,-.22,1.27),(x,-.26,1.31)]
        m.tube('Garra articulada',pts,[.028,.026,.019,.001],armor,hand,12)
        m.ball('Nudillo',pts[1],(.030,.027,.026),edge,hand)
    m.tube('Pulgar con garra',[(palm.x-s*.09,palm.y,palm.z),(palm.x-s*.18,palm.y-.07,palm.z-.045),(palm.x-s*.21,palm.y-.17,palm.z+.04)],[.036,.029,.001],armor,hand,12)
    m.tube('Pantalón',[(s*.29,.02,1.53),(s*.37,0,.97)],[.18,.135],cloth,th,24)
    for k in range(3):
        z=1.77-k*.20
        panel('Escama de faldón',[(s*.17,-.23,z),(s*.36,-.17,z+.04),(s*.52,-.13,z-.27),(s*.25,-.25,z-.22)],th)
        for q in range(2):rune((s*(.28+q*.075),-.28+q*.03,z-.10-q*.025),.085,th,k+q)
    m.tube('Bota alta',[(s*.38,0,.96),(s*.40,.01,.22)],[.15,.105],under,sh,24)
    panel('Rodillera de punta',[(s*.24,-.16,1.03),(s*.37,-.23,1.16),(s*.52,-.16,1.03),(s*.46,-.24,.83),(s*.38,-.27,.75),(s*.27,-.23,.84)],sh)
    rune((s*.38,-.28,.97),.14,sh,0)
    panel('Greba',[(s*.27,-.18,.78),(s*.50,-.17,.78),(s*.46,-.18,.30),(s*.39,-.24,.23),(s*.30,-.20,.32)],sh)
    for k in range(4):rune((s*.39,-.245,.68-k*.095),.07,sh,k)
    m.ball('Escarpe',(s*.40,-.12,.13),(.14,.24,.115),armor,foot)
    for k in range(3):
        x=s*.40+(k-1)*.083
        m.tube('Punta de bota',[(x,-.23,.13),(x,-.34,.075),(x,-.41,.045)],[.05,.04,.002],armor,foot,12)
        m.line('Grabado de bota',[(x,-.16,.235),(x,-.27,.17),(x,-.34,.11)],.004,edge,foot,6)

# Flowing layered cloth, with real holes and non-uniform hanging strips.
for s in [-1,1]:
    vs=[];fs=[];rows=29;cols=23
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1);x=s*(.025+u*(.45+.36*t)+.08*math.sin(t*5+u*3)*t)
            y=.22+.40*t+.065*math.sin(u*math.pi*7+t*3)*t
            z=2.82-2.43*t-.19*math.sin(u*17)**2*t**7
            vs.append((x,y,z))
            if r and c:
                hole=(r in [19,20,21] and c in [6,7]) or (r>21 and c in [3,10,16,20] and r>24-c%3)
                if not hole:q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    cape=solid(m.mesh('Manto desgarrado',vs,fs,cloth,'chest'),.008)
    hips=cape.vertex_groups.new(name='hips');chest=cape.vertex_groups['chest']
    for vx in cape.data.vertices:
        w=max(0,min(.8,(2.5-vx.co.z)/1.3));chest.add([vx.index],1-w,'REPLACE');hips.add([vx.index],w,'REPLACE')
    # Folded side skirts stay close to the hips, exposing the greaves.
    vs=[];fs=[];rows=17;cols=13
    for r in range(rows):
        t=r/(rows-1)
        for c in range(cols):
            u=c/(cols-1)
            vs.append((s*(.18+.40*u+.10*t),-.03+.22*u+.055*math.sin(u*18),1.64-1.02*t-.17*math.sin(u*11)**2*t**6))
            if r and c and not(r>12 and c in [3,8] and r>14-c%2):q=(r-1)*cols+c-1;fs.append((q,q+1,q+cols+1,q+cols))
    solid(m.mesh('Falda lateral',vs,fs,lining,'hips'),.008)

panel('Tabardo central',[(-.17,-.30,1.67),(.17,-.30,1.67),(.15,-.36,.92),(0,-.38,.71),(-.15,-.36,.92)],'hips',cloth,.018)
for k in range(5):rune((0,-.41,1.49-k*.145),.115,'hips',k)
for s in [-1,1]:
    m.line('Bordado del tabardo',[(s*.13,-.32,1.64),(s*.115,-.38,.95),(0,-.40,.77)],.005,edge,'hips',6)

die_start=len(m.parts)
die(m,mat('Dado de amatista',(.12,.018,.24),.38,.22,.06),mat('Puntos del dado',(.67,.32,.92),.1,.3,1.5))
die_center=Vector((1.10,-.59,2.30))
for obj in m.parts[die_start:]:
    for vx in obj.data.vertices:vx.co=die_center+(vx.co-die_center)*.88
pivot=rig.data.bones['forearm.L'].head_local.copy()
turn=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(-57),4,'X')@Matrix.Translation(-pivot)
handhead=rig.data.bones['hand.L'].head_local.copy();handmove=Matrix.Translation(turn@handhead-handhead)
for obj in m.parts:
    if any(g.name in ['forearm.L','hand.L'] for g in obj.vertex_groups):
        transform=handmove if 'hand.L' in obj.vertex_groups else turn
        for vx in obj.data.vertices:vx.co=transform@vx.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:rig.data.edit_bones[name].transform(handmove if name=='hand.L' else turn)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig);print('SOMBRA_GEOMETRY_READY',len(mesh.data.vertices),flush=True)
bake_surfaces(mesh,'sombra_v2');ground_fast(rig,mesh)
rig['reference']='public/mascots/sombra.webp';rig['revision']=2
scene=bpy.context.scene;scene.render.fps=30;rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'sombra.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'sombra.glb')
(OUT/'model.json').write_text(json.dumps({'name':'La Sombra','revision':2,'reference':'/mascots/sombra.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
render_review(OUT,rig,accent=(.56,.10,1),height=2,scale=4.6,face_target=3.43)
print('SOMBRA_V2_READY',flush=True)
