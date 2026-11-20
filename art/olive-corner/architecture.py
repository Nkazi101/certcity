"""The original Park Pacific, Olive & Rye and street meshes in world units."""

from math import cos, pi, sin, sqrt
from random import Random

from PIL import Image, ImageDraw

from meshkit import Meshes, image_data, lettered, material, placement, wash


def surfaces():
    for seed, (name, color, accent, pattern) in enumerate([
        ("Ivory terra cotta", "#e7ddc5", "#a59b8b", "terra"),
        ("Carved limestone", "#f2dfb7", "#ac977f", "stone"),
        ("Shadowed terra cotta", "#b8a790", "#71655a", "terra"),
        ("Granite base", "#6b6764", "#453f3b", "stone"),
        ("Park roof", "#c5ba9f", "#94856b", "roof"),
        ("Blond masonry", "#c3ab83", "#9d8060", "brick"),
        ("St. Louis red brick", "#a44e39", "#542d30", "brick"),
        ("Green painted wood", "#315f4e", "#25443c", "wood"),
        ("Stained oak", "#ae7143", "#633a28", "wood"),
        ("Rust canvas", "#ac4b39", "#633031", "fabric"),
        ("Cream canvas", "#efd0a1", "#c49361", "fabric"),
        ("Green canvas", "#417d66", "#285348", "fabric"),
        ("Terrazzo", "#cdab81", "#a07a58", "paving"),
        ("Olive sidewalk", "#c7b49b", "#938675", "paving"),
        ("Blue-gray cobble", "#7c8582", "#4f5b5a", "paving"),
        ("Roof tiles", "#728a7e", "#4e6e63", "roof"),
    ]):
        grain = {"roof": .40, "paving": .34, "stone": .46, "terra": .52}.get(pattern, .76)
        roughness = {"roof": .67 if name == "Roof tiles" else .83, "brick": .88, "fabric": .98, "wood": .69}.get(pattern, .76)
        material(name, texture=wash(name, color, accent, pattern, 1300 + seed, grain=grain), rough=roughness)
    for name, color in {
        "Mortar shadow": "#73695f", "Bronze dark": "#514b37", "Bronze": "#9a7547",
        "Brass": "#e5b76b", "Iron": "#334b49", "Glass gasket": "#344953",
        "Terra planter": "#b67551", "Mulch": "#6d4c3e", "Leaf dark": "#386a43",
        "Leaf amber": "#a0ad57", "Leaf green": "#68974d", "Leaf light": "#8fb459",
        "Leaf red": "#b77939", "Leaf gold": "#e2af4b", "Bark": "#6d4f39",
        "Rose": "#ce665d", "Apricot": "#f1b27e", "Violet": "#8d688f",
        "Cream ceramic": "#f1dfc3", "Bakery gold": "#c58143", "Tea": "#83543d",
        "Creek": "#63aba3", "Neon": "#ecc77e", "Curtain": "#d8b58c",
        "Patinated copper": "#6b9284", "Roof zinc": "#72838d",
    }.items():
        material(name, color, rough=.77, metallic=.23 if name in {"Bronze", "Brass"} else 0,
                 glow=.38 if name == "Neon" else 0)

    for name, low, high, warm in [
        ("Olive glass dark", "#283f4f", "#577f8b", False),
        ("Olive glass sky", "#466b7c", "#92aeb2", False),
        ("Olive glass blue", "#3c5367", "#788fa3", False),
        ("Lit window", "#675347", "#c5a472", True),
        ("Cafe glass", "#3a5b54", "#85a29c", False),
        ("Cafe window", "#513e39", "#d2a876", True),
    ]:
        canvas = Image.new("RGB", (160, 160), low)
        draw = ImageDraw.Draw(canvas, "RGBA")
        from PIL.ImageColor import getrgb
        for y in range(160):
            factor = .06 + .94 * (1 - y / 159) ** 1.17
            color = tuple(round(a + (b - a) * factor) for a, b in zip(getrgb(low), getrgb(high)))
            draw.line((0, y, 160, y), fill=color)
        if warm:
            draw.polygon([(18, 24), (49, 13), (59, 138), (14, 144)], fill=(247, 216, 161, 83))
            draw.polygon([(134, 19), (149, 28), (154, 150), (122, 148)], fill=(248, 207, 136, 105))
        else:
            draw.polygon([(3, 53), (4, 78), (156, 13), (157, 2)], fill=(215, 235, 232, 76))
            draw.polygon([(15, 132), (62, 123), (62, 104), (104, 100), (105, 79), (158, 65), (159, 155),
                          (16, 155)], fill=(25, 51, 67, 75))
        draw.rectangle((0, 0, 159, 159), outline=(30, 39, 48, 129), width=5)
        material(name, texture=image_data(name, canvas), rough=.34)
    for name, title, colors, sub, deco in [
        ("Park sign", "PARK PACIFIC", ("#334e46", "#f1d4a0"), None, True),
        ("Missouri sign", "MISSOURI PACIFIC", ("#7c6c58", "#f2dcb2"), None, True),
        ("Olive address", "1226", ("#3a4d43", "#f3d2a3"), None, False),
        ("Cafe fascia", "OLIVE & RYE", ("#284e42", "#ffe3b2"), "CAFE   •   BAKERY", True),
        ("Cafe menu", "TODAY", ("#354744", "#f2d7a9"), "COFFEE  /  PASTRIES", False),
        ("Cafe blade", "OLIVE & RYE", ("#31574a", "#f5d6a0"), None, True),
        ("Olive sign", "OLIVE ST", ("#3b6357", "#fff0c8"), None, False),
        ("Thirteenth sign", "13TH ST", ("#3b6357", "#fff0c8"), None, False),
    ]:
        material(name, texture=lettered(name, title, colors, sub, deco))


