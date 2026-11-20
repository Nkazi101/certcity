"""Original landmark geometry, modeled in CertCity coordinates (east, up, south)."""

from math import atan2, cos, pi, sin, sqrt
from random import Random

import bpy

from meshkit import Meshes, lettered, material, placement, wash


def surfaces():
    for i, (name, base, accent, pattern) in enumerate([
        ("Arena brick", "#a85b47", "#6c4136", "brick"),
        ("Loop brick", "#ad7052", "#744632", "brick"),
        ("Dark brick", "#874c42", "#50342b", "brick"),
        ("Granite", "#ae786b", "#77544e", "stone"),
        ("Limestone", "#e2c8a0", "#b09978", "terra"),
        ("Ivory", "#f0dcc0", "#bfa580", "terra"),
        ("Terrace", "#d4bd9a", "#9c8267", "paving"),
        ("Copper", "#5b7f73", "#3b615c", "roof"),
        ("Slate", "#526367", "#374b4c", "roof"),
        ("Roof", "#8c8271", "#615b51", "roof"),
        ("Grass slope", "#89a557", "#688a4c", "grass"),
    ]):
        material(name, texture=wash(name, base, accent, pattern, 800 + i, size=256))
    material("Loop roof", texture=wash("Loop roof", "#867866", "#6c6254", "roof", 852, size=256))
    for name, color in {
        "Mortar": "#a48f75", "Coal": "#303e40", "Cream": "#f3deb3", "Steel": "#67787a",
        "Light metal": "#b9c3ba", "Glass dark": "#294d57", "Glass": "#46777e",
        "Glass light": "#6e9c9f", "Glass bright": "#9bb8b6", "Amber glass": "#c59959",
        "Navy": "#233f57", "Red": "#9e302f", "Bright red": "#c8493d", "Gold": "#e7b64f",
        "Bulb": "#f8de9e", "Ink": "#273636", "Turf": "#6b9441", "Mown turf": "#78a04b",
        "Infield": "#bc8562", "Chalk": "#f0ead1", "Water": "#438486", "Water dark": "#397679",
        "Water light": "#77acaa", "Water spray": "#b1d6d1", "Slope": "#7fa452",
        "Lawn": "#8cb258", "Meadow": "#8aac54", "Brick walk": "#bc916c",
    }.items():
        material(name, color, rough=.36 if name.startswith(("Glass", "Water")) else .82,
                 glow=.18 if name in {"Bulb", "Water spray"} else 0)
    for name, title, palette, subtitle in [
        ("Tivoli sign", "TIVOLI", ("#492c2d", "#f5ce7c"), "DELMAR BOULEVARD"),
        ("Blueberry sign", "BLUEBERRY HILL", ("#284a77", "#f6cc67"), "THE LOOP"),
        ("Loop sign", "DELMAR LOOP", ("#2f5149", "#f8e3ad"), None),
        ("Arena sign", "Enterprise Center", ("#294742", "#f2efd9"), None),
        ("Blues banner", "ST. LOUIS BLUES", ("#274775", "#f3d486"), None),
        ("Stifel sign", "STIFEL THEATRE", ("#dbc6a2", "#3e443f"), None),
        ("Stadium sign", "BUSCH STADIUM", ("#6d2729", "#f7e3b8"), None),
        ("Village sign", "BALLPARK VILLAGE", ("#482e32", "#f5dfb8"), None),
        ("WashU sign", "WASHINGTON UNIVERSITY", ("#553637", "#f5e1bc"), "DANFORTH CAMPUS"),
        ("UMSL sign", "UMSL", ("#65272c", "#f5d294"), "TOUHILL PERFORMING ARTS CENTER"),
        ("Art sign", "SAINT LOUIS ART MUSEUM", ("#c9b393", "#3e493e"), None),
    ]:
        material(name, texture=lettered(name, title, palette, subtitle))


def strip(mesh, surface, a, b, width, height=.07):
    x, y, z = a
    X, Y, Z = b
    length = sqrt((X - x)**2 + (Z - z)**2)
    dx, dz = (Z - z) * width / (2 * length), (x - X) * width / (2 * length)
    top = [(x - dx, y, z - dz), (X - dx, Y, Z - dz), (X + dx, Y, Z + dz), (x + dx, y, z + dz)]
    mesh.face(surface, top)
    if height:
        for first, second in zip(top, top[1:] + top[:1]):
            mesh.face(surface, [second, first, (first[0], first[1] - height, first[2]),
                                (second[0], second[1] - height, second[2])], shade=.84)


def cap(mesh, surface, x, z, y, width, depth, rise, tf=None):
    """Hipped roof with four separate planes."""
    a, b = width / 2, depth / 2
    spine = a * .75
    A, B = (x - spine, y + rise, z), (x + spine, y + rise, z)
    nw, ne = (x - a, y, z - b), (x + a, y, z - b)
    sw, se = (x - a, y, z + b), (x + a, y, z + b)
    for poly, value in [([sw, se, B, A], .92), ([ne, nw, A, B], .8), ([nw, sw, A], .95), ([se, ne, B], .84)]:
        mesh.face(surface, poly, shade=value, transform=tf)


