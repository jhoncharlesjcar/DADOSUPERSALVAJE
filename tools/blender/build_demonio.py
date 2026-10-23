"""Build the reviewable Demonio Salvaje mascot in Blender. Original procedural geometry.
Run with Blender --background --factory-startup --python tools/blender/build_demonio.py.
The existing demonio.webp is an artistic reference, not an automatically reconstructed mesh.
Skin: volcanic rock with lava cracks baked from a procedural shader into color/emission/normal maps.
Props: flaming mace in hand.R and burning die (6 facing forward) in hand.L, parented to those bones.
"""
import bpy
import math
import random
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/mascots3d/demonio"
WEB = ROOT / "public/models/mascots"
OUT.mkdir(parents=True, exist_ok=True)
WEB.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
random.seed(13)

def material(name, color, metal=0.0, rough=0.4, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emission:
        p.inputs["Emission Color"].default_value = (*color, 1)
        p.inputs["Emission Strength"].default_value = emission
    return m

obsidian = material("Obsidiana · armadura", (0.04, 0.024, 0.022), 0.75, 0.3)
skin = material("Roca volcánica", (0.115, 0.038, 0.025), 0.18, 0.52)
bronze = material("Bordes de bronce quemado", (0.36, 0.15, 0.05), 0.9, 0.28)
horn = material("Cuerno oscuro", (0.08, 0.04, 0.03), 0.25, 0.37)
lava = material("Fisuras de lava", (1.0, 0.105, 0.008), 0.1, 0.3, 6.0)
fire = material("Ojos y núcleo", (1.0, 0.52, 0.035), 0, 0.23, 8.0)
runes = material("Runas incandescentes", (1.0, 0.26, 0.02), 0, 0.3, 4.0)
mouth = material("Cavidades", (0.008, 0.004, 0.003), 0.0, 0.65)
teeth = material("Dientes de marfil", (0.68, 0.48, 0.28), 0.1, 0.4)
grip = material("Mango envuelto", (0.05, 0.03, 0.022), 0.1, 0.75)
die_red = material("Dado rojo", (0.42, 0.006, 0.004), 0.05, 0.12, 0.35)
pips = material("Puntos del dado", (1.0, 0.86, 0.6), 0, 0.3, 5.0)
flame_out = material("Llama exterior", (1.0, 0.12, 0.006), 0, 0.5, 2.6)
flame_in = material("Llama interior", (1.0, 0.42, 0.03), 0, 0.5, 4.0)
parts = []

def finish(obj, name, mat, bone, smooth=True):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    parts.append(obj)
    return obj

def link_mesh(name, verts, faces):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);bpy.context.view_layer.objects.active=obj
    return obj

def ellipsoid(name, center, scale, mat, bone, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat, bone)

