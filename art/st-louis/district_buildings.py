"""Distinct secondary landmarks, storefronts and civic buildings."""

from math import cos, pi, sin
from random import Random

from meshkit import Meshes, lettered, material, placement, wash
from architecture import arch, cap, curved_front, stairs, strip, window


def detail_surfaces():
    for i,(name,color,accent,kind) in enumerate([
        ("Buff brick","#caa480","#a27b63","brick"),("Umber brick","#926a54","#604b3f","brick"),
        ("White concrete","#bfb9a8","#868c82","stone"),("Plaster","#e4c7a8","#ac8d77","stone"),
        ("Charcoal concrete","#525c57","#343b38","stone"),("Green tile","#5a7c67","#3d584b","roof"),
    ]):
        material(name,texture=wash(name,color,accent,kind,554+i,size=192))
    for name,color in [("Blue steel","#577a8b"),("Stainless","#9caeb0"),("Copper trim","#8e6d5b"),
                       ("Leaf bronze","#6f674d"),("Sun awning","#d5a056"),("Teal cloth","#587f72"),
                       ("Rose cloth","#a66463"),("Cream tile","#e8d4b1"),("Seat wood","#b98458")]:
        material(name,color,rough=.46 if name in ("Blue steel","Stainless") else .82)
    for name,title,palette in [
        ("Moonrise sign","MOONRISE",("#2a4759","#f1dfac")),
        ("Pageant sign","THE PAGEANT",("#623735","#f5ce79")),
        ("Kemper sign","KEMPER ART MUSEUM",("#4b5554","#fff2cf")),
        ("Sumers sign","SUMERS WELCOME CENTER",("#495951","#f1dec0")),
        ("Schnuck sign","SCHNUCK PAVILION",("#4d6052","#f3e3c5")),
        ("Student sign","MILLENNIUM STUDENT CENTER",("#572e31","#f5dfb8")),
        ("Jefferson sign","THOMAS JEFFERSON LIBRARY",("#5c413d","#f4dfbb")),
        ("Loews sign","LIVE! BY LOEWS",("#51453f","#f5e1b7")),
        ("Kiel sign","KIEL CENTER GARAGE",("#34434d","#eee2c1")),
        ("East building sign","EAST BUILDING",("#46524c","#f3e3c8")),
        ("Soldiers sign","SOLDIERS MEMORIAL",("#8d7c64","#fff0d0")),
    ]:
        material(name,texture=lettered(name,title,palette))


def awning(m,x,y,z,w,depth,tone,tf):
    m.face(tone,[(x-w/2,y-.20,z+depth),(x+w/2,y-.20,z+depth),(x+w/2,y+.08,z),(x-w/2,y+.08,z)],transform=tf)
    m.box(tone,(x,y-.24,z+depth),(w,.16,.075),transform=tf)
    for edge in [-1,1]:
        m.box("Steel",(x+edge*w*.475,y-.23,z+depth*.49),(.045,.055,depth),transform=tf)


