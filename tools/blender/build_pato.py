"""Individual Pato revision. Writes a review candidate, never the public asset.
Blender --background --factory-startup -t 6 --python tools/blender/build_pato.py
"""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).parent))
from build_roster import Model, mat, ground, aim, ROOT, SOURCE, die
from glb_textures import deduplicate_textures

OUT = ROOT/'assets/mascots3d/pato/revision2'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(52)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig = bpy.data.objects['Demonio_Salvaje']; rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.rotation_euler = (0,0,0); bone.location = (0,0,0)
for obj in list(bpy.data.objects):
    if obj != rig: bpy.data.objects.remove(obj, do_unlink=True)
rig.name = 'Pato_Salvaje'
bpy.ops.outliner.orphans_purge(do_recursive=True)

def surface(name, color, metal, rough, grain):
    material = mat(name, color, metal, rough)
    nt = material.node_tree; n = nt.nodes; l = nt.links; p = n['Principled BSDF']
    coord = n.new('ShaderNodeTexCoord')
    noise = n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = grain
    noise.inputs['Detail'].default_value = 3
    l.new(coord.outputs['Object'], noise.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = tuple(c*.40 for c in color)+(1,)
    ramp.color_ramp.elements[1].color = tuple(min(1,c*1.3) for c in color)+(1,)
    l.new(noise.outputs['Fac'], ramp.inputs[0]); l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.23; bump.inputs['Distance'].default_value=.003
    l.new(noise.outputs['Fac'],bump.inputs['Height']); l.new(bump.outputs['Normal'],p.inputs['Normal'])
    return material

gold = surface('Oro antiguo cepillado',(.40,.23,.065),.82,.34,110)
edge = mat('Relieves de oro claro',(.64,.40,.13),.78,.29)
bronze = surface('Bronce ennegrecido',(.085,.055,.025),.75,.42,130)
yellow = surface('Esmalte amarillo',(.68,.37,.008),.5,.29,90)
feathers = surface('Plumaje ocre',(.21,.14,.065),0,.75,150)
cream = surface('Plumas claras',(.48,.36,.19),0,.68,165)
billmat = surface('Pico naranja natural',(.59,.23,.025),.05,.37,135)
feetmat = surface('Escamas de las patas',(.28,.12,.028),0,.62,170)
cloth = surface('Terciopelo carbón',(.018,.013,.019),0,.87,190)
dark = mat('Cavidades oscuras',(.012,.006,.003),0,.65)
eye = mat('Iris amarillo',(.95,.52,.005),.05,.25,2)
blackgem = mat('Obsidiana de la corona',(.016,.018,.022),.6,.20)

class Sculpt(Model):
    def ball(self,name,at,scale,material,bone='head'):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16,location=at)
        obj=bpy.context.object;obj.scale=scale
        return self.finish(obj,name,material,bone)
    def line(self,name,pts,r,material,bone='chest',sides=6):
        return self.tube(name,pts,[r]*len(pts),material,bone,sides)
    def panel(self,name,pts,material,bone,trim=True,depth=.04):
        obj=self.plate(name,pts,material,bone,depth)
        if trim:self.line(name+' borde',[(x,y-.012,z) for x,y,z in pts+[pts[0]]],.012,edge,bone)
        return obj
    def feather(self,name,start,end,width,material,bone,engraved=False):
        a=Vector(start);b=Vector(end);d=b-a
        side=Vector((d.z,0,-d.x)).normalized();vs=[];fs=[];rows=9
        for i in range(rows):
            t=i/(rows-1);p=a+d*t;w=width*math.sin(math.pi*t)**.65
            p.y-=.045*math.sin(math.pi*t)
            for j in range(3):
                q=p+side*w*(j-1);q.y+=abs(j-1)*.025*math.sin(math.pi*t);vs.append(q)
            if i:
                for j in range(2):k=(i-1)*3+j;fs.append((k,k+1,k+4,k+3))
        obj=self.mesh(name,vs,fs,material,bone)
        self.line(name+' rachis',[a+Vector((0,-.008,0)),a+d*.5+Vector((0,-.052,0)),b],.006 if engraved else .003,edge if engraved else cream,bone,5)
        if engraved:
            for t in [.25,.40,.55,.70]:
                p=a+d*t+Vector((0,-.055*math.sin(math.pi*t),0));w=width*math.sin(math.pi*t)**.65
                for s in [-1,1]:self.line('Barbe gravée',[p,p+d*.08+side*w*s*.85],.0035,bronze,bone,5)
        return obj

