"""Reusable Blender meshes for traffic, shade trees and animated pedestrians."""

from math import cos, pi, sin
from random import Random

from meshkit import Meshes, material, placement
from people import animate, armature, head, people_surfaces, wardrobe


def surfaces():
    for name, color in {
        "Car paint": "#ad5548", "Utility paint": "#527781", "Car glass": "#496c78",
        "Car glint": "#91aeb0", "Tire": "#363a37", "Alloy": "#b3b4a9",
        "Wheel dark": "#606c69", "Brake": "#ae4035", "Headlight": "#f5e7b2",
        "Trolley red": "#9d4943", "Trolley cream": "#e4c890", "Trolley roof": "#4f625d",
        "Bark": "#63513b", "Oak deep": "#557540", "Oak green": "#688d48",
        "Oak light": "#84a654", "Oak tips": "#a3b65e", "Autumn leaf": "#b79b50",
        "Brass": "#bd9c61", "Granite base": "#8d8175",
    }.items():
        material(name,color,rough=.37 if "glass" in name.lower() or "paint" in name else .79)
    people_surfaces()


def hull(m, mats, rings):
    cross = [(-.91,0),( .91,0),(1,.25),(.96,.73),(.74,1),(-.74,1),(-.96,.73),(-1,.25)]
    loops=[[(w*x,y+h*v,z) for x,v in cross] for z,y,w,h in rings]
    for i,(a,b) in enumerate(zip(loops,loops[1:])):
        for side in range(len(a)):
            j=(side+1)%len(a)
            surface = mats(i,side)
            m.face(surface,[a[side],b[side],b[j],a[j]],shade=.91+.085*(side in (3,4,5)))
    m.face(mats(0,0),loops[0][::-1])
    m.face(mats(len(loops)-2,0),loops[-1])


def vehicle(group, utility=False):
    m=Meshes()
    paint="Utility paint" if utility else "Car paint"
    length=1.54 if utility else 1.42
    hull(m,lambda i,s: paint, [
        (-length,.38,.55,.31),(-length+.13,.30,.68,.46),(-.83,.31,.725,.50),
        (.79,.31,.722,.49),(length-.12,.32,.69,.38),(length,.37,.60,.25),
    ])
    cabin=[(-1.17,.73,.62,.14),(-.79,.74,.655,.59),(.17,.76,.645,.60),(.57,.77,.575,.20)]
    if not utility:
        cabin=[(-.94,.74,.62,.09),(-.48,.78,.614,.51),(.26,.79,.601,.49),(.72,.77,.59,.14)]
    hull(m,lambda i,s: paint if s in (0,4) else "Car glass",cabin)
    for side in [-1,1]:
        for z in [-.70,.76]:
            wheel=placement(side*.70,.255,z,0)
            def axle(p):
                return wheel((p[1],p[0],-p[2]))
            m.lathe("Tire",(0,0,0),[(-.105,.211),(-.08,.244),(.071,.244),(.105,.213)],20,transform=axle)
            m.lathe("Wheel dark",(0,0,0),[(side*.106,.153),(side*.115,.153)],18,transform=axle)
            for i in range(7):
                a=i*2*pi/7
                m.ball("Alloy",(side*.819,.255+.089*cos(a),z+.089*sin(a)),(.031,.052,.052),sides=7)
            m.ball("Alloy",(side*.824,.255,z),(.029,.087,.087),sides=8)
        m.box("Tire",(side*.677,.388,.0),(.072,.11,.81))
        m.box("Alloy",(side*.726,.722,.18),(.042,.035,.15))
        m.box(paint,(side*.727,.96,.44),(.18,.092,.16))
        m.box("Car glint",(side*.816,.973,.424),(.022,.06,.114))
        m.box("Headlight",(side*.433,.615,length-.021),(.296,.126,.073))
        m.box("Brake",(side*.444,.637,-length+.015),(.271,.119,.076))
        m.box("Tire",(side*.657,.97,-.15),(.035,.40,.051))
    m.box("Tire",(0,.49,length+.005),(.54,.112,.045))
    m.box("Alloy",(0,.463,length+.026),(.30,.076,.028))
    m.box("Alloy",(0,.481,-length-.032),(.31,.085,.030))
    m.build("Crossover" if utility else "Fastback sedan",group)