def delmar_shop(m,x,z,w,d,style,seed,facing=0):
    """Separate shop types use different massing and street-level treatment."""
    tf=placement(x,0,z,facing)
    rng=Random(seed)
    wall, trim, canopy = {
        "bay":("Loop brick","Cream tile","Teal cloth"),
        "diner":("Plaster","Ivory","Rose cloth"),
        "studio":("Buff brick","Limestone","Navy"),
        "arcade":("Dark brick","Limestone","Sun awning"),
        "corner":("Umber brick","Ivory","Teal cloth"),
    }[style]
    h={"bay":4.62,"diner":2.69,"studio":5.9,"arcade":3.85,"corner":5.18}[style]
    front=d/2
    m.box(wall,(0,h/2,0),(w,h,d),transform=tf)
    m.box("Loop roof",(0,h+.035,0),(w-.14,.09,d-.12),transform=tf)
    m.box(trim,(0,h-.10,front+.021),(w+.19,.19,.23),transform=tf)
    m.box(wall,(0,h+.18,front+.02),(w+.17,.22,.25),transform=tf)
    for side in (-1,1):
        m.box(wall,(side*(w/2-.13),h/2,front+.15),(.28,h,.29),transform=tf)
    rear=placement(0,0,-front,pi)
    back=lambda point: tf(rear(point))
    # Service sides and rooflines are visible when the player rotates.
    for a in [-1,1]:
        if style in ("studio","corner"):
            for y in (2.95,4.51):
                if y<h-.22:
                    window(m,a*w*.24,y,.023,.53,.88,trim,back,tint="Glass dark")
            m.box("Steel",(a*w*.27,.87,.078),(.67,1.56,.10),transform=back)
        if style in ("bay","studio"):
            m.box("Copper trim",(a*w*.16,h*.49,.082),(.058,h*.96,.078),transform=back)
    if style=="arcade":
        for n in (-1,1):
            arch(m,n*w*.23,.12,.042,.77,1.39,trim,tf=back)
        m.box("Glass dark",(0,h+.22,.65),(1.23,.43,.82),transform=back)
        m.box("Limestone",(0,h+.46,.65),(1.29,.08,.86),transform=back)
    if style=="corner":
        m.box("Umber brick",(-w*.29,h-.12,-d*.27),(w*.31,.95,1.44),transform=tf)
        cap(m,"Green tile",-w*.29,-d*.27,h+.34,w*.36,1.54,.51,tf)
    if style=="diner":
        m.box("Steel",(0,.46,front+.13),(w-.58,.50,.18),transform=tf)
        for i in range(5):
            cx=(i-2)*w*.175
            window(m,cx,1.28,front+.071,w*.145,1.22,"Cream tile",tf,tint="Amber glass")
        awning(m,0,2.18,front+.12,w-.41,1.03,canopy,tf)
        for i in (-1, 1):
            m.box("Loop roof",(i*w*.255,h+.19,-d*.25),(.61,.23,.83),transform=tf)
        return
    if style=="corner":
        m.box(wall,(w*.27,h*.63,front-.4),(w*.42,h*.92,1.24),transform=tf)
        m.box("Ivory",(w*.27,h*1.09,front-.34),(w*.45,.19,1.37),transform=tf)
        m.box("Green tile",(w*.28,h*1.15,front-.34),(w*.41,.17,1.29),transform=tf)
    n=max(2,round(w/1.36))
    for i in range(n):
        cx=(i-(n-1)/2)*(w-.31)/n
        if style=="arcade":
            arch(m,cx,.18,front+.063,(w-.85)/n,1.73,trim,tf=tf)
        else:
            window(m,cx,.99,front+.036,(w-.45)/n-.16,1.56,"Steel",tf,tint="Amber glass" if i%3==0 else "Glass dark")
        if style=="bay" and i%2==0:
            m.box(trim,(cx,3.04,front+.116),(.97,1.41,.43),transform=tf)
            window(m,cx,3.07,front+.36,.67,1.14,trim,tf,tint="Glass dark")
            m.box("Copper trim",(cx,3.86,front+.125),(1.09,.18,.51),transform=tf)
        elif style=="arcade":
            window(m,cx,2.70,front+.051,.55,.70,trim,tf)
        else:
            for y in (3.0,4.59) if style=="studio" else (3.21,):
                window(m,cx,y,front+.044,.61,1.16,trim,tf,tint="Glass light" if i%2 else "Glass dark")
    if style in ("bay","arcade"):
        for side in (-1,1):
            awning(m,side*w*.24,2.15,front+.10,w*.43,.77,canopy,tf)
    else:
        m.box(trim,(0,2.13,front+.36),(w-.41,.22,.65),transform=tf)
    for side in (-1,1):
        side_tf=placement(side*w/2,0,0,side*pi/2)
        for j in range(3):
            window(m,(j-1)*d*.25,2.8,.032,.63,.99,trim,lambda p:tf(side_tf(p)),tint="Glass dark")
    m.box("Roof",(-w*.23,h+.28,-d*.18),(1.19,.40,1.04),transform=tf)
    if rng.random()>.43:
        m.box(wall,(w*.24,h+.38,-d*.32),(.58,.76,.57),transform=tf)
        m.box(trim,(w*.24,h+.77,-d*.32),(.65,.12,.66),transform=tf)


