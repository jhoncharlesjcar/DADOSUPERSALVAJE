"""Pantera reference study: bespoke feline anatomy and neon leather coat.
Writes a review candidate, never overwrites the live GLB. Blender 4.5 LTS.
"""
import bpy, math, sys, random, json
from pathlib import Path
from mathutils import Vector, Matrix
sys.path.insert(0, str(Path(__file__).parent))
from build_roster import Model, mat, ground, aim, ROOT, SOURCE
from glb_textures import deduplicate_textures

OUT=ROOT/'assets/mascots3d/pantera/revision2'
OUT.mkdir(parents=True,exist_ok=True)
random.seed(34)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=bpy.data.objects['Demonio_Salvaje'];rig.animation_data.action=None
for bone in rig.pose.bones:
 bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
for obj in list(bpy.data.objects):
 if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
rig.name='Pantera_Rosada';bpy.ops.outliner.orphans_purge(do_recursive=True)

class Sculpt(Model):
 def ball(self,name,at,scale,material,bone='head'):
  bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=at)
  obj=bpy.context.object;obj.scale=scale
  return self.finish(obj,name,material,bone)
 def line(self,name,points,radius,material,bone='chest',sides=8):
  return self.tube(name,points,[radius]*len(points),material,bone,sides)
 def panel(self,name,outline,material,bone='chest',trim=None):
  obj=self.plate(name,outline,material,bone,.025)
  if trim:self.line(name+' ribete',[(x,y-.018,z) for x,y,z in outline+[outline[0]]],.009,trim,bone)
  return obj

