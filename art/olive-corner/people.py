"""Original rigged characters for the Olive Street corner."""

from math import pi, sin

import bpy

from meshkit import Meshes, material, native, wash


def people_surfaces():
    for name, color in [
        ("Sofia skin", "#b87955"), ("Sofia blush", "#a96551"), ("Sofia hair", "#493127"),
        ("Sofia trousers", "#465e66"), ("Sofia sleeve", "#a65e53"), ("Sofia shoes", "#65463b"),
        ("Micah skin", "#8f5e47"), ("Micah blush", "#8a5041"), ("Micah hair", "#392925"),
        ("Micah shirt", "#e0b77c"), ("Micah trousers", "#444e48"), ("Micah shoes", "#463632"),
        ("Apron piping", "#bac292"), ("Eyes", "#312622"), ("Cloth buttons", "#dcbd80"),
        ("Eye ivory", "#fff2db"), ("Honey glint", "#f5d4a7"),
    ]:
        material(name, color)
    for i, (name, color, accent) in enumerate([
        ("Sofia coat", "#a85a53", "#803e43"), ("Sofia tote", "#cfab74", "#8b6a45"),
        ("Micah apron", "#406c58", "#275844"), ("Micah cap", "#51665d", "#324b4a"),
    ]):
        material(name, texture=wash(name, color, accent, "fabric", 3720 + i, size=160))


def armature(name, collection):
    rig_data = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, rig_data)
    collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    def bone(label, start, end, parent=None):
        edit = rig_data.edit_bones.new(label)
        edit.head = native(start)
        edit.tail = native(end)
        if parent:
            edit.parent = rig_data.edit_bones[parent]

    bone("Root", (0, .02, 0), (0, .75, 0))
    bone("Chest", (0, .731, 0), (0, 1.18, 0), "Root")
    bone("Head", (0, 1.17, 0), (0, 1.54, 0), "Chest")
    for sign, side in [(-1, "L"), (1, "R")]:
        bone(f"Arm.{side}", (sign * .219, 1.113, 0), (sign * .285, .912, 0), "Chest")
        bone(f"Forearm.{side}", (sign * .285, .912, 0), (sign * .31, .731, .005), f"Arm.{side}")
        bone(f"Thigh.{side}", (sign * .113, .743, 0), (sign * .115, .421, .014), "Root")
        bone(f"Shin.{side}", (sign * .115, .421, .014), (sign * .116, .143, .0), f"Thigh.{side}")
        bone(f"Foot.{side}", (sign * .116, .143, 0), (sign * .116, .086, .132), f"Shin.{side}")
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    return rig


