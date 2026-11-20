"""Render the in-world dialogue portraits from the Blender character kit."""

from pathlib import Path
import sys

import bpy
from mathutils import Vector
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "olive-corner")]
from meshkit import Meshes, material, native
from people import head, people_surfaces, wardrobe

CAST = [
    ("nia", "#a86547", "#3c554d", "#302724", False),
    ("arun", "#aa7452", "#527889", "#312925", True),
    ("jo", "#cc9277", "#9e5c4c", "#51352a", False),
    ("jordan", "#c88f6b", "#756684", "#2d2527", False),
    ("lina", "#c78865", "#a05042", "#482f26", False),
    ("priya", "#9c6551", "#496b82", "#302728", False),
    ("nolan", "#a7755c", "#627c6a", "#564238", True),
    ("micah", "#91604a", "#466650", "#342723", True),
]

output = HERE.parents[1] / "public" / "models" / "portraits"
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
people_surfaces()
material("Brass", "#d0a263")
material("Granite base", "#9b8774")
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.resolution_x = 360
scene.render.resolution_y = 416
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.world = bpy.data.worlds.new("Soft city daylight")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .38

def look_at(obj, point):
    obj.rotation_euler = (Vector(native(point)) - obj.location).to_track_quat("-Z", "Y").to_euler()

data = bpy.data.cameras.new("Portrait camera")
data.type = "ORTHO"
data.ortho_scale = .99
camera = bpy.data.objects.new(data.name, data)
scene.collection.objects.link(camera)
scene.camera = camera
camera.location = native((.44,1.48,3.35))
look_at(camera,(0,1.145,0))

for name, position, power, size, tint in [
    ("Window",(-2,3.2,3.0),390,4.0,(1,.82,.66)),
    ("Sky",(2.65,1.9,1.15),210,3.0,(.74,.87,1)),
    ("Rim",(1.2,2.5,-2.5),330,2.1,(1,.91,.74)),
]:
    light = bpy.data.lights.new(name,"AREA")
    light.energy = power
    light.size = size
    light.color = tint
    obj = bpy.data.objects.new(name,light)
    scene.collection.objects.link(obj)
    obj.location = native(position)
    look_at(obj,(0,1.2,0))

for name, skin, coat, hair, cap in CAST:
    for slot,color in [("skin",skin),("blush",skin),("hair",hair),("coat",coat),("sleeve",coat),("shoes","#52453b"),("trousers","#4b5e62")]:
        material(name+" "+slot,color)
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    mesh = Meshes()
    head(mesh,name,cap)
    wardrobe(mesh,name,False)
    if name in ("arun","nolan","priya"):
        for side in (-1,1):
            x=side*.06
            for y in (1.346,1.397):
                mesh.box("Eyes",(x,y,.151),(.083,.010,.011))
            for off in (-.042,.042):
                mesh.box("Eyes",(x+off,1.371,.151),(.012,.057,.014))
        mesh.box("Eyes",(0,1.382,.158),(.035,.010,.012))
    mesh.build(name,group)
    path=output/(name+".png")
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    with Image.open(path) as frame:
        frame.save(output/(name+".webp"),quality=86,method=5)
    path.unlink()
    for obj in list(group.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(group)
