"""Build the editable Blender source and runtime GLBs for Olive and 13th."""

from math import cos, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from architecture import cafe, park_pacific, paving_and_street, plaza, surfaces
from central_library import central_library
from meshkit import export_models, material, native
from people import people_surfaces, person

OUTPUT = HERE.parent.parent / "public" / "models" / "olive-corner"


def collection(name):
    group = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(group)
    return group


def stage_review(sofia, micah):
    """Pose the source scene for editing, after the runtime assets are exported."""
    for group, position, yaw in ((sofia, (52.16, .066, -2.79), 1.57), (micah, (35.55, .058, 16.86), -.56)):
        rig = next(obj for obj in group.objects if obj.type == "ARMATURE")
        rig.location = native(position)
        rig.rotation_euler.z = yaw
    stage = collection("Review camera and lighting")
    data = bpy.data.cameras.new("Olive Street gameplay camera")
    data.type = "ORTHO"
    data.ortho_scale = 48.72
    camera = bpy.data.objects.new(data.name, data)
    stage.objects.link(camera)
    target = Vector(native((43.45, 4.38, 6.42)))
    pitch, yaw, radius = .735, -.67, 78
    camera.location = target + Vector(native((sin(yaw) * cos(pitch) * radius, sin(pitch) * radius, cos(yaw) * cos(pitch) * radius)))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    for label, direction, power, tint in [
        ("Warm daylight", (-28, 47, 29), 2.12, (1, .91, .78)),
        ("Cool fill", (24, 16, -25), .61, (.84, .92, 1)),
    ]:
        light_data = bpy.data.lights.new(label, "SUN")
        light_data.energy = power
        light_data.color = tint
        light_data.angle = .17
        light = bpy.data.objects.new(label, light_data)
        stage.objects.link(light)
        light.rotation_euler = (-Vector(native(direction))).to_track_quat("-Z", "Y").to_euler()
    street = bpy.data.meshes.new("Neutral context")
    street.from_pydata([native(p) for p in [(24, 0, 25), (66, 0, 25), (66, 0, -25), (24, 0, -25)]], [], [(0, 1, 2, 3)])
    street.update()
    ground = bpy.data.objects.new("Neutral context", street)
    stage.objects.link(ground)
    ground.data.materials.append(material("Preview pavement", "#ae9c81"))
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                space = area.spaces.active
                space.region_3d.view_perspective = "CAMERA"
                space.shading.color_type = "MATERIAL"
                space.overlay.show_overlays = False


bpy.ops.wm.read_factory_settings(use_empty=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.context.scene.render.fps = 24
bpy.context.scene.frame_end = 1
surfaces()
people_surfaces()
buildings = collection("Olive and 13th · exterior and street")
park_pacific(buildings)
central_library(buildings)
cafe(buildings)
paving_and_street(buildings)
plaza(buildings)
sofia = collection("Sofia Reed · Park Pacific")
person("Sofia", sofia)
micah = collection("Micah Evans · Olive & Rye")
person("Micah", micah, apron=True)
bpy.context.scene.frame_set(1)
export_models((
    ("olive-and-13th.glb", buildings, False),
    ("sofia.glb", sofia, True),
    ("micah.glb", micah, True),
), OUTPUT)
stage_review(sofia, micah)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "olive-and-13th.blend"), compress=True)
