# Olive and 13th

[Olive and 13th.blend](olive-and-13th.blend) contains the editable building, street and plaza meshes, packed source textures, two character armatures, animation actions and a review camera. Select the **Olive and 13th**, **Sofia Reed** or **Micah Evans** collection to work on those assets. The review camera and lights stay in the source file.

The original bitmap textures use individually authored pigments, drawn brush marks and local face shading. The runtime meshes use an exaggerated footprint and height that match the existing city layout. The Park Pacific tower borrows its setbacks, U-shaped light well, pale terra cotta, and west entrance relief from the [historic nomination](https://mostateparks.com/sites/mostateparks/files/Missouri%20Pacific%20Bldg.pdf) and [renovation photography](https://www.paric.com/project/park-pacific-2/). Olive & Rye and the plaza sculpture are original fictional designs.

The Central Library entrance draws from the [library’s construction archive](https://central.slpl.org/construction.html) and the [Historic American Buildings Survey](https://www.loc.gov/item/mo1087/). Nolan’s in-game print and the conversation use the south-front photograph by HABS staff photographer Jack E. Boucher, April–May 1986, from the [Cass Gilbert Society reproduction](https://cassgilbertsociety.org/works/stl-public-library/). The photographer and date come from the [Library of Congress photo index](https://tile.loc.gov/storage-services/master/pnp/habshaer/mo/mo1000/mo1087/data/mo1087cap.pdf).

## Rebuild from the scripts

Use Blender’s Python module for the same Python version you install it with. The checked-in GLBs are ready for use by the app. Node and npm are needed for the pinned glTF optimizer when regenerating assets.

```sh
python3.13 -m venv /tmp/simza-art
/tmp/simza-art/bin/pip install bpy==5.2.4 pillow==13.0.0
/tmp/simza-art/bin/python art/olive-corner/build.py
```

The script regenerates the Blender file and the three GLBs under `public/models/olive-corner/`. It packs WebP textures and Meshopt-compressed geometry for the browser. The scripts recreate the checked-in art, so keep any subsequent manual edits in a separately named Blender master until they are incorporated into the asset workflow.