def surface(name,color,kind):
 material=mat(name,color,.0 if kind=='fur' else .10,.60 if kind=='fur' else .42)
 nt=material.node_tree;n=nt.nodes;l=nt.links;p=n['Principled BSDF']
 coord=n.new('ShaderNodeTexCoord')
 noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=120 if kind=='fur' else 155
 noise.inputs['Detail'].default_value=3
 scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(1,1,.18) if kind=='fur' else (1,1,1)
 l.new(coord.outputs['Object'],scale.inputs[0]);l.new(scale.outputs['Vector'],noise.inputs['Vector'])
 ramp=n.new('ShaderNodeValToRGB');l.new(noise.outputs['Fac'],ramp.inputs[0])
 ramp.color_ramp.elements[0].color=tuple(c*.38 for c in color)+(1,)
 ramp.color_ramp.elements[1].color=tuple(min(1,c*1.5) for c in color)+(1,)
 l.new(ramp.outputs['Color'],p.inputs['Base Color'])
 if kind=='fur':
  # Small irregular rosettes in object space, with directional fur grain beneath.
  warp=n.new('ShaderNodeTexNoise');warp.inputs['Scale'].default_value=32;warp.inputs['Detail'].default_value=2
  l.new(coord.outputs['Object'],warp.inputs['Vector'])
  offset=n.new('ShaderNodeVectorMath');offset.operation='SCALE';offset.inputs['Scale'].default_value=.035
  l.new(warp.outputs['Color'],offset.inputs[0])
  warped=n.new('ShaderNodeVectorMath');warped.operation='ADD'
  l.new(coord.outputs['Object'],warped.inputs[0]);l.new(offset.outputs['Vector'],warped.inputs[1])
  cells=n.new('ShaderNodeTexVoronoi');cells.inputs['Scale'].default_value=22
  l.new(warped.outputs['Vector'],cells.inputs['Vector'])
  spots=n.new('ShaderNodeValToRGB');l.new(cells.outputs['Distance'],spots.inputs[0])
  stops=spots.color_ramp.elements;stops[0].position=.25;stops[0].color=(.55,.55,.55,1)
  stops[1].position=.58;stops[1].color=(1,1,1,1)
  for pos,value in [(.30,.09),(.43,.09),(.49,1)]:
   el=stops.new(pos);el.color=(value,value,value,1)
  mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.87
  l.new(ramp.outputs['Color'],mix.inputs[1]);l.new(spots.outputs['Color'],mix.inputs[2]);l.new(mix.outputs[0],p.inputs['Base Color'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.30;bump.inputs['Distance'].default_value=.005 if kind=='fur' else .002
 l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
 return material

fur=surface('Pelaje malva con rosetas',(.055,.016,.041),'fur')
muzzle=surface('Pelaje corto del hocico',(.095,.053,.075),'leather')
leather=surface('Cuero berenjena grano fino',(.022,.008,.026),'leather')
cloth=surface('Tejido negro del traje',(.013,.009,.019),'leather')
trim=mat('Titanio violeta',(.16,.055,.16),.74,.30)
edge=mat('Bisel de plata oscura',(.18,.13,.20),.75,.27)
neon=mat('Neón rosa fino',(.8,.012,.27),.15,.3,2.5)
eye=mat('Iris magenta',(.85,.025,.32),.15,.28,3)
black=mat('Nariz y pupilas',(.008,.003,.009),.10,.34)
inner=surface('Interior de orejas',(.09,.012,.04),'leather')
whisker=mat('Bigotes',(.31,.19,.29),.1,.6)
claw=mat('Garras oscuras',(.065,.04,.06),.5,.25)
m=Sculpt()

# A tailored body: no shared plate armor, giant gems, crown or stock loincloth.
m.ball('Pecho del traje',(0,.025,2.40),(.43,.245,.44),cloth,'chest')
m.ball('Cintura ceñida',(0,0,2.02),(.29,.205,.32),cloth,'spine')
m.ball('Pantalón caderas',(0,.015,1.66),(.34,.23,.25),cloth,'hips')
m.tube('Cuello felino',[(0,0,2.74),(0,.01,3.13)],[.17,.16],fur,'neck',24)
for s in [-1,1]:
 side='L' if s==1 else 'R';ua='upper_arm.'+side;fa='forearm.'+side;hand='hand.'+side;th='thigh.'+side;sh='shin.'+side;foot='foot.'+side
 m.ball('Manga hombro',(s*.58,0,2.65),(.19,.22,.23),leather,ua)
 m.tube('Manga superior',[(s*.59,0,2.62),(s*.79,0,2.38),(s*.96,0,2.16)],[.19,.17,.135],leather,ua,24)
 end=(1.06,-.40,1.98) if s==1 else (-1.12,-.04,1.70)
 m.tube('Manga antebrazo',[(s*.96,0,2.16),end],[.14,.11],leather,fa,24)
 # Thin, fitted bracers with luminous channels rather than bulky shared cuffs.
 if s==-1:
  pts=[(-1.01,-.145,2.11),(-.88,-.17,2.02),(-1.0,-.18,1.69),(-1.16,-.15,1.68),(-1.18,-.14,1.97)]
 else:pts=[(.87,-.06,2.17),(1.04,-.07,2.18),(1.18,-.40,2.04),(1.0,-.45,2.04)]
 m.panel('Brazal acanalado',pts,trim,fa,edge)
 m.line('Luz brazal',[(x,y-.025,z) for x,y,z in pts[:3]],.011,neon,fa)
 palm=Vector((1.10,-.56,1.98) if s==1 else (-1.14,-.07,1.55))
 m.ball('Palma felina',palm,(.14,.16,.10) if s==1 else (.14,.10,.18),fur,hand)
 for f in range(4):
  x=palm.x+(f-1.5)*.065
  pts=[(x,-.60,1.98),(x,-.72,2.03),(x,-.75,2.16)] if s==1 else [(x,-.09,1.47),(x,-.13,1.34),(x+.01,-.20,1.31)]
  m.tube('Dedo articulado',pts,[.032,.028,.018],fur,hand,10)
  tip=Vector(pts[-1]);m.tube('Garra mano',[tip,tip+Vector((0,-.035,.06 if s==1 else -.04))],[.019,.001],claw,hand,8)
 thumb=[(palm.x-s*.10,palm.y+.015,palm.z),(palm.x-s*.18,palm.y-.045,palm.z-.04),(palm.x-s*.19,palm.y-.13,palm.z+.025)]
 m.tube('Pulgar',thumb,[.045,.034,.016],fur,hand,12)
 # Soft elbow folds, fine seam stitching and tailored seams.
 for k in range(4):
  z=2.22+k*.027;x=s*(.92-k*.022)
  m.line('Pliegue codo',[(x-s*.10,-.12,z),(x,-.15,z-.02),(x+s*.09,-.11,z+.01)],.012,cloth,ua)
 m.tube('Pierna pantalón',[(s*.29,0,1.65),(s*.33,0,1.28),(s*.38,0,.92)],[.20,.18,.135],cloth,th,28)
 m.tube('Bota alta',[(s*.38,0,.91),(s*.4,0,.57),(s*.4,0,.22)],[.15,.16,.105],leather,sh,24)
 pts=[(s*.25,-.17,.91),(s*.38,-.22,1.01),(s*.52,-.17,.87),(s*.51,-.18,.46),(s*.44,-.20,.26),(s*.29,-.18,.38)]
 m.panel('Greba entallada',pts,trim,sh,edge)
 m.line('Canal neón bota',[(x,y-.018,z) for x,y,z in pts[1:5]],.009,neon,sh)
 m.panel('Protector rodilla',[(s*.25,-.20,.95),(s*.39,-.24,1.07),(s*.52,-.20,.96),(s*.43,-.25,.82),(s*.32,-.24,.84)],leather,sh,trim)
 m.ball('Pata felina',(s*.40,-.17,.13),(.18,.30,.13),fur,foot)
 for k in range(4):
  x=s*.4+(k-1.5)*.079
  m.ball('Dedo de pata',(x,-.37,.10),(.048,.10,.067),fur,foot)
  m.tube('Garra pata',[(x,-.43,.11),(x,-.51,.065)],[.022,.001],claw,foot,8)
 # Shoulder pads follow the reference's round, close-fitting panels.
 pts=[(s*.38,-.14,2.80),(s*.58,-.23,2.84),(s*.77,-.14,2.70),(s*.72,-.25,2.55),(s*.51,-.28,2.58)]
 m.panel('Hombrera cuero',pts,leather,ua,trim)
 m.line('Neón hombro',[(x,y-.015,z) for x,y,z in pts[1:4]],.012,neon,ua)

# Long coat with a continuous fitted silhouette and flared split tails.
for s in [-1,1]:
 levels=[(2.83,.34,.10),(2.64,.43,.06),(2.34,.37,.055),(2.04,.30,.05),(1.78,.36,.09),(1.38,.43,.15),(.85,.53,.22)]
 verts=[];faces=[];cols=25
 for r,(z,width,gap) in enumerate(levels):
  depth=.25 if z>2.1 else .235
  for c in range(cols):
   a=-math.pi/2+c/(cols-1)*math.pi
   x=s*(gap+width*math.cos(a));y=depth*math.sin(a)
   if z<1.8:y+=.14*(1.8-z)+.035*math.sin(a*5)*(1.8-z)
   verts.append((x,y,z))
   if r and c:i=r*cols+c;faces.append((i-cols-1,i-cols,i,i-1))
 coat=m.mesh('Abrigo largo',verts,faces,leather,'chest')
 # Rigid chest-to-hips blend keeps the lower coat away from the chest rotation pivot.
 for v in coat.data.vertices:
  t=max(0,min(1,(2.25-v.co.z)/.55))
  coat.vertex_groups['chest'].add([v.index],1-t,'REPLACE')
  if 'hips' not in coat.vertex_groups:coat.vertex_groups.new(name='hips')
  coat.vertex_groups['hips'].add([v.index],t,'REPLACE')
 solid=coat.modifiers.new('Cuero con grosor','SOLIDIFY');solid.thickness=.018;bpy.ops.object.modifier_apply(modifier=solid.name)
 front=[verts[r*cols] for r in range(len(levels))]
 m.line('Vivo frontal abrigo',[(x,y-.015,z) for x,y,z in front[:4]],.011,neon,'chest')
 m.line('Vivo faldón',[(x,y-.015,z) for x,y,z in front[3:]],.011,neon,'hips')
 m.line('Dobladillo cola abrigo',[verts[-cols+i] for i in range(cols)],.012,trim,'hips')
 lapel=[(s*.11,-.25,2.91),(s*.28,-.28,2.77),(s*.35,-.29,2.61),(s*.15,-.30,2.28),(s*.10,-.27,2.48),(s*.22,-.28,2.69)]
 m.panel('Solapa sastre',lapel,trim,'chest',neon)
 m.panel('Chaleco central',[(s*.02,-.265,2.72),(s*.17,-.275,2.60),(s*.14,-.28,2.16),(s*.035,-.26,2.02)],leather,'spine',trim)
 for k in range(5):
  z=2.46-k*.075
  m.line('Costura chaleco',[(s*.035,-.286,z),(s*.12,-.291,z+.045)],.006,edge,'spine',6)
 # Narrow high collar surrounding the neck rather than a superhero cape.
 m.panel('Cuello alzado',[(s*.11,-.15,2.83),(s*.15,-.12,3.07),(s*.27,.05,3.09),(s*.29,.17,2.86)],leather,'chest',neon)
 m.line('Costura lateral',[(s*.43,-.03,2.58),(s*.37,-.10,2.34),(s*.30,-.12,2.08)],.006,edge,'chest',6)

# Belt and geometric pendant match the understated suit ornamentation.
for s in [-1,1]:
 m.panel('Cinturón',[(s*.025,-.25,1.95),(s*.30,-.20,1.95),(s*.31,-.20,1.88),(s*.025,-.25,1.88)],leather,'hips',trim)
m.gem('Colgante',(0,-.292,2.74),(.055,.075),trim,'chest')
m.gem('Centro colgante',(0,-.373,2.74),(.032,.048),neon,'chest')

# Sculpt the muzzle as one continuous surface instead of toy-like intersecting balls.
start=len(m.parts)
m.ball('Cráneo',(0,.015,3.36),(.265,.23,.285),fur)
m.ball('Frente',(0,-.07,3.48),(.225,.19,.17),fur)
m.ball('Mandíbula',(0,-.075,3.19),(.19,.20,.14),fur)
m.ball('Puente nasal',(0,-.19,3.33),(.07,.14,.13),fur)
for s in [-1,1]:
 m.ball('Pómulo',(s*.18,-.11,3.30),(.115,.16,.14),fur)
 m.ball('Morro',(s*.082,-.255,3.24),(.108,.13,.085),fur)
 m.tube('Arco supraorbital',[(s*.055,-.19,3.44),(s*.14,-.18,3.48),(s*.22,-.12,3.49)],[.035,.048,.035],fur,'head',12)
headparts=m.parts[start:];bpy.ops.object.select_all(action='DESELECT')
for obj in headparts:obj.select_set(True)
bpy.context.view_layer.objects.active=headparts[0];bpy.ops.object.join();head=bpy.context.object
head.data.remesh_voxel_size=.009;bpy.ops.object.voxel_remesh()
smooth=head.modifiers.new('Escultura suavizada','SMOOTH');smooth.factor=.65;smooth.iterations=5;bpy.ops.object.modifier_apply(modifier=smooth.name)
head.vertex_groups.clear();head.vertex_groups.new(name='head').add(list(range(len(head.data.vertices))),1,'REPLACE')
for p in head.data.polygons:p.use_smooth=True
m.parts=m.parts[:start]+[head]
# Rounded feline ears, a broad triangular nose, lowered eyelids and luminous irises.
for s in [-1,1]:
 m.plate('Oreja felina',[(s*.15,-.005,3.54),(s*.19,-.005,3.64),(s*.265,.015,3.68),(s*.29,.025,3.64),(s*.29,.015,3.53)],fur,'head',.055)
 m.plate('Interior oreja',[(s*.19,-.026,3.55),(s*.22,-.021,3.625),(s*.26,-.009,3.641),(s*.267,-.006,3.56)],inner,'head',.008)
 m.ball('Almohadilla bigotes',(s*.085,-.30,3.245),(.09,.07,.057),muzzle)
 m.ball('Ojo oscuro',(s*.127,-.221,3.405),(.078,.031,.049),black)
 m.ball('Iris',(s*.127,-.250,3.402),(.044,.009,.029),eye)
 m.ball('Pupila',(s*.127,-.261,3.403),(.013,.005,.022),black)
 m.line('Párpado superior',[(s*.065,-.252,3.408),(s*.125,-.264,3.430),(s*.19,-.225,3.448)],.015,fur,'head',10)
 m.line('Párpado inferior',[(s*.067,-.246,3.390),(s*.128,-.258,3.370),(s*.19,-.225,3.393)],.010,fur,'head',10)
 for k in range(5):
  x=s*(.095+.018*(k%2));z=3.25-k*.012
  m.ball('Folículo bigote',(x,-.369,z),(.006,.003,.004),black)
  m.tube('Bigote fino',[(x,-.371,z),(s*.24,-.37,z+.02-k*.009),(s*.38,-.33,z+.045-k*.018)],[.0027,.0018,.0003],whisker,'head',5)
 # Fine cheek silhouette fur: follows the jaw, not a huge lion mane.
 for k in range(12):
  z=3.42-k*.018;x=s*(.24-.045*k/12)
  m.tube('Mechón mejilla',[(x,-.02,z),(x+s*.027,-.035,z-.023),(x+s*.018,-.02,z-.050)],[.016,.011,.001],fur,'head',6)
m.mesh('Trufa triangular',[(-.077,-.35,3.29),(.077,-.35,3.29),(.042,-.404,3.278),(0,-.411,3.237),(-.042,-.404,3.278),(0,-.33,3.25)],[(0,1,2,4),(4,2,3),(0,4,3,5),(1,5,3,2),(0,5,1)],black,'head')
m.line('Philtrum',[(0,-.38,3.239),(0,-.365,3.208)],.005,black,'head',6)
for s in [-1,1]:m.line('Línea boca',[(0,-.365,3.208),(s*.075,-.343,3.197),(s*.133,-.293,3.217)],.005,black,'head',6)

# Smooth sweeping tail, unlike the angular tube of the first version.
tail=[];p0=Vector((0,.30,1.60));p1=Vector((-.65,.60,.28));p2=Vector((-1.40,.40,.45));p3=Vector((-1.15,.35,1.11))
for i in range(49):
 t=i/48;tail.append((1-t)**3*p0+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*p3)
m.tube('Cola curva',tail,[.045]*(len(tail)-4)+[.043,.037,.025,.003],fur,'hips',16)

# Reference-side holster. It is an inert visual accessory, attached to the thigh.
m.panel('Funda lateral',[(-.40,-.16,1.65),(-.51,-.15,1.58),(-.58,-.16,1.12),(-.47,-.19,1.10)],leather,'thigh.R',trim)
m.tube('Empuñadura enfundada',[(-.44,-.16,1.63),(-.40,-.16,1.80)],[.045,.045],black,'thigh.R',8)
for k in range(4):m.line('Estría empuñadura',[(-.445,-.199,1.68+k*.025),(-.395,-.199,1.69+k*.025)],.004,trim,'thigh.R',6)

# Die and clean luminous pips, suspended just above the cupped palm.
center=Vector((1.10,-.59,2.30));size=.30
cubeMat=mat('Dado magenta',(.27,.006,.085),.30,.22)
bpy.ops.mesh.primitive_cube_add(size=size,location=center);obj=bpy.context.object
bev=obj.modifiers.new('Esquinas pulidas','BEVEL');bev.width=.022;bev.segments=4;bpy.ops.object.modifier_apply(modifier=bev.name)
m.finish(obj,'Dado',cubeMat,'hand.L',False)
patterns={1:[(0,0)],2:[(-1,-1),(1,1)],3:[(-1,-1),(0,0),(1,1)],4:[(-1,-1),(-1,1),(1,-1),(1,1)],5:[(-1,-1),(-1,1),(1,-1),(1,1),(0,0)],6:[(-1,-1),(-1,0),(-1,1),(1,-1),(1,0),(1,1)]}
pips=mat('Puntos del dado',(.95,.55,.85),.1,.3,1.5)
for normal,right,up,value in [((0,-1,0),(1,0,0),(0,0,1),6),((0,1,0),(-1,0,0),(0,0,1),1),((0,0,1),(1,0,0),(0,1,0),3),((0,0,-1),(1,0,0),(0,-1,0),4),((1,0,0),(0,1,0),(0,0,1),2),((-1,0,0),(0,-1,0),(0,0,1),5)]:
 for u,v in patterns[value]:m.ball('Punto dado',center+Vector(normal)*.151+Vector(right)*u*.065+Vector(up)*v*.065,(.016,.016,.016),pips,'hand.L')

# Raise the offering hand to the reference's chest-height pose, preserving skin/rig alignment.
pivot=rig.data.bones['forearm.L'].head_local.copy()
turn=Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(-65),4,'X') @ Matrix.Translation(-pivot)
handhead=rig.data.bones['hand.L'].head_local.copy()
handmove=Matrix.Translation(turn @ handhead-handhead)
for obj in m.parts:
 if any(group.name in ['forearm.L','hand.L'] for group in obj.vertex_groups):
  transform=handmove if 'hand.L' in obj.vertex_groups else turn
  for vertex in obj.data.vertices:vertex.co=transform @ vertex.co
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name in ['forearm.L','hand.L']:
 bone=rig.data.edit_bones[name];bone.transform(handmove if name=='hand.L' else turn)
bpy.ops.object.mode_set(mode='OBJECT')
mesh=m.join(rig)

def bake_surfaces(obj):
 """Bake procedural fur/leather to shared color/normal atlases for parity in glTF."""
 bpy.context.view_layer.objects.active=obj
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.003);bpy.ops.object.mode_set(mode='OBJECT')
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.margin=6
 materials=list(obj.data.materials);targets=[]
 for material in materials:
  target=material.node_tree.nodes.new('ShaderNodeTexImage');material.node_tree.nodes.active=target;targets.append(target)
 images={}
 for key,kind,options,space in [('color','DIFFUSE',{'pass_filter':{'COLOR'}},'sRGB'),('normal','NORMAL',{},'Non-Color')]:
  img=bpy.data.images.new('pantera_v2_'+key,2048,2048);img.colorspace_settings.name=space
  for target in targets:target.image=img
  bpy.ops.object.bake(type=kind,**options);img.pack();images[key]=img
 for material in materials:
  nt=material.node_tree;p=nt.nodes['Principled BSDF']
  for name in ['Base Color','Normal']:
   for link in list(p.inputs[name].links):nt.links.remove(link)
  color=nt.nodes.new('ShaderNodeTexImage');color.image=images['color'];nt.links.new(color.outputs['Color'],p.inputs['Base Color'])
  tex=nt.nodes.new('ShaderNodeTexImage');tex.image=images['normal'];norm=nt.nodes.new('ShaderNodeNormalMap')
  nt.links.new(tex.outputs['Color'],norm.inputs['Color']);nt.links.new(norm.outputs['Normal'],p.inputs['Normal'])
 print('BAKED_PANTERA',flush=True)