def delmar_east(m):
    # The Moonrise stands just west of The Pageant, on the north side of the street.
    x,z,w,d=20.0,-9.0,6.8,8.0
    m.box("Loop brick",(x,3.89,z),(w,7.78,d))
    m.box("Limestone",(x,1.04,z+d/2+.04),(w+.20,2.08,.25))
    m.box("Blue steel",(x+.90,5.0,z+d/2+.091),(3.4,4.87,.28))
    for floor in range(6):
        for j in range(5):
            window(m,x-2.71+j*1.29,1.23+floor*1.073,z+d/2+.105,.84,.64,
                   "Limestone",tint=["Glass","Glass dark","Glass light"][(floor+j)%3],cross=False)
    m.box("Coal",(x,7.93,z),(w+.28,.26,d+.24))
    for side in (-1,1):
        f=placement(x+side*w/2,0,z,side*pi/2)
        for level in range(5):
            for i in range(5):
                window(m,-3.05+i*1.46,2.31+level*1.06,.026,.81,.61,"Limestone",f,tint="Glass dark",cross=False)
    for i in range(5):
        window(m,x-2.62+i*1.31,4.48,z-d/2-.02,.82,.69,"Limestone",tf=None,tint="Glass dark",cross=False)
    m.box("Glass dark",(x+1.53,8.49,z-1.09),(2.55,1.08,3.3))
    m.box("Light metal",(x+1.53,9.07,z-1.09),(2.8,.16,3.56))
    m.lathe("Steel",(x-1.48,8.04,z+1.03),[(0,.22),(.83,.14)],12)
    m.ball("Cream",(x-1.48,9.63,z-.61),(1.65,1.65,1.65),sides=24)
    for dx,dy in [(-.23,.18),(.22,-.09),(-.14,-.25)]:
        m.ball("Limestone",(x-1.48+dx,9.63+dy,z+.12),(.19,.16,.062),sides=9)
    m.sign("Moonrise sign",(x,1.94,z+d/2+.215),(4.16,.32))
    for i in range(8):
        m.box("Steel",(x-3.04+i*.86,8.24,z+d/2-.20),(.044,.56,.045))
    m.box("Steel",(x,8.52,z+d/2-.20),(6.3,.047,.052))

    x,z=28.75,-9.65
    m.box("Dark brick",(x,2.69,z),(9.72,5.38,9.68))
    m.box("Roof",(x,5.45,z-.3),(9.62,.16,8.94))
    m.box("Plaster",(x,3.62,z+4.84),(8.51,3.63,.31))
    profile=[(x+4.25*cos(i*pi/20),5.38+.86*sin(i*pi/20)) for i in range(21)]
    m.relief("Limestone",profile,[z+4.7,z+5.02])
    for i in range(5):
        px=x-3.32+i*1.65
        window(m,px,.96,z+4.96,1.08,1.61,"Steel",tint="Glass dark")
        if i in (0,4):
            arch(m,px,2.64,z+5.02,.86,1.52,"Ivory")
    m.box("Navy",(x,2.22,z+5.59),(6.28,.58,1.22))
    m.sign("Pageant sign",(x,2.25,z+6.21),(5.94,.47))
    for i in range(21):
        m.box("Bulb",(x-2.91+i*.29,1.94,z+6.17),(.044,.039,.047))