def pilaster(mesh, x, y, z, width, height, transform, *, crown=False):
    mesh.box("Shadowed terra cotta", (x, y + height / 2, z + .021), (width * 1.2, height, .132), transform=transform)
    mesh.box("Carved limestone", (x, y + height / 2, z + .083), (width, height, .129), transform=transform)
    for side in (-1, 1):
        mesh.box("Ivory terra cotta", (x + side * width * .27, y + height / 2, z + .151),
                 (width * .19, height, .038), transform=transform)
    if crown:
        mesh.relief("Carved limestone", [(x - width * .79, y + height - .057), (x + width * .79, y + height - .057),
                                        (x + width * .54, y + height + .151), (x, y + height + .343),
                                        (x - width * .54, y + height + .151)],
                    (z + .022, z + .20), transform=transform)
        mesh.box("Shadowed terra cotta", (x, y + height + .027, z + .209),
                 (width * .42, .11, .027), transform=transform)


def window(mesh, x, y, w, h, z, material_name, transform, *, bar=True, recess=.043):
    mesh.sign("Glass gasket", (x, y, z - recess / 2 + .0245), (w + .063, h + .057), transform)
    mesh.sign(material_name, (x, y, z - recess / 2 + .026), (w, h), transform)
    if bar:
        mesh.sign("Glass gasket", (x, y + h * .12, z - recess / 2 + .039), (w, .025), transform)
    mesh.box("Shadowed terra cotta", (x, y - h / 2 - .052, z + .008), (w + .138, .045, .141), transform=transform, shade=.93, facing=True)
    mesh.box("Carved limestone", (x, y - h / 2 - .026, z + .026), (w + .11, .034, .146), transform=transform, facing=True)


def arch_band(mesh, x, base, radius, width, depth, surface, transform, rise=1):
    for segment in range(16):
        a, b = (segment * pi / 16, (segment + 1) * pi / 16)
        inner, outer = radius, radius + width
        outline = [(x + outer * cos(a), base + outer * sin(a) * rise),
                   (x + outer * cos(b), base + outer * sin(b) * rise),
                   (x + inner * cos(b), base + inner * sin(b) * rise),
                   (x + inner * cos(a), base + inner * sin(a) * rise)]
        mesh.relief(surface, outline, depth, shade=.90 + .10 * sin(a), transform=transform)


def pediment(mesh, x, y, half, z, transform):
    outline = [(x - half, y - .04), (x + half, y - .04), (x + half * .78, y + .102),
               (x + half * .48, y + .143), (x, y + .235), (x - half * .48, y + .143),
               (x - half * .78, y + .102)]
    mesh.relief("Carved limestone", outline, (z, z + .077), transform=transform)


