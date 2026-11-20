"""Mesh and painted surface tools for the Olive Street art source."""

from collections import defaultdict
from io import BytesIO
from math import cos, pi, sin
from pathlib import Path
from random import Random
from shutil import copyfile
from subprocess import run
from tempfile import TemporaryDirectory

import bpy
from mathutils import Vector
from PIL import Image, ImageColor, ImageDraw, ImageFont


def native(point):
    x, y, z = point
    return x, -z, y


def rgb(color):
    return ImageColor.getrgb(color)


def linear(color):
    def channel(value):
        value /= 255
        return value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4
    return tuple(channel(n) for n in rgb(color))


def pigment(color, change):
    return tuple(max(0, min(255, n + change)) for n in color)


def wash(name, color, accent, pattern, seed, size=320, grain=1):
    """Paint a small repeating swatch. Brush marks wrap across the tile edges."""
    random = Random(seed)
    pigment_base = rgb(color)
    pigment_accent = rgb(accent)
    canvas = Image.new("RGB", (size, size), color)
    draw = ImageDraw.Draw(canvas, "RGBA")
    units = {"terra": (80, 80), "brick": (80, 40), "paving": (80, 80), "roof": (80, 80)}
    if pattern in units:
        width, height = units[pattern]
        for j, y in enumerate(range(0, size, height)):
            for x in range(-width + (j % 2) * (width // 2), size, width):
                fill = pigment(pigment_base, round(random.randint(-16, 12) * grain))
                for dx in [-size, 0, size]:
                    draw.rectangle((x + dx, y, x + dx + width, y + height), fill + (255,))
                    draw.line((x + dx + 1, y + height - 1, x + dx + width, y + height - 1),
                              fill=pigment_accent + (81 if pattern == "brick" else 35,), width=2)
                    draw.line((x + dx, y + 1, x + dx + width, y + 1), fill=(251, 232, 196, 48), width=2)
                    draw.line((x + dx + width - 1, y + 3, x + dx + width - 1, y + height - 1),
                              fill=pigment_accent + (59 if pattern == "brick" else 34,), width=2)
    for _ in range(round(1450 * grain)):
        x, y = random.randrange(size), random.randrange(size)
        length = random.randrange(3, 37) if pattern != "fabric" else random.randrange(1, 13)
        height = random.randrange(1, 8)
        color_mark = pigment_accent if random.random() < .52 else (249, 238, 209)
        alpha = round(random.randrange(9, 40) * grain)
        for dx in (-size, 0, size):
            for dy in (-size, 0, size):
                i, j = x + dx, y + dy
                draw.polygon([(i, j), (i + length // 3, j - height),
                              (i + length, j - height // 2), (i + length * .62, j + height)],
                             fill=color_mark + (alpha,))
    if pattern == "wood":
        for i in range(40):
            y = 8 * i
            draw.line([(x, y + 2 * sin(x / 41 + i)) for x in range(0, size + 1, 4)],
                      fill=pigment_accent + (40 if i % 5 else 95,), width=1)
    if pattern == "fabric":
        for i in range(0, size, 3):
            draw.line((i, 0, i, size), fill=(251, 232, 196, 25))
    return image_data(name, canvas)


def image_data(name, canvas):
    data = BytesIO()
    canvas.save(data, "PNG", optimize=True)
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / (name + ".png")
        path.write_bytes(data.getvalue())
        picture = bpy.data.images.load(str(path), check_existing=False)
        picture.name = name
        picture.pack()
    return picture


def lettered(name, title, colors, subtitle=None, deco=False):
    ground, ink = colors
    canvas = Image.new("RGB", (512, 160), ground)
    draw = ImageDraw.Draw(canvas, "RGBA")
    for line in range(160):
        draw.line((0, line, 512, line), fill=(247, 213, 164, max(0, 22 - line // 5)))
    draw.rounded_rectangle((8, 8, 504, 152), radius=7, outline=ink, width=3)
    draw.rounded_rectangle((15, 15, 497, 145), radius=5, outline=rgb(ink) + (120,), width=1)
    random = Random(19)
    for _ in range(320):
        x, y = random.randint(10, 501), random.randint(10, 148)
        draw.line((x, y, x + random.randint(1, 8), y), fill=(245, 228, 182, 30), width=1)
    family = [
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    ]
    for size in range(62, 19, -2):
        font = next((ImageFont.truetype(path, size) for path in family if Path(path).exists()),
                    ImageFont.load_default(size))
        if draw.textlength(title, font=font) < 430:
            break
    draw.text((256, 67 if subtitle else 80), title, font=font, fill=ink, anchor="mm")
    if subtitle:
        sub = ImageFont.load_default(21)
        draw.text((256, 112), subtitle, font=sub, fill=ink, anchor="mm")
    if deco:
        for x in (29, 483):
            draw.polygon([(x, 58), (x + 6, 80), (x, 102), (x - 6, 80)], fill=ink)
    return image_data(name, canvas)


def material(name, color="#ffffff", texture=None, rough=.84, metallic=0, glow=0):
    surface = bpy.data.materials.new(name)
    surface.use_nodes = True
    bsdf = surface.node_tree.nodes.get("Principled BSDF")
    tint = linear(color)
    surface.diffuse_color = (*tint, 1)
    bsdf.inputs["Base Color"].default_value = (*tint, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if glow:
        bsdf.inputs["Emission Color"].default_value = (*tint, 1)
        bsdf.inputs["Emission Strength"].default_value = glow
    if texture:
        node = surface.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = texture
        surface.node_tree.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    return surface


class Meshes:
    def __init__(self):
        self.parts = defaultdict(list)

    def face(self, surface, points, shade=1, uv=None, transform=None, smooth=False, bone=None):
        if transform:
            points = [transform(p) for p in points]
        self.parts[surface].append((points, shade, uv, smooth, bone))

    def box(self, surface, at, size, *, shade=1, transform=None, bone=None, facing=False):
        x, y, z = at
        a, b, c = (d / 2 for d in size)
        vertices = [(x + u * a, y + v * b, z + w * c)
                    for u, v, w in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                                    (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
        for ids, value in [((4, 5, 6, 7), .98), ((1, 0, 3, 2), .89), ((0, 4, 7, 3), .97),
                           ((5, 1, 2, 6), .91), ((7, 6, 2, 3), 1), ((0, 1, 5, 4), .73)]:
            if facing and ids in ((1, 0, 3, 2), (0, 1, 5, 4)):
                continue
            self.face(surface, [vertices[i] for i in ids], shade * value, transform=transform, bone=bone)

    def slab(self, surface, at, size, *, shade=1, transform=None):
        x, y, z = at
        w, d = (n / 2 for n in size)
        self.face(surface, [(x - w, y, z + d), (x + w, y, z + d), (x + w, y, z - d), (x - w, y, z - d)],
                  shade, transform=transform)

    def relief(self, surface, outline, depth, *, shade=1, transform=None, bone=None):
        points = [(x, y, z) for x, y in outline for z in depth]
        self.face(surface, points[1::2], shade, transform=transform, bone=bone)
        self.face(surface, points[0::2][::-1], shade * .83, transform=transform, bone=bone)
        for i in range(0, len(points), 2):
            nxt = (i + 2) % len(points)
            self.face(surface, [points[i], points[nxt], points[nxt + 1], points[i + 1]], shade * .87, transform=transform, bone=bone)

    def sign(self, surface, at, size, transform=None):
        x, y, z = at
        w, h = (n / 2 for n in size)
        self.face(surface, [(x - w, y - h, z), (x + w, y - h, z), (x + w, y + h, z), (x - w, y + h, z)],
                  uv=[(0, 0), (1, 0), (1, 1), (0, 1)], transform=transform)

    def lathe(self, surface, at, profile, sides=12, *, depth=1, shade=1, smooth=True, transform=None, bone=None):
        x, y, z = at
        rings = [
            [(x + r * cos(2 * pi * i / sides), y + dy, z + r * depth * sin(2 * pi * i / sides))
             for i in range(sides)]
            for dy, r in profile
        ]
        for lower, upper in zip(rings, rings[1:]):
            for i in range(sides):
                j = (i + 1) % sides
                self.face(surface, [lower[i], upper[i], upper[j], lower[j]], shade * (.94 + .06 * sin(i * .8)),
                          transform=transform, smooth=smooth, bone=bone)
        self.face(surface, rings[0], shade * .85, transform=transform, bone=bone)
        self.face(surface, rings[-1][::-1], shade, transform=transform, bone=bone)

    def ball(self, surface, at, size, *, shade=1, sides=12, bone=None):
        width, height, depth = size
        self.lathe(surface, at, [(height * sin(j * pi / 12) / 2, max(.0001, width * cos(j * pi / 12) / 2))
                                 for j in range(-6, 7)], sides, depth=depth / width, shade=shade, bone=bone)

    def build(self, name, collection, rig=None):
        for surface, faces in self.parts.items():
            vertices = []
            polygons = []
            weights = defaultdict(list)
            # Weld smooth curved surfaces so the exported normals can flow around the profile.
            smooth_vertices = {}
            for points, _, _, smooth, bone in faces:
                ids = []
                for point in points:
                    value = tuple(round(n, 6) for n in native(point))
                    key = (bone, value)
                    index = smooth_vertices.get(key) if smooth else None
                    if index is None:
                        index = len(vertices)
                        vertices.append(value)
                        if smooth:
                            smooth_vertices[key] = index
                        if bone:
                            weights[bone].append(index)
                    ids.append(index)
                polygons.append(ids)
            mesh = bpy.data.meshes.new(f"{name} · {surface}")
            mesh.from_pydata(vertices, [], polygons)
            mesh.update()
            obj = bpy.data.objects.new(mesh.name, mesh)
            collection.objects.link(obj)
            material = bpy.data.materials[surface]
            obj.data.materials.append(material)
            color = mesh.color_attributes.new(name="Paint", type="FLOAT_COLOR", domain="CORNER")
            uv = mesh.uv_layers.new(name="UV") if any(node.type == "TEX_IMAGE" for node in material.node_tree.nodes) else None
            for poly, (points, shade, mapped, smooth, _) in zip(mesh.polygons, faces):
                poly.use_smooth = smooth
                normal = poly.normal
                up = abs(normal.z) > .71
                front = abs(normal.y) > abs(normal.x)
                for i, (loop, (x, y, z)) in enumerate(zip(poly.loop_indices, points)):
                    uvs = (x * .55, z * .55) if up else ((x if front else z) * .9, y * .9)
                    if uv is not None:
                        uv.data[loop].uv = mapped[i] if mapped else uvs
                    shade_here = min(1, shade * (.987 + .013 * sin(x * 4.41 + z * 2.71 + y * 4.2)))
                    color.data[loop].color = (shade_here, shade_here, shade_here, 1)
            if rig:
                obj.parent = rig
                for bone, indices in weights.items():
                    obj.vertex_groups.new(name=bone).add(indices, 1, "REPLACE")
                modifier = obj.modifiers.new("Character rig", "ARMATURE")
                modifier.object = rig


def placement(x, y, z, yaw=0):
    c, s = cos(yaw), sin(yaw)
    return lambda point: (x + c * point[0] + s * point[2], y + point[1], z - s * point[0] + c * point[2])


def export_models(files, output):
    output.mkdir(parents=True, exist_ok=True)
    tool = ["npm", "exec", "--yes", "--package=@gltf-transform/cli@4.3.0", "--", "gltf-transform"]
    root = Path(__file__).resolve().parents[2]
    with TemporaryDirectory() as temp:
        stage = Path(temp)
        for name, group, animated in files:
            raw = stage / ("raw-" + name)
            bpy.ops.object.select_all(action="DESELECT")
            for obj in group.objects:
                obj.select_set(True)
            bpy.ops.export_scene.gltf(
                filepath=str(raw), export_format="GLB", use_selection=True,
                export_animations=animated, export_animation_mode="ACTIVE_ACTIONS",
                export_vertex_color="ACTIVE", export_force_sampling=True,
            )
            textured = stage / ("textured-" + name)
            run([*tool, "webp", str(raw), str(textured), "--quality", "89"], cwd=root, check=True)
            run([*tool, "meshopt", str(textured), str(stage / name), "--quantize-position", "16", "--quantize-texcoord", "14"],
                cwd=root, check=True)
        for name, _, _ in files:
            pending = output / (name + ".tmp")
            copyfile(stage / name, pending)
            pending.replace(output / name)