def tube(name, points, radii, mat, bone, sides=12):
    pts = [Vector(p) for p in points]
    verts, faces = [], []
    for i, p in enumerate(pts):
        tangent = (pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        ref = Vector((0,1,0)) if abs(tangent.y) < 0.9 else Vector((1,0,0))
        u = tangent.cross(ref).normalized(); v = tangent.cross(u).normalized()
        for j in range(sides):
            a = j*math.tau/sides
            verts.append(p + radii[i]*(math.cos(a)*u+math.sin(a)*v))
        if i:
            for j in range(sides):
                k=(j+1)%sides
                faces.append(((i-1)*sides+j,(i-1)*sides+k,i*sides+k,i*sides+j))
    faces.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
    return finish(link_mesh(name,verts,faces),name,mat,bone)

def plate(name, outline, thickness, mat, bone, bevel=0.025):
    # Polygon in XZ, extruded along Y. The front faces negative Y.
    n=len(outline);verts=[(x,y,z) for x,y,z in outline]+[(x,y+thickness,z) for x,y,z in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=link_mesh(name,verts,faces)
    mod=obj.modifiers.new("Aristas biseladas","BEVEL");mod.width=bevel;mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,mat,bone,False)

# Elder Futhark strokes in a unit box (x right, y up). The belt spells R·P·K like the reference.
GLYPHS={
 "R":[[(-.3,-.5),(-.3,.5),(.25,.25),(-.3,0),(.3,-.5)]],
 "K":[[(.25,.5),(-.25,0),(.25,-.5)]],
 "P":[[(-.3,-.5),(-.3,.5),(.25,.38),(.25,.12),(-.3,0)]],
 "Z":[[(0,-.5),(0,.5)],[(-.35,.5),(0,.1),(.35,.5)]],
 "TH":[[(-.25,-.5),(-.25,.5)],[(-.25,.3),(.25,0),(-.25,-.3)]],
 "T":[[(0,-.5),(0,.5)],[(-.35,.15),(0,.5),(.35,.15)]],
 "F":[[(-.25,-.5),(-.25,.5)],[(-.25,.15),(.3,.45)],[(-.25,-.15),(.3,.15)]],
}

def rune(name, glyph, origin, right, up, size, bone, width=.028, depth=.018):
    # Raised emissive strokes; they sink 2 cm so curved or uneven armor never leaves gaps.
    o,r,u=Vector(origin),Vector(right).normalized(),Vector(up).normalized();n=r.cross(u).normalized()
    verts,faces=[],[]
    for stroke in GLYPHS[glyph]:
        pts=[o+size*(x*r+y*u) for x,y in stroke]
        for a,b in zip(pts,pts[1:]):
            d=(b-a).normalized();a,b=a-d*width*.5,b+d*width*.5;s=n.cross(d)*width*.5;base=len(verts)
            verts+=[p-n*.02 for p in (a-s,b-s,b+s,a+s)]+[p+n*depth for p in (a-s,b-s,b+s,a+s)]
            faces+=[(base,base+1,base+2,base+3),(base+4,base+7,base+6,base+5),(base,base+4,base+5,base+1),
                    (base+1,base+5,base+6,base+2),(base+2,base+6,base+7,base+3),(base+3,base+7,base+4,base)]
    return finish(link_mesh(name,verts,faces),name,runes,bone,False)

def rune_on(name, glyph, outline, size, bone, shift=(0,0)):
    pts=[Vector(p) for p in outline];c=sum(pts,Vector())/len(pts);n=Vector()
    for a,b in zip(pts,pts[1:]+pts[:1]):
        n+=Vector(((a.y-b.y)*(a.z+b.z),(a.z-b.z)*(a.x+b.x),(a.x-b.x)*(a.y+b.y)))
    n.normalize()
    if n.y>0: n=-n
    up=(Vector((0,0,1))-n*n.z).normalized();right=up.cross(n)
    return rune(name,glyph,c+right*shift[0]+up*shift[1],right,up,size,bone)

def tongue(name, base, height, radius, mat, phase):
    pts,radii=[],[]
    for k in range(6):
        t=k/5;sway=.07*math.sin(phase+t*3.4)*t
        pts.append(Vector(base)+Vector((sway,.6*sway*math.cos(phase),height*t)))
        radii.append(max(radius*(1-t)**.75*(1+.3*math.sin(t*math.pi)),.001))
    return tube(name,pts,radii,mat,"root",10)

def flames(prefix, bases, scale):
    for i,(base,height) in enumerate(bases):
        phase=random.uniform(0,math.tau)
        tongue(f"{prefix} exterior",base,height*scale,.085*scale,flame_out,phase)
        tongue(f"{prefix} interior",Vector(base)+Vector((0,-.012,-.02)),height*scale*.5,.105*scale,flame_in,phase)

def take(start):
    taken=parts[start:];del parts[start:];return taken

# Skeleton in a relaxed A pose; the left forearm reaches forward, palm up, to offer the die.
armature=bpy.data.armatures.new("Demonio_Rig")
rig=bpy.data.objects.new("Demonio_Salvaje",armature)
bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bone_defs={
 "root":((0,0,0),(0,0,0.3),None),
 "hips":((0,0,1.48),(0,0,1.84),"root"),
 "spine":((0,0,1.84),(0,0,2.25),"hips"),
 "chest":((0,0,2.25),(0,0,2.76),"spine"),
 "neck":((0,0,2.76),(0,0,3.03),"chest"),
 "head":((0,0,3.03),(0,0,3.48),"neck"),
}
for side,sign in [("L",1),("R",-1)]:
    bone_defs.update({
      f"upper_arm.{side}":((sign*.65,0,2.65),(sign*.96,0,2.16),"chest"),
      f"thigh.{side}":((sign*.29,0,1.56),(sign*.38,0,.91),"hips"),
      f"shin.{side}":((sign*.38,0,.91),(sign*.4,0,.23),f"thigh.{side}"),
      f"foot.{side}":((sign*.4,0,.23),(sign*.4,-.4,.12),f"shin.{side}"),
    })
bone_defs.update({
 "forearm.L":((.96,0,2.16),(1.06,-.40,1.98),"upper_arm.L"),
 "hand.L":((1.06,-.40,1.98),(1.10,-.62,1.98),"forearm.L"),
 "forearm.R":((-.96,0,2.16),(-1.12,-.04,1.70),"upper_arm.R"),
 "hand.R":((-1.12,-.04,1.70),(-1.15,-.06,1.43),"forearm.R"),
})
for name,(head,tail,parent) in bone_defs.items():
    b=armature.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT");rig.select_set(False)

# Bare rock torso with pectoral and abdominal masses; the cracks come from the baked skin.
ellipsoid("Torso",(0,.02,2.3),(.63,.30,.57),skin,"chest")
ellipsoid("Cintura",(0,0,1.95),(.39,.25,.37),skin,"spine")
ellipsoid("Cadera",(0,.025,1.57),(.45,.27,.24),obsidian,"hips")
ellipsoid("Cuello",(0,0,2.9),(.20,.19,.25),skin,"neck")
for sign in [-1,1]:
    ellipsoid("Pectoral",(sign*.245,-.12,2.5),(.27,.18,.19),skin,"chest")
    ellipsoid("Trapecio",(sign*.3,.04,2.78),(.24,.2,.13),skin,"chest")
    for row,z in enumerate([2.18,2.04,1.9]):
        ellipsoid("Abdominal",(sign*.098,-.2+row*.01,z),(.105,.09,.075),skin,"spine")
    ellipsoid("Oblicuo",(sign*.31,-.08,2.0),(.13,.16,.2),skin,"spine")

# Belt with R·P·K plaques, as on the reference.
belt=[(.37*math.cos(a),.01-.26*math.sin(a),1.75) for a in [i*math.tau/28 for i in range(29)]]
tube("Cinturón",belt,[.075]*len(belt),obsidian,"hips",10)
plate("Hebilla",[(-.18,-.32,1.73),(0,-.37,1.86),(.18,-.32,1.73),(0,-.39,1.48)],.09,bronze,"hips")
rune_on("Runa P","P",[(-.18,-.32,1.73),(0,-.37,1.86),(.18,-.32,1.73),(0,-.39,1.48)],.16,"hips",(0,.02))
for sign,glyph in [(-1,"R"),(1,"K")]:
    outline=[(sign*.2,-.29,1.84),(sign*.37,-.2,1.84),(sign*.37,-.2,1.66),(sign*.2,-.29,1.66)]
    plate("Placa del cinturón",outline,.06,bronze,"hips",.015)
    rune_on(f"Runa {glyph}",glyph,outline,.14,"hips")

for sign in [-1,1]:
    side="L" if sign==1 else "R"
    ua,fa,handb,thigh,shin,foot=[f"{name}.{side}" for name in ["upper_arm","forearm","hand","thigh","shin","foot"]]
    ellipsoid("Deltoides",(sign*.65,0,2.64),(.29,.29,.29),skin,ua)
    ellipsoid("Bíceps",(sign*.83,0,2.40),(.23,.23,.36),skin,ua)
    ellipsoid("Codo",(sign*.96,0,2.16),(.19,.19,.19),skin,fa)
    if side=="L":
        tube("Antebrazo",[(.97,-.02,2.14),(1.05,-.38,1.99)],[.21,.16],obsidian,fa,16)
        tube("Brazal",[(.985,-.08,2.115),(1.045,-.33,2.01)],[.235,.195],bronze,fa,16)
        rune("Runa brazal","T",(1.24,-.2,2.07),(0,1,0),(0,0,1),.15,fa)
        ellipsoid("Palma",(1.08,-.5,1.97),(.17,.2,.12),skin,handb)
        for finger in range(4):
            x=.985+finger*.064
            tube("Garra",[(x,-.64,1.99),(x,-.72,2.04),(x,-.725,2.1),(x,-.69,2.15)],[.045,.04,.03,.004],horn,handb,8)
        tube("Pulgar",[(.95,-.42,2.0),(.89,-.5,2.08),(.9,-.56,2.14)],[.06,.045,.008],skin,handb,10)
    else:
        tube("Antebrazo",[(-.97,0,2.14),(-1.10,-.035,1.78)],[.21,.16],obsidian,fa,16)
        ellipsoid("Guante",(-1.14,-.055,1.59),(.19,.15,.22),skin,handb)
        for finger in range(4):
            x=-(1.02+finger*.08)
            tube("Garra",[(x,-.08,1.50),(x,-.13,1.34),(x+.025,-.22,1.32)],[.045,.034,.004],horn,handb,8)
        tube("Pulgar",[(-1.0,-.02,1.63),(-.91,-.14,1.49),(-.93,-.21,1.43)],[.065,.045,.008],skin,handb,10)
        bracer=[(-.87,-.19,2.10),(-1.14,-.20,2.12),(-1.25,-.18,1.80),(-1.02,-.23,1.73)]
        plate("Brazal",bracer,.12,bronze,fa)
        rune_on("Runa brazal","T",bracer,.15,fa)
    for layer in range(3):
        z=2.84-layer*.10; x=sign*(.62+layer*.10)
        pad=[(x-sign*.23,-.24,z),(x+sign*.18,-.23,z+.07),(x+sign*.28,-.19,z-.12),(x+sign*.10,-.32,z-.22),(x-sign*.19,-.31,z-.16)]
        plate("Hombrera laminada",pad,.43,obsidian,ua)
        tube("Ribete hombrera",[(x-sign*.18,-.34,z-.13),(x+sign*.10,-.35,z-.18),(x+sign*.26,-.22,z-.10)],[.015]*3,bronze,ua,8)
    rune_on("Runa hombrera","Z",pad,.15,ua,(0,.02))
    for k in range(3):
        x=sign*(.55+k*.19)
        tube("Espina de hombro",[(x,.07,2.80),(x+sign*.13,.08,3.00),(x+sign*.17,.1,3.20-k*.07)],[.11,.065,0.002],horn,ua)
        tube("Punta incandescente",[(x+sign*.14,.085,3.02-k*.035),(x+sign*.17,.1,3.20-k*.07)],[.041,.001],lava,ua,8)
    ellipsoid("Muslo",(sign*.33,.025,1.22),(.27,.27,.39),skin,thigh)
    ellipsoid("Rodilla",(sign*.38,-.01,.88),(.22,.23,.22),obsidian,shin)
    tube("Greba",[(sign*.39,0,.76),(sign*.40,0,.25)],[.22,.17],obsidian,shin,16)
    rune("Runa greba","TH",(sign*.395,-.195,.5),(1,0,0),(0,-.098,.995),.17,shin)
    plate("Rodillera",[(sign*.18,-.24,.94),(sign*.38,-.30,1.10),(sign*.58,-.24,.94),(sign*.38,-.34,.65)],.10,bronze,shin)
    tube("Lava rodilla",[(sign*.27,-.35,.95),(sign*.38,-.38,.86),(sign*.49,-.35,.95)],[.007,.016,.007],lava,shin,8)
    ellipsoid("Bota",(sign*.40,-.17,.17),(.25,.43,.17),obsidian,foot)
    for k in range(3):
        x=sign*.4+(k-1)*.16
        tube("Garra del pie",[(x,-.42,.15),(x,-.61,.10),(x,-.69,.075)],[.07,.045,.001],horn,foot,10)
    plate("Faldón lateral",[(sign*.22,-.24,1.69),(sign*.49,-.17,1.60),(sign*.64,-.21,1.19),(sign*.39,-.34,1.35)],.09,obsidian,thigh)
apron=[(-.16,-.32,1.59),(.16,-.32,1.59),(.12,-.38,1.13),(0,-.40,.98),(-.12,-.38,1.13)]
plate("Faldón central",apron,.08,obsidian,"hips")
rune_on("Runa faldón","F",apron,.17,"hips",(0,.05))

# Angular mask, inset eyes and swept horns preserve the reference's silhouette.
ellipsoid("Cráneo",(0,0,3.24),(.29,.25,.36),skin,"head")
plate("Frente",[(-.25,-.15,3.46),(0,-.19,3.70),(.25,-.15,3.46),(.17,-.29,3.27),(0,-.34,3.32),(-.17,-.29,3.27)],.13,obsidian,"head")
plate("Mandíbula",[(-.22,-.20,3.21),(-.18,-.29,3.02),(0,-.32,2.91),(.18,-.29,3.02),(.22,-.20,3.21),(0,-.27,3.12)],.14,skin,"head")
plate("Boca",[(-.15,-.302,3.16),(0,-.34,3.13),(.15,-.302,3.16),(.12,-.326,3.055),(-.12,-.326,3.055)],.025,mouth,"head",.005)
for k in range(7):
    x=(k-3)*.035
    tube("Colmillo",[(x,-.35,3.135),(x,-.36,3.078 if k%2 else 3.095)],[.018,.002],teeth,"head",6)
for s in [-1,1]:
    plate("Órbita",[(s*.025,-.29,3.31),(s*.22,-.24,3.36),(s*.20,-.30,3.23),(s*.07,-.33,3.23)],.04,mouth,"head",.012)
    plate("Ojo de fuego",[(s*.055,-.34,3.30),(s*.194,-.30,3.32),(s*.16,-.343,3.255),(s*.08,-.35,3.258)],.02,fire,"head",.006)
    plate("Ceja",[(s*.015,-.34,3.34),(s*.22,-.27,3.41),(s*.27,-.26,3.35),(s*.07,-.36,3.30)],.06,obsidian,"head",.012)
    plate("Pómulo",[(s*.23,-.22,3.29),(s*.15,-.31,3.19),(s*.21,-.27,3.05),(s*.32,-.13,3.23)],.08,obsidian,"head")
    tube("Cuerno mayor",[(s*.22,.035,3.47),(s*.46,.045,3.49),(s*.68,.06,3.66),(s*.73,.08,3.88),(s*.63,.06,4.05),(s*.54,.02,4.18),(s*.56,-.02,4.32)],[.17,.16,.13,.10,.066,.034,.001],horn,"head",16)
    tube("Brasa del cuerno",[(s*.63,.06,4.05),(s*.54,.02,4.18),(s*.56,-.02,4.32)],[.067,.035,.001],lava,"head",12)
    tube("Cuerno interior",[(s*.11,.035,3.53),(s*.23,.06,3.74),(s*.24,.02,3.88),(s*.19,-.02,3.96)],[.085,.06,.027,.001],horn,"head")
    tube("Marca facial",[(s*.22,-.29,3.20),(s*.15,-.34,3.10),(s*.08,-.35,3.01)],[.007,.01,.001],lava,"head",8)
tube("Sello frontal",[(0,-.23,3.62),(.02,-.30,3.48),(0,-.36,3.35)],[.004,.012,.002],lava,"head",8)

# Flaming mace held head-down in the right fist.
G=Vector((-1.13,-.12,1.5));D=Vector((-.32,-.42,-.85)).normalized();H=G+D*1.08
start=len(parts)
tube("Mango",[G-D*.16,G+D*.86],[.05,.05],grip,"root",12)
for t in [.3,.55,.8]:
    tube("Anillo del mango",[G+D*(t-.025),G+D*(t+.025)],[.062,.062],bronze,"root",12)
tube("Collar",[G+D*.82,G+D*.9],[.08,.1],bronze,"root",14)
ellipsoid("Núcleo de lava",H,(.25,.25,.25),lava,"root",16,10)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=.3,location=(0,0,0))
rock=bpy.context.object
for v in rock.data.vertices: v.co*=random.uniform(.78,1.16)
rock.location=H;finish(rock,"Cabeza de roca",obsidian,"root",False)
for i in range(16):
    z=1-2*(i+.5)/16;d=Vector((math.sqrt(1-z*z)*math.cos(i*2.39996),math.sqrt(1-z*z)*math.sin(i*2.39996),z))
    if d.dot(-D)>.35: continue
    tube("Púa",[H+d*.22,H+d*.38,H+d*.5],[.08,.045,.002],horn,"root",10)
    tube("Púa incandescente",[H+d*.39,H+d*.5],[.04,.001],lava,"root",8)