m=Sculpt()
# Compact avian anatomy under overlapping armor, rather than a human suit.
m.ball('Poitrine',(0,.02,2.38),(.53,.31,.48),feathers,'chest')
m.ball('Ventre',(0,.02,1.99),(.41,.29,.37),feathers,'spine')
m.ball('Bassin',(0,.07,1.65),(.43,.30,.28),feathers,'hips')
m.tube('Cou emplumé',[(0,.04,2.72),(0,.035,3.12)],[.19,.20],feathers,'neck',24)
for s in [-1,1]:
    side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
    m.ball('Aile supérieure',(s*.78,.01,2.41),(.23,.24,.35),feathers,ua)
    end=Vector((1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70))
    m.tube('Avant-bras',[(s*.96,0,2.16),end],[.17,.14],feathers,fa,20)
    m.tube('Bracelet ouvragé',[(s*.98,-.015,2.13),end],[.21,.17],bronze,fa,24)
    for t in [0,.15,.85,1]:
        p=Vector((s*.98,-.015,2.13)).lerp(end,t)
        direction=(end-Vector((s*.98,-.015,2.13))).normalized();u=direction.cross(Vector((0,1,0))).normalized();v=direction.cross(u)
        radius=.214-.04*t
        m.line('Jonc du brassard',[p+(u*math.cos(a*math.tau/32)+v*math.sin(a*math.tau/32))*radius for a in range(33)],.013,edge,fa)
    palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
    m.ball('Paume',palm,(.17,.17,.10) if s==1 else (.16,.13,.19),feathers,hand)
    for f in range(4):
        x=palm.x+(f-1.5)*.067
        pts=[(x,-.62,1.97),(x,-.77,2.00),(x,-.79,2.10)] if s==1 else [(x,-.10,1.49),(x,-.18,1.38),(x,-.22,1.44)]
        m.tube('Doigt emplumé',pts,[.044,.040,.025],feathers,hand,10)
    # Three curved shell layers and actual feather-shaped wing blades.
    for layer in range(3):
        z=2.83-layer*.12;x=s*(.60+layer*.06)
        pts=[(x-s*.18,-.20,z),(x+s*.10,-.19,z+.04),(x+s*.31,-.09,z-.14),(x+s*.26,-.28,z-.22),(x-s*.18,-.29,z-.16)]
        m.panel('Écaille épaulière',pts,gold,ua,depth=.32)
        for k in range(5):m.ball('Rivet épaulière',(x+s*(-.10+k*.075),-.315,z-.145),(.013,.009,.013),edge,ua)
    for row in range(3):
        for k in range(6):
            start=(s*(.58+k*.048),-.13-row*.055,2.73-row*.09)
            end=(s*(.85+k*.105),-.11-row*.055,3.00+k*.105-row*.17)
            m.feather('Plume armure',start,end,.065 if row else .080,gold if row%2 else edge,ua,True)
    m.ball('Médaillon épaule',(s*.59,-.345,2.65),(.13,.035,.16),bronze,ua)
    m.gem('Losange épaule',(s*.59,-.39,2.65),(.078,.113),yellow,ua)
    # Organic thighs and scaly shins lead into broad webbed feet.
    m.ball('Cuisse emplumée',(s*.34,.02,1.25),(.26,.26,.36),feathers,th)
    for row in range(5):
        for k in range(6):
            x=s*.34+(k-2.5)*.075;z=1.46-row*.09;y=-.205-.035*math.sin(k*math.pi/5)
            m.feather('Plume cuisse',(x,y,z),(x+s*.03,y-.02,z-.20),.055,cream if (k+row)%4==0 else feathers,th)
    m.tube('Patte écailleuse',[(s*.38,.01,.98),(s*.40,0,.30),(s*.40,-.12,.13)],[.105,.078,.10],feetmat,sh,20)
    for k in range(11):
        z=.31+k*.05;m.line('Écaille tibia',[(s*.4-.065,-.060,z),(s*.4,-.091,z-.01),(s*.4+.065,-.060,z)],.009,billmat,sh)
    base=(s*.40,-.05,.12)
    toes=[(s*.40+(k-1)*.22,-.59+.06*abs(k-1),.065) for k in range(3)]
    for k,t in enumerate(toes):
        mid=((base[0]+t[0])*.5,-.31,.08)
        m.tube('Doigt du pied',[base,mid,t],[.055,.043,.021],feetmat,foot,10)
        m.tube('Ongle',[t,(t[0],t[1]-.07,.045)],[.023,.001],bronze,foot,8)
    for k in range(2):
        a=Vector(toes[k]);b=Vector(toes[k+1]);root=Vector(base)
        m.panel('Membrane palmée',[tuple(root),tuple(a),tuple((a+b)*.5+Vector((0,.08,0))),tuple(b)],feetmat,foot,False,.018)
    # The breastplate follows a round chest and frames enamel lightning inlays.
    pts=[(s*.03,-.31,2.71),(s*.33,-.285,2.70),(s*.49,-.20,2.46),(s*.39,-.31,2.24),(s*.08,-.38,2.22)]
    m.panel('Coraza antigua',pts,bronze,'chest')
    m.panel('Esmalte pecho',[(s*.09,-.355,2.63),(s*.27,-.34,2.62),(s*.37,-.31,2.40),(s*.25,-.37,2.30),(s*.11,-.405,2.30)],yellow,'chest')
    m.line('Rayo oscuro',[(s*.20,-.38,2.61),(s*.14,-.40,2.49),(s*.23,-.40,2.48),(s*.19,-.42,2.33)],.010,bronze,'chest')
    for row in range(3):
        z=2.24-row*.16
        m.panel('Lámina abdomen',[(s*.02,-.34,z),(s*.33,-.28,z+.07),(s*.35,-.28,z-.06),(s*.07,-.36,z-.16)],gold,'spine')
    m.panel('Faldón cadera',[(s*.12,-.31,1.76),(s*.44,-.21,1.74),(s*.56,-.20,1.30),(s*.22,-.34,1.40)],bronze,th)
    m.panel('Inserto faldón',[(s*.20,-.35,1.69),(s*.39,-.26,1.66),(s*.46,-.27,1.42),(s*.28,-.36,1.48)],yellow,th)
    # Scrollwork on the breast: real curves survive glTF export.
    for k in range(4):
        cx=s*(.11+k*.075);cz=2.70-k*.025
        pts=[]
        for i in range(22):
            a=i/21*math.pi*2.6;r=.030*(1-i/25)
            pts.append((cx+s*r*math.cos(a),-.343,cz+r*math.sin(a)))
        m.line('Filigrana pecho',pts,.0045,edge,'chest',5)