def arch(mesh, x, base, z, w, height, surround, glass="Glass dark", tf=None, pointed=False):
    """Model the arch opening, spring line and individual masonry voussoirs."""
    r = w / 2
    rise = r * (1.36 if pointed else 1)
    spring = base + height - rise
    curve = [(x + r * cos(i * pi / 12), spring + rise * sin(i * pi / 12), z) for i in range(13)]
    mesh.face(glass, [(x-r, base, z), (x+r, base, z), *curve], transform=tf)
    for i in range(12):
        left, right = i * pi / 12, (i + .97) * pi / 12
        points = [
            (x + (r + margin) * cos(angle), spring + (rise + margin) * sin(angle), z + .043)
            for angle, margin in [(left, 0), (left, .155), (right, .155), (right, 0)]
        ]
        mesh.face(surround, points, shade=.90 + (i % 4) * .025, transform=tf)
    for side in (-1, 1):
        mesh.box(surround, (x + side * (r + .064), (base + spring) / 2, z + .036),
                 (.14, spring - base, .104), transform=tf)
    mesh.box(surround, (x, base - .055, z + .062), (w + .30, .10, .17), transform=tf)
    for q in (-.25, 0, .25):
        mesh.box("Steel", (x + w*q, (base + spring) / 2, z + .065), (.026, spring - base, .04), transform=tf)
    mesh.box("Steel", (x, spring, z + .066), (w, .043, .043), transform=tf)


def window(mesh, x, y, z, w, h, trim="Limestone", tf=None, tint="Glass", cross=True):
    mesh.box("Glass dark", (x, y, z), (w+.09, h+.075, .082), transform=tf)
    mesh.box(tint, (x, y, z+.053), (w, h, .04), transform=tf)
    mesh.box("Glass light", (x - w*.19, y + h*.1, z+.076), (w*.43, h*.61, .017), shade=.74, transform=tf)
    mesh.box(trim, (x, y-h*.52, z+.082), (w+.19, .095, .14), transform=tf)
    mesh.box(trim, (x, y+h*.50, z+.060), (w+.12, .072, .11), transform=tf)
    if cross:
        mesh.box("Light metal", (x, y, z+.082), (.039, h, .036), transform=tf)
        mesh.box("Light metal", (x, y+h*.12, z+.082), (w, .037, .035), transform=tf)


def bands(mesh, x, z, width, depth, levels, surface="Limestone"):
    for y, height, lip in levels:
        mesh.box(surface, (x, y, z), (width + lip, height, depth + lip))


def stairs(mesh, x, z, width, count, rise=.13, tread=.33, base=0, surface="Limestone"):
    for index in range(count):
        height = rise * (index + 1)
        mesh.box(surface, (x, base + height / 2, z - index*tread), (width, height, tread+.022))


def storefront(mesh, x, z, w, d, floors, wall, style, seed):
    rng = Random(seed)
    h = 2.4 + (floors-1)*1.66
    tf = placement(x, 0, z)
    front = d/2
    mesh.box(wall, (0,h/2,0), (w,h,d), transform=tf)
    mesh.box("Roof", (0,h+.05,0), (w-.26,.12,d-.24), transform=tf)
    for y, depth, tone in [(2.03,.17,"Limestone"), (h-.22,.15,"Ivory"), (h+.23,.18,wall), (h+.36,.12,"Limestone")]:
        mesh.box(tone,(0,y,front+.035),(w+.16,depth,.22), transform=tf)
    count = max(2, round(w/1.42))
    for i in range(count):
        cx = (i - (count-1)/2)*(w-.23)/count
        for f in range(1, floors):
            window(mesh, cx, 2.78+(f-1)*1.64, front+.012, .69, .99, tf=tf, tint=rng.choice(["Glass","Glass dark","Amber glass"]))
        window(mesh, cx, .91, front+.036, (w-.55)/count-.09, 1.47, trim="Steel", tf=tf, tint="Glass dark" if i % 3 else "Amber glass")
        mesh.box("Steel", (cx+(w-.23)/count*.46, .99, front+.13), (.095,1.9,.13), transform=tf)
    if style:
        mesh.box(style, (0,1.99,front+.40), (w-.43,.14,.82), transform=tf)
        for i in range(1, count*3):
            if i % 2:
                mesh.box("Cream", ((i/(count*3)-.5)*(w-.43),2.069,front+.42), ((w-.43)/(count*3),.025,.76), transform=tf)
        mesh.box(style,(0,1.9,front+.82),(w-.43,.17,.055),transform=tf)
    for i in (-1, 1):
        mesh.box(wall,(w*.49*i,h/2,front+.13),(.21,h+.1,.32),transform=tf)
    for edge in (-1, 1):
        side = placement(x+edge*w/2,0,z,edge*pi/2)
        if seed%2==0:
            for u in (-d*.34,-d*.12,d*.16):
                for floor in range(floors):
                    window(mesh,u,1.12+floor*1.64,.019,.49,.83,tf=side,tint="Glass dark")
        mesh.box(wall,(0,h+.17,.02),(d+.12,.33,.15),transform=side)
    mesh.box("Steel", (w*.23,h+.37,-.35), (.94,.44,.8), transform=tf)
    if seed%3==0:
        mesh.box(wall,(-w*.28,h+.32,-d*.31),(.51,.72,.52),transform=tf)
        mesh.box("Limestone",(-w*.28,h+.68,-d*.31),(.62,.13,.64),transform=tf)
    if seed%3==1:
        mesh.box("Roof",(-w*.19,h+.28,d*.13),(1.42,.39,1.17),transform=tf)
        for row in range(4):
            mesh.box("Steel",(-w*.19,h+.484,d*.13-.42+row*.27),(1.18,.043,.041),transform=tf)