def east_end(m):
    """The glass pavilions and faceted museum set a second architectural language on campus."""
    for x,z,sign,h in [(20.6,13.4,"Sumers sign",2.46),(20.6,-13.9,"Schnuck sign",2.27)]:
        w,d=9.40,6.0
        m.box("Terrace",(x,.10,z),(w+1.45,.20,d+1.15))
        m.box("Glass",(x,h/2,z),(w,h,d))
        m.box("Charcoal concrete",(x,h+.17,z),(w+1.4,.34,d+1.10))
        m.box("Light metal",(x,h+.38,z),(w+.69,.09,d+.37))
        for side in (-1,1):
            for i in range(14):
                m.box("Steel",(x-w/2+.13+i*.70,h/2,z+side*(d/2+.025)),(.048,h,.068))
            for i in range(9):
                m.box("Steel",(x+side*(w/2+.022),h/2,z-d/2+.15+i*.71),(.067,h,.047))
            m.box("Light metal",(x,h*.63,z+side*(d/2+.04)),(w,.039,.068))
        for i in range(7):
            m.box("Seat wood",(x-w*.4+i*1.18,.09,z+d/2+.43),(.64,.16,.21))
        m.sign(sign,(x,h-.14,z+d/2+.079),(4.7,.27))
    x,z,w,d,h=32.6,11.55,10.2,8.2,5.3
    m.box("White concrete",(x,h/2,z),(w,h,d))
    m.box("Charcoal concrete",(x,h+.09,z),(w+.05,.18,d+.13))
    m.box("Ivory",(x-3.05,h*.45,z+d/2+.03),(3.97,h*.90,.18))
    m.box("Glass dark",(x-2.82,1.63,z+d/2+.17),(3.9,2.27,.14))
    m.sign("Kemper sign",(x-2.83,3.01,z+d/2+.20),(3.85,.36))
    for i in range(12):
        a=x-1.1+i*.53
        depth=(i%2)*.23
        m.face("Stainless" if i%3 else "Glass bright",[(a,.18,z+d/2+.14),(a+.53,.18,z+d/2+.14),
                (a+.53,h-.04,z+d/2+.14+depth),(a,h-.04,z+d/2+.14+.23-depth)],shade=.80+i%4*.045)
    for i in range(5):
        px=x-3.76+i*.87
        m.box("Glass light",(px,h+.35,z-1.32),(.57,.48,1.26))
        m.box("Steel",(px,h+.63,z-1.33),(.62,.12,1.31))
    stairs(m,x-2.79,z+d/2+1.1,4.56,4,.09,.22,surface="Terrace")