m.panel('Faldón de tela',[(-.17,-.29,1.64),(.17,-.29,1.64),(.18,-.37,.77),(0,-.40,.62),(-.18,-.37,.77)],cloth,'hips')
for s in [-1,1]:
    m.line('Bordado faldón',[(s*.12,-.32,1.60),(s*.13,-.40,.81),(0,-.43,.70)],.009,edge,'hips')
m.gem('Hebilla exterior',(0,-.41,1.71),(.17,.23),gold,'hips')
m.gem('Hebilla esmalte',(0,-.49,1.71),(.09,.14),yellow,'hips')
# Long dark cape with sculpted folds and embroidered scrolling edges.
vs=[];fs=[];cols=17;rows=15
for r in range(rows):
    t=r/(rows-1)
    for c in range(cols):
        u=c/(cols-1)*2-1
        x=u*(.46+.58*t);y=.24+.36*t+.075*math.cos(u*math.pi*4)*t
        z=2.76-2.35*t-.05*math.cos(c*2.5)*t**8
        vs.append((x,y,z))
        if r and c:a=(r-1)*cols+c-1;b=r*cols+c-1;fs.append((a,a+1,b+1,b))
cape=m.mesh('Capa de terciopelo',vs,fs,cloth,'chest')
mod=cape.modifiers.new('Grosor tela','SOLIDIFY');mod.thickness=.018;bpy.ops.object.modifier_apply(modifier=mod.name)
for s in [-1,1]:
    m.line('Borde capa',[(s*(.46+.58*t),.24+.36*t-.012,2.76-2.35*t) for t in [i/20 for i in range(21)]],.014,edge,'chest')
    for k in range(10):
        t=.15+k*.075;cx=s*(.39+.58*t);cy=.24+.36*t-.04;cz=2.76-2.35*t
        m.line('Bordado espiral',[(cx+s*.04*(1-i/30)*math.cos(i/24*math.tau*1.4),cy,cz+.07*(1-i/30)*math.sin(i/24*math.tau*1.4)) for i in range(25)],.004,edge,'chest',5)