def trolley(group):
    m=Meshes()
    m.box("Trolley red",(0,.78,0),(1.53,1.03,4.82))
    m.box("Trolley cream",(0,1.49,0),(1.56,.79,4.72))
    m.box("Trolley red",(0,1.91,0),(1.6,.16,4.87))
    hull(m,lambda i,s:"Trolley roof",[(-2.54,1.95,.78,.16),(-2.20,1.96,.825,.29),(2.20,1.96,.825,.29),(2.54,1.95,.78,.16)])
    for side in [-1,1]:
        for i in range(8):
            z=-1.98+i*.554
            m.box("Car glass",(side*.797,1.47,z),(.044,.58,.43))
            m.box("Car glint",(side*.824,1.56,z+.10),(.022,.32,.145))
            m.box("Brass",(side*.827,1.14,z),(.024,.049,.48))
        for z in [-1.56,1.56]:
            m.ball("Tire",(side*.57,.29,z),(.28,.58,.58),sides=12)
        m.box("Car glass",(0,1.51,side*2.411),(.91,.64,.066))
        m.box("Headlight",(0,.88,side*2.455),(.22,.24,.08))
        m.box("Brass",(0,.48,side*2.47),(1.38,.15,.13))
    m.box("Coal",(0,2.26,0),(.17,.10,.62))
    m.face("Steel",[(-.035,2.26,-.27),(.033,2.26,-.27),(.029,2.83,.72),(-.039,2.83,.72)])
    m.build("Delmar Loop heritage trolley",group)


def branch(m,a,b,radius):
    # Tapered, angular secondary branches keep the canopies legible in close views.
    loops=[]
    for (x,y,z),r in [(a,radius),(b,radius*.36)]:
        loops.append([(x+r*cos(i*pi/4),y,z+r*sin(i*pi/4)) for i in range(8)])
    for i in range(8):
        j=(i+1)%8
        m.face("Bark",[loops[0][i],loops[1][i],loops[1][j],loops[0][j]],shade=.80+.024*i)


def tree(group, upright):
    m=Meshes()
    rng=Random(733 if upright else 64)
    m.lathe("Bark",(0,.015,0),[(0,.19),(.29,.124),(1.37,.086),(2.34,.032)],10)
    for i in range(8):
        angle=2*pi*i/8
        distance=.48+rng.random()*.48 if upright else .73+rng.random()*.88
        x,z=distance*cos(angle),distance*sin(angle)
        y=1.94+rng.random()*1.16
        branch(m,(0,1.21+i*.072,0),(x,y,z),.063-i*.003)
        for j in range(7):
            a=rng.random()*2*pi
            reach=rng.uniform(.16,.69)
            px,pz=x+reach*cos(a),z+reach*sin(a)
            py=y+rng.uniform(-.29,.55)
            w=rng.uniform(.61,1.10)
            tint=["Oak deep","Oak green","Oak light","Oak tips"][(j+i+(py>2.62))%4]
            m.lathe(tint,(px,py,pz),[(-w*.37,w*.09),(-w*.24,w*.38),(w*.02,w*.49),(w*.26,w*.35),(w*.43,w*.068)],
                    sides=7,depth=rng.uniform(.76,1.24),shade=rng.uniform(.83,1),smooth=False)
    for i in range(4):
        m.lathe("Oak light",(rng.uniform(-.35,.35),2.97+i*.09,rng.uniform(-.39,.39)),
                [(-.33,.09),(-.20,.39),(.08,.48),(.36,.27),(.46,.07)],sides=8,smooth=False)
    m.build("Upright park tree" if upright else "Broad-canopy oak",group)


def walkers(first, second):
    for name, group, skin, cloth, hair, hat in [
        ("Riley", first, "#b98158", "#526f8c", "#413027", False),
        ("Jules", second, "#8b5d46", "#a45c48", "#3d2924", True),
    ]:
        for label,color in [("skin",skin),("hair",hair),("blush","#ac7056"),("trousers","#44544f"),("shoes","#514337"),("coat",cloth),("sleeve",cloth)]:
            material(name+" "+label,color)
        rig=armature(name,group)
        mesh=Meshes()
        head(mesh,name,hat)
        wardrobe(mesh,name,False)
        if hat:
            mesh.ball("Trolley cream",(0,1.05,-.16),(.29,.34,.11),bone="Chest")
            for x in [-.10,.10]:
                mesh.box("Trolley cream",(x,1.035,.131),(.034,.23,.027),bone="Chest")
        mesh.build(name,group,rig)
        animate(rig,False)
        rig.animation_data.action.name="Sidewalk walk"