def park_pacific(collection):
    mesh = Meshes()
    random = Random(188)
    origin_x, origin_z = 51.12, -10.25
    origin = placement(origin_x, .08, origin_z)
    podium, story = 1.87, .703
    mesh.box("Granite base", (0, .18, 0), (11.8, .34, 13), transform=origin)
    mesh.box("Shadowed terra cotta", (0, 1.018, 0), (11.40, 1.40, 12.57), transform=origin)
    for y, w, d, surface in [
        (1.695, 11.74, 12.93, "Shadowed terra cotta"),
        (1.774, 11.92, 13.04, "Carved limestone"),
        (1.848, 11.82, 12.99, "Ivory terra cotta"),
    ]:
        mesh.box(surface, (0, y, 0), (w, .095, d), transform=origin)
    mesh.slab("Park roof", (0, 1.899, 0), (11.62, 12.8), transform=origin)

    def facade(x, z, angle, length, bays, first, floors, rear=False):
        base = podium + first * story
        top = base + floors * story
        tf = placement(origin_x + x, .08, origin_z + z, angle)
        pitch = length / bays
        masonry = "Blond masonry" if rear else "Ivory terra cotta"
        for i in range(bays + 1):
            u = (i - bays / 2) * pitch
            if rear:
                mesh.box(masonry, (u, (base + top) / 2, -.035), (.18, top - base, .108), transform=tf)
            else:
                pilaster(mesh, u, base, -.038, .102 if i % 2 else .145, top - base + .115, tf, crown=i % 2 == 0)
                if i < bays:
                    pediment(mesh, u + pitch * .52, top + .064, pitch * .45, -.002, tf)
        for floor in range(floors):
            y = base + floor * story
            mesh.box(masonry, (0, y + .098, -.051), (length, .19, .135), transform=tf,
                     shade=.89 + floor * .009)
            mesh.box(masonry, (0, y + .617, -.051), (length, .171, .134), transform=tf)
            for bay in range(bays):
                u = (bay + .5 - bays / 2) * pitch
                pair = pitch * .72
                mesh.box(masonry, (u, y + .36, -.039), (.075, .50, .13), transform=tf)
                for side in (-1, 1):
                    seed = random.random()
                    glass = ("Lit window" if seed > .94 else "Olive glass sky" if seed > .48 else
                             "Olive glass blue" if seed > .22 else "Olive glass dark")
                    window(mesh, u + side * pair * .26, y + .372, pair * .434, .314, -.032, glass, tf, bar=seed > .36)
        if not rear:
            mesh.box("Shadowed terra cotta", (0, top - .051, -.032), (length, .087, .157), transform=tf)
            mesh.box("Carved limestone", (0, top + .027, -.009), (length, .079, .176), transform=tf)

    def tier(first, floors, outer, inner, addition):
        l, r, n, s = outer
        back, notch_n, notch_s = inner
        bottom, height = podium + first * story, floors * story
        for a, b, c, d in ((back, r, n, s), (l, back, n, notch_n), (l, back, notch_s, s)):
            mesh.box("Shadowed terra cotta", ((a + b) / 2, bottom + height / 2, (c + d) / 2),
                     (b - a - .136, height, d - c - .137), transform=origin)
            mesh.slab("Park roof", ((a + b) / 2, bottom + height + .017, (c + d) / 2),
                      (b - a, d - c), transform=origin)
        for a, b, edge, turn, bays in [
            (l, r, n, pi, 8 if addition else 6), (l, r, s, 0, 8 if addition else 6),
            (l, back, notch_n, 0, 3), (l, back, notch_s, pi, 3),
        ]:
            facade((a + b) / 2, edge, turn, b - a, bays, first, floors)
        for a, b, edge, turn, bays, rear in [
            (n, s, r, pi / 2, 9, True), (n, notch_n, l, -pi / 2, 3, False),
            (notch_s, s, l, -pi / 2, 3, False), (notch_n, notch_s, back, -pi / 2, 4, False),
        ]:
            facade(edge, (a + b) / 2, turn, b - a, bays, first, floors, rear)
    tier(0, 10, (-4.64, 5.79, -6.38, 6.38), (-.93, -2.25, 2.25), True)
    tier(10, 6, (-4.64, 3.59, -5.72, 5.72), (-.93, -2.25, 2.25), False)
    tier(16, 4, (-3.45, 2.98, -4.57, 4.57), (-.39, -2.17, 2.17), False)
    top = podium + 20 * story
    mesh.box("Shadowed terra cotta", (1.61, top + .207, -.85), (1.45, .42, 1.85), transform=origin)
    mesh.box("Ivory terra cotta", (1.61, top + .442, -.85), (1.67, .12, 2.04), transform=origin)
    for i in range(3):
        mesh.box("Granite base", (.31 + i * .42, top + .14, -3.16), (.14, .27, .20), transform=origin)

    for turn, distance, length, count, entrance in [
        (-pi / 2, 5.85, 12.91, 11, 5), (0, 6.44, 11.72, 9, 6), (pi, 6.44, 11.72, 9, 4),
        (pi / 2, 5.84, 12.91, 11, -1),
    ]:
        tf = placement(origin_x + sin(turn) * distance, .08, origin_z + cos(turn) * distance, turn)
        pitch = length / count
        for bay in range(count):
            u = (bay + .5 - count / 2) * pitch
            pilaster(mesh, u - pitch / 2, .24, -.019, .16, 1.46, tf)
            mesh.box("Granite base", (u, .203, .034), (pitch * .89, .36, .16), transform=tf)
            if bay == entrance and turn <= 0:
                continue
            glass = "Cafe window" if bay % 4 == 1 else "Olive glass sky" if bay % 3 == 0 else "Olive glass dark"
            window(mesh, u, .811, pitch * .72, .82, -.018, glass, tf, bar=True, recess=.033)
            window(mesh, u, 1.433, pitch * .68, .295, .014, "Olive glass blue", tf, bar=False)
            for offset in (-.16, .16):
                mesh.box("Bronze dark", (u + pitch * offset, .82, .028), (.026, .78, .023), transform=tf)
            if glass == "Cafe window":
                mesh.box("Curtain", (u, .694, .025), (pitch * .53, .021, .026), transform=tf)

    west = placement(origin_x - 5.875, .08, origin_z, -pi / 2)
    mesh.box("Granite base", (0, .61, .022), (1.51, 1.23, .24), transform=west)
    mesh.slab("Terrazzo", (0, .016, .26), (1.54, .66), transform=west)
    mesh.box("Glass gasket", (0, .641, .154), (1.055, 1.23, .066), transform=west)
    for side in (-1, 1):
        mesh.box("Shadowed terra cotta", (side*.566, .637, .247), (.096, 1.22, .262), transform=west)
        mesh.box("Carved limestone", (side*.679, 1.235, .228), (.235, .095, .347), transform=west)
        mesh.sign("Olive glass dark", (side * .237, .626, .195), (.402, .997), west)
        mesh.box("Brass", (side * .078, .555, .22), (.034, .176, .046), transform=west)
        pilaster(mesh, side * .669, .05, .132, .19, 1.44, west)
    arch_band(mesh, 0, 1.482, .61, .149, (.122, .28), "Carved limestone", west, rise=.86)
    arch_band(mesh, 0, 1.482, .574, .035, (.177, .295), "Bronze", west, rise=.86)
    mesh.sign("Missouri sign", (0, 1.269, .239), (1.122, .25), west)
    # The west entrance's railroad relief is composed as shallow carved stone.
    mesh.relief("Shadowed terra cotta", [(-.29, 1.575), (.29, 1.575), (.234, 1.906), (.0, 1.971), (-.234, 1.906)],
                (.154, .236), transform=west)
    mesh.relief("Carved limestone", [(-.235, 1.623), (.235, 1.623), (.156, 1.737), (.129, 1.859), (-.129, 1.859), (-.156, 1.737)],
                (.236, .291), transform=west)
    mesh.box("Shadowed terra cotta", (0, 1.681, .306), (.275, .048, .038), transform=west)
    mesh.box("Ivory terra cotta", (0, 1.785, .315), (.178, .151, .055), transform=west)
    mesh.box("Bronze", (0, 1.815, .345), (.064, .065, .029), transform=west)
    for side in (-1, 1):
        mesh.relief("Carved limestone", [(side*x, y) for x, y in ((.33, 1.604), (.47, 1.604), (.455, 1.847), (.397, 1.913), (.35, 1.853))][::side],
                    (.192, .267), transform=west)
        mesh.lathe("Carved limestone", (side*.407, 1.857, .238), [(0, .048), (.069, .045), (.078, .025)], 8, transform=west)
    mesh.relief("Carved limestone", [(-.42, 2.147), (-.23, 2.104), (0, 2.149), (.23, 2.104), (.42, 2.147),
                                    (.30, 2.235), (.10, 2.241), (.01, 2.341), (-.089, 2.237), (-.30, 2.235)],
                (.047, .225), transform=west)

    olive = placement(origin_x + 2.6, .08, origin_z + 6.46)
    mesh.box("Granite base", (0, .607, .05), (1.40, 1.24, .22), transform=olive)
    mesh.slab("Terrazzo", (0, .024, .28), (1.61, .78), transform=olive)
    mesh.box("Glass gasket", (0, .412, .249), (1.12, .143, .066), transform=olive)
    mesh.box("Bronze dark", (0, .641, .159), (1.09, 1.21, .11), transform=olive)
    for side in (-1, 1):
        mesh.sign("Olive glass sky", (side * .228, .64, .221), (.407, 1.018), olive)
        mesh.box("Brass", (side * .059, .65, .241), (.023, .184, .037), transform=olive)
        mesh.box("Bronze", (side * .682, 1.06, .292), (.096, .27, .14), transform=olive)
        mesh.box("Neon", (side * .682, 1.062, .371), (.062, .164, .03), transform=olive)
    mesh.box("Bronze dark", (0, 1.369, .295), (1.64, .106, .69), transform=olive)
    mesh.box("Brass", (0, 1.366, .641), (1.59, .044, .041), transform=olive)
    mesh.box("Neon", (0, 1.309, .434), (1.13, .016, .063), transform=olive)
    mesh.sign("Park sign", (0, 1.522, .219), (1.39, .268), olive)
    for y, w, d in [(.032, 1.67, .34), (.086, 1.51, .26)]:
        mesh.box("Carved limestone", (0, y, .28), (w, .06, d), transform=olive)
    for side in (-1, 1):
        mesh.box("Carved limestone", (side * .629, .73, .09), (.121, 1.29, .31), transform=olive)
        mesh.box("Bronze", (side * .625, 1.36, .316), (.087, .09, .32), transform=olive)
        for j in range(3):
            mesh.box("Brass", (side * .674, 1.192 + j * .039, .402), (.118, .014, .04), transform=olive)
    for x in (-2.85, -.89, 2.95):
        mesh.box("Shadowed terra cotta", (x, 2.01, 6.415), (.66, .31, .14), transform=origin)
        mesh.box("Carved limestone", (x, 2.19, 6.47), (.82, .074, .21), transform=origin)
        for j in range(-2, 3):
            mesh.box("Ivory terra cotta", (x+j*.112, 2.037, 6.514), (.052, .154-abs(j)*.028, .075), transform=origin)
    mesh.sign("Olive address", (0, 1.225, .25), (.39, .132), olive)

    annex = placement(60.02, .08, -9.66)
    mesh.box("Blond masonry", (0, 2.626, 0), (5.94, 5.253, 11.89), transform=annex)
    mesh.box("Park roof", (0, 5.261, 0), (6.06, .123, 12.01), transform=annex)
    for x in (-2.87, 2.87):
        mesh.box("Carved limestone", (x, 5.43, 0), (.145, .286, 11.97), transform=annex)
    for z in (-5.91, 5.91):
        mesh.box("Carved limestone", (0, 5.43, z), (5.77, .286, .149), transform=annex)
    mesh.box("Roof zinc", (-.92, 5.57, -1.62), (1.23, .38, 1.38), transform=annex)
    for j in range(5):
        mesh.box("Patinated copper", (-1.37+j*.224, 5.778, -1.62), (.042, .044, 1.18), transform=annex)
    for x in (.81, 1.46):
        mesh.lathe("Roof zinc", (x, 5.32, -1.83), [(0,.17),(.22,.11),(.43,.11),(.48,.24),(.54,.19)], 12, transform=annex)
    mesh.box("Shadowed terra cotta", (0, .651, 5.95), (5.82, 1.24, .109), transform=annex)
    for col in range(7):
        x = (col - 3) * .807
        for floor in range(5):
            window(mesh, x, 1.64 + .713 * floor, .356, .242, 5.965, "Olive glass dark", annex, bar=False)
        window(mesh, x, .672, .655, .86, 6.032, "Olive glass sky", annex, bar=True)
    mesh.build("Park Pacific", collection)


