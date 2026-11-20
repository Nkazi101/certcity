"""Cass Gilbert's Central Library, from the Olive Street and aerial references."""

from math import cos, pi, sin

from architecture import arch_band, window
from meshkit import Meshes, lettered, material, placement, wash


def arched_bay(mesh, tf, x, bottom, spring, width, *, entrance=False):
    radius = width / 2
    if entrance:
        # At Olive Street the arches open onto a loggia, with the bronze doors set back.
        back = -.26
        arc = [(x + radius * cos(i * pi / 16), spring + radius * sin(i * pi / 16)) for i in range(17)]
        for i, (a, b) in enumerate(zip(arc, arc[1:])):
            mesh.face("Library vault", [(a[0], a[1], .085), (b[0], b[1], .085), (b[0], b[1], back), (a[0], a[1], back)],
                      shade=.86 + (i % 2) * .06, transform=tf)
        for side in (-1, 1):
            mesh.box("Library ashlar", (x + side * (radius + .034), (bottom + spring) / 2, -.074),
                     (.079, spring - bottom, .326), transform=tf)
        mesh.box("Library threshold", (x, bottom -.017, -.068), (width, .035, .39), transform=tf)
        mesh.relief("Library recess", [(x - radius, bottom), (x + radius, bottom)] + arc, (back - .028, back), transform=tf)
        arch_band(mesh, x, spring, radius, .087, (.052, .133), "Library ashlar", tf)
        arch_band(mesh, x, spring, radius * .96, .028, (.092, .139), "Library threshold", tf)
        for side in (-1, 1):
            door_x = x + side * radius * .44
            mesh.box("Bronze dark", (door_x, bottom + .465, back + .04), (radius*.86, .911, .060), transform=tf)
            mesh.box("Olive glass dark", (door_x, bottom + .57, back + .086), (radius*.64, .565, .025), transform=tf)
            for fret in (-1, 0, 1):
                mesh.box("Bronze", (door_x + fret*.059, bottom + .568, back + .101),
                         (.016, .569, .018), transform=tf)
            for y in (.36, .55, .75, .9):
                mesh.box("Bronze", (door_x, bottom + y, back + .104), (radius*.72, .018, .021), transform=tf)
            mesh.box("Brass", (x + side*.044, bottom + .45, back + .131), (.032, .153, .033), transform=tf)
        mesh.lathe("Bronze dark", (x, spring + .115, -.08), [(0, .045), (.025, .09), (.135, .076), (.174, .013)], 8, transform=tf)
        mesh.lathe("Library lamp", (x, spring + .135, -.08), [(0, .055), (.114, .061)], 8, transform=tf)
        return
    outline = [(x - radius, bottom), (x + radius, bottom)] + [
        (x + radius * cos(i * pi / 14), spring + radius * sin(i * pi / 14))
        for i in range(15)
    ]
    mesh.relief("Library recess", outline, (.013, .049), transform=tf)
    glazing = [(x - radius * .82, bottom + .08), (x + radius * .82, bottom + .08)] + [
        (x + radius * .82 * cos(i * pi / 14), spring - .025 + radius * .82 * sin(i * pi / 14))
        for i in range(15)
    ]
    mesh.relief("Olive glass dark", glazing, (.051, .065), transform=tf)
    arch_band(mesh, x, spring, radius, .055, (.041, .122), "Library ashlar", tf)
    for side in (-1, 1):
        mesh.box("Library ashlar", (x + side * (radius + .032), (spring + bottom) / 2, .077),
                 (.081, spring - bottom, .108), transform=tf)
    height = spring - bottom + radius * .82
    mesh.box("Bronze dark", (x, bottom + height / 2, .071), (.025, height, .027), transform=tf)
    mesh.box("Bronze dark", (x, spring - .048, .081), (width * .79, .025, .027), transform=tf)
    mesh.box("Library ashlar", (x, bottom - .019, .081), (width + .155, .074, .176), transform=tf)