mace=take(start)
start=len(parts)
flames("Llama de la maza",[(H+Vector((.19*math.cos(a),.19*math.sin(a),.1)),random.uniform(.45,.7)) for a in [i*math.tau/6 for i in range(6)]]+[(H+Vector((0,0,.22)),.85)],1)
mace_fire=take(start)

# Burning die offered on the left palm; 6 faces forward, opposite faces sum to 7.
C=Vector((1.08,-.49,2.25));HALF=.14
start=len(parts)
bpy.ops.mesh.primitive_cube_add(size=HALF*2,location=C);cube=bpy.context.object
bevel=cube.modifiers.new("Esquinas","BEVEL");bevel.width=.035;bevel.segments=4;bpy.ops.object.modifier_apply(modifier=bevel.name)
finish(cube,"Dado",die_red,"root",False)
PIPS={1:[(0,0)],2:[(-1,-1),(1,1)],3:[(-1,-1),(0,0),(1,1)],4:[(-1,-1),(1,-1),(-1,1),(1,1)],
      5:[(-1,-1),(1,-1),(0,0),(-1,1),(1,1)],6:[(-1,-1),(-1,0),(-1,1),(1,-1),(1,0),(1,1)]}
for value,normal,right,up in [(6,(0,-1,0),(1,0,0),(0,0,1)),(1,(0,1,0),(-1,0,0),(0,0,1)),(5,(0,0,1),(1,0,0),(0,1,0)),
                              (2,(0,0,-1),(1,0,0),(0,-1,0)),(4,(1,0,0),(0,1,0),(0,0,1)),(3,(-1,0,0),(0,-1,0),(0,0,1))]:
    n,r,u=Vector(normal),Vector(right),Vector(up)
    for a,b in PIPS[value]:
        scale=Vector([.012 if abs(c) else .024 for c in normal])
        ellipsoid("Punto",C+n*(HALF-.003)+(r*a+u*b)*.072,scale*1.15,pips,"root",12,8)