# Unified feathered head, cheek fans and a broad, downturned duck bill.
m.ball('Cráneo',(0,.015,3.31),(.34,.27,.36),feathers)
m.ball('Mandíbula',(0,-.10,3.12),(.28,.24,.19),feathers)
for s in [-1,1]:
    m.ball('Mejilla',(s*.20,-.11,3.22),(.19,.18,.23),feathers)
    for row in range(5):
        for k in range(5):
            x=s*(.12+k*.04);z=3.52-row*.10;y=-.22+.02*k
            m.feather('Pluma de mejilla',(x,y,z),(x+s*(.12+row*.008),y+.04,z-.12),.045,cream if (row+k)%3==0 else feathers,'head')
    m.ball('Órbita profunda',(s*.16,-.254,3.36),(.145,.055,.10),dark)
    m.ball('Ojo de ámbar',(s*.16,-.293,3.35),(.102,.028,.064),eye)
    m.ball('Pupila',(s*.16,-.319,3.35),(.019,.007,.045),dark)
    m.tube('Ceja severa',[(s*.035,-.293,3.37),(s*.12,-.304,3.44),(s*.24,-.23,3.48),(s*.31,-.13,3.47)],[.045,.060,.045,.005],cream,'head',16)
    for k in range(7):
        x=s*(.055+k*.035)
        m.feather('Pluma de frente',(x,-.24,3.42),(x+s*.015,-.15,3.68),.022,cream,'head')

def bill(name,lower=False):
    vs=[];fs=[];rows=15;cols=25
    for i in range(rows):
        t=i/(rows-1);w=.17+.14*math.sin(math.pi*t*.85)
        y=-.22-.53*t
        center=3.22-.12*t+.055*math.sin(math.pi*t) if not lower else 3.085-.04*t
        for j in range(cols):
            u=j/(cols-1)*2-1
            z=center-(.045 if not lower else -.023)*u*u
            vs.append((u*w,y+.08*abs(u)**3*t,z))
            if i and j:a=(i-1)*cols+j-1;fs.append((a,a+1,a+cols+1,a+cols))
    obj=m.mesh(name,vs,fs,billmat,'head')
    mod=obj.modifiers.new('Espesor pico','SOLIDIFY');mod.thickness=.035;bpy.ops.object.modifier_apply(modifier=mod.name)
    rim=[vs[i*cols] for i in range(rows)]+vs[-cols:]+[vs[i*cols+cols-1] for i in reversed(range(rows))]
    m.line('Labio pico',rim,.018,billmat,'head',8)
bill('Pico superior curvo');bill('Mandíbula inferior',True)
m.ball('Interior del pico',(0,-.47,3.083),(.25,.24,.027),dark)
for s in [-1,1]:m.ball('Orificio nasal',(s*.09,-.38,3.229),(.027,.040,.012),dark)
# A substantial open crown, black gems and alternating spear points.
for z,rad in [(3.61,.32),(3.67,.325),(3.75,.34)]:
    m.line('Anillo corona',[(rad*math.cos(a*math.tau/64),.235*math.sin(a*math.tau/64),z) for a in range(65)],.018,edge,'head',8)
