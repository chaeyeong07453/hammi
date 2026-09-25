"""Rebuild the original Hammi Play models with Blender. No external assets.
Run: Blender --background --python game-design/blender/build_assets.py
Coordinates in helper functions follow Three.js (Y up, +Z toward camera).
"""
import bpy, math, os, json
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'models'
OUT.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection' and c.users==0: bpy.data.collections.remove(c)
PALETTE={'orchid':'E1B7FA','lilac':'B9A7F9','sky':'B1D4FA','mint':'B9EBEA','butter':'F0EDC2','peach':'F6C8AD','white':'FFFDF9','ink':'45405D','road':'8884A9','grass':'D5EEDB','trunk':'BCA0AC','net':'827994','ball':'E6EC9B'}
def srgb(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
MATS={}
for name,h in PALETTE.items():
    m=bpy.data.materials.new(name);m.diffuse_color=tuple(srgb(int(h[i:i+2],16)/255) for i in (0,2,4))+(1,)
    m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.65;MATS[name]=m
MATS['lilac'].name='CarPaint'
def pos(p): return (p[0],-p[2],p[1])
def collection(name):
    c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c
C=None
def move(o,name,mat):
    o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    C.objects.link(o)
    if mat:o.data.materials.append(MATS[mat])
    return o
def smooth(o):
    if hasattr(o.data,'polygons'):
        for f in o.data.polygons:f.use_smooth=True
    return o
def box(name,p,d,mat,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos(p));o=bpy.context.object;o.dimensions=(d[0],d[2],d[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);move(o,name,mat)
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL');mod.width=min(bevel,min(d)*.4);mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return o
def ball(name,p,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=1,location=pos(p));o=bpy.context.object;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return smooth(move(o,name,mat))
def cylinder(name,p,r,h,mat,axis='y',vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=pos(p));o=bpy.context.object
    if axis=='x':o.rotation_euler[1]=math.pi/2
    elif axis=='z':o.rotation_euler[0]=math.pi/2
    move(o,name,mat);return smooth(o)
def line(name,a,b,r,mat):
    aa,bb=Vector(pos(a)),Vector(pos(b));delta=bb-aa
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=delta.length,location=(aa+bb)/2);o=bpy.context.object;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return smooth(move(o,name,mat))
def tree(x,z,size=1,tone='mint'):
    cylinder('Tree trunk',(x,.65*size,z),.14*size,1.3*size,'trunk')
    for dx,dy,dz,r in [(0,1.9,0,.87),(-.48,1.65,.12,.66),(.43,1.7,-.1,.72)]:ball('Cloud tree',(x+dx*size,dy*size,z+dz*size),(r*size,r*size,r*size),tone)
def flower(x,z,tone):
    cylinder('Flower stem',(x,.18,z),.025,.32,'mint',vertices=8)
    for i in range(5):
        a=i*math.tau/5;ball('Petal',(x+math.cos(a)*.12,.4+math.sin(a)*.12,z),(.095,.1,.05),tone)
    ball('Flower heart',(x,.4,z+.025),(.07,.07,.065),'butter')
def merge_by_material(c):
    # Environment draw calls stay low while silhouettes keep their soft detail.
    groups={}
    for o in list(c.objects):
        if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
    for material,objs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        if len(objs)>1:bpy.ops.object.join()
        objs[0].name=c.name+'_'+material
        bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
def export(c,file):
    # Preserve individually named editable pieces in the .blend, merge only export copies.
    temp=collection(c.name+'_Export')
    for source in c.objects:
        obj=source.copy();obj.data=source.data.copy();temp.objects.link(obj)
    merge_by_material(temp)
    bpy.ops.object.select_all(action='DESELECT')
    for o in temp.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
    print('EXPORTED',file,len(temp.objects),'objects')
    for obj in list(temp.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(temp)
# --- A soft three-lane garden road, forward points toward +Z. ---
C=collection('RaceWorld')
box('Garden island',(0,-.28,-24),(33,.6,105),'grass',.28)
box('Lavender road',(0,.06,-24),(10.6,.14,105),'road',.04)
for side in [-1,1]:
    box('Sidewalk',(side*6.6,.09,-24),(2.2,.2,105),'white',.08)
    for i in range(26):box('Candy curb',(side*5.6,.25,-73+i*4),(1,.3,3.7),'lilac' if i%2 else 'butter',.1)
    for i,z in enumerate(range(-66,15,9)):
        tree(side*(9+(i%2)*1.3),z,.95+(i%3)*.13,['mint','orchid','sky'][i%3])
    for z in [-41,-13,12]:
        line('Lamp pole',(side*7.2,.2,z),(side*7.2,4.7,z),.075,'white')
        line('Lamp arm',(side*7.2,4.7,z),(side*6.7,4.7,z),.07,'white')
        ball('Lamp',(side*6.6,4.65,z),(.28,.2,.28),'butter')
for i in range(9):ball('Distant hills',(-34+i*8,1.1,-77),(7,5+i%3,5),['mint','sky','lilac'][i%3])
for x in [-13,13]:
    for j,z in enumerate([-55,-39]):
        box('Little house',(x,1.2,z),(3.2,2.5,3.2),['peach','sky'][j],.2)
        box('Little roof',(x,2.8,z),(3.6,.6,3.5),'lilac',.18)
        box('Window',(x,1.8,z+1.63),(1,.8,.06),'white',.1)
        box('Door',(x,.75,z+1.63),(.65,1.2,.07),'mint',.1)
for x,z in [(-8,3),(8,-3),(-9,-5),(8,-22)]:flower(x,z,'peach')
export(C,'race-world.glb')
# --- Rounded toy car with a named, recolorable paint material. ---
C=collection('Car')
box('Car body',(0,.65,0),(1.65,.65,2.65),'lilac',.24)
box('Car glass',(0,1.16,-.25),(1.35,.7,1.25),'ink',.2)
box('Car roof',(0,1.53,-.35),(1.41,.16,1.15),'lilac',.1)
for x in [-.68,.68]:box('Window frame',(x,1.13,-.25),(.075,.68,.09),'lilac',.03)
box('Hood stripe',(0,1,.86),(.26,.015,.7),'white',.005)
box('Bumper',(0,.49,1.31),(1.32,.18,.12),'white',.06)
for x in [-.54,.54]:ball('Headlamp',(x,.78,1.29),(.2,.14,.075),'butter')
for x in [-.83,.83]:
    for z in [-.83,.83]:
        cylinder('Tire',(x,.38,z),.32,.22,'ink','x')
        cylinder('Hubcap',(x*1.13,.38,z),.16,.02,'white','x')
for x in [-.92,.92]:ball('Mirror',(x,1.07,.1),(.14,.08,.12),'lilac')
export(C,'car.glb')
# --- Garden tennis court, scaled in friendly world units. ---
C=collection('TennisWorld')
box('Court island',(0,-.38,0),(17,.65,24),'white',.45)
box('Apricot apron',(0,-.01,0),(13.4,.13,20),'peach',.4)
box('Court surface',(0,.07,0),(8.2,.12,16.4),'mint',.12)
for x in [-3.85,3.85]:box('Singles alley',(x,.14,0),(.5,.02,16),'sky',.005)
# Court lines, baselines and service boxes.
for x in [-4,-3.25,3.25,4]:box('Court line',(x,.162,0),(.07,.012,16),'white',0)
for z in [-8,-4,4,8]:box('Court line',(0,.162,z),(8,.012,.07),'white',0)
for z in [-2,2]:box('Service line',(0,.163,z),(.065,.012,4),'white',0)
for z in [-8,8]:box('Baseline mark',(0,.164,z),(.06,.012,.35),'white',0)
for x in [-4.4,4.4]:
    cylinder('Net post',(x,.73,0),.1,1.5,'lilac')
    ball('Post cap',(x,1.49,0),(.13,.1,.13),'butter')
for x in range(-21,22):line('Net vertical',(x*.2,.2,0),(x*.2,1.35,0),.011,'net')
for y in range(2,14):line('Net horizontal',(-4.3,y*.1,0),(4.3,y*.1,0),.009,'net')
line('Net tape',(-4.4,1.37,0),(4.4,1.37,0),.047,'white')
for x,z in [(-6.5,-9),(6.7,-9),(-6.7,8),(6.8,8)]:tree(x,z,1.05,'mint' if x<0 else 'orchid')
for x in [-6.5,6.5]:
    box('Bench seat',(x,.6,2.3),(1,.2,2.5),'lilac',.09)
    box('Bench back',(x+.4,.95,2.3),(.15,.7,2.5),'lilac',.07)
    for z in [1.4,3.2]:box('Bench leg',(x,.28,z),(.6,.5,.15),'white',.06)
for x in [-5.3,5.3]:
    for z in [-7,-5,5,7]:flower(x,z,'orchid' if x>0 else 'butter')
# Small scalloped pavilion umbrella.
cylinder('Umbrella pole',(-6.2,1.6,-3),.06,3.2,'white')
for i in range(8):
    angle=i*math.tau/8;ball('Umbrella scallop',(-6.2+math.cos(angle)*.65,3.1,-3+math.sin(angle)*.65),(.8,.24,.8),'butter' if i%2 else 'white')
ball('Umbrella top',(-6.2,3.28,-3),(.65,.2,.65),'butter')
export(C,'tennis-world.glb')
# --- A small bear tennis player. Named parts remain editable in the .blend. ---
C=collection('TennisPlayer')
ball('Body',(0,.85,0),(.45,.6,.36),'lilac')
ball('Head',(0,1.55,.04),(.52,.48,.43),'white')
for x in [-.36,.36]:
    ball('Ear',(x,1.92,.015),(.19,.21,.14),'white');ball('Inner ear',(x,1.94,.135),(.10,.12,.035),'peach')
for x in [-.17,.17]:ball('Eye',(x,1.61,.43),(.038,.052,.025),'ink')
ball('Snout',(0,1.45,.43),(.15,.10,.055),'peach')
ball('Nose',(0,1.49,.475),(.046,.03,.025),'ink')
for x in [-.29,.29]:ball('Blush',(x,1.43,.385),(.07,.04,.025),'peach')
box('Headband',(0,1.84,.08),(1.02,.11,.74),'sky',.08)
for x in [-.23,.23]:
    ball('Shoe',(x,.23,.17),(.22,.16,.34),'white')
    line('Leg',(x,.3,.03),(x,.61,.02),.13,'white')
line('Left arm',(-.36,1.02,0),(-.63,.78,.14),.12,'white')
line('Racket arm',(.33,1.04,0),(.72,1.0,.20),.12,'white')
line('Racket grip',(.68,1.03,.19),(.98,1.34,.19),.06,'peach')
# Racket hoop and a small string grid face the camera.
for i in range(28):
    a=i*math.tau/28;b=(i+1)*math.tau/28
    line('Racket hoop',(1.15+math.cos(a)*.33,1.58+math.sin(a)*.43,.2),(1.15+math.cos(b)*.33,1.58+math.sin(b)*.43,.2),.037,'lilac')
for x in [-.2,-.1,0,.1,.2]:
    h=.40*math.sqrt(1-(x/.33)**2);line('Racket strings',(1.15+x,1.58-h,.2),(1.15+x,1.58+h,.2),.008,'white')
for y in [-.3,-.15,0,.15,.3]:
    w=.31*math.sqrt(1-(y/.43)**2);line('Racket strings',(1.15-w,1.58+y,.2),(1.15+w,1.58+y,.2),.008,'white')
export(C,'tennis-player.glb')
C=collection('TennisBall')
ball('Tennis ball',(0,0,0),(.22,.22,.22),'ball')
for offset in [-.09,.09]:
    for i in range(32):
        a=i*math.tau/32;b=(i+1)*math.tau/32;r=math.sqrt(.221**2-offset**2)
        line('Ball seam',(math.cos(a)*r,math.sin(a)*r,offset),(math.cos(b)*r,math.sin(b)*r,offset),.009,'white')
export(C,'tennis-ball.glb')
# Save an organized, editable source scene; each collection is an independent asset.
for c in bpy.data.collections:
    if c.name=='Collection' and not c.objects:bpy.data.collections.remove(c)
library=bpy.context.scene;library.name='00 Asset Library'
library['readme']='Original editable parts by collection. Switch to 01 Race Preview or 02 Tennis Preview. build_assets.py regenerates GLBs from asset origins. No rigs or gameplay animations.'
def preview_scene(name,world_name,camera_at,look_at):
    scene=bpy.data.scenes.new(name);scene.collection.children.link(bpy.data.collections[world_name])
    world=bpy.data.worlds.new(name+' World');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.62,.75,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;scene.world=world
    light=bpy.data.lights.new(name+' Softbox','AREA');light.energy=2200;light.shape='DISK';light.size=12
    light_obj=bpy.data.objects.new(name+' Softbox',light);scene.collection.objects.link(light_obj);light_obj.location=pos((-8,16,7))
    light_obj.rotation_euler=(Vector(pos((0,0,0)))-light_obj.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.cameras.new(name+' Camera');camera.lens=43
    obj=bpy.data.objects.new(name+' Camera',camera);scene.collection.objects.link(obj);obj.location=pos(camera_at)
    obj.rotation_euler=(Vector(pos(look_at))-obj.location).to_track_quat('-Z','Y').to_euler();scene.camera=obj
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1600;scene.render.resolution_y=1000
    return scene
def instance(scene,collection_name,name,location,scale=1):
    obj=bpy.data.objects.new(name,None);obj.instance_type='COLLECTION';obj.instance_collection=bpy.data.collections[collection_name]
    obj.location=pos(location);obj.scale=(scale,scale,scale);scene.collection.objects.link(obj)
race=preview_scene('01 Race Preview','RaceWorld',(0,6.1,13),(0,1,-17))
for x,z in [(-3.5,-1),(0,-12),(3.5,-6)]:instance(race,'Car','Toy Car',(x,.16,z),1.22)
tennis=preview_scene('02 Tennis Preview','TennisWorld',(13,17,22),(0,.4,0))
for x,z in [(-1.8,5.9),(1.4,-6)]:instance(tennis,'TennisPlayer','Bear Player',(x,.15,z),1.6)
instance(tennis,'TennisBall','Tennis Ball',(0,3.5,1),1.4)
bpy.context.window.scene=tennis
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'hammi-play.blend'))
report={p.name:p.stat().st_size for p in OUT.glob('*.glb')}
(ROOT/'models'/'manifest.json').write_text(json.dumps({'generator':'Blender '+bpy.app.version_string,'files':report,'coordinates':'glTF Y-up; +Z toward camera; car forward +Z','recolorMaterial':'CarPaint'},indent=2))
print('FINISHED',report)