def umsl_campus(m):
    """Millennium's rounded front and the library's concrete wings and pyramid."""
    x,z=6.7,20.0
    m.box("Dark brick",(x-1.5,2.68,z-1.16),(11.32,5.36,6.2))
    m.box("Roof",(x-1.5,5.43,z-1.18),(11.4,.18,6.35))
    curved_front(m,(x+1.04,z+1.28),4.83,3.32,.31,4.75,0,pi,23,"Light metal")
    m.lathe("Arena brick",(x+3.02,.1,z-2.28),[(0,1.37),(6.96,1.37),(7.14,1.24)],16)
    m.lathe("Copper",(x+3.02,7.24,z-2.28),[(0,1.46),(.13,1.46),(.62,1.13)],16)
    for i in range(12):
        a=i*pi/6
        tf=placement(x+3.02+1.31*cos(a),0,z-2.28+1.31*sin(a),pi/2-a)
        window(m,0,6.14,.05,.36,.76,"Limestone",tf=tf,cross=False)
    m.sign("Student sign",(x-2.79,3.37,z+2.06),(3.85,.36))
    # Campus bridge from the student center toward the academic quad.
    m.box("Steel",(-.53,2.58,z+.25),(10.7,.34,2.07))
    m.box("White concrete",(-6.8,1.84,z+.25),(2.83,3.68,2.76))
    m.box("Glass dark",(-6.8,1.59,z+1.67),(1.94,2.59,.083))
    m.box("Terrace",(-6.8,3.78,z+.25),(3.03,.20,2.97))
    m.box("Light metal",(-6.8,.42,z+1.94),(2.91,.17,.57))
    m.box("Charcoal concrete",(x-3.92,5.57,z-1.56),(3.34,.28,3.19))
    for i in range(7):
        px=x-5.63+i*.74
        window(m,px,3.53,z-4.29,.51,1.13,"Limestone",tint="Glass dark",cross=False)
        m.box("Limestone",(px,4.27,z-4.24),(.51,.10,.081))
    for side in (-1,1):
        m.box("Glass light",(-.53,3.12,z+.25+side*.94),(10.63,.83,.082))
        for i in range(15):
            m.box("Light metal",(-5.65+i*.73,3.13,z+.25+side*.98),(.052,.89,.055))
    m.box("Light metal",(-.53,3.63,z+.25),(10.75,.13,2.13))
    for px in [-4.85,2.3]:
        m.box("White concrete",(px,1.25,z+.25),(.37,2.50,.46))

    x,z=-14.7,19.8
    m.box("White concrete",(x,2.05,z),(12.6,4.10,8.2))
    m.box("Charcoal concrete",(x,4.21,z),(12.78,.22,8.35))
    m.box("White concrete",(x+2.18,4.58,z+.52),(5.73,.59,4.36))
    m.box("Limestone",(x+2.18,4.94,z+.52),(5.97,.17,4.61))
    for i in range(7):
        m.box("Steel",(x-.39+i*.82,4.64,z+2.727),(.54,.168,.071))
    for side in (-1,1):
        for i in range(4):
            m.box("White concrete",(x+side*6.36,2.38,z-2.96+i*1.96),(.29,3.47,.14))
    for direction in (-1,1):
        for i in range(16):
            px=x-5.88+i*.782
            m.box("Glass dark",(px,2.68,z+direction*4.106),(.67,1.54,.08))
            m.box("White concrete",(px+.34,2.58,z+direction*4.16),(.125,2.02,.31))
    m.box("Glass dark",(x,1.08,z-4.19),(4.9,1.88,.24))
    for i in range(7):
        m.box("Light metal",(x-2.22+i*.74,1.11,z-4.34),(.059,1.92,.095))
    front=placement(x,0,z-4.37,pi)
    m.sign("Jefferson sign",(0,2.21,.014),(5.17,.42),transform=front)
    m.box("Limestone",(x,2.37,z-4.62),(5.44,.20,.84))
    m.box("Terrace",(x,.115,z-5.65),(7.23,.23,2.31))
    px,pz=x-4.38,z-1.58
    for i in range(4):
        a=i*pi/2
        A=(px+1.52*cos(a)-1.52*sin(a),4.38,pz+1.52*sin(a)+1.52*cos(a))
        b=(i+1)*pi/2
        B=(px+1.52*cos(b)-1.52*sin(b),4.38,pz+1.52*sin(b)+1.52*cos(b))
        m.face("Glass light",[B,A,(px,6.43,pz)],shade=.79+i*.042)
        strip(m,"Light metal",A,(px,6.43,pz),.064,.041)
    m.box("Steel",(px,4.42,pz),(3.18,.15,3.18))