def awning(mesh, transform, width, y, depth, offset=0):
    stripes = int(width / .24)
    for i in range(stripes):
        a = offset - width / 2 + width * i / stripes
        b = a + width / stripes
        surface = "Cream canvas" if i % 2 else "Rust canvas"
        mesh.face(surface, [(a, y + .01, depth), (b, y + .01, depth), (b, y + .24, .10), (a, y + .24, .10)],
                  shade=.92 + .07 * sin(i * .63), transform=transform)
        mesh.face(surface, [(a, y - .105, depth + .011), (b, y - .105, depth + .011),
                            (b, y + .012, depth + .011), (a, y + .012, depth + .011)], shade=.83, transform=transform)
    for side in (-1, 1):
        mesh.box("Iron", (offset + side * width * .45, y, depth * .49),
                 (.04, .042, depth), transform=transform)


def cafe(collection):
    mesh = Meshes()
    ox, oz = 35.8, 11.6
    body = placement(ox, .08, oz)
    width, depth = 7.9, 6.1
    mesh.box("Granite base", (0, .202, 0), (8.04, .368, 6.26), transform=body)
    mesh.box("St. Louis red brick", (0, 1.811, 0), (7.76, 3.12, 5.95), transform=body)
    mesh.box("Roof tiles", (0, 3.384, 0), (7.86, .091, 6.17), transform=body)
    for turn, axis, length in [(0, depth / 2, width), (pi, depth / 2, width),
                               (-pi / 2, width / 2, depth), (pi / 2, width / 2, depth)]:
        tf = placement(ox + sin(turn) * axis, .08, oz + cos(turn) * axis, turn)
        for y, w, h, z, material_name in [
            (1.457, length + .074, .129, .009, "Carved limestone"),
            (3.111, length + .133, .105, .067, "Shadowed terra cotta"),
            (3.247, length + .185, .146, .122, "Carved limestone"),
            (3.465, length + .08, .32, -.039, "St. Louis red brick"),
            (3.633, length + .145, .089, -.018, "Carved limestone"),
        ]:
            mesh.box(material_name, (0, y, z), (w, h, .19), transform=tf)
        count = 5 if length > 7 else 4
        pitch = (length - .54) / count
        for i in range(count):
            x = (i + .5 - count / 2) * pitch
            window(mesh, x, 2.535, pitch * .55, .682, .014, "Olive glass sky" if i % 3 else "Lit window", tf)
            arch_band(mesh, x, 2.824, pitch * .292, .078, (.025, .106), "Carved limestone", tf, rise=.61)
            mesh.box("Shadowed terra cotta", (x, 2.935, .075), (.128, .107, .127), transform=tf)
            for off in (-.23, .23):
                mesh.box("Carved limestone", (x + off, 3.093, .117), (.09, .155, .095), transform=tf)
            mesh.box("Green painted wood", (x, .795, .05), (pitch * .81, 1.31, .16), transform=tf)
            if i == count // 2 and turn in (0, -pi / 2):
                mesh.sign("Cafe glass", (x, .835, .142), (pitch * .57, 1.116), tf)
                mesh.box("Brass", (x + .158, .754, .165), (.039, .126, .054), transform=tf)
            else:
                mesh.sign("Cafe window", (x, .934, .144), (pitch * .70, .726), tf)
                mesh.box("Green painted wood", (x, .92, .164), (.053, .719, .051), transform=tf)
                mesh.box("Green painted wood", (x, 1.047, .164), (pitch * .69, .037, .047), transform=tf)
                for s in (-1, 1):
                    mesh.box("Bakery gold", (x + s * pitch * .177, .644, .163), (.116, .061, .051), transform=tf)
            mesh.box("Bronze", (x, 1.538, .148), (.175, .149, .14), transform=tf)
            mesh.box("Neon", (x, 1.53, .229), (.128, .094, .043), transform=tf)

        if turn in (0, pi, -pi / 2):
            awning(mesh, tf, 4.97 if length > 7 else 2.88, 1.558, .86)
        if turn in (0, -pi / 2):
            mesh.box("Green painted wood", (0, 1.999, .089), (3.65, .498, .206), transform=tf)
            mesh.sign("Cafe fascia", (0, 1.997, .204), (3.52, .465), tf)

    mesh.box("St. Louis red brick", (-2.72, 3.732, -1.97), (.56, .74, .57), transform=body)
    mesh.box("Carved limestone", (-2.72, 4.12, -1.97), (.68, .093, .69), transform=body)
    for x in [-1.87, -.90, .07, 1.04, 2.01, 2.98]:
        mesh.box("Bronze dark", (x, 3.635, -1.64), (.041, .49, .045), transform=body)
    mesh.box("Bronze dark", (.50, 3.873, -1.63), (4.89, .054, .062), transform=body)
    mesh.box("Shadowed terra cotta", (1.72, 3.55, .19), (1.54, .261, 1.27), transform=body)
    for i in range(3):
        x = 1.20 + i * .52
        mesh.box("Green painted wood", (x, 3.72, .19), (.49, .10, 1.25), transform=body)
        mesh.slab("Olive glass sky", (x, 3.775, .19), (.37, 1.12), transform=body)
    for x in [-1.95, -.72, .51]:
        planter(mesh, x, 3.412, -.91, .83, .42, int((x + 2) * 19), body)
    for x in [-3.13, 3.02]:
        planter(mesh, x, .004, 3.57, .88, .46, int((x + 5) * 17), body)
    mesh.box("Green painted wood", (-2.23, .49, 3.97), (.68, .85, .12), transform=body)
    mesh.sign("Cafe menu", (-2.23, .54, 4.039), (.584, .57), body)
    mesh.box("Bronze", (-3.88, 1.944, 3.14), (.069, .073, .71), transform=body)
    blade = placement(ox - 3.89, .08, oz + 3.51, -pi / 2)
    mesh.box("Green painted wood", (0, 1.839, 0), (.55, .36, .091), transform=blade)
    mesh.sign("Cafe blade", (0, 1.841, .049), (.516, .319), blade)
    mesh.build("Olive & Rye", collection)


