"""Nine original stylized mascots, sharing the approved Demonio animation skeleton.
Blender --background --factory-startup --python tools/blender/build_roster.py [-- slug]
The supplied .webp illustrations guide silhouettes; these are game models, not reconstructions.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/mascots3d/demonio/demonio.blend'
ROSTER=[
 ('pantera','Pantera Rosada',(.32,.025,.20),(.075,.018,.065),(.8,.035,.38),'cat'),
 ('pato','Pato Salvaje',(.62,.49,.23),(.35,.19,.045),(1,.65,.035),'duck'),
 ('oceano','Titán del Océano',(.025,.28,.34),(.025,.12,.17),(.025,.8,1),'sea'),
 ('fantasma','La Fantasma',(.31,.39,.44),(.36,.43,.51),(.65,.88,1),'ghost'),
 ('sombra','La Sombra',(.025,.016,.05),(.035,.018,.065),(.42,.06,1),'shadow'),
 ('rey_salvaje','El Rey Salvaje',(.42,.24,.08),(.018,.18,.08),(.04,1,.34),'lion'),
 ('emperador_viento','Emperador del Viento',(.09,.065,.075),(.23,.018,.065),(.9,.16,.34),'eagle'),
 ('bestia_fuego','Bestia de Fuego',(.55,.12,.025),(.28,.08,.018),(1,.26,.015),'fox'),
 ('poseidon','Poseidón',(.39,.22,.15),(.025,.06,.20),(.05,.35,1),'king'),
]

def mat(name,color,metal=0,rough=.45,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 return m

class Model:
 def __init__(self): self.parts=[]
 def finish(self,o,name,material,bone,smooth=True):
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  o.name=name;o.data.materials.append(material);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  for p in o.data.polygons:p.use_smooth=smooth
  o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE');self.parts.append(o);return o
 def ball(self,name,at,scale,material,bone='head'):
  bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=at);o=bpy.context.object;o.scale=scale
  return self.finish(o,name,material,bone)
 def mesh(self,name,verts,faces,material,bone,smooth=True):
  m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o)
  return self.finish(o,name,material,bone,smooth)
 def tube(self,name,points,radii,material,bone='head',sides=10):
  pts=list(map(Vector,points));vs=[];fs=[]
  for i,p in enumerate(pts):
   d=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized();ref=Vector((0,1,0)) if abs(d.y)<.9 else Vector((1,0,0))
   u=d.cross(ref).normalized();v=d.cross(u).normalized()
   for j in range(sides):
    a=j*math.tau/sides;vs.append(p+radii[i]*(u*math.cos(a)+v*math.sin(a)))
   if i:
    for j in range(sides):k=(j+1)%sides;fs.append(((i-1)*sides+j,(i-1)*sides+k,i*sides+k,i*sides+j))
  fs.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
  return self.mesh(name,vs,fs,material,bone)
 def plate(self,name,points,material,bone,depth=.07):
  n=len(points);vs=points+[(x,y+depth,z) for x,y,z in points]
  fs=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
  o=self.mesh(name,vs,fs,material,bone,False);mod=o.modifiers.new('Bisel','BEVEL');mod.width=.018;mod.segments=2
  bpy.ops.object.modifier_apply(modifier=mod.name);return o
 def gem(self,name,at,size,material,bone='chest'):
  x,y,z=at;w,h=size
  return self.mesh(name,[(x-w,y,z),(x,y,z+h),(x+w,y,z),(x,y,z-h),(x,y-.075,z),(x,y+.03,z)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,5,1),(1,5,2),(2,5,3),(3,5,0)],material,bone,False)
 def join(self,rig):
  bpy.ops.object.select_all(action='DESELECT')
  for o in self.parts:o.select_set(True)
  bpy.context.view_layer.objects.active=self.parts[0];bpy.ops.object.join();o=bpy.context.object;o.name='Mascot_Mesh'
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
  mod=o.modifiers.new('Esqueleto','ARMATURE');mod.object=rig;o.parent=rig;return o

def crown(m,metal,glow,z=3.64):
 pts=[(.34*math.cos(i*math.tau/32),.20*math.sin(i*math.tau/32),z) for i in range(33)]
 m.tube('Diadema',pts,[.045]*33,metal)
 for i in range(7):
  a=math.tau*i/7;x=.34*math.cos(a);y=.21*math.sin(a)
  m.tube('Punta de corona',[(x,y,z),(x*1.1,y*1.1,z+.28),(x*1.16,y*1.16,z+.42 if i%2==0 else z+.32)],[.065,.045,.001],metal,sides=6)
  m.gem('Joya corona',(x,y-.025,z+.10),(.045,.085),glow,'head')

def cloak(m,material,trim,ragged=False,coat=False):
 for side in [-1,1]:
  vs=[];fs=[];cols=8;rows=8
  for r in range(rows):
   t=r/(rows-1)
   for c in range(cols):
    u=c/(cols-1);x=side*(.035+u*(.60+.36*t));y=.24+.40*t+.09*math.sin(u*math.pi*4)
    z=2.76-2.48*t-(.16*(c%2) if ragged and r==rows-1 else 0)
    if coat:z-=.10; y-=.12
    vs.append((x,y,z))
    if r and c:a=(r-1)*cols+c-1;b=r*cols+c-1;fs.append((a,a+1,b+1,b))
  o=m.mesh('Capa plisada',vs,fs,material,'chest');mod=o.modifiers.new('Grosor','SOLIDIFY');mod.thickness=.025;bpy.ops.object.modifier_apply(modifier=mod.name)
  m.tube('Borde capa',[vs[c*cols+cols-1] for c in range(rows)],[.018]*rows,trim,'chest',8)

def body(m,skin,armor,metal,glow,kind):
 slim=kind in ['cat','ghost','shadow','eagle'];w=.49 if slim else .59
 m.ball('Torso',(0,.02,2.34),(w,.28,.50),skin,'chest');m.ball('Cintura',(0,0,1.98),(.34,.23,.32),skin,'spine')
 m.ball('Caderas',(0,0,1.57),(.42,.27,.24),armor,'hips');m.ball('Cuello',(0,0,2.88),(.18,.18,.25),skin,'neck')
 for s in [-1,1]:
  side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
  if kind=='sea':
   m.ball('Pectoral',(s*.23,-.15,2.48),(.25,.18,.22),skin,'chest')
  else:
   outline=[(s*.035,-.30,2.65),(s*.42,-.22,2.69),(s*.52,-.20,2.40),(s*.16,-.35,2.25),(s*.035,-.35,2.32)]
   m.plate('Coraza',outline,armor,'chest');m.tube('Filigrana coraza',outline[:3],[.022]*3,metal,'chest',8)
  for row in range(3):
   z=2.25-row*.15
   m.plate('Abdominal',[(s*.025,-.28,z),(s*.28,-.23,z+.02),(s*.26,-.26,z-.11),(s*.03,-.31,z-.13)],armor,'spine')
  m.ball('Hombro',(s*.63,0,2.61),(.24,.25,.25),skin,ua);m.ball('Brazo',(s*.80,0,2.39),(.21,.21,.33),skin,ua)
  m.ball('Codo',(s*.96,0,2.16),(.17,.18,.18),skin,fa)
  end=(1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70)
  m.tube('Brazal',[(s*.96,0,2.14),end],[.20,.14],armor,fa,16)
  palm=(1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55)
  m.ball('Mano',palm,(.17,.18,.12) if s==1 else (.17,.13,.21),skin,hand)
  for f in range(4):
   x=palm[0]+(f-1.5)*.075
   pts=[(x,-.61,1.96),(x,-.77,2.00),(x,-.79,2.10)] if s==1 else [(x,-.08,1.45),(x,-.13,1.28),(x+.02,-.20,1.25)]
   m.tube('Dedos',pts,[.035,.03,.008],skin,hand,8)
  for layer in range(3):
   x=s*(.60+layer*.09);z=2.79-layer*.10
   m.plate('Hombrera',[(x-s*.18,-.24,z),(x+s*.18,-.20,z+.05),(x+s*.27,-.18,z-.12),(x+s*.10,-.31,z-.20),(x-s*.18,-.28,z-.14)],armor,ua,.39)
   m.tube('Ribete hombrera',[(x-s*.15,-.32,z-.14),(x+s*.10,-.34,z-.20),(x+s*.25,-.22,z-.12)],[.017]*3,metal,ua,8)
  m.ball('Muslo',(s*.33,0,1.23),(.24,.25,.37),skin,th);m.ball('Rodilla',(s*.38,0,.90),(.20,.21,.19),armor,sh)
  m.tube('Greba',[(s*.39,0,.77),(s*.40,0,.24)],[.20,.15],armor,sh,16)
  m.gem('Rodillera',(s*.38,-.24,.88),(.16,.24),metal,sh);m.gem('Sello rodilla',(s*.38,-.325,.91),(.055,.085),glow,sh)
  if kind=='duck':
   m.ball('Pata palmípeda',(s*.4,-.21,.12),(.27,.40,.11),metal,foot)
   for k in range(3):m.tube('Dedo palmeado',[(s*.4+(k-1)*.15,-.3,.12),(s*.4+(k-1)*.20,-.58,.08)],[.065,.018],metal,foot)
  else:
   m.ball('Pie',(s*.40,-.17,.14),(.23,.39,.14),skin if kind in ['cat','lion','fox','sea','eagle'] else armor,foot)
   for k in range(3):m.tube('Garra del pie',[(s*.4+(k-1)*.14,-.42,.13),(s*.4+(k-1)*.15,-.60,.08)],[.055,.005],metal,foot,8)
  m.plate('Faldón lateral',[(s*.19,-.25,1.71),(s*.46,-.16,1.64),(s*.57,-.16,1.20),(s*.34,-.30,1.34)],armor,th)
  m.gem('Joya hombro',(s*.56,-.32,2.67),(.07,.11),glow,ua)
 m.plate('Faldón central',[(-.15,-.29,1.6),(.15,-.29,1.6),(.14,-.34,1.05),(0,-.39,.90),(-.14,-.34,1.05)],armor,'hips')
 m.gem('Hebilla',(0,-.35,1.69),(.16,.20),metal,'hips');m.gem('Núcleo',(0,-.43,1.7),(.06,.09),glow,'hips')
 m.gem('Emblema',(0,-.33,2.55),(.09,.13),glow)
 # Distinct luminous marks are geometry, so the lightweight GLB needs no texture fetches.
 for z in [1.27,1.43]:m.tube('Glifo',[(0,-.395,z+.05),(.045,-.395,z),(0,-.395,z-.05),(-.045,-.395,z),(0,-.395,z+.05)],[.009]*5,glow,'hips',6)

def face(m,skin,armor,metal,glow,kind):
 dark=mat('Cavidades',(.009,.006,.013));ivory=mat('Marfil',(.68,.58,.40));fur=mat('Pelaje claro',(.60,.43,.20));black=mat('Nariz',(.018,.012,.016),.1)
 m.ball('Cabeza',(0,0,3.25),(.32,.26,.37),skin)
 if kind in ['cat','lion','fox']:
  if kind=='lion':
   mane=mat('Melena',(.18,.085,.024),0,.7)
   for i in range(19):
    a=i*math.tau/19;x=.36*math.sin(a);z=3.24+.38*math.cos(a)
    m.tube('Mechón melena',[(x,.06,z),(x*1.38,.01,3.24+(z-3.24)*1.38),(x*1.3,.03,3.20+(z-3.24)*1.58)],[.14,.12,.005],mane)
  for s in [-1,1]:
   tip=3.91 if kind=='fox' else 3.73
   m.plate('Oreja',[(s*.15,-.05,3.48),(s*.35,.01,tip),(s*.40,.05,3.42)],skin,'head',.12)
   m.plate('Interior oreja',[(s*.21,-.075,3.49),(s*.34,-.02,tip-.09),(s*.35,-.015,3.48)],fur if kind=='fox' else armor,'head',.02)
   m.ball('Mejilla',(s*.19,-.17,3.18),(.18,.19,.18),fur if kind=='fox' else skin)
   m.ball('Hocico',(s*.095,-.30 if kind!='fox' else -.38,3.16),(.12,.14,.095),fur if kind!='cat' else skin)
  m.ball('Nariz',(0,-.445 if kind!='fox' else -.51,3.22),(.095,.045,.055),black)
  m.tube('Boca',[(-.16,-.34,3.10),(0,-.43,3.07),(.16,-.34,3.10)],[.012]*3,dark)
  for s in [-1,1]:
   for k in range(3):m.tube('Bigote',[(s*.12,-.41,3.15-k*.028),(s*(.29+k*.035),-.40,3.15-k*.035)],[.005,.001],ivory,sides=6)
  tail=[(0,.22,1.60),(.32,.55,1.35),(.65,.66,1.0),(1.02,.62,.91),(1.24,.48,1.16),(1.20,.38,1.42)]
  radii=[.09,.10,.095,.08,.065,.04] if kind!='fox' else [.18,.23,.26,.27,.21,.002]
  m.tube('Cola',tail,radii,skin,'hips',14)
  if kind=='lion':m.ball('Borla cola',tail[-1],(.12,.12,.21),mane,'hips')
  if kind=='fox':m.tube('Punta blanca cola',tail[-3:],[.26,.20,.002],fur,'hips',14)
 elif kind in ['duck','eagle']:
  beak=mat('Pico',(.7,.32,.035),.25)
  if kind=='duck':
   m.ball('Pico superior',(0,-.34,3.20),(.29,.32,.09),beak);m.ball('Pico inferior',(0,-.33,3.095),(.25,.27,.05),beak)
   for s in [-1,1]:m.ball('Orificio nasal',(s*.075,-.48,3.272),(.023,.035,.012),dark)
  else:m.tube('Pico curvo',[(0,-.19,3.28),(0,-.40,3.25),(0,-.53,3.15),(0,-.51,3.04)],[.14,.13,.08,.002],beak,sides=16)
  for s in [-1,1]:
   for k in range(6):
    x=s*(.22+.035*(k%2));z=3.40-k*.09
    m.tube('Pluma facial',[(x,.02,z),(x+s*.09,.06,z-.07),(x+s*.1,.10,z-.17)],[.07,.055,.002],fur if kind=='duck' else skin)
 elif kind in ['ghost','shadow']:
  m.ball('Rostro oculto',(0,-.17,3.26),(.255,.13,.30),dark)
  if kind=='shadow':
   m.tube('Capucha',[(-.28,-.18,2.99),(-.39,-.12,3.35),(-.22,-.08,3.65),(0,-.07,3.85),(.22,-.08,3.65),(.39,-.12,3.35),(.28,-.18,2.99)],[.10,.12,.13,.10,.13,.12,.10],armor)
  else:
   for s in [-1,1]:m.plate('Yelmo',[(s*.02,-.30,3.56),(s*.23,-.19,3.69),(s*.34,-.16,3.43),(s*.25,-.24,3.05),(s*.05,-.32,2.96),(s*.05,-.34,3.28)],armor,'head')
   m.tube('Cresta yelmo',[(0,.02,3.52),(0,0,3.80),(0,-.05,3.99)],[.09,.05,.002],metal)
 else:
  m.ball('Mandíbula',(0,-.11,3.08),(.24,.23,.18),skin)
  m.tube('Nariz',[(0,-.24,3.38),(0,-.31,3.21),(0,-.38,3.19)],[.055,.07,.035],skin)
  m.tube('Boca',[(-.1,-.31,3.08),(0,-.34,3.07),(.1,-.31,3.08)],[.012]*3,dark)
  if kind=='king':
   hair=mat('Barba azul gris',(.075,.09,.12),.15,.55)
   for i in range(9):
    x=(i-4)*.048;m.tube('Barba',[(x,-.23,3.10),(x*.9,-.31,2.98),(x*.6,-.24,2.79+abs(x)*.6)],[.05,.05,.003],hair)
   for s in [-1,1]:m.tube('Cabello',[(s*.25,.08,3.49),(s*.32,.13,3.23),(s*.30,.20,2.87)],[.15,.13,.04],hair)
  if kind=='sea':
   for s in [-1,1]:m.plate('Aleta facial',[(s*.22,0,3.55),(s*.49,.03,3.70),(s*.40,.04,3.34),(s*.47,.03,3.14),(s*.24,-.01,3.10)],armor,'head')
   m.tube('Cresta marina',[(0,.07,3.48),(0,.10,3.75),(0,.14,3.88)],[.14,.065,.002],metal)
 for s in [-1,1]:
  m.ball('Órbita',(s*.14,-.24,3.34),(.12,.055,.072),dark)
  m.plate('Ojo',[(s*.055,-.302,3.35),(s*.23,-.28,3.37),(s*.19,-.31,3.30),(s*.09,-.32,3.30)],glow,'head',.015)
  m.tube('Ceja',[(s*.04,-.31,3.39),(s*.16,-.285,3.43),(s*.26,-.23,3.40)],[.035,.045,.018],skin if kind not in ['ghost','shadow'] else metal)
 if kind in ['duck','lion','king']:crown(m,metal,glow)

def details(m,skin,armor,metal,glow,kind):
 if kind in ['cat','duck','ghost','shadow','eagle','king']:cloak(m,armor,metal,kind in ['ghost','shadow','eagle'],kind=='cat')
 if kind=='cat':
  for s in [-1,1]:
   m.plate('Solapa',[(s*.09,-.29,2.85),(s*.30,-.33,2.63),(s*.12,-.38,2.29),(s*.04,-.34,2.57)],armor,'chest')
   m.tube('Neón solapa',[(s*.09,-.32,2.85),(s*.30,-.36,2.63),(s*.12,-.41,2.29)],[.012]*3,glow,'chest',8)
   m.plate('Cola de abrigo',[(s*.09,-.26,1.70),(s*.37,-.2,1.72),(s*.66,-.04,.72),(s*.24,-.22,.84)],armor,'hips')
 if kind in ['duck','eagle']:
  for s in [-1,1]:
   for k in range(7):
    start=(s*(.59+k*.045),.08,2.69);end=(s*(.89+k*.08),.09,2.89+k*.08)
    m.tube('Pluma de hombrera',[start,((start[0]+end[0])*.5,.04,(start[2]+end[2])*.5),end],[.075,.10,.001],metal if kind=='duck' else skin,'upper_arm.'+('L' if s==1 else 'R'),8)
 if kind=='lion':
  for s in [-1,1]:
   for k in range(3):m.tube('Cristal esmeralda',[(s*(.57+k*.15),.05,2.80),(s*(.63+k*.20),.06,3.15-k*.04)],[.10,.001],glow,'upper_arm.'+('L' if s==1 else 'R'),6)
 if kind=='sea':
  coral=mat('Coral',(.30,.13,.27),.1,.65)
  for s in [-1,1]:
   bone='upper_arm.'+('L' if s==1 else 'R')
   for k in range(3):
    x=s*(.55+k*.16);m.tube('Coral',[(x,.07,2.79),(x+s*.09,.10,2.98),(x+s*.03,.09,3.18)],[.055,.045,.01],coral,bone)
    m.tube('Rama coral',[(x+s*.08,.10,2.98),(x+s*.20,.10,3.07),(x+s*.22,.08,3.19)],[.035,.025,.005],coral,bone)
  for z,bone in [(2.55,'chest'),(1.70,'hips')]:
   for k in range(7):
    a=(k-3)*.23;m.tube('Concha',[(0,-.37,z-.13),(.22*math.sin(a),-.40,z+.13*math.cos(a))],[.02,.035],glow,bone,8)
 if kind=='fox':
  for s in [-1,1]:
   for k in range(3):m.tube('Llama hombro',[(s*(.6+k*.12),.05,2.80),(s*(.63+k*.13),.02,3.02),(s*(.7+k*.13),.01,3.20-k*.05)],[.08,.055,.001],glow,'upper_arm.'+('L' if s==1 else 'R'))
  for k in range(5):m.tube('Llama de crin',[((k-2)*.07,.1,3.49),((k-2)*.085,.13,3.79),((k-2)*.09+.06,.14,3.98-abs(k-2)*.1)],[.09,.045,.001],glow)
 if kind in ['king','eagle']:
  x=-1.26;bone='hand.R';m.tube('Bastón',[(x,-.07,.10),(x,-.07,3.42)],[.043,.043],metal,bone,12)
  if kind=='king':
   for dx in [-.30,0,.30]:
    m.tube('Tridente',[(x,-.07,3.1),(x+dx,-.07,3.42),(x+dx,-.07,3.97 if dx==0 else 3.80)],[.075,.06,.001],metal,bone)
    m.gem('Luz tridente',(x+dx,-.08,3.66),(.035,.12),glow,bone)
  else:
   m.ball('Águila del cetro',(x,-.07,3.49),(.10,.08,.16),metal,bone)
   for s in [-1,1]:m.plate('Ala del cetro',[(x,-.09,3.51),(x+s*.36,-.09,3.79),(x+s*.24,-.09,3.42)],metal,bone)

def die(m,color,glow):
 center=Vector((1.10,-.59,2.30));size=.40
 bpy.ops.mesh.primitive_cube_add(size=size,location=center);o=bpy.context.object
 mod=o.modifiers.new('Esquinas','BEVEL');mod.width=.035;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
 m.finish(o,'Dado',color,'hand.L',False)
 patterns={1:[(0,0)],2:[(-1,-1),(1,1)],3:[(-1,-1),(0,0),(1,1)],4:[(-1,-1),(-1,1),(1,-1),(1,1)],5:[(-1,-1),(-1,1),(1,-1),(1,1),(0,0)],6:[(-1,-1),(-1,0),(-1,1),(1,-1),(1,0),(1,1)]}
 for normal,right,up,value in [((0,-1,0),(1,0,0),(0,0,1),6),((0,1,0),(-1,0,0),(0,0,1),1),((0,0,1),(1,0,0),(0,1,0),3),((0,0,-1),(1,0,0),(0,-1,0),4),((1,0,0),(0,1,0),(0,0,1),2),((-1,0,0),(0,-1,0),(0,0,1),5)]:
  for u,v in patterns[value]:m.ball('Punto',center+Vector(normal)*.204+Vector(right)*u*.088+Vector(up)*v*.088,(.023,.023,.023),glow,'hand.L')

def ground(rig,mesh):
 scene=bpy.context.scene
 for action in list(bpy.data.actions):
  rig.animation_data.action=action
  for frame in range(int(action.frame_range[0]),int(action.frame_range[1])+1):
   scene.frame_set(frame);e=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());low=min((e.matrix_world@v.co).z for v in e.data.vertices)
   root=rig.pose.bones['root'];root.location.y-=low;root.keyframe_insert(data_path='location',frame=frame,group='root')

def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def render_stage(out,title):
 scene=bpy.context.scene
 stone=mat('Peana',(.025,.035,.045),.4,.4)
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1.9,depth=.12,location=(0,0,-.08));bpy.context.object.data.materials.append(stone)
 bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.15));bpy.context.object.data.materials.append(stone)
 for name,loc,color,power in [('Principal',(3,-5,6),(1,.80,.64),950),('Relleno',(-4,-3,4),(.44,.63,1),600),('Borde',(2,3,5),(.68,.8,1),1000)]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=4;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;aim(o,(0,0,2))
 d=bpy.data.cameras.new('Cámara');o=bpy.data.objects.new('Cámara',d);scene.collection.objects.link(o);scene.camera=o;o.location=(4,-10,4.3);aim(o,(0,0,2));d.type='ORTHO';d.ortho_scale=5.25
 scene.world.color=(.04,.04,.05);scene.use_nodes=False;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
 scene.render.resolution_x=720;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
 bpy.ops.wm.save_as_mainfile(filepath=str(out/'model.blend'),compress=True)
 scene.render.filepath=str(out/'preview.png');bpy.ops.render.render(write_still=True)

def build(spec):
 slug,title,skin_color,armor_color,accent,kind=spec
 metadata=ROOT/'assets/mascots3d'/slug/'model.json'
 if metadata.exists() and json.loads(metadata.read_text(encoding='utf8')).get('revision',1)>=2:
  print(f'{slug.upper()}_PRESERVED: use its individual builder for the refined reference study',flush=True);return
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE));rig=bpy.data.objects.get('Demonio_Salvaje');rig.animation_data.action=None
 for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
 for o in list(bpy.data.objects):
  if o!=rig:bpy.data.objects.remove(o,do_unlink=True)
 rig.name=title.replace(' ','_');rig['reference']=f'public/mascots/{slug}.webp';rig['status']='Modelo estilizado de videojuego'
 bpy.ops.outliner.orphans_purge(do_recursive=True)
 skin=mat('Piel',skin_color,0,.58);armor=mat('Armadura',armor_color,.72,.32)
 metal=mat('Ribetes',(.43,.26,.07) if kind in ['duck','lion','fox','king'] else tuple(min(1,c*.8+.15) for c in accent),.8,.30)
 glow=mat('Energía',accent,.1,.3,2.2);m=Model();body(m,skin,armor,metal,glow,kind);face(m,skin,armor,metal,glow,kind);details(m,skin,armor,metal,glow,kind)
 die(m,mat('Color dado',tuple(c*.35 for c in accent),.25,.2),mat('Puntos dado',(.9,.86,.72),.1,.3,1))
 mesh=m.join(rig);ground(rig,mesh)
 rig.animation_data.action=bpy.data.actions['Idle'];scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=61;scene.frame_set(1)
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
 web=ROOT/'public/models/mascots';out=ROOT/'assets/mascots3d'/slug;out.mkdir(parents=True,exist_ok=True)
 bpy.ops.export_scene.gltf(filepath=str(web/f'{slug}.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True)
 (out/'model.json').write_text(json.dumps({'name':title,'reference':f'/mascots/{slug}.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout']},ensure_ascii=False,indent=2),encoding='utf8')
 render_stage(out,title);print('MASCOT_READY',slug,flush=True)

if __name__ == '__main__':
 requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 for spec in ROSTER:
  if not requested or spec[0] in requested:build(spec)