def sports_neighbors(m,arena):
    if arena:
        # The open deck bays make the west parking structure read separately from the arena.
        x,z=-17.2,1.2
        m.box("Charcoal concrete",(x,1.82,z),(7.75,3.64,17.5))
        for i in range(5):
            y=.22+i*.91
            m.box("White concrete",(x,y,z),(8.14,.17,17.8))
            for side in (-1,1):
                for j in range(9):
                    m.box("White concrete",(x+side*4.03,y+.31,z-8+j*2),(.13,.63,.15))
                m.box("Light metal",(x+side*4.025,y+.4,z),(.11,.055,17.74))
        m.box("Terrace",(x,3.98,z),(8.1,.19,17.85))
        m.sign("Kiel sign",(x,3.45,z+8.94),(4.55,.43))
        m.box("Ivory",(x,2.78,z+8.83),(7.79,.16,.14))
    else:
        # Brick piers, a glazed lobby and roof setbacks at the west end of the Village.
        x,z,w,d=-16.1,-13.3,7.7,7.55
        m.box("Arena brick",(x,3.76,z),(w,7.52,d))
        m.box("Coal",(x,7.66,z),(w+.12,.29,d+.13))
        m.box("Roof",(x+.64,8.05,z-1.3),(w-2.15,.51,d-3.2))
        for i in range(7):
            px=x-3.29+i*1.10
            window(m,px,1.04,z+d/2+.045,.94,1.73,"Steel",tint="Glass light",cross=False)
            for floor in range(5):
                window(m,px,2.47+floor*.96,z+d/2+.055,.65,.64,"Copper trim",tint="Glass dark",cross=False)
            m.box("Dark brick",(px+.41,4.24,z+d/2+.19),(.20,5.57,.30))
        m.box("Limestone",(x,2.12,z+d/2+.57),(w+.17,.21,1.29))
        m.sign("Loews sign",(x,2.37,z+d/2+1.2),(4.69,.42))
        for side in (-1,1):
            tf=placement(x+side*w/2,0,z,side*pi/2)
            for i in range(5):
                for floor in range(6):
                    window(m,-2.83+i*1.39,.95+floor*1.05,.01,.82,.68,"Copper trim",tf=tf,tint="Glass dark",cross=False)


def east_museum(m):
    x,z,y=16.65,16.9,1.20
    m.box("Charcoal concrete",(x,y+2.16,z),(9.28,4.32,8.12))
    m.box("Coal",(x,y+4.48,z-.19),(10.17,.31,8.47))
    m.box("Glass dark",(x,y+1.84,z-4.09),(8.86,3.42,.15))
    for i in range(9):
        px=x-4.17+i*1.04
        m.box("Light metal",(px,y+1.81,z-4.21),(.072,3.55,.085))
        m.box("Glass light",(px+.38,y+2.45,z-4.19),(.55,1.43,.061),shade=.74+i%4*.051)
    for i in range(3):
        for j in range(3):
            m.box("Coal",(x-2.76+j*2.76,y+4.7,z-2.31+i*2.1),(1.84,.29,1.21))
            m.box("Glass light",(x-2.76+j*2.76,y+4.87,z-2.31+i*2.1),(1.50,.048,.97))
    tf=placement(x,0,z-4.27,pi)
    m.sign("East building sign",(0,y+4.13,.031),(4.09,.32),transform=tf)
    for i in range(8):
        m.box("Terrace",(x,(i+1)*y/16,z-6.41+i*.28),(9.5,(i+1)*y/8,.315))


def civic_details(group):
    m=Meshes()
    # Soldiers Memorial's low limestone wings and four sculptural pylons.
    x,z=31.0,46.8
    m.box("Limestone",(x,1.57,z),(8.93,3.14,5.0))
    m.box("Ivory",(x,3.20,z),(9.17,.19,5.25))
    m.box("Roof",(x,3.34,z),(8.86,.11,4.99))
    m.box("Ivory",(x,2.69,z+.14),(3.2,2.06,4.88))
    m.box("Glass dark",(x,1.42,z+2.61),(1.89,2.29,.13))
    m.sign("Soldiers sign",(x,2.81,z+2.697),(2.81,.34))
    stairs(m,x,z+3.93,5.10,6,.092,.19)
    for side in (-1,1):
        for j in [-1,1]:
            px=x+side*2.03
            pz=z+j*2.94
            m.box("Ivory",(px,.75,pz),(.82,1.50,.88))
            m.box("Limestone",(px,1.60,pz),(.58,.23,.64))
            m.ball("Limestone",(px,1.97,pz),(.41,.58,.46),sides=8)
        for off in [-3.43,-2.75,2.75,3.43]:
            window(m,x+off,1.55,z+side*2.54,.53,1.26,"Ivory")
    for surface,faces in list(m.parts.items()):
        m.parts[surface]=[([(px,y,z+(pz-z)*.60) for px,y,pz in points],shade,uv,smooth,bone)
                          for points,shade,uv,smooth,bone in faces]
    m.build("Soldiers Memorial on Chestnut",group)