bake_surfaces(mesh)
# Short real geometry at the head's silhouette catches grazing light like fur.
# Added after baking so thousands of tiny triangles do not consume the main UV atlas.
furverts=set()
for polygon in mesh.data.polygons:
 if mesh.data.materials[polygon.material_index]==fur:
  furverts.update(polygon.vertices)
group=mesh.vertex_groups['head'].index
candidates=[v for v in mesh.data.vertices if v.index in furverts and any(g.group==group for g in v.groups)]
random.shuffle(candidates);verts=[];faces=[]
for v in candidates[:2800]:
 n=v.normal.normalized();p=v.co+n*.001
 tangent=Vector((p.x*.4,0,-1));tangent=(tangent-n*tangent.dot(n)).normalized()
 side=n.cross(tangent).normalized();length=random.uniform(.008,.018);w=.0015
 tip=p+n*length*.6+tangent*length
 i=len(verts);verts.extend([p-side*w,p+side*w,tip]);faces.append((i,i+1,i+2))
hair=mat('Fibras de pelaje',(.045,.012,.033),0,.72)
hairmesh=m.mesh('Pelaje corto',verts,faces,hair,'head')
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);hairmesh.select_set(True);bpy.context.view_layer.objects.active=mesh;bpy.ops.object.join()
ground(rig,mesh)
rig['reference']='public/mascots/pantera.webp';rig['revision']='2: feline anatomy and tailored neon leather'
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=61
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'pantera.glb'),export_format='GLB',use_selection=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='WEBP',export_image_quality=88)
deduplicate_textures(OUT/'pantera.glb')
(OUT/'model.json').write_text(json.dumps({'name':'Pantera Rosada','revision':2,'reference':'/mascots/pantera.webp','vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'clips':['Idle','Celebrate','Throw','Hit','Knockout'],'textures':['baseColor 2048','normal 2048'],'status':'reference study for review'},ensure_ascii=False,indent=2),encoding='utf8')

# Neutral photographic lighting: magenta edge accents without bleaching the coat.
stage=mat('Escenario mate',(.009,.012,.02),.2,.5)
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.65,depth=.09,location=(0,0,-.065));bpy.context.object.data.materials.append(stage)
bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.12));bpy.context.object.data.materials.append(stage)
for name,loc,color,power,size in [('Softbox',(2,-4,6),(.86,.90,1),700,4),('Relleno',(-3,-3,3),(.59,.65,1),320,3),('Neón borde',(-3,2,4),(1,.08,.4),750,2),('Recorte',(3,2,5),(.5,.35,1),650,3)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,2))
data=bpy.data.cameras.new('Cámara');camera=bpy.data.objects.new('Cámara',data);scene.collection.objects.link(camera);scene.camera=camera
camera.location=(2,-10,3.8);aim(camera,(0,0,1.97));data.type='ORTHO';data.ortho_scale=4.45
scene.world.color=(.025,.025,.035);scene.use_nodes=False;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'model.blend'),compress=True)
scene.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True)
camera.location=(1,-6,3.65);aim(camera,(0,-.10,3.27));data.ortho_scale=1.35
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.filepath=str(OUT/'detail.png');bpy.ops.render.render(write_still=True)
print('PANTERA_V2_READY',len(mesh.data.vertices),flush=True)