def planter(mesh, x, y, z, width, depth, seed, transform=None):
    random = Random(seed)
    at = placement(x, y, z)
    tf = (lambda p: transform(at(p))) if transform else at
    mesh.box("Terra planter", (0, .164, 0), (width, .319, depth), transform=tf)
    mesh.box("Carved limestone", (0, .313, 0), (width + .087, .093, depth + .085), transform=tf)
    mesh.box("Mulch", (0, .366, 0), (width - .071, .027, depth - .09), transform=tf)
    for i in range(max(2, round(width * 3.2))):
        offset = (i - max(2, round(width * 3.2)) / 2 + .5) * .265
        off_z = random.uniform(-.07, .079)
        mesh.lathe("Leaf green" if i % 2 else "Leaf dark", (offset, .497, off_z),
                   [(-.13, .052), (-.04, .142), (.084, .093), (.139, .019)], 6, transform=tf)
        if i % 2 or random.random() < .43:
            mesh.lathe(("Rose", "Apricot", "Violet")[i % 3], (offset + .04, .619, off_z),
                       [(-.049, .043), (-.018, .083), (.044, .06)], 7, transform=tf)


def paving_and_street(collection):
    mesh = Meshes()
    # Tile bands fit inside the city curbs and reserve a clear route at both doors.
    mesh.slab("Olive sidewalk", (52.67, .032, -2.952), (16.45, 1.29))
    mesh.slab("Olive sidewalk", (44.68, .032, -11.43), (1.23, 15.54))
    mesh.slab("Blue-gray cobble", (52.75, .034, -2.367), (15.69, .218), shade=.95)
    mesh.slab("Blue-gray cobble", (44.46, .034, -11.64), (.229, 15.41), shade=.95)
    mesh.slab("Terrazzo", (35.82, .037, 16.85), (8.25, 3.82), shade=.97)
    mesh.slab("Olive sidewalk", (34.4, .039, 7.48), (10.52, 1.76))
    mesh.slab("Blue-gray cobble", (35.31, .041, 15.14), (8.76, .265), shade=.89)
    mesh.slab("Blue-gray cobble", (31.52, .041, 16.93), (.22, 3.82), shade=.86)
    for x, z, w in [(49.30, -3.09, 1.61), (54.91, -3.13, .68), (57.97, -3.13, 1.14),
                    (33.0, 18.30, 1.41), (36.15, 18.31, 1.83), (39.37, 18.0, .77), (38.7, 7.2, 1.2)]:
        planter(mesh, x, .049, z, w, .43, int(x * 17))
    for x, z, tint in [(34.14, 16.51, "Rust canvas"), (37.33, 16.82, "Green canvas")]:
        mesh.lathe("Iron", (x, .052, z), [(0, .21), (.079, .17), (.12, .041), (1.82, .033)], 11)
        mesh.lathe("Stained oak", (x, .052, z), [(.566, .14), (.605, .48), (.676, .485), (.704, .37)], 16)
        for i in range(10):
            a, b = i * pi / 5, (i + 1) * pi / 5
            mesh.face(tint if i % 2 else "Cream canvas", [
                (x + .821 * cos(a), 1.702, z + .821 * sin(a)),
                (x + .033 * cos(a), 2.047, z + .033 * sin(a)),
                (x + .033 * cos(b), 2.047, z + .033 * sin(b)),
                (x + .821 * cos(b), 1.702, z + .821 * sin(b)),
            ], shade=.88 + .105 * sin(a + .55))
            mesh.face(tint if i % 2 else "Cream canvas", [
                (x + .821 * cos(a), 1.617, z + .821 * sin(a)),
                (x + .821 * cos(a), 1.702, z + .821 * sin(a)),
                (x + .821 * cos(b), 1.702, z + .821 * sin(b)),
                (x + .821 * cos(b), 1.617, z + .821 * sin(b)),
            ], shade=.82)
        for side in (-1, 1):
            chair = placement(x + side * .663, .045, z + side * .075, side * pi / 2)
            for lx in (-.13, .13):
                for lz in (-.11, .11):
                    mesh.box("Iron", (lx, .148, lz), (.038, .292, .038), transform=chair)
                mesh.box("Iron", (lx, .451, .123), (.033, .35, .035), transform=chair)
            mesh.box("Green painted wood", (0, .309, 0), (.35, .065, .316), transform=chair)
            mesh.box("Stained oak", (0, .556, .131), (.332, .11, .037), transform=chair)
        mesh.lathe("Cream ceramic", (x + .235, .741, z - .06), [(0, .064), (.021, .063)], 10)
        mesh.lathe("Cream ceramic", (x + .235, .762, z - .06), [(0, .031), (.077, .049)], 10)
        mesh.lathe("Tea", (x + .235, .84, z - .06), [(0, .041), (.003, .041)], 10)
        mesh.box("Bakery gold", (x - .182, .766, z + .061), (.17, .057, .11))
        for stack in range(3):
            mesh.lathe("Cream ceramic", (x-.17, .729+stack*.028, z-.20),
                       [(0,.041),(.024,.056)], 12)
        mesh.box("Rust canvas", (x-.021, .726, z+.19), (.146, .014, .106))
    for x, z, turn in [(48.12, -3.1, 0), (51.33, -3.10, 0), (44.65, -9.08, -pi / 2),
                        (37.51, 6.22, pi)]:
        tf = placement(x, .075, z, turn)
        for q in (-.48, .48):
            mesh.box("Iron", (q, .183, .01), (.087, .359, .329), transform=tf)
            mesh.box("Iron", (q, .452, -.165), (.056, .542, .079), transform=tf)
        for strip in range(3):
            mesh.box("Stained oak", (0, .394, .121 - strip * .125), (1.38, .044, .09), transform=tf)
        for strip in range(2):
            mesh.box("Stained oak", (0, .562 + strip * .099, -.182), (1.38, .071, .039), transform=tf)

    for x, z, angle in [(44.97, -2.76, 0), (59.88, -2.79, 0), (44.7, -15.8, -pi / 2), (39.61, 15.45, pi)]:
        tf = placement(x, .07, z, angle)
        mesh.lathe("Iron", (0, 0, 0), [(0, .116), (.075, .122), (.109, .083), (.31, .063), (1.68, .04),
                                      (1.81, .057), (1.87, .074)], 12, transform=tf)
        mesh.box("Iron", (.15, 1.82, .018), (.334, .061, .071), transform=tf)
        mesh.lathe("Neon", (.301, 1.706, .018), [(0, .061), (.142, .095)], 6, transform=tf)
        mesh.lathe("Iron", (.301, 1.845, .018), [(0, .116), (.05, .109), (.10, .039)], 6, transform=tf)
    mesh.sign("Olive sign", (45.13, 1.59, -2.716), (.69, .182))
    mesh.sign("Thirteenth sign", (.044, 1.355, .03), (.69, .182), placement(44.97, .07, -2.76, -pi / 2))

    for index, (x, z, stature) in enumerate([(46.32, -2.96, .89), (57.08, -3.07, .93),
                                             (39.47, 4.58, 1.03), (33.13, 7.18, .78)]):
        random = Random(168 + index)
        mesh.box("Blue-gray cobble", (x, .049, z), (.53, .028, .53))
        for j in (-2, -1, 0, 1, 2):
            mesh.box("Iron", (x+j*.083, .071, z), (.019, .018, .44))
            mesh.box("Iron", (x, .071, z+j*.083), (.44, .018, .019))
        mesh.lathe("Bark", (x, .035, z), [(0, .13), (.55, .083), (.99, .073), (1.37, .044)], 10, shade=.93)
        for branch in range(20):
            angle = branch * 2.399
            spread = .13 + random.random() * .65
            y = 1.32 + random.random() * .81
            scale = (.25 + random.random() * .22) * stature
            px = x + cos(angle) * spread
            pz = z + sin(angle) * spread
            name = ("Leaf dark", "Leaf green", "Leaf light", "Leaf amber")[branch % 4] if index != 2 else (
                "Leaf red", "Leaf gold", "Leaf amber")[branch % 3]
            mesh.lathe(name, (px, y, pz), [(-scale * .73, scale * .36), (-scale * .36, scale * .83),
                                           (.061, scale), (scale * .60, scale * .79), (scale * .96, scale * .23)],
                       7, depth=.91, smooth=True, shade=.9 + .1 * random.random())
    mesh.build("Olive Street and cafe terrace", collection)