def delmar(group):
    m = Meshes()
    from district_buildings import delmar_shop, delmar_east
    # Tivoli is east of Blueberry Hill. Both front the south side of Delmar.
    for i,(x,w,d,style) in enumerate([
        (-27,6.2,7.5,"corner"),(-20.7,5.35,6.65,"diner"),(-15.6,4.66,8.48,"studio"),
        (-9.25,7.4,7.5,"arcade"),(-2.83,4.4,6.1,"bay"),(2.21,4.93,7.2,"diner"),
        (18.23,5.24,8.8,"studio"),(24.35,5.7,6.4,"corner"),
    ]):
        delmar_shop(m,x,4.52+d/2,w,d,style,44+i,pi)
    for i,(x,w,d,style) in enumerate([
        (-26.5,7.2,7.7,"studio"),(-19.3,5.6,6.5,"arcade"),(-13.15,5.5,6.8,"bay"),
        (-7.05,5.8,8.5,"corner"),(-.6,5.8,6.7,"diner"),(4.0,3.8,7.2,"bay"),
        (8.5,4.04,7.9,"diner"),
    ]):
        delmar_shop(m,x,-4.73-d/2,w,d,style,68+i)
    delmar_east(m)
    front = placement(11.05,0,5.18,pi)
    m.box("Arena brick",(0,3.05,-6.05),(10.3,6.1,8.6),transform=front)
    m.box("Loop roof",(0,6.19,-6.1),(10.13,.18,8.37),transform=front)
    m.box("Ivory",(0,2.62,-1.09),(9.5,5.24,2.29),transform=front)
    for ix in (-3.15, 0, 3.15):
        m.box("Loop brick",(ix,3.23,.081),(2.49,2.44,.12),transform=front)
        for x in (ix-.62,ix+.62):
            window(m,x,3.31,.153,.78,1.61,"Ivory",tf=front)
        for x in (ix-1.46,ix+1.46):
            m.box("Ivory",(x,3.41,.23),(.24,3.08,.29),transform=front)
            m.box("Limestone",(x,4.66,.34),(.44,.28,.34),transform=front)
        if ix:
            outline=[(ix + 1.42*cos(i*pi/18),5.14+.72*sin(i*pi/18)) for i in range(19)]
            m.relief("Ivory",outline,[.05,.26],transform=front)
    for y in (2.27,4.53,5.05):
        m.box("Limestone",(0,y,.16),(9.62,.13,.32),transform=front)
    for x in (-3.64,-2.35,0,2.35,3.64):
        window(m,x,1,.14,1.13,1.8,"Steel",tf=front,tint="Amber glass" if abs(x)<1 else "Glass dark")
    m.box("Red",(0,2.04,.69),(4.19,.45,1.48),transform=front)
    m.box("Gold",(0,1.9,1.44),(4.30,.095,.10),transform=front)
    m.sign("Tivoli sign",(0,2.09,1.45),(3.88,.35),transform=front)
    for i in range(17):
        m.box("Bulb",(-1.92+i*.24,1.958,1.503),(.043,.039,.038),transform=front)
    m.box("Red",(1.53,4.15,.59),(.58,3.34,.83),transform=front)
    for i,c in enumerate("TIVOLI"):
        name=f"Tivoli blade {c}"
        if name not in bpy.data.materials:
            material(name,texture=lettered(name,c,("#772e32","#ffe09e")))
        m.sign(name,(1.53,5.28-i*.43,1.02),(.46,.36),transform=front)
        for side in (-1,1):
            blade_side=placement(1.53+side*.301,0,.59,side*pi/2)
            m.sign(name,(0,5.28-i*.43,.015),(.56,.36),
                   transform=lambda p: front(blade_side(p)))
    t=placement(-9.25,0,4.44,pi)
    m.box("Navy",(0,2.38,.01),(4.58,.84,.36),transform=t)
    m.sign("Blueberry sign",(0,2.38,.20),(4.48,.75),transform=t)
    m.box("Gold",(0,1.98,.22),(4.65,.06,.075),transform=t)
    for x in [-12.4,-9.4,-6.2,7,14.8]:
        m.box("Coal",(x,.24,3.68),(.52,.43,.53))
        m.box("Terrace",(x,.47,3.68),(.56,.08,.56))
    for i in range(22):
        x=-25.2+2.42*i
        m.slab("Coal",(x,.123,3.31),(.55,.51))
        star=[(x+(.19 if j%2==0 else .079)*sin(j*pi/5),.129,3.31+(.19 if j%2==0 else .079)*cos(j*pi/5)) for j in range(10)]
        m.face("Gold",star[::-1])
    for x in [-24,-12,0,12,24]:
        for z in [-3.58,3.61]:
            m.lathe("Coal",(x,.1,z),[(0,.13),(.24,.088),(3.1,.047)],8)
            m.box("Coal",(x,3.31,z),(.27,.43,.28))
            m.box("Bulb",(x,3.30,z),(.23,.30,.236))
            m.lathe("Coal",(x,3.49,z),[(0,.23),(.11,.08)],8)
    m.build("Delmar storefronts, Tivoli marquee and Walk of Fame",group)