for k in range(10):
    a=k*math.tau/10;center=Vector((.335*math.sin(a),-.24*math.cos(a),3.70));tangent=Vector((math.cos(a),math.sin(a),0));normal=Vector((math.sin(a),-math.cos(a),0))
    height=.48 if k%2==0 else .32
    outline=[center-tangent*.11+Vector((0,0,-.06)),center+tangent*.11+Vector((0,0,-.06)),center+tangent*.08+Vector((0,0,.08)),center+tangent*.045+Vector((0,0,height-.10)),center+Vector((0,0,height)),center-tangent*.045+Vector((0,0,height-.10)),center-tangent*.08+Vector((0,0,.08))]
    m.panel('Punta calada corona',[tuple(p) for p in outline],gold,'head',False,.018)
    m.line('Borde corona',outline+[outline[0]],.009,edge,'head')
    p=center+normal*.024+Vector((0,0,.07));w=.036;h=.067
    m.mesh('Obsidiana corona',[p-tangent*w,p+Vector((0,0,h)),p+tangent*w,p-Vector((0,0,h)),p+normal*.024],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],blackgem,'head',False)

die(m,mat('Dado oro',(.65,.36,.01),.65,.24),mat('Puntos oscuros',(.055,.024,.003),.2,.40))
# Compress the lower silhouette and all rest bones together, keeping the head large.
def compact(v):
    p=v.copy();p.z=p.z*.80 if p.z<2.78 else p.z-.556;return p
for obj in m.parts:
    for v in obj.data.vertices:v.co=compact(v.co)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for bone in rig.data.edit_bones:
    bone.head=compact(bone.head);bone.tail=compact(bone.tail)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig)

def bake(obj):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.002);bpy.ops.object.mode_set(mode='OBJECT')
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.margin=4
    materials=list(obj.data.materials);targets=[];images={}
    for material in materials:
        target=material.node_tree.nodes.new('ShaderNodeTexImage');material.node_tree.nodes.active=target;targets.append(target)
    for key,kind,options,space in [('color','DIFFUSE',{'pass_filter':{'COLOR'}},'sRGB'),('normal','NORMAL',{},'Non-Color')]:
        img=bpy.data.images.new('pato_v2_'+key,2048,2048);img.colorspace_settings.name=space
        for target in targets:target.image=img
        bpy.ops.object.bake(type=kind,**options);img.pack();images[key]=img
    for material in materials:
        nt=material.node_tree;p=nt.nodes['Principled BSDF']
        for name in ['Base Color','Normal']:
            for link in list(p.inputs[name].links):nt.links.remove(link)
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=images['color'];nt.links.new(tex.outputs['Color'],p.inputs['Base Color'])
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=images['normal'];norm=nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tex.outputs['Color'],norm.inputs['Color']);nt.links.new(norm.outputs['Normal'],p.inputs['Normal'])
    print('PATO_TEXTURES_BAKED',flush=True)
bake(mesh)
ground(rig,mesh)
rig['reference']='public/mascots/pato.webp';rig['revision']=2
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=61
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'pato.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'pato.glb')
(OUT/'model.json').write_text(json.dumps({'name':'Pato Salvaje','revision':2,'reference':'/mascots/pato.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'individual reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')
stage=mat('Escenario mate',(.012,.018,.027),.15,.55)
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.8,depth=.09,location=(0,0,-.065));bpy.context.object.data.materials.append(stage)
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.12));bpy.context.object.data.materials.append(stage)
for name,loc,color,power,size in [('Principal',(2,-4,6),(1,.88,.68),650,4),('Relleno',(-3,-3,3),(.61,.72,1),380,3),('Borde',(-2,2,4),(1,.65,.21),700,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,1.8))
data=bpy.data.cameras.new('Cámara');camera=bpy.data.objects.new('Cámara',data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=(2.1,-10,3.5);aim(camera,(0,0,1.77));data.type='ORTHO';data.ortho_scale=4.20
scene.world.color=(.025,.025,.035);scene.use_nodes=False;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'model.blend'),compress=True)
scene.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Celebrate'];scene.frame_set(32)
scene.render.filepath=str(OUT/'celebrate.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
camera.location=(1,-6,3.3);aim(camera,(0,-.10,2.94));data.ortho_scale=1.55
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.filepath=str(OUT/'detail.png');bpy.ops.render.render(write_still=True)
print('PATO_V2_READY',len(mesh.data.vertices),flush=True)