def plaza(collection):
    mesh = Meshes()
    ox, oz = 51.9, 11.0
    tf = placement(ox, .04, oz)
    mesh.slab("Olive sidewalk", (0, 0, 0), (14.62, 12.96), transform=tf)
    mesh.slab("Terrazzo", (0, .007, .03), (13.7, 11.91), shade=.95, transform=tf)
    for x in (-5.18, 5.18):
        mesh.slab("Blue-gray cobble", (x, .009, 0), (.108, 11.80), shade=.93, transform=tf)
    for z in (-5.9, 5.91):
        mesh.slab("Blue-gray cobble", (0, .009, z), (13.76, .107), shade=.93, transform=tf)
    for x, z, rx, rz, seed in [(-4.1, -3.14, 2.27, 2.0, 96), (4.4, -2.98, 2.06, 2.02, 43),
                                (-4.42, 3.23, 1.9, 1.78, 51), (4.19, 3.31, 2.25, 1.76, 65)]:
        garden = placement(ox + x, .059, oz + z)
        mesh.lathe("Carved limestone", (0, 0, 0), [(0, rx - .11), (.062, rx), (.145, rx), (.189, rx - .073)],
                   22, depth=rz / rx, transform=garden)
        mesh.lathe("Leaf green", (0, 0, 0), [(.19, rx - .115), (.211, rx - .185)], 22,
                   depth=rz / rx, shade=.90, transform=garden)
        random = Random(seed)
        for i in range(54):
            t = i * 2.399
            rho = .19 + sqrt(i / 54) * .71
            px, pz = rx * rho * cos(t), rz * rho * sin(t)
            h = .12 + random.random() * .24
            leaf = ("Leaf dark", "Leaf green", "Leaf light", "Leaf amber")[i % 4]
            mesh.lathe(leaf, (px, .208, pz), [(0, .049), (.082, h * .53), (h, h * .28), (h * 1.2, .03)],
                       6, transform=garden)
            if i % 5 < 2:
                tint = ("Rose", "Violet", "Apricot", "Cream ceramic")[(i//5 + seed) % 4]
                for bloom in range(3):
                    dx, dz = (bloom-1)*.113, cos(bloom*2.33)*.075
                    level = .246 + h + random.uniform(.006, .088)
                    mesh.lathe("Leaf dark", (px+dx, .219, pz+dz), [(0,.018), (level-.219,.011)], 5, transform=garden)
                    mesh.lathe(tint, (px+dx, level, pz+dz),
                               [(0,.031), (.045,.079), (.087,.051)], 8, transform=garden)
                    mesh.ball("Leaf gold", garden((px+dx, level+.083, pz+dz)), (.067,.049,.066), sides=8)
        for i in range(11):
            t = i * 2.399 + .15
            radius = .44 + random.random() * .30
            cluster = .25 + random.random() * .21
            color = ("Leaf dark", "Leaf green", "Leaf light")[i % 3]
            mesh.lathe(color, (rx*radius*cos(t),.33,rz*radius*sin(t)),
                       [(-.10,cluster*.36), (0,cluster), (.21,cluster*.86), (.32,cluster*.18)],
                       9, depth=.85, transform=garden)
        tree_x, tree_z = x + (.28 if x < 0 else -.28), z + (.13 if z > 0 else -.13)
        tree = placement(ox + tree_x, .25, oz + tree_z)
        mesh.lathe("Bark", (0, 0, 0), [(0, .13), (.67, .091), (1.42, .071), (2.07, .031)], 9, transform=tree)
        for i in range(21):
            t = i * 2.399
            r = .13 + random.random() * .77
            size = .31 + random.random() * .36
            color = ("Leaf dark", "Leaf green", "Leaf light", "Leaf amber")[i % 4]
            if seed == 65:
                color = ("Leaf gold", "Leaf amber", "Leaf red")[i % 3]
            mesh.lathe(color, (cos(t) * r, 1.50 + random.random() * .9, sin(t) * r),
                       [(-size * .58, size * .46), (-.078, size), (size * .42, size * .88), (size * .83, size * .28)],
                       11, depth=.93, transform=tree)

    for side in (-1, 1):
        for z in (-2.03, 1.89):
            planter(mesh, side*6.32, .033, z, 1.45, .61, round(62+z*7+side*9), tf)
        for z in (-5.48, 5.45):
            mesh.lathe("Iron", (side*5.41,.014,z), [(0,.105),(.08,.12),(1.45,.034),(1.56,.10)],
                       12, transform=tf)
            mesh.lathe("Neon", (side*5.41,1.58,z), [(0,.069),(.15,.10),(.22,.065)], 8, transform=tf)
            mesh.lathe("Iron", (side*5.41,1.795,z), [(0,.126),(.078,.068),(.119,.029)], 10, transform=tf)

    pool = placement(ox + .12, .059, oz + .12)
    mesh.lathe("Shadowed terra cotta", (0, 0, 0), [(0, 2.79), (.13, 2.81), (.165, 2.79)],
               38, depth=.67, transform=pool)
    mesh.lathe("Carved limestone", (0, 0, 0), [(.16, 2.82), (.24, 2.82), (.267, 2.75)],
               38, depth=.67, transform=pool)
    mesh.lathe("Creek", (0, 0, 0), [(.268, 2.59), (.277, 2.59)], 38, depth=.67, transform=pool)
    for i in range(17):
        t = i * 2.399
        radius = 2.28 * sqrt(i / 17)
        cx, cz = radius * cos(t), radius * sin(t) * .61
        mesh.slab("Creek", (cx, .278, cz), (.20 + .08 * sin(t), .032),
                  shade=.77 + .20 * (.5 + .5 * cos(t)), transform=pool)

    mesh.lathe("Shadowed terra cotta", (0, .279, 0), [(0, .37), (.15, .34)], 10, transform=pool)
    # Three folded bronze leaves fan outward above the basin.
    for i, (direction, height, lean) in enumerate([(-.95, 1.48, .66), (.06, 1.94, .31), (1.08, 1.31, .81)]):
        turn = direction + .32
        stem = placement(ox + .12, .47, oz + .12, turn)
        shade = ["Green painted wood", "Creek", "Leaf green"][i]
        points = [(-.09, 0), (.104, 0), (.315, height * .59), (lean, height), (.12, height * .63)]
        mesh.relief(shade, points, (-.038, .045), transform=stem)
        mesh.relief("Bronze", [(.012, .04), (.065, .047), (lean * .79, height * .88), (lean, height), (.123, height * .46)],
                    (.044, .059), shade=.88, transform=stem)

    for x, z, yaw in [(-3.15, .17, pi / 2), (3.28, .32, -pi / 2), (-1.17, 4.38, pi), (1.1, -4.38, 0)]:
        bench = placement(ox + x, .064, oz + z, yaw)
        for side in (-1, 1):
            mesh.box("Iron", (.58 * side, .195, 0), (.083, .39, .41), transform=bench)
            mesh.box("Iron", (.58 * side, .48, -.182), (.061, .51, .063), transform=bench)
        for i in range(4):
            mesh.box("Stained oak", (0, .409, .143 - i * .10), (1.57, .05, .077), transform=bench)
        mesh.box("Stained oak", (0, .607, -.189), (1.57, .139, .05), transform=bench)
    mesh.build("Thirteenth Street Plaza", collection)