die=take(start)
start=len(parts)
flames("Llama del dado",[(C+Vector((x,y,.1)),random.uniform(.32,.48)) for x,y in [(-.08,.06),(.08,.06),(0,.09),(0,-.02)]],.5)
die_fire=take(start)

def crack_material():
    m=bpy.data.materials.new("Horneado · roca y lava");m.use_nodes=True
    nt=m.node_tree;N=nt.nodes;L=nt.links;p=N["Principled BSDF"]
    def socket(node,identifier,outputs=False):
        return next(s for s in (node.outputs if outputs else node.inputs) if s.identifier==identifier)
    coord=N.new("ShaderNodeTexCoord")
    warp=N.new("ShaderNodeTexNoise");warp.inputs["Scale"].default_value=2.4;warp.inputs["Detail"].default_value=4
    L.new(coord.outputs["Object"],warp.inputs["Vector"])
    offset=N.new("ShaderNodeVectorMath");offset.operation="MULTIPLY_ADD"
    offset.inputs[1].default_value=(.16,.16,.16);offset.inputs[2].default_value=(-.08,-.08,-.08)
    L.new(warp.outputs["Color"],offset.inputs[0])
    warped=N.new("ShaderNodeVectorMath");warped.operation="ADD"
    L.new(coord.outputs["Object"],warped.inputs[0]);L.new(offset.outputs["Vector"],warped.inputs[1])
    def edges(scale,width,strength):
        cells=N.new("ShaderNodeTexVoronoi");cells.feature="DISTANCE_TO_EDGE";cells.inputs["Scale"].default_value=scale
        L.new(warped.outputs["Vector"],cells.inputs["Vector"])
        ramp=N.new("ShaderNodeMapRange");ramp.interpolation_type="SMOOTHSTEP"
        for key,value in [("From Min",0),("From Max",width),("To Min",strength),("To Max",0)]: ramp.inputs[key].default_value=value
        L.new(cells.outputs["Distance"],ramp.inputs["Value"]);return ramp.outputs["Result"]
    mask=N.new("ShaderNodeMath");mask.operation="MAXIMUM"
    L.new(edges(3.3,.034,1),mask.inputs[0]);L.new(edges(8.5,.016,.32),mask.inputs[1])
    grain=N.new("ShaderNodeTexNoise");grain.inputs["Scale"].default_value=14;grain.inputs["Detail"].default_value=8
    L.new(coord.outputs["Object"],grain.inputs["Vector"])
    stone=N.new("ShaderNodeValToRGB");L.new(grain.outputs["Fac"],stone.inputs["Fac"])
    stone.color_ramp.elements[0].position=.3;stone.color_ramp.elements[0].color=(.028,.013,.01,1)
    stone.color_ramp.elements[1].position=.75;stone.color_ramp.elements[1].color=(.15,.06,.035,1)
    mix=N.new("ShaderNodeMix");mix.data_type="RGBA"
    L.new(mask.outputs[0],socket(mix,"Factor_Float"));L.new(stone.outputs["Color"],socket(mix,"A_Color"))
    socket(mix,"B_Color").default_value=(.9,.22,.03,1)
    L.new(socket(mix,"Result_Color",True),p.inputs["Base Color"])
    glow=N.new("ShaderNodeValToRGB");L.new(mask.outputs[0],glow.inputs["Fac"])
    stops=glow.color_ramp.elements;stops[0].position=.12;stops[0].color=(0,0,0,1);stops[1].position=1;stops[1].color=(1,.78,.3,1)
    for position,color in [(.4,(.55,.025,0,1)),(.75,(1,.26,.02,1))]:
        stop=stops.new(position);stop.color=color
    L.new(glow.outputs["Color"],p.inputs["Emission Color"]);p.inputs["Emission Strength"].default_value=1
    height=N.new("ShaderNodeMath");height.operation="MULTIPLY_ADD";height.inputs[1].default_value=-.9;height.inputs[2].default_value=1
    L.new(mask.outputs[0],height.inputs[0])
    rough=N.new("ShaderNodeMath");rough.operation="MULTIPLY_ADD";rough.inputs[1].default_value=.25
    L.new(grain.outputs["Fac"],rough.inputs[0]);L.new(height.outputs[0],rough.inputs[2])
    bump=N.new("ShaderNodeBump");bump.inputs["Strength"].default_value=.7;bump.inputs["Distance"].default_value=.03
    L.new(rough.outputs[0],bump.inputs["Height"]);L.new(bump.outputs["Normal"],p.inputs["Normal"])
    return m

