"""Editable meshes for the three City Dispatch workstations."""

from math import pi
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "olive-corner"))

from meshkit import Meshes, export_models, lettered, material, native, placement, wash


def surfaces():
    for index, (name, color, accent, pattern) in enumerate([
        ("Oak top", "#b98455", "#78462e", "wood"),
        ("Green panel", "#52775e", "#395a50", "wood"),
        ("Blue workstation", "#427280", "#2c505c", "stone"),
        ("Support rug", "#829475", "#516951", "fabric"),
        ("Lookup tile", "#758990", "#5b6c6d", "paving"),
        ("Packing concrete", "#bfab88", "#9a835f", "paving"),
        ("Cardboard", "#c19565", "#a37850", "stone"),
    ]):
        material(name, texture=wash(name, color, accent, pattern, 4070 + index))
    for name, color in {
        "Iron": "#3c4c48", "Rack gray": "#667973", "Edge band": "#d8b489",
        "Gold": "#ddaa54", "Paper": "#f3e1b5", "Tape": "#ebc995", "Fern": "#729a5e",
        "Deep glass": "#344b4c", "Screen teal": "#79b6ad", "Glint": "#c6ddbb",
        "Alert": "#e9a758", "Terra": "#aa6b51",
    }.items():
        material(name, color, glow=.26 if name in {"Alert", "Screen teal"} else 0)
    for name, title, palette, text in [
        ("Support plaque", "SUPPORT", ("#52775e", "#f7e4b5"), "CUSTOMER DESK"),
        ("Lookup plaque", "ORDER LOOKUP", ("#3d6372", "#e9f0cb"), "SCAN  /  VERIFY"),
        ("Packing plaque", "PACK & SEND", ("#82573e", "#f9e7b4"), "DISPATCH"),
    ]:
        material(name, texture=lettered(name, title, palette, text))


def parcel(mesh, x, y, z, scale, yaw=0):
    tf = placement(x, y, z, yaw)
    mesh.box("Cardboard", (0, .254 * scale, 0), (.77 * scale, .51 * scale, .67 * scale), transform=tf)
    mesh.box("Tape", (0, .514 * scale, 0), (.128 * scale, .023, .663 * scale), transform=tf)
    mesh.box("Paper", (.14 * scale, .323 * scale, .342 * scale), (.203 * scale, .109 * scale, .019), transform=tf)
    for i in range(5):
        mesh.box("Iron", ((.081 + .026 * i) * scale, .326 * scale, .355 * scale), (.008, .061 * scale, .009), transform=tf)


def console(mesh, x, z, height, width, tone):
    base = placement(x, height, z)
    mesh.box("Iron", (0, .044, 0), (.34, .076, .24), transform=base)
    mesh.box("Rack gray", (0, .18, .006), (.069, .29, .093), transform=base)
    mesh.box("Iron", (0, .362, .033), (width, .476, .106), transform=base)
    mesh.box("Deep glass", (0, .372, .091), (width - .077, .39, .019), transform=base)
    mesh.box(tone, (0, .373, .107), (width - .128, .333, .023), transform=base)
    for i in range(4):
        mesh.box("Glint", (-(width * .118), .274 + .062 * i, .121), (.43 + .027 * (i % 3), .018, .008), transform=base)
    mesh.box("Iron", (0, .021, .314), (.448, .036, .169), transform=base)
    for i in range(8):
        mesh.box("Rack gray", (-.187 + i * .054, .044, .314), (.034, .009, .104), transform=base)


def support(group):
    mesh = Meshes()
    mesh.slab("Support rug", (-4.45, .326, 1.37), (5.44, 3.33))
    for z in [-.20, 2.96]:
        mesh.slab("Edge band", (-4.45, .328, z), (5.21, .045))
    mesh.box("Iron", (-4.48, .73, 1.18), (3.45, .78, .96))
    mesh.box("Green panel", (-4.48, .824, 1.723), (3.48, .781, .149))
    for i in range(13):
        mesh.box("Rack gray", (-6.055 + i * .26, .81, 1.813), (.041, .671, .036))
    mesh.box("Oak top", (-4.48, 1.328, 1.19), (3.7, .141, 1.22))
    mesh.box("Edge band", (-4.48, 1.331, 1.817), (3.72, .074, .076))
    mesh.sign("Support plaque", (-4.48, .881, 1.844), (1.16, .294))
    for x, z in [(-5.47, 1.08), (-4.24, 1.084)]:
        console(mesh, x, z, 1.404, .82, "Screen teal")
    mesh.lathe("Terra", (-3.35, 1.398, 1.25), [(0, .058), (.118, .078)], 10)
    mesh.lathe("Paper", (-3.35, 1.516, 1.25), [(0, .072), (.016, .072)], 10)
    mesh.box("Green panel", (-6.0, .646, -.25), (.94, .68, .87))
    for i in range(3):
        mesh.box("Oak top", (-6.0, .413 + i * .208, .196), (.83, .17, .041))
        mesh.box("Iron", (-6.0, .415 + i * .208, .225), (.15, .034, .042))
    mesh.build("Customer support desk", group)