def curved_front(mesh, center, rx, rz, low, high, start, end, count, trim="Light metal"):
    cx,cz=center
    for i in range(count):
        a,b=start+(end-start)*i/count,start+(end-start)*(i+1)/count
        x,z=cx+rx*cos(a),cz+rz*sin(a)
        X,Z=cx+rx*cos(b),cz+rz*sin(b)
        for row in range(3):
            y=low+(high-low)*row/3
            Y=low+(high-low)*(row+1)/3
            mesh.face(["Glass","Glass light","Glass dark","Glass bright"][(i*3+row)%4],
                      [(X,y,Z),(x,y,z),(x,Y,z),(X,Y,Z)])
            strip(mesh,trim,(x,Y,z),(X,Y,Z),.08,.10)
        mesh.box(trim,(x,(high+low)/2,z),(.09,high-low,.13))
        strip(mesh,"Limestone",(x,high+.42,z),(X,high+.42,Z),.88,.28)
        strip(mesh,"Terrace",(x,low+.07,z),(X,low+.07,Z),.24,.10)


def enterprise(group):
    m=Meshes()
    m.box("Limestone",(0,3.67,0),(23.4,7.34,14.6))
    m.box("Roof",(0,7.47,-.5),(22.9,.27,13.2))
    for i in range(15):
        x=-11.3+i*1.58
        roof_y=7.63+1.25*(1-(x/12)**2)
        m.box("Light metal",(x,roof_y-.24,-1.36),(1.62,.60,12.7))
        m.box("Steel",(x,roof_y+.08,-1.36),(.037,.05,12.65))
    # Southeast entrance pavilion, curved glazing, long 14th Street side.
    curved_front(m,(-4.7,4.35),7.1,5.8,.3,5.95,0,pi,24)
    for i in range(11):
        x=-.05+i*.99
        window(m,x,3.65,7.38,.91,3.74,"Light metal",tint=["Glass","Glass dark","Glass light"][i%3],cross=True)
        m.box("Steel",(x+.47,3.2,7.47),(.073,5.64,.119))
        window(m,x,.89,7.43,.79,1.58,"Steel",tint="Glass dark")
    for side in [-1,1]:
        face=placement(side*11.75,0,-.6,side*pi/2)
        for i in range(10):
            window(m,-5.5+i*1.21,3.4,.045,1.04,3.23,"Light metal",tf=face,tint=["Glass dark","Glass","Glass light"][i%3])
        m.box("Coal",(0,5.65,.09),(13.5,.24,.15),transform=face)
        for i in range(8):
            m.box("Limestone",(-5+i*1.44,1.63,.06),(.12,3.1,.24),transform=face)
    m.box("Steel",(4.99,6.27,7.43),(13.5,.78,.24))
    m.box("Navy",(5,6.23,7.58),(8.5,.61,.12))
    m.sign("Arena sign",(5,6.24,7.65),(8.25,.52))
    m.box("Cream",(5.9,1.92,8.24),(12.1,.2,2.12))
    m.box("Navy",(5.9,1.98,9.34),(12.16,.095,.12))
    stairs(m,4.5,10.03,10.3,4,.09,.27)
    for x in [-11.5,-8.4,-5.3,8.9,11.2]:
        m.lathe("Light metal",(x,.04,10.8),[(0,.07),(3.3,.037)],8)
        m.box("Navy" if x<0 else "Gold",(x+.30,2.92,10.79),(.60,.47,.023))
    m.box("Terrace",(-13.05,.12,-.7),(1.92,.23,17.6))
    m.sign("Blues banner",(5.9,2.17,9.35),(7.0,.37))
    for x in [-9.3,-8.4,-6.3,-4.7,-3.4,-1.9,2.0,3.4,8.2,9.7]:
        m.lathe("Navy",(x,.07,10.91),[(0,.078),(.55,.078),(.59,.055)],10)
    stifel(m)
    from district_buildings import sports_neighbors
    sports_neighbors(m, True)
    m.build("Enterprise Center arena and southeast entry",group)