def bake_skin(obj, size=2048):
    # glTF cannot carry procedural nodes, so the crack network is baked to textures on a fresh UV layout.
    bpy.ops.object.select_all(action="DESELECT");obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    source=crack_material();obj.data.materials.clear();obj.data.materials.append(source)
    target=source.node_tree.nodes.new("ShaderNodeTexImage")
    scene=bpy.context.scene;scene.render.engine="CYCLES";scene.cycles.samples=1;scene.render.bake.margin=8
    images={}
    for key,kind,options,colorspace in [("color","DIFFUSE",{"pass_filter":{"COLOR"}},"sRGB"),("emit","EMIT",{},"sRGB"),("normal","NORMAL",{},"Non-Color")]:
        image=bpy.data.images.new(f"demonio_piel_{key}",size,size);image.colorspace_settings.name=colorspace
        target.image=image;source.node_tree.nodes.active=target
        bpy.ops.object.bake(type=kind,**options);image.pack();images[key]=image
    final=bpy.data.materials.new("Roca volcánica agrietada");final.use_nodes=True
    nt=final.node_tree;p=nt.nodes["Principled BSDF"]
    def texture(key):
        node=nt.nodes.new("ShaderNodeTexImage");node.image=images[key];return node
    nt.links.new(texture("color").outputs["Color"],p.inputs["Base Color"])
    nt.links.new(texture("emit").outputs["Color"],p.inputs["Emission Color"]);p.inputs["Emission Strength"].default_value=3.2
    normal_map=nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(texture("normal").outputs["Color"],normal_map.inputs["Color"]);nt.links.new(normal_map.outputs["Normal"],p.inputs["Normal"])
    p.inputs["Roughness"].default_value=.62;p.inputs["Metallic"].default_value=.08
    obj.data.materials.clear();obj.data.materials.append(final)