def lookup(group):
    mesh = Meshes()
    mesh.slab("Lookup tile", (4.14, .326, -2.33), (3.81, 2.49))
    mesh.box("Blue workstation", (4.06, .94, -2.84), (2.22, 1.21, .87))
    mesh.box("Iron", (4.06, 1.456, -2.62), (2.35, .165, 1.14))
    mesh.box("Rack gray", (4.06, 1.504, -2.19), (2.25, .067, .27))
    console(mesh, 4.06, -2.68, 1.559, 1.29, "Screen teal")
    mesh.sign("Lookup plaque", (4.06, .99, -2.396), (1.2, .287))
    mesh.box("Iron", (5.59, .792, -2.52), (.70, .926, .72))
    mesh.box("Blue workstation", (5.59, 1.265, -2.52), (.82, .137, .86))
    parcel(mesh, 5.59, 1.338, -2.50, .75, -.03)
    mesh.box("Rack gray", (4.91, 1.69, -2.53), (.068, .33, .069))
    mesh.box("Blue workstation", (4.91, 1.852, -2.44), (.157, .108, .244))
    mesh.box("Alert", (4.91, 1.837, -2.303), (.099, .044, .034))
    for y in [.493, .689, 1.148]:
        mesh.box("Iron", (3.23, y, -2.385), (.264, .095, .043))
    mesh.build("Order lookup and barcode scanner", group)


def packing(group):
    mesh = Meshes()
    mesh.slab("Packing concrete", (3.91, .328, 2.47), (5.04, 3.11))
    mesh.slab("Gold", (3.88, .331, 3.79), (4.58, .052))
    for x in [1.58, 6.13]:
        mesh.slab("Gold", (x, .331, 2.66), (.052, 2.29))
    for x in [2.2, 5.31]:
        for z in [1.84, 2.65]:
            mesh.box("Iron", (x, .799, z), (.144, .96, .144))
            mesh.box("Rack gray", (x, .369, z), (.219, .107, .215))
    mesh.box("Oak top", (3.77, 1.304, 2.22), (3.56, .162, 1.20))
    mesh.box("Edge band", (3.77, 1.288, 2.827), (3.57, .076, .055))
    mesh.box("Green panel", (3.76, .604, 2.23), (3.33, .107, 1.03))
    mesh.box("Iron", (3.78, 1.39, 2.38), (.92, .027, .47))
    mesh.sign("Packing plaque", (3.77, 1.181, 2.833), (1.15, .233))
    for x, y, z, size, yaw in [(2.51, 1.389, 2.12, .96, .05), (5.0, 1.389, 2.34, .77, -.09),
                                (2.57, .664, 2.16, .96, -.03), (4.85, .662, 2.24, .91, .08),
                                (5.94, .33, 2.47, 1.06, -.045), (5.94, .87, 2.47, .86, .10)]:
        parcel(mesh, x, y, z, size, yaw)
    mesh.lathe("Gold", (4.34, 1.39, 2.54), [(0, .106), (.11, .108)], 14)
    mesh.lathe("Iron", (4.34, 1.499, 2.54), [(0, .057), (.008, .056)], 12)
    mesh.box("Paper", (3.34, 1.4, 2.67), (.253, .026, .31))
    mesh.build("Packing bench and staging area", group)


bpy.ops.wm.read_factory_settings(use_empty=True)
stations = bpy.data.collections.new("City Dispatch · three workstations")
bpy.context.scene.collection.children.link(stations)
surfaces()
support(stations)
lookup(stations)
packing(stations)
export_models((("stations.glb", stations, False),), HERE.parent.parent / "public" / "models" / "city-dispatch")
camera_data = bpy.data.cameras.new("Depot camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = 21
camera = bpy.data.objects.new(camera_data.name, camera_data)
bpy.context.scene.collection.objects.link(camera)
camera.location = native((12, 13, 14))
camera.rotation_euler = (-Vector(camera.location)).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.shading.color_type = "MATERIAL"
bpy.ops.object.select_all(action="DESELECT")
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "city-dispatch.blend"), compress=True)