def head(mesh, name, cap):
    skin, blush, hair = name + " skin", name + " blush", name + " hair"
    mesh.lathe(skin, (0, 1.203, .006), [(0, .064), (.071, .081)], 12, bone="Head")
    mesh.lathe(skin, (0, 1.281, .008), [
        (-.07, .061), (-.043, .109), (.012, .146), (.081, .164), (.141, .16),
        (.198, .117), (.222, .059), (.23, .004),
    ], 16, depth=.90, bone="Head")
    for side in (-1, 1):
        mesh.ball(skin, (side * .15, 1.346, .006), (.076, .095, .081), bone="Head")
        mesh.ball(blush, (side * .095, 1.322, .112), (.042, .023, .024), sides=8, bone="Head")
        mesh.ball("Eye ivory", (side * .063, 1.375, .142), (.056, .035, .027), sides=12, bone="Head")
        mesh.ball("Eyes", (side * .063, 1.374, .154), (.030, .034, .016), sides=10, bone="Head")
        mesh.ball("Eye ivory", (side * .063 - .008, 1.381, .162), (.010, .012, .006), sides=8, bone="Head")
        mesh.ball(hair, (side * .062, 1.412, .139), (.063, .018, .017), sides=10, bone="Head")
    mesh.ball(skin, (0, 1.344, .148), (.058, .051, .069), sides=10, bone="Head")
    mesh.ball(blush, (0, 1.306, .133), (.063, .012, .022), sides=8, bone="Head")
    if cap:
        mesh.lathe(hair, (0, 1.415, -.015), [(-.044, .146), (.026, .167), (.079, .123), (.096, .004)],
                   14, depth=.93, bone="Head")
        mesh.lathe("Micah cap", (0, 1.456, -.012), [(-.022, .163), (.019, .174), (.064, .142), (.086, .064)],
                   16, depth=.92, bone="Head")
        mesh.ball("Micah cap", (0, 1.45, .139), (.251, .044, .201), bone="Head")
        mesh.box("Apron piping", (0, 1.493, .148), (.076, .042, .016), bone="Head")
        mesh.ball("Micah cap", (0, 1.549, -.015), (.032, .022, .03), sides=10, bone="Head")
        for side in (-1, 1):
            mesh.ball(hair, (side * .127, 1.311, .053), (.066, .089, .048), sides=8, bone="Head")
    else:
        mesh.lathe(hair, (0, 1.416, -.028), [(-.065, .137), (.002, .170), (.067, .152), (.108, .099), (.12, .025)],
                   16, bone="Head")
        for i, (x, z) in enumerate([(-.112, .061), (-.084, .101), (-.043, .118), (.012, .115), (.075, .083)]):
            mesh.ball(hair, (x, 1.46 - i * .004, z), (.111, .129, .108), sides=10, bone="Head")
        mesh.ball(hair, (-.089, 1.395, -.146), (.211, .215, .155), sides=13, bone="Head")
        mesh.ball("Brass", (.157, 1.312, .024), (.022, .035, .027), sides=8, bone="Head")


def wardrobe(mesh, name, apron):
    skin, trousers, shoe = name + " skin", name + " trousers", name + " shoes"
    shirt = "Micah shirt" if apron else "Sofia coat"
    sleeves = "Micah shirt" if apron else "Sofia sleeve"
    for side, suffix in [(-1, "L"), (1, "R")]:
        thigh, shin, foot = ("Thigh." + suffix, "Shin." + suffix, "Foot." + suffix)
        mesh.lathe(trousers, (side * .112, .51, 0), [(-.123, .075), (-.04, .091), (.125, .104), (.249, .101)],
                   10, depth=1.03, bone=thigh)
        mesh.lathe(trousers, (side * .113, .241, .012), [(-.10, .058), (-.043, .071), (.169, .077), (.221, .077)],
                   10, depth=.94, bone=shin)
        mesh.ball(shoe, (side * .114, .102, .065), (.152, .137, .26), bone=foot)
        mesh.box("Granite base", (side * .114, .045, .068), (.141, .05, .235), bone=foot)
        mesh.box("Honey glint", (side * .114, .112, .139), (.091, .016, .033), bone=foot)
        arm, forearm = "Arm." + suffix, "Forearm." + suffix
        mesh.ball(sleeves, (side * .236, 1.036, 0), (.147, .264, .162), bone=arm)
        mesh.ball(sleeves, (side * .281, .909, .008), (.128, .122, .132), sides=10, bone=arm)
        mesh.ball(sleeves, (side * .302, .83, .009), (.126, .181, .12), sides=10, bone=forearm)
        mesh.lathe("Apron piping" if apron else "Sofia coat", (side * .308, .762, .01),
                   [(-.04, .052), (.021, .064)], 10, bone=forearm)
        mesh.ball(skin, (side * .314, .728, .023), (.106, .124, .087), sides=10, bone=forearm)
    mesh.lathe(trousers, (0, .737, 0), [(-.076, .138), (-.016, .18), (.081, .19)], 14, depth=.75, bone="Root")
    mesh.lathe(shirt, (0, .736, 0), [(-.063, .157), (.045, .196), (.148, .183), (.28, .223),
                                       (.372, .211), (.428, .138), (.45, .083)], 16, depth=.70, bone="Chest")
    if apron:
        mesh.box("Micah apron", (0, .864, .148), (.306, .327, .031), bone="Chest")
        mesh.box("Micah apron", (0, .726, .148), (.356, .266, .041), bone="Chest")
        for x in (-.106, .106):
            mesh.box("Micah apron", (x, 1.073, .12), (.036, .18, .033), bone="Chest")
        mesh.box("Apron piping", (0, .811, .176), (.197, .024, .024), bone="Chest")
        mesh.box("Micah apron", (0, .763, .177), (.18, .081, .021), bone="Chest")
        mesh.lathe("Cream ceramic", (.318, .731, .067), [(0, .046), (.102, .054)], 10, bone="Forearm.R")
        mesh.lathe("Tea", (.318, .835, .067), [(0, .049), (.003, .049)], 10, bone="Forearm.R")
    else:
        for y in (.831, .914, 1.013):
            mesh.ball("Cloth buttons", (.023, y, .148), (.024, .024, .012), sides=7, bone="Chest")
        mesh.box("Sofia tote", (-.317, .597, .087), (.215, .246, .104), bone="Forearm.L")
        for x in (-.382, -.25):
            mesh.box("Sofia tote", (x, .732, .087), (.028, .15, .021), bone="Forearm.L")
        if name == "Sofia":
            for side in (-1, 1):
                collar = [(.016 * side, 1.149), (.117 * side, 1.146), (.094 * side, .991)]
                if side < 0:
                    collar.reverse()
                mesh.relief("Sofia sleeve", collar, (.118, .155), bone="Chest")
            mesh.box("Cloth buttons", (-.108, .976, .159), (.093, .024, .018), bone="Chest")
            mesh.box("Honey glint", (-.319, .636, .144), (.099, .04, .016), bone="Forearm.L")


