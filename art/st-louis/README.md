# St. Louis in CertCity

[Open the editable Blender scene](st-louis.blend). Six district collections and a Soldiers Memorial collection sit side by side for inspection. Separate collections contain the sedan, crossover, Loop Trolley, two tree silhouettes, and two rigged pedestrians. The browser uses the compressed GLBs in `public/models/st-louis/`. It loads landmark art as the camera approaches each district and shares street assets across views. The new traffic and trees also appear around Olive Street.

## Site references

| District | Reference cues used in the model |
|---|---|
| Delmar Loop | The Tivoli’s ivory terra cotta, blade and marquee, Blueberry Hill’s blue-and-gold sign, sidewalk stars, the street-running trolley, and distinct diner, bay-front and arcade shop shells. The eastern segment has the taller Moonrise Hotel next to The Pageant. [Moonrise photographs](https://moonrisehotel.com/the-hotel/gallery/) · [The Pageant](https://www.thepageant.com/venue-info/the-pageant/) · [Historic district nomination](https://mostateparks.com/sites/mostateparks/files/Delmar%20Loop-Parkview%20Gardens%20HD.pdf) · [Blueberry Hill photographs](https://blueberryhill.com/media-resources/) · [Loop Trolley](https://www.looptrolley.com/) |
| Enterprise Center | The arcing glass pavilion and long arena elevation at 14th and Clark, with Stifel Theatre’s limestone colonnade facing Market on the north. Open Kiel Garage decks sit to the west. [Parking plan](https://www.enterprisecenter.com/events/parking) · [Enterprise Center entrance guide](https://www.enterprisecenter.com/plan-your-visit/directions) · [Exterior photographs](https://www.enterprisecenter.com/about-us) · [Stifel Theatre history](https://www.stifeltheatre.com/about-us/history) |
| Ballpark Village | The plaza north of Clark, the stepped red-brick stadium bowl with a lower center-field edge, and One Cardinal Way behind the Village. Live! by Loews anchors the west side. [Live! by Loews project](https://www.cordish.com/en/Portfolio/Live-by-Loews-St-Louis-Missouri) · [Ballpark Village plaza](https://www.stlballparkvillage.com/eat-and-drink/together-credit-union-plaza) · [Stadium structural design](https://www.bniengineers.com/projects-item/busch-stadium-design-build/) · [One Cardinal Way façade](https://www.guardianglass.com/us/en/projects/project-details/one-cardinal-way) |
| Forest Park | Eight jets in Emerson Grand Basin, the rise of Art Hill and Cass Gilbert’s museum façade beside the dark concrete East Building. [East Building architect](https://davidchipperfield.com/news/2023/tenth-anniversary-of-the-saint-louis-art-museums-east-building) · [Forest Park Forever](https://www.forestparkmap.org/emerson-grand-basin) · [HOK restoration photographs](https://www.hok.com/news/2025-09/forest-park-restoration-wins-asla-landmark-award/) |
| WashU | Brookings Hall’s red granite and limestone trim, its central passage, crenellated towers, the pedestrian axis through Tisch Park, glass welcome pavilions and the Kemper museum’s faceted steel. [Danforth map](https://washu.edu/app/uploads/2024/09/Danforth-Campus-Map.pdf) · [East End architects](https://new.kierantimberlake.com/page/east-end-transformation) · [WashU Danforth Campus](https://washu.edu/about-washu/our-campuses/danforth-campus/) |
| UMSL | The Touhill’s curved glass lobby, adjoining brick volumes, the Millennium Student Center and its elevated pedestrian link, and the Thomas Jefferson Library’s north entry and pyramid skylight. [North Campus map](https://www.umsl.edu/files/pdfs/campus-map.pdf) · [Library renovation](https://www.umsl.edu/transform/libraries.html) · [About the Touhill](https://www.umsl.edu/touhill/about-the-touhill/index.html) · [UMSL exterior photograph](https://www.umsl.edu/chancellor/files/pdfs/archived-documents-tom-george/sua04.pdf) · [UMSL campus map](https://www.umsl.edu/marketing/files/pdfs/map.pdf) |
| Downtown and riverfront | Soldiers Memorial’s limestone frontage, Kiener Plaza’s lawn and fountain, and the steel spans and masonry piers at Eads Bridge. [Soldiers Memorial](https://mohistory.org/memorial) · [Kiener Plaza](https://www.archpark.org/visit/points-of-interest/kiener-plaza) · [Eads Bridge historic engineering record](https://tile.loc.gov/storage-services/master/pnp/habshaer/mo/mo0300/mo0361/data/mo0361data.pdf) |

Landmarks retain their general regional positions and key local street relationships. The game compresses distance, building scale and block spacing. Secondary buildings and most connecting blocks are illustrative. The expanded park represents Art Hill and the Grand Basin. The campuses represent the Danforth East End and selected North Campus buildings. A shared street layout links the districts. Local courtyards, parking access and walkways follow the modeled entrances. Place profiles use fictional staff and visitors.

## Rebuild

```sh
python3.13 -m venv /tmp/certcity-art
/tmp/certcity-art/bin/pip install bpy==5.2.4 pillow==13.0.0
/tmp/certcity-art/bin/python art/st-louis/build.py
/tmp/certcity-art/bin/python art/st-louis/portraits.py
```

The script exports assets with the same Meshopt and WebP pipeline as Olive Street, then stages the editable source collections. Edits to the script regenerate the source file and all 14 runtime GLBs. The portrait script renders eight WebP stills using the Blender character kit.