def join(objects, active):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=active
    if len(objects)>1: bpy.ops.object.join()
    return bpy.context.object

skin_parts=[p for p in parts if p.data.materials[0]==skin]
skin_mesh=join(skin_parts,skin_parts[0]);skin_mesh.name="Piel"
bake_skin(skin_mesh)
# Join geometry but preserve each rigid armor piece's bone weights; the skin keeps the active UV map.
mesh=join([p for p in parts if p not in skin_parts]+[skin_mesh],skin_mesh);mesh.name="Demonio_Mesh"
# Recalculate normals after mirrored polygon construction.
bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode="OBJECT")
modifier=mesh.modifiers.new("Esqueleto","ARMATURE");modifier.object=rig
mesh.parent=rig
rig["status"]="Prototipo para revisión artística; no sustituye todavía las mascotas del juego"
rig["reference"]="public/mascots/demonio.webp"

def attach(objects, name, origin, bone):
    # Props follow the hand bone as separate nodes, so the web viewer can flicker the flames and light them.
    for obj in objects: obj.vertex_groups.clear()
    obj=join(objects,objects[0]);obj.name=name;obj.data.name=name
    bpy.context.scene.cursor.location=origin;bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.mode_set(mode="EDIT");bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode="OBJECT")
    world=obj.matrix_world.copy()
    obj.parent=rig;obj.parent_type="BONE";obj.parent_bone=bone
    bpy.context.view_layer.update();obj.matrix_world=world
    return obj