def roof_wing(mesh, tf, outer, inner, extent, inner_extent):
    low, high = 4.124, 4.57
    z = (outer + inner) / 2
    run = (extent + inner_extent) / 2
    mesh.face("Library roof tile", [(-extent, low, outer), (extent, low, outer), (run, high, z), (-run, high, z)],
              shade=.99, transform=tf)
    mesh.face("Library roof tile", [(-run, high, z), (run, high, z), (inner_extent, low, inner), (-inner_extent, low, inner)],
              shade=.89, transform=tf)
    mesh.box("Library roof crest", (0, high, z), (run * 2, .064, .08), transform=tf)


def central_library(collection):
    for name, base, accent, pattern, seed in [
        ("Library granite", "#b5b2a4", "#7c827f", "terra", 742),
        ("Library ashlar", "#d7cdb9", "#a39c8c", "stone", 743),
        ("Library roof tile", "#688b7e", "#466659", "roof", 744),
    ]:
        material(name, texture=wash(name, base, accent, pattern, seed, grain=.45), rough=.76)
    material("Library roof crest", "#455e54")
    material("Library recess", "#43504c")
    material("Library threshold", "#a49e8f")
    material("Library vault", "#ada085")
    material("Library lamp", "#e7c383")
    material("Library court roof", "#a3a49a")
    material("Library flag blue", "#446287")
    material("Library flag red", "#a45046")
    material("Library plaque", texture=lettered("Library plaque", "ST. LOUIS PUBLIC LIBRARY",
                                               ("#9b8f77", "#fff1cd")))

    mesh = Meshes()
    ox, oz = 33.42, -12.20
    base = placement(ox, .082, oz)
    w, d = 13.86, 14.32
    half_x, half_z = w / 2, d / 2
    inner_x, inner_z = 3.58, 3.77
    mesh.box("Library granite", (0, .329, .04), (14.43, .65, 14.94), transform=base)
    mesh.box("Library ashlar", (0, .659, .04), (14.61, .09, 15.1), transform=base)
    mesh.slab("Olive sidewalk", (0, .011, .80), (15.32, 16.73), transform=base)
    mesh.slab("Terrazzo", (0, .011, 8.36), (10.61, 1.71), transform=base)

    for side in (-1, 1):
        wing_z = side * (half_z + inner_z) / 2
        wing_x = side * (half_x + inner_x) / 2
        mesh.box("Library granite", (0, 2.369, wing_z), (w, 3.426, half_z - inner_z), transform=base)
        mesh.box("Library granite", (wing_x, 2.369, 0), (half_x - inner_x, 3.426, inner_z * 2), transform=base)

    for yaw, length, edge, inside, inside_width in [
        (0, w, half_z, inner_z, inner_x), (pi, w, half_z, inner_z, inner_x),
        (pi / 2, d, half_x, inner_x, inner_z), (-pi / 2, d, half_x, inner_x, inner_z),
    ]:
        roof_wing(mesh, placement(ox, .082, oz, yaw), edge + .21, inside, length / 2 + .21, inside_width)
        wall = placement(ox + sin(yaw) * edge, .082, oz + cos(yaw) * edge, yaw)
        for y, width, depth, surface in [
            (.85, .115, .166, "Library ashlar"), (1.14, .085, .171, "Library ashlar"),
            (3.13, .087, .171, "Library ashlar"), (3.248, .133, .286, "Library ashlar"),
            (3.33, .092, .309, "Shadowed terra cotta"), (4.036, .124, .225, "Library ashlar"),
            (4.121, .054, .275, "Library ashlar"),
        ]:
            mesh.box(surface, (0, y, .048), (length + .31, width, depth), transform=wall)
        for i in range(int(length / .28)):
            x = -length / 2 + (i + .48) * .28
            mesh.box("Library ashlar", (x, 3.201, .207), (.095, .082, .094), transform=wall)
        if yaw == 0:
            columns = [side * (2.38 + .72 * i) for side in (-1, 1) for i in range(6)]
        elif yaw == pi:
            columns = [i * 1.19 for i in range(-5, 6)]
        else:
            columns = [i * 1.14 for i in range(-5, 6)]
        for i, x in enumerate(columns):
            arched_bay(mesh, wall, x, 1.384, 2.378, .49 if yaw == 0 else .58)
            window(mesh, x, 3.689, .29 if yaw == 0 else .40, .324, .015,
                   "Lit window" if i % 4 == 1 else "Olive glass blue", wall, bar=False)
            window(mesh, x, .953, .29 if yaw == 0 else .36, .268, .015, "Olive glass dark", wall, bar=False)
            if yaw != pi:
                stamp = placement(ox + sin(yaw) * (edge + .05), .082, oz + cos(yaw) * (edge + .05), yaw)
                center = x + (.33 if yaw == 0 else .48)
                outline = [(center + .083 * cos(t * pi / 6), 3.692 + .083 * sin(t * pi / 6))
                           for t in range(12)]
                mesh.relief("Library ashlar", outline, (0, .049), transform=stamp)
                if yaw == 0:
                    mesh.box("Library threshold", (x, 1.184, .018), (.28, .24, .056), transform=stamp)
                    for direction in (-1, 1):
                        mesh.lathe("Library ashlar", (x + direction*.055, 1.099, .062),
                                   [(0, .032), (.153, .032)], 6, transform=stamp)
        for side in (-1, 1):
            for y in [1.40, 1.71, 2.02, 2.33, 2.64, 2.95]:
                mesh.box("Library ashlar", (side * (length / 2 - .104), y, .017),
                         (.237, .112, .15), transform=wall)

    # The Great Hall is a raised oval within a ring of roof wings.
    court = placement(ox, .082, oz - .32)
    mesh.lathe("Blond masonry", (0, 0, 0), [(.64, 2.36), (3.91, 2.36)], 34, depth=1.33, transform=court)
    mesh.lathe("Library court roof", (0, 0, 0), [(3.89, 2.41), (4.02, 2.42)],
               34, depth=1.33, transform=court)
    for x, z in [(-1.0, -.9), (.7, -.73), (-.58, .70), (.79, 1.25)]:
        mesh.box("Shadowed terra cotta", (x, 4.119, z), (.55, .146, .41), transform=court)
        mesh.box("Olive glass sky", (x, 4.218, z), (.48, .048, .38), transform=court)
    mesh.box("Library court roof", (0, 3.43, -3.27), (2.32, .16, 1.91), transform=court)
    for x in [-.81, -.32, .19, .69]:
        mesh.box("Olive glass sky", (x, 3.256, -3.26), (.40, .46, 1.2), transform=court)
    for x, z in [(-5.35, -5.53), (5.32, -5.61), (-5.67, 4.31), (5.59, 3.81)]:
        mesh.lathe("Library roof crest", (x, 4.32, z), [(0, .073), (.26, .066), (.28, .195), (.34, .12)],
                   11, transform=base)

    # Three arches and a broad stair are the signature of the Olive façade.
    front = placement(ox, .082, oz + half_z + .235)
    mesh.box("Library granite", (0, 3.58, -.046), (3.82, 1.04, .73), transform=front)
    for y, width, height, depth in [
        (1.13, 3.99, .10, .71), (3.17, 3.97, .11, .83),
        (3.282, 4.03, .119, .94), (3.975, 4.06, .123, .90),
        (4.061, 4.02, .085, .86),
    ]:
        mesh.box("Library ashlar", (0, y, .047), (width, height, depth), transform=front)
    for x in [-1.145, 0, 1.145]:
        face = placement(ox, .082, oz + half_z + .621)
        arched_bay(mesh, face, x, 1.159, 2.49, .86, entrance=True)
        mesh.box("Library granite", (x, 2.966, -.144), (.87, .143, .49), transform=face)
    for x in (-1.80, -.574, .574, 1.80):
        mesh.box("Library granite", (x, 2.093, -.133), (.282, 1.88, .51), transform=front)
        mesh.box("Library ashlar", (x, 2.094, .338), (.241, 1.85, .47), transform=front)
        for y in (1.277, 2.441, 2.514):
            mesh.box("Library ashlar", (x, y, .425), (.279, .052, .198), transform=front)
    for side in (-1, 1):
        mesh.box("Library granite", (side * 1.891, 2.16, -.033), (.119, 1.95, .733), transform=front)
    mesh.sign("Library plaque", (0, 3.631, .358), (2.82, .269), front)
    for i in range(11):
        height = .11 + .089 * i
        z = 2.315 - i * .153
        mesh.box("Library granite", (0, height * .5, z), (4.78 - i * .025, height, .183),
                 shade=.91 + i * .006, transform=front)
        mesh.box("Library ashlar", (0, height - .015, z + .077), (4.78 - i * .025, .037, .047), transform=front)
    mesh.box("Library granite", (0, .516, .554), (4.51, 1.04, .47), transform=front)
    for x in (-1.08, 1.08):
        rail = [(2.43, .35), (.87, 1.18)]
        a, b = rail
        mesh.face("Bronze", [(x-.041, a[1], a[0]), (x+.041, a[1], a[0]),
                            (x+.041, b[1], b[0]), (x-.041, b[1], b[0])], transform=front)
        for i in range(5):
            z = 2.34 - i*.34
            ground = .11 + i*.18
            mesh.box("Bronze dark", (x, ground+.16, z), (.058, .32, .058), transform=front)
            mesh.lathe("Bronze", (x, ground, z), [(0, .052), (.049, .042)], 8, transform=front)
    for side in (-1, 1):
        x = side * 2.36
        for i in range(5):
            z = 2.154 - i * .301
            y = .21 + i * .182
            mesh.box("Library granite", (x, y * .5, z), (.302, y, .316), transform=front)
        mesh.box("Library ashlar", (x, 1.06, .77), (.48, .137, .47), transform=front)
        lamp_x = side * 2.63
        mesh.lathe("Bronze dark", (lamp_x, .09, 2.02),
                   [(0, .17), (.076, .14), (.225, .066), (1.46, .04), (1.54, .072)], 10, transform=front)
        # Low supports echo the turtles recorded in the Historic American Buildings Survey.
        for offset in (-.13, .13):
            mesh.lathe("Bronze", (lamp_x+offset, .093, 2.02),
                       [(0, .086), (.061, .081), (.108, .041)], 8, depth=.67, transform=front)
        mesh.lathe("Library lamp", (lamp_x, 1.6, 2.02), [(0, .073), (.104, .134), (.246, .055)], 10, transform=front)
        mesh.lathe("Bronze dark", (lamp_x, 1.84, 2.02), [(0, .091), (.078, .018)], 10, transform=front)
        for index in range(10):
            rail_x = side * (2.75 + index * .365)
            mesh.box("Library granite", (rail_x, .337, 1.026), (.145, .549, .18), transform=front)
        mesh.box("Library ashlar", (side * 4.37, .624, 1.026), (3.69, .093, .24), transform=front)
        mesh.box("Library ashlar", (side * 4.37, .124, 1.026), (3.69, .129, .24), transform=front)
        flag_x = side * 5.37
        mesh.lathe("Bronze", (flag_x, .048, 1.75), [(0, .172), (.119, .113), (.21, .041), (3.49, .031)],
                   11, transform=front)
        for row in range(7):
            y = 3.355 - row * .062
            points = [(flag_x, y - .06, 1.75), (flag_x + .59, y - .062, 1.85),
                      (flag_x + .59, y, 1.85), (flag_x, y, 1.75)]
            tone = "Library flag red" if row % 2 == 0 else "Library ashlar"
            mesh.face(tone, points, transform=front)
            mesh.face(tone, points[::-1], transform=front)
        mesh.box("Library flag blue", (flag_x + .118, 3.251, 1.782), (.236, .196, .027), transform=front)
    # U-shaped racks on the sidewalk beside the steps.
    for x in (-4.82, -4.27, -3.72):
        for z in (2.26, 2.73):
            mesh.box("Iron", (x, .21, z), (.054, .42, .052), transform=front)
        mesh.box("Iron", (x, .429, 2.495), (.056, .058, .49), transform=front)
    mesh.build("St. Louis Public Library - Central Library", collection)