def stifel(m):
    # Stifel's limestone Market Street front meets the north wall of the arena.
    m.box("Limestone",(-1.5,2.47,-10.08),(21.2,4.94,5.6))
    m.box("Roof",(-1.5,5.04,-10.1),(20.9,.22,5.37))
    m.box("Ivory",(-1.5,5.24,-10.08),(21.35,.24,5.68))
    tf=placement(-1.5,0,-12.89,pi)
    for x in [-8.9,-7.6,-6.35,6.35,7.6,8.9]:
        window(m,x,2.51,.024,.78,1.82,"Ivory",tf=tf,tint="Glass dark")
    m.box("Limestone",(0,3.07,.14),(10.46,4.47,.36),transform=tf)
    for x in [i*1.31-4.585 for i in range(8)]:
        m.lathe("Ivory",(x,.38,.69),[(0,.23),(.28,.21),(.33,.16),(3.85,.134),(4.01,.21),(4.15,.24)],12,transform=tf)
    for x in [-3.61,-1.8,0,1.8,3.61]:
        window(m,x,1.41,.356,.84,2.11,"Limestone",tf=tf,tint="Glass dark")
    m.box("Ivory",(0,4.79,.66),(10.9,.26,.76),transform=tf)
    m.sign("Stifel sign",(0,4.62,1.057),(7.3,.31),transform=tf)
    for side in (-1,1):
        x=side*5.78
        m.box("Limestone",(x,.65,1.21),(.82,1.25,.77),transform=tf)
        m.box("Ivory",(x,1.39,1.23),(.64,.31,.76),transform=tf)
        for i in range(3):
            m.box("Limestone",(x,1.53+i*.13,1.13+i*.11),(.45-i*.045,.25,.53-i*.10),transform=tf)
    for step in range(4):
        m.box("Terrace",(0,.052*(step+1),1.59-step*.17),(11.3,.104*(step+1),.18),transform=tf)