props=[attach(mace,"Maza",G,"hand.R"),attach(mace_fire,"Llamas_Maza",H,"hand.R"),
       attach(die,"Dado",C,"hand.L"),attach(die_fire,"Llamas_Dado",C+Vector((0,0,.1)),"hand.L")]

scene=bpy.context.scene
scene.render.fps=30
def pose(frame, rotations=None, lift=0, forward=0):
    for b in rig.pose.bones:
        b.rotation_mode="XYZ";b.rotation_euler=(0,0,0);b.location=(0,0,0)
    for name, degrees in (rotations or {}).items():
        rig.pose.bones[name].rotation_euler=tuple(math.radians(v) for v in degrees)
    # Root local Y points up; local Z points backwards in the rest skeleton.
    rig.pose.bones["root"].location=(0,lift,forward)
    for b in rig.pose.bones:
        b.keyframe_insert(data_path="rotation_euler",frame=frame,group=b.name)
        b.keyframe_insert(data_path="location",frame=frame,group=b.name)

def clip(name, keys):
    rig.animation_data_create();rig.animation_data.action=None
    action=bpy.data.actions.new(name);action.use_fake_user=True
    rig.animation_data.action=action
    for frame, rotations, lift, forward in keys: pose(frame,rotations,lift,forward)
    return action

# The left forearm already reaches forward, so its celebration raises the die toward the camera instead of overhead.
idle=clip("Idle",[(1,{},0,0),(31,{"chest":(2,0,0),"head":(-2,0,0),"forearm.L":(0,0,3),"forearm.R":(0,0,-3)},.018,0),(61,{},0,0)])
clip("Celebrate",[(1,{},0,0),(16,{"spine":(8,0,0),"upper_arm.L":(0,0,-20),"upper_arm.R":(0,0,20)},-.04,0),(32,{"chest":(-10,0,0),"upper_arm.L":(-20,0,-60),"upper_arm.R":(0,0,125),"forearm.L":(60,0,0),"forearm.R":(0,0,30),"head":(-10,0,0)},.1,0),(55,{"chest":(-7,0,0),"upper_arm.L":(-15,0,-55),"upper_arm.R":(0,0,115),"forearm.L":(50,0,0)},.03,0),(76,{},0,0)])
clip("Throw",[(1,{},0,0),(20,{"chest":(0,0,-16),"upper_arm.R":(-100,0,15),"forearm.R":(-50,0,0),"head":(0,0,12)},0,0),(28,{"chest":(16,0,18),"upper_arm.R":(100,0,-15),"forearm.R":(10,0,0),"upper_arm.L":(-20,0,0)},-.03,0),(42,{"chest":(8,0,6),"upper_arm.R":(40,0,0)},0,0),(61,{},0,0)])
clip("Hit",[(1,{},0,0),(8,{"chest":(-18,0,-10),"head":(-16,0,12),"upper_arm.L":(-20,0,-15),"upper_arm.R":(-20,0,15)},-.04,0),(18,{"chest":(8,0,4),"head":(7,0,0)},-.02,0),(36,{},0,0)])
clip("Knockout",[(1,{},0,0),(15,{"chest":(-12,0,0),"head":(-15,0,0)},-.08,0),(35,{"root":(-42,0,-8),"chest":(12,0,0),"upper_arm.L":(0,0,-25),"upper_arm.R":(0,0,25)},.05,0),(55,{"root":(-88,0,-8),"head":(8,0,0),"upper_arm.L":(0,0,-30),"upper_arm.R":(0,0,30)},.38,0),(76,{"root":(-88,0,-8),"head":(8,0,0),"upper_arm.L":(0,0,-30),"upper_arm.R":(0,0,30)},.38,0)])