def animate(rig, apron):
    for pose in rig.pose.bones:
        pose.rotation_mode = "XYZ"
    if apron:
        duration = 76
        for frame, bend, tilt in [(1, .46, -.025), (23, .82, .083), (47, .59, -.063), (76, .46, -.025)]:
            poses = {
                "Head": (.10 * bend, -.72 * tilt, .21 * tilt),
                "Chest": (.14 * bend, -.15 * tilt, tilt),
                "Arm.R": (.13 + .18 * bend, -.09, .06),
                "Forearm.R": (.49 + bend * .49, 0, -.08),
                "Arm.L": (.105, -.04, -.037),
                "Forearm.L": (.22 + bend * .26, 0, .053),
            }
            for name, value in poses.items():
                bone = rig.pose.bones[name]
                bone.rotation_euler = value
                bone.keyframe_insert("rotation_euler", frame=frame, group=name)
        rig.animation_data.action.name = "Serve coffee"
    else:
        duration = 28
        for i in range(9):
            phase = i * 2 * pi / 8
            frame = 1 + i * (duration - 1) / 8
            for direction, suffix in [(-1, "L"), (1, "R")]:
                step = sin(phase) * direction
                values = {
                    "Thigh." + suffix: (.387 * step, 0, .013 * direction),
                    "Shin." + suffix: (-.27 * max(0, -step), 0, 0),
                    "Foot." + suffix: (-.097 * step, 0, 0),
                    "Arm." + suffix: (-.24 * step, 0, .065 * direction),
                    "Forearm." + suffix: (.14 - .075 * step, 0, .042 * direction),
                }
                for name, value in values.items():
                    bone = rig.pose.bones[name]
                    bone.rotation_euler = value
                    bone.keyframe_insert("rotation_euler", frame=frame, group=name)
            for name, value in {"Chest": (.014, .075 * sin(phase), .025 * sin(phase)),
                                "Head": (-.011, -.053 * sin(phase), -.012 * sin(phase))}.items():
                bone = rig.pose.bones[name]
                bone.rotation_euler = value
                bone.keyframe_insert("rotation_euler", frame=frame, group=name)
        rig.animation_data.action.name = "Walk on Olive"
    bpy.context.scene.frame_end = max(bpy.context.scene.frame_end, duration)
    bpy.context.scene.frame_set(1)


def person(name, collection, apron=False):
    rig = armature(name, collection)
    mesh = Meshes()
    head(mesh, name, apron)
    wardrobe(mesh, name, apron)
    mesh.build(name, collection, rig)
    animate(rig, apron)