def stadium(m,x,z):
    cx,cz=x,z
    radius=(13.9,12.0)
    rings=80
    for i in range(rings):
        a,b=2*pi*i/rings,2*pi*(i+1)/rings
        # Leave the center-field edge low so the bowl opens toward Ballpark Village.
        outfield = 43 < i < 72
        height=5.45 if not outfield else (1.75 if 50 < i < 67 else 2.63)
        for tier in range(3 if height>3 else 1):
            for step in range(5):
                scale=.62+tier*.122+step*.021
                y=.7+tier*1.38+step*.20
                coords=[(cx+radius[0]*scale*cos(t),y,cz+radius[1]*scale*sin(t)) for t in (a,b)]
                coords2=[(cx+radius[0]*(scale+.021)*cos(t),y,cz+radius[1]*(scale+.021)*sin(t)) for t in (a,b)]
                m.face("Bright red" if (i//9+tier)%3 else "Red",[coords[0],coords[1],coords2[1],coords2[0]])
                m.face("Arena brick",[coords2[0],coords2[1],(coords2[1][0],y+.17,coords2[1][2]),(coords2[0][0],y+.17,coords2[0][2])])
        X,Z=cx+radius[0]*cos(a),cz+radius[1]*sin(a)
        x2,z2=cx+radius[0]*cos(b),cz+radius[1]*sin(b)
        midx,midz=(X+x2)/2,(Z+z2)/2
        yaw=atan2(cos((a+b)/2),sin((a+b)/2))
        tf=placement(midx,0,midz,yaw)
        chord=sqrt((x2-X)**2+(z2-Z)**2)
        m.box("Arena brick",(0,height/2,-.16),(chord+.02,height,.44),transform=tf)
        m.box("Limestone",(0,height,.10),(chord+.04,.19,.40),transform=tf)
        if i%2==0:
            arch(m,0,.25,.073,chord*.69,min(height-.47,2.95),"Limestone",tf=tf)
        if i%3==0 and not outfield:
            m.box("Ivory",(0,4.41,-.06),(chord+.01,.22,.50),transform=tf)
            m.box("Glass dark",(0,4.15,.204),(chord*.8,.33,.075),transform=tf)
            m.box("Coal",(0,5.52,-.27),(chord+.02,.075,.23),transform=tf)
        if i%4==0 and height>3:
            m.box("Arena brick",(0,height*.72,.25),(.26,height*.59,.36),transform=tf)
    m.lathe("Turf",(cx,.11,cz),[(0,8.9),(.012,8.9)],64,depth=.83)
    for i in range(-5,6):
        z0=i*1.24
        w=2*sqrt(max(1,7.2**2-z0**2))
        m.slab("Mown turf" if i%2 else "Turf",(cx,.132,cz+z0),(w,1.22))
    tf=placement(cx,0,cz+2.25,pi/4)
    m.slab("Infield",(0,.155,0),(5.25,5.25),transform=tf)
    m.slab("Turf",(0,.162,0),(3.95,3.95),transform=tf)
    for x1,z1 in [(-2.61,-2.61),(2.61,-2.61),(-2.61,2.61),(2.61,2.61)]:
        m.slab("Chalk",(x1,.169,z1),(.22,.22),transform=tf)
    m.lathe("Infield",(cx,.154,cz+2.25),[(0,.57),(.02,.57)],16)
    for side in (-1,1):
        xx=cx+side*9.1
        m.lathe("Steel",(xx,4,cz+8),[(0,.14),(4.8,.08)],8)
        m.box("Steel",(xx,8.65,cz+8),(2.3,.43,.24))
        for j in range(7):
            m.box("Bulb",(xx-.94+j*.31,8.65,cz+7.84),(.23,.30,.075))
    board_x, board_z = cx+7.12, cz-9.71
    for x in [board_x-1.59,board_x+1.59]:
        m.box("Steel",(x,3.18,board_z),(.22,3.42,.32))
    m.box("Coal",(board_x,4.72,board_z),(4.85,2.06,.41))
    m.box("Glass dark",(board_x,4.78,board_z+.22),(4.61,1.68,.05))
    for i in range(5):
        m.box("Glass bright",(board_x,4.24+i*.26,board_z+.257),(3.85-i%2*.46,.026,.02))
    m.box("Red",(board_x,5.71,board_z+.24),(4.69,.26,.17))
    m.box("Arena brick",(cx,3.35,cz+11.95),(5.5,3.35,.93))
    m.box("Limestone",(cx,5.06,cz+12.05),(5.73,.22,1.01))
    m.sign("Stadium sign",(cx,4.65,cz+12.47),(5.0,.6))


def ballpark(group):
    m=Meshes()
    stadium(m,1.8,10.5)
    for x,w,fl,tint in [(-8.3,7,3,"Red"),(-1.65,6,2,"Navy"),(4.28,5.6,3,"Red"),(10.95,7.2,2,"Red")]:
        storefront(m,x,-11.75,w,6.9,fl,"Arena brick",tint,int(x*10))
    m.box("Arena brick",(5.18,3.38,-8.3),(7.67,2.43,1.01))
    m.sign("Village sign",(5.18,3.66,-7.77),(7.2,.80))
    for x in [-9,-7.15,-3.6,-1.7,.1,9.0,11.4,13.3]:
        m.lathe("Terrace",(x,.06,-6.65),[(0,.45),(.08,.36),(.67,.10),(.71,.54),(.77,.54)],16)
        m.lathe("Coal",(x,.05,-6.65),[(0,.05),(1.60,.04)],8)
        m.lathe("Red" if x<0 else "Cream",(x,1.58,-6.65),[(0,.77),(.09,.77),(.28,.11)],12)
    # One Cardinal Way is behind the northern frontage.
    x,z,w,d=14.75,-15.5,6.25,5.55
    m.box("Dark brick",(x,1.26,z),(w+.55,2.52,d+.53))
    m.box("Glass dark",(x,8.22,z),(w,14.48,d))
    for i in range(21):
        y=2.35+i*.65
        for j in range(6):
            window(m,x-2.64+j*1.05,y,z+d/2+.015,.91,.51,"Steel",tint=["Glass","Glass dark","Glass light"][(i+j)%3],cross=False)
        for sign in [-1,1]:
            f=placement(x+sign*w/2,0,z,sign*pi/2)
            for j in range(5):
                window(m,-2.16+j*1.07,y,.014,.92,.51,"Steel",tf=f,tint=["Glass","Glass light","Glass dark"][(i+j)%3],cross=False)
        if i%2==0:
            m.box("Light metal",(x-1.6,y-.33,z+d/2+.21),(2.05,.08,.56))
            m.box("Steel",(x-1.60,y-.18,z+d/2+.47),(2.05,.23,.07))
    for q in [-2.65,0,2.65]:
        m.box("Light metal",(x+q,8.75,z+d/2+.13),(.15,13.85,.19))
    m.box("Coal",(x,15.56,z),(w+.23,.27,d+.22))
    from district_buildings import sports_neighbors
    sports_neighbors(m, False)
    m.build("Busch Stadium, plaza and One Cardinal Way",group)


def forestry_hill(mesh):
    # The museum terrace and Art Hill rise south of the Grand Basin.
    for index in range(16):
        z, Z = -5 + index*1.02, -5 + (index+1)*1.02
        def height(distance):
            fraction = max(0, min(1, (distance+5)/14))
            return .04 + 2.36*fraction*fraction*(3-2*fraction)
        for col in range(8):
            x, X = -23+col*5.75,-23+(col+1)*5.75
            def y(px,pz):
                return .025 + height(pz) * (1-min(1,max(0,(abs(px)-16)/7))**1.55)
            def point(px, pz):
                # Pull the east slope in from Grand Drive and let it widen into the museum terrace.
                taper = max(0, min(1, (pz-3)/8))
                east_edge = 10.85 + 5.5*taper*taper*(3-2*taper)
                return (px * east_edge / 23 if px > 0 else px, y(px, pz), pz)
            mesh.face("Grass slope", [point(x,Z),point(X,Z),point(X,z),point(x,z)],shade=.94+index%2*.035)
    mesh.box("Terrace",(0,1.19,11.4),(29.7,2.42,6.1))
    for x in (-15,10):
        for i in range(15):
            z=-3.9+i*.99
            rise=2.35*(i/14)**2
            strip(mesh,"Terrace",(x,.13+rise,z),(x,.13+2.35*((i+1)/14)**2,z+.99),.89,.08)


def forest(group):
    m=Meshes()
    forestry_hill(m)
    tf=placement(0,2.39,12.12,pi)
    m.box("Ivory",(0,2.25,-3.7),(24.5,4.5,8.23),transform=tf)
    m.box("Slate",(0,4.59,-3.81),(24.65,.31,7.86),transform=tf)
    m.box("Limestone",(0,2.76,-.26),(12.1,5.53,2.23),transform=tf)
    m.box("Ivory",(0,5.64,.89),(12.6,.34,.46),transform=tf)
    m.box("Limestone",(0,6.03,.18),(10.9,.45,2.53),transform=tf)
    m.box("Ivory",(0,6.31,.19),(11.5,.17,2.61),transform=tf)
    for x in [-9.7,-7.91,-4.92,-1.63,1.63,4.92,7.91,9.7]:
        height = 4.34 if abs(x)>6 else 4.92
        m.lathe("Limestone",(x,.28,.87),[(0,.28),(.19,.27),(.31,.20),(height-.22,.18),(height-.13,.23),(height,.26)],
                sides=12,transform=tf)
        m.box("Ivory",(x,height+.25,.87),(.59,.17,.60),transform=tf)
    for x in (-3.28,0,3.28):
        arch(m,x,.19,.903,2.36,4.05,"Ivory",tf=tf)
        m.box("Coal",(x,.86,1.01),(1.06,1.70,.15),transform=tf)
        m.box("Light metal",(x,.87,1.098),(.034,1.68,.034),transform=tf)
    for x in (-11,-8.65,8.65,11):
        window(m,x,2.67,.46,1.36,2.08,"Ivory",tf=tf,tint="Glass dark")
    m.sign("Art sign",(0,5.59,1.136),(8.5,.23),transform=tf)
    for i in range(8):
        m.box("Limestone",(0,(i+1)*.105/2,3.58-i*.31),(13.55,(i+1)*.105,.34),transform=tf)
    m.box("Terrace",(0,.09,2.21),(20.5,.18,4.15),transform=tf)
    # The basin broadens toward the promenade, with a flatter edge at Art Hill.
    def shoreline(angle, scale=1):
        shape=1+.095*sin(angle)-.04*cos(angle*2)
        return (10.7*scale*shape*cos(angle),-14+9.65*scale*shape*sin(angle))

    for surface, scale, y in [("Limestone",1,.079),("Water",.976,.084),("Water dark",.942,.088)]:
        points=[shoreline(i*2*pi/72,scale) for i in range(72)]
        m.face(surface,[(x,y,z) for x,z in points[::-1]])
    for i in range(4):
        m.box("Terrace",(0,.16+i*.028,-23.7-i*.24),(5.4,.23,.29))
    for x in (-2.64,2.64):
        m.box("Limestone",(x,.48,-24.08),(.22,.44,2.66))
        for z in (-25.42,-22.75):
            m.box("Ivory",(x,.53,z),(.44,.79,.46))
            m.box("Limestone",(x,.95,z),(.52,.13,.55))
    for i in range(29):
        x=-8.8+i*.63
        z=-3.23-(x*.061)**2
        m.box("Limestone",(x,.23,z),(.118,.36,.17))
        m.box("Ivory",(x,.425,z),(.66,.084,.24))
    for x in (-4.6,-1.7,1.7,4.6):
        for z in (-15.4,-10.7):
            m.lathe("Water light",(x,.103,z),[(0,.51),(.011,.51)],22)
            m.lathe("Water spray",(x,.104,z),[(0,.12),(.24,.097),(.91,.039),(1.18,.012)],8)
            for i in range(5):
                angle = i*2*pi/5
                curve=[(x+.065*cos(angle),.22,z+.065*sin(angle)),(x+.23*cos(angle),.66,z+.23*sin(angle)),
                       (x+.38*cos(angle),.37,z+.38*sin(angle))]
                for A,B in zip(curve,curve[1:]):
                    strip(m,"Water spray",A,B,.044,.037)
    for i in range(72):
        a,b=i*2*pi/72,(i+1)*2*pi/72
        x,z=shoreline(a,1.035)
        X,Z=shoreline(b,1.035)
        strip(m,"Terrace",(x,.10,z),(X,.10,Z),1.08,.12)
        if i%2==0:
            x,z=shoreline(a,.875)
            X,Z=shoreline(b,.873)
            strip(m,"Water light",(x,.093,z),(X,.093,Z),.028,.0)
    from district_buildings import east_museum
    east_museum(m)
    m.build("Art Hill, Saint Louis Art Museum and Grand Basin",group)


def crenellation(mesh,x,z,w,d,y):
    mesh.box("Ivory",(x,y,z),(w+.22,.19,d+.22))
    for a in range(7):
        dx=(a-3)*w/6
        for sign in (-1,1):
            mesh.box("Limestone",(x+dx,y+.22,z+sign*d/2),(w*.10,.34,.28))
    for a in range(1,6):
        for sign in (-1,1):
            mesh.box("Limestone",(x+sign*w/2,y+.22,z+(a-3)*d/6),(.28,.34,d*.10))


def collegiate_wing(m,x,z,w,d,h):
    m.box("Granite",(x,h/2,z),(w,h,d))
    cap(m,"Slate",x,z,h+.075,w+.25,d+.26,1.8)
    bands(m,x,z,w,d,[(.23,.40,.17),(2.23,.105,.13),(h-.14,.19,.23)])
    for side in (-1,1):
        face=placement(x,0,z+side*d/2,0 if side==1 else pi)
        for col in range(max(3,round(w/1.21))):
            n=max(3,round(w/1.21))
            u=(col-(n-1)/2)*(w-.25)/n
            for y in (1.31,3.20):
                window(m,u,y,.014,.59,.91,"Limestone",tf=face,tint="Glass dark")
            m.box("Limestone",(u,3.84,.055),(.41,.118,.17),transform=face)
        for u in (-w*.44,w*.44):
            m.box("Limestone",(u,h/2,.09),(.27,h,.24),transform=face)


def washu(group):
    m=Meshes()
    collegiate_wing(m,-8.65,-2.0,11.3,6.7,4.61)
    collegiate_wing(m,8.65,-2.0,11.3,6.7,4.61)
    for x in (-13.3,13.3):
        collegiate_wing(m,x,-7.8,3.2,5.9,4.31)
    for x in (-3.16,3.16):
        for z in (.46,-4.2):
            h=8.1 if z>0 else 7.22
            m.box("Granite",(x,h/2,z),(2.63,h,2.88))
            bands(m,x,z,2.63,2.88,[(.28,.40,.17),(4.4,.12,.14),(h-.65,.13,.14)])
            crenellation(m,x,z,2.78,3.02,h-.06)
            for sign in (-1,1):
                face=placement(x,0,z+sign*1.46,0 if sign==1 else pi)
                for y in (2.05,4.0,6.05):
                    arch(m,0,y-.65,.042,.81,1.31,"Limestone",tf=face,pointed=True)
                for col in (-1,1):
                    m.box("Limestone",(col*1.23,h/2,.079),(.19,h-.2,.21),transform=face)
    m.box("Granite",(0,4.89,-.72),(3.95,2.1,3.9))
    m.box("Limestone",(0,6.01,-.72),(4.1,.24,4.08))
    for i in range(9):
        m.box("Limestone",(-1.86+.465*i,6.23,1.24),(.24,.25,.25))
    for x in (-1.47,1.47):
        m.box("Granite",(x,1.63,-.45),(.75,3.23,3.99))
    arch(m,0,.125,-2.22,2.45,3.48,"Limestone",pointed=True)
    for x in (-1.47,1.47):
        m.box("Limestone",(x,1.40,1.33),(.23,2.8,.20))
    for x in (-.80,0,.8):
        window(m,x,5.06,1.28,.55,1.12,"Limestone",tint="Glass dark")
    m.sign("WashU sign",(0,3.69,1.34),(2.48,.38))
    stairs(m,0,3.77,5.91,8,.075,.28)
    # Brookings Hall faces east along the axis toward Tisch Park.
    for surface, faces in list(m.parts.items()):
        m.parts[surface] = [([(z,y,-x) for x,y,z in points],shade,uv,smooth,bone)
                            for points,shade,uv,smooth,bone in faces]
    from district_buildings import east_end
    east_end(m)
    m.build("Brookings Hall and Danforth East End",group)


def umsl(group):
    m=Meshes()
    m.box("Dark brick",(-1.6,3.03,-2.06),(18.15,6.06,11.3))
    m.box("Arena brick",(-4.8,4.01,-4.65),(9.4,8.03,8.4))
    m.box("Slate",(-4.8,8.13,-4.65),(9.7,.19,8.54))
    for i in range(16):
        x=-9.23+i*.54
        h=8.12 + 1.12*sqrt(max(0,1-((x+5.18)/4.4)**2))
        m.box("Slate",(x,h,-4.67),(.55,.29,7.91))
    curved_front(m,(-1.0,3.10),8.1,5.26,.25,5.64,0,pi,26,"Steel")
    m.box("Limestone",(-1.0,5.96,3.58),(16.65,.46,.38))
    for i in range(11):
        x=-5.47+i*.83
        window(m,x,1.10,7.89-.038*(x+1.3)**2,.74,1.85,"Steel",tint="Glass dark")
    m.box("Dark brick",(7.8,3.16,-.17),(4.9,6.32,9.16))
    for i in range(7):
        window(m,6.1+i*.53,4.2,4.44,.39,1.24,"Ivory",tint="Glass dark")
    m.sign("UMSL sign",(7.76,2.2,4.50),(4.10,1.24))
    stairs(m,-.5,9.8,12.4,4,.092,.39,surface="Terrace")
    from district_buildings import umsl_campus
    umsl_campus(m)
    m.build("Touhill Performing Arts Center and North Campus",group)
