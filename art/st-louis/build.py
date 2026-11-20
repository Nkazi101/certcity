"""Build the editable Blender scene and GLBs for the St. Louis expansion."""

from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "olive-corner"))
sys.path.insert(0, str(HERE))

from architecture import ballpark, delmar, enterprise, forest, surfaces, umsl, washu
from district_buildings import civic_details, detail_surfaces
from meshkit import export_models, native
from street_life import surfaces as street_surfaces
from street_life import tree, trolley, vehicle, walkers


def collection(name):
    group = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(group)
    return group


bpy.ops.wm.read_factory_settings(use_empty=True)
surfaces()
street_surfaces()
detail_surfaces()
models = []
for key, name, build in [
    ("delmar", "Delmar Loop", delmar),
    ("enterprise", "Enterprise Center", enterprise),
    ("ballpark", "Ballpark Village and Busch Stadium", ballpark),
    ("forest-park", "Forest Park", forest),
    ("washu", "WashU Danforth Campus", washu),
    ("umsl", "UMSL North Campus", umsl),
    ("civic", "Soldiers Memorial and downtown civic detail", civic_details),
    ("sedan", "Fastback sedan", vehicle),
    ("crossover", "Crossover", lambda group: vehicle(group, True)),
    ("trolley", "Loop Trolley", trolley),
    ("oak", "Broad-canopy oak", lambda group: tree(group, False)),
    ("upright-tree", "Upright park tree", lambda group: tree(group, True)),
]:
    group = collection(name)
    build(group)
    models.append((key + ".glb", group, False))
people = [collection("Riley walking"), collection("Jules walking")]
walkers(*people)
models.extend((name + ".glb", group, True) for name, group in zip(("riley", "jules"), people))

# Save the authored city blocks side-by-side for inspection. Export remains local to each block.
export_models(models, HERE.parents[1] / "public" / "models" / "st-louis")
offsets = [(-72,0,0), (0,0,0), (62,0,0), (-72,0,58), (0,0,58), (62,0,58),(-20,0,108)]
for (_, group, _), offset in zip(models, offsets + [(0,0,-25),(5,0,-25),(-7,0,-25),
                                                      (-15,0,-25),(-21,0,-25),(11,0,-25),(14,0,-25)]):
    for obj in group.objects:
        if obj.parent is None:
            obj.location += Vector(native(offset))
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "st-louis.blend"), compress=True)