# Bake floor contact for every pose, props included; the rigid prototype has no leg IK yet.
for action in list(bpy.data.actions):
    rig.animation_data.action=action
    for frame in range(int(action.frame_range[0]),int(action.frame_range[1])+1):
        scene.frame_set(frame)
        graph=bpy.context.evaluated_depsgraph_get()
        lowest=min(min((e.matrix_world@v.co).z for v in e.data.vertices) for e in [o.evaluated_get(graph) for o in [mesh,*props]])
        root=rig.pose.bones["root"];root.location.y-=lowest
        root.keyframe_insert(data_path="location",frame=frame,group="root")

# Export only the character and its props. The review stage and lighting are not game assets.
bpy.ops.object.select_all(action="DESELECT")
for obj in [rig,mesh,*props]: obj.select_set(True)
bpy.context.view_layer.objects.active=rig
rig.animation_data.action=idle
scene.frame_start=1;scene.frame_end=61;scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(WEB/"demonio.glb"),export_format="GLB",use_selection=True,export_animations=True,export_animation_mode="ACTIONS",export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format="WEBP",export_image_quality=82)

# Dark review stage with bloom, useful for inspecting actual geometry rather than concept art.
stage=material("Escenario",(.03,.032,.038),.35,.42)
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.8,depth=.12,location=(0,0,-.08))
pedestal=bpy.context.object;pedestal.name="Peana de revisión";pedestal.data.materials.append(stage)
bevel=pedestal.modifiers.new("Borde","BEVEL");bevel.width=.05;bevel.segments=3
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.15));bpy.context.object.data.materials.append(stage)
def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
def light(name,loc,color,power,size):
    data=bpy.data.lights.new(name,"AREA");data.energy=power;data.color=color;data.shape="DISK";data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,2))
light("Principal",(3,-5,6),(1,.72,.52),750,4)
light("Relleno",(-4,-3,4),(.48,.6,1),380,4)
light("Contorno",(2,3,5),(1,.2,.055),1600,3)
light("Contorno opuesto",(-3,3,4),(1,.32,.08),900,3)
camera_data=bpy.data.cameras.new("Cámara de revisión");camera=bpy.data.objects.new("Cámara de revisión",camera_data)
scene.collection.objects.link(camera);scene.camera=camera
camera.location=(4,-10,4.4);aim(camera,(0,0,2.05));camera_data.type="ORTHO";camera_data.ortho_scale=5.4
scene.world.color=(.03,.03,.035)
scene.render.engine="CYCLES";scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.view_settings.view_transform="AgX"
scene.use_nodes=True;tree=scene.node_tree
for node in list(tree.nodes): tree.nodes.remove(node)
layers=tree.nodes.new("CompositorNodeRLayers");glare=tree.nodes.new("CompositorNodeGlare");composite=tree.nodes.new("CompositorNodeComposite")
glare.glare_type="BLOOM"
for key,value in [("Threshold",1.0),("Strength",.7),("Size",.6)]:
    if key in glare.inputs: glare.inputs[key].default_value=value
tree.links.new(layers.outputs["Image"],glare.inputs["Image"]);tree.links.new(glare.outputs["Image"],composite.inputs["Image"])
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"demonio.blend"))
scene.render.filepath=str(OUT/"preview.png");bpy.ops.render.render(write_still=True)
rig.animation_data.action=bpy.data.actions["Celebrate"];scene.frame_set(32)
scene.render.filepath=str(OUT/"celebrate.png");bpy.ops.render.render(write_still=True)
rig.animation_data.action=idle;scene.frame_set(1)
camera.location=C+Vector((1.6,-4,1.1));aim(camera,C+Vector((-.25,0,-.1)));camera_data.ortho_scale=1.5
scene.render.resolution_y=900;scene.render.filepath=str(OUT/"detail.png");bpy.ops.render.render(write_still=True)
print("DEMONIO_READY",len(mesh.data.vertices),"vertices",len(armature.bones),"bones",len(props),"props")
