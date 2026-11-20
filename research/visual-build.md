# Visual build

CertCity opens in a full-viewport, real-time 3D city. Downtown begins on Olive Street near Park Pacific, with the Gateway Arch grounds, Maplewood, Market Row and Lucas Gardens connected in the same scene. The Places menu offers the same location actions as the map. City Dispatch opens an interactive 3D cutaway with three workstations. A workflow overlay runs the same assignment shift and updates the support desk’s visible ticket stack.

## Run locally

```sh
npm ci
npm run dev
```

Open [CertCity on localhost](http://localhost:3000). Run `npm run typecheck` for the TypeScript check and `npm run build` for a static export in `out/`.

## Runtime

- **Three.js and WebGL** render orthographic views, modeled geometry, animated residents and traffic, lights and shadows. Exterior meshes are batched in spatial cells by surface and shadow behavior. The renderer can cull cells outside the camera view. Place markers project from 3D coordinates, and canvas selections use ray intersection against place bounds or, for the Gateway Arch, the curved steel mesh itself.
- **React and Next.js** own navigation, place details, dialogs and keyboard access. The scene respects reduced motion. Location and station menus still work if WebGL is unavailable.
- **The local TypeScript shift evaluator** supplies the order lookup results, simulated operating figures, and depot ticket count. Example assignments at other places are descriptions. The depot is the playable assignment.

Three.js supersedes the initial Phaser sprite prototype for this build. The earlier engine comparison remains in [the architecture proposal](E-technical-architecture.md). The [FarmVille visual comparison](farmville-visual-audit.md) records the reasons for the art changes and the St. Louis architectural references.

## St. Louis landmarks and names

Park Pacific is the only apartment complex. Washington Avenue Printworks occupies a former warehouse as a commercial print shop. Thirteenth Street Plaza, Jefferson Market Hall and the Lucas institutions take names from St. Louis streets and parks. The names and activities are fictional unless they identify an actual landmark. [Explore St. Louis downtown map](https://explorestlouis.com/wp-content/uploads/2025/04/Downtown-Map-2025.pdf) · [City of St. Louis Downtown West parks](https://www.stlouis-mo.gov/live-work/community/neighborhoods/downtown-west/index.cfm)

The Gateway Arch sits on the west bank of the Mississippi, east of the Old Courthouse. Its tapered triangular steel sections follow an approximation of the Arch’s catenary and preserve the near-equal height and span. The grounds include two ponds, curving paths, the west entrance and stairs down to the river. The city compresses the real distances to keep the landmarks and surrounding blocks readable in an orthographic game view. [NPS Arch engineering](https://www.nps.gov/jeff/planyourvisit/gateway-arch-fact-sheet.htm) · [NPS cultural landscape](https://www.nps.gov/articles/national-expansion-memorial-landscape-450006.htm) · [Old Courthouse and its setting](https://www.nps.gov/articles/old-courthouse-450003.htm)

## Olive and 13th art pass

The first production asset pass replaces the original procedural Park Pacific frontage, Olive & Rye, Thirteenth Street Plaza and two local characters with Blender models. The art uses original painted surface maps, recessed window bays, modeled terra-cotta relief, weathered storefront trim and distinct silhouettes for Sofia and Micah. Sofia walks along Olive and Micah serves coffee on the terrace. The same map and assignment controls remain available while the models load or if a file is unavailable. [Blender source and rebuild instructions](../art/olive-corner/README.md) · [FarmVille 2 asset treatment](https://frankvanderwel.artstation.com/projects/y4ZqJ)

The camera button in Downtown opens the Olive Street close-up. [Matched browser comparison](mockups/olive-corner-comparison.jpg) · [Current browser capture](mockups/olive-corner-3d.jpg)

## Painterly St. Louis

The exterior uses painted masonry and paving, violet-blue shade, warm directional light, sculpted tree canopies, and district-specific compositions. The Arch shot frames both feet against the Mississippi with the Eads approach on the left. The Art Hill shot follows the slope from the museum and bronze equestrian monument to the fountain basin. Delmar brings the Tivoli marquee and the trolley to the foreground. The boat traffic is a fictional tow inspired by the working port, and the tiled inlay in Thirteenth Street Plaza is original. [Gateway Arch landscape](https://www.nps.gov/jeff/planyourvisit/the-significance-of-the-gateway-arch-landscape.htm) · [Eads Bridge landmark record](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/66000946_text) · [Art Hill statue](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/city-landmarks/Statue-of-St-Louis.cfm) · [Grand Basin](https://www.forestparkmap.org/emerson-grand-basin) · [Delmar Loop history](https://www.visittheloop.com/history) · [St. Louis port](https://www.stlouis-mo.gov/government/departments/sldc/slpa/port-of-metropolitan-st-louis.cfm)

The lighting and water take their cues from production techniques for stylized animation. The city uses warm and cool light to shape buildings and a small palette of animated strokes to describe the river current. [Pixar RenderMan on stylization](https://renderman.pixar.com/stories/stylization-at-pixar)

Procedural residents use one rigged mesh per shared surface. Painted contact shadows follow moving actors while an architectural shadow map is refreshed as the camera crosses into new areas or new models load. The WebGL drawing buffer has a pixel budget and can adapt during sustained camera motion. A hidden tab or a stationary reduced-motion view stops scheduling animation frames. [Three.js shadow rendering](https://threejs.org/manual/pages/shadows.html) · [Drawing-buffer sizing](https://threejs.org/manual/pages/responsive.html) · [Rendering on demand](https://threejs.org/manual/pages/rendering-on-demand.html)

The riverfront terrain follows Dan Kiley’s meadow and pond grades. Two recessed basins sit in sloping banks, with bald cypresses gathered in clusters along their edges. The widening Grand Staircase meets the levee promenade, and a semicircular glass-and-steel canopy marks the west museum entrance. The Olive Street bakery uses a custom cast-iron shopfront with amber transoms, a stepped parapet, and a roof lantern. It is a fictional shop based on the city’s commercial building types. [Gateway Arch landscape](https://www.nps.gov/jeff/planyourvisit/the-significance-of-the-gateway-arch-landscape.htm) · [Museum entrance project](https://www.corgan.com/projects/gateway-arch-museum-and-visitor-center) · [St. Louis commercial preservation survey](https://www.stlouis-mo.gov/government/departments/planning/cultural-resources/preservation-plan/The-Victorian-City-Commercial-Structures.cfm)

## Central Library, downtown traffic and City Dispatch

The model at 1301 Olive Street is **St. Louis Public Library - Central Library**. Cass Gilbert’s façade, three entrance arches, broad stair, green hipped roofs and oval Great Hall courtyard come from the library’s photographs and design archive. The model keeps the real relationship between the building, Olive, Locust, 13th and 14th at the game’s compressed scale. [Central Library](https://www.slpl.org/locations/9/) · [Architectural tours](https://www.slpl.org/central-library-tours/) · [Roof and courtyard photograph](https://central.slpl.org/renewal.html)

Locust shifts alignment near 13th. Downtown streets now use varied widths, rounded curbs, several crossing treatments, stop lines, storm drains and pavement repairs. Washington and Tucker have raised planted islands on selected stretches. Signal phases drive the animated downtown traffic at the modeled intersections. The island locations and timing are game designs informed by the city’s street plans. [Downtown map](https://explorestlouis.com/wp-content/uploads/2025/04/Downtown-Map-2025.pdf) · [Library construction and Locust](https://central.slpl.org/construction.html) · [Washington Avenue improvements](https://www.stlouis-mo.gov/government/departments/public-service/projects/project.cfm?customel_datapageid_486626=1143004) · [Tucker Boulevard improvements](https://www.stlouis-mo.gov/government/departments/public-service/projects/project.cfm?customel_datapageid_486626=1126304)

The City Dispatch cutaway uses [authored Blender workstations](../art/city-dispatch/city-dispatch.blend) and distinct staff routines. Replay T-17 to see the original reply beside the outcome under the draft policy. A completed shift adds a debrief. **Save shift** stores the evaluated policy in that browser so the visible workload and results can be restored after a reload.

## Browser review

[Central Library and downtown traffic](mockups/central-library-and-traffic.jpg) · [City Dispatch workstations](mockups/city-dispatch-workstations.jpg) · [Ticket replay](mockups/city-dispatch-ticket-replay.jpg) · [Gateway Arch](mockups/gateway-arch-3d.jpg) · [Downtown](mockups/downtown-3d.jpg) · [Market Row](mockups/market-row-3d.jpg) · [First 3D build](mockups/first-3d-build.jpg)

Chromium checks covered the 1440 × 900 full-canvas view, Park Pacific selection from the model and pin, district switching, camera drag, rotation and reset, the workflow, and the changed depot workload. The Gateway Arch update passed direct mesh selection, Old Courthouse selection, camera rotation and reset, and the 320 px district selector check in Chromium. The Olive Street pass was checked with the same 1440 × 900 camera framing, reduced motion, an emulated 390 × 844 touch viewport, and failed model requests. Physical phone performance still needs measurement.

A production-export comparison at 1440 × 900 CSS pixels in Chromium used the same repeated drag input on an Apple M1 Max. Downtown went from 12.5 to 59.6 rendered FPS during the 2.8-second drag. The 95th-percentile frame interval fell from 84.0 ms to 17.6 ms. With the camera still, the median submitted triangles fell from about 1.75 million to 934,000 and the median draw calls fell from 1,464 to 932. These measurements include each build’s shipped camera composition. The later terrain and storefront pass held 59.6 FPS Downtown and 59.3 FPS at the Arch in the same drag test. Mobile layout and touch checks used Chromium device emulation.

## Archived concept art

The early [Maplewood](mockups/concept-maplewood.webp) and [City Dispatch](mockups/concept-dispatch.webp) illustrations were generated as original concept art. The runtime uses live 3D models and materials.

<details>
<summary>Maplewood generation prompt</summary>

```text
Use case: stylized-concept
Asset type: full-bleed game world artwork for CertCity, a browser city simulation. Landscape 3:2 composition.
Scene: an inviting, lively, mixed-use neighborhood in a walkable contemporary city. Fixed orthographic isometric gameplay camera, roughly 45-degree yaw and 35-degree elevation. Show a neighborhood at city-block scale with streets extending naturally off all four edges. Closely art-directed like a premium cozy city-building game, charming scale, hand-painted-looking physically lit 3D assets, warm falloff and rounded edges, finely crafted building materials. Rich warm terracotta, golden stucco, pastel sage and blue, light sandstone paths and deep charcoal asphalt. Bright late morning light from top left, detailed cast shadows.
Layout: an attractive diagonal main street and crosswalks. Upper left an identifiable red-brick SCHOOL with clock tower, playground, and school yard. Upper right a contemporary midrise blue-glass TECH OFFICE. Left center a cozy small bistro RESTAURANT with terracotta or red awning and patio tables. Right center an identifiable neighborhood REPAIR SHOP with a teal service awning, tools and garage. Lower left a cream and teal small last-mile DELIVERY DEPOT with two rollup doors and a yellow parcel van. Lower right a set of APARTMENT HOMES, garden stoops, and residents. An active tiny park or plaza at the center, a few tiny pedestrians and street trees throughout. Put all six buildings fully in frame and separated so they can be interacted with. Fill frame with continued neighborhoods and trees at edges. Natural city life and coherent size hierarchy. 
Constraints: game environment only. No UI, pin markers, interface text, graphic logos, watermarks, fantasy islands, water, bridges or docks. No floating isolated block, no giant skyscrapers, no skewed buildings or toy plastic. High quality original environment art, readable from a distance.
```

</details>

<details>
<summary>City Dispatch generation prompt</summary>

```text
Use case: stylized-concept
Asset type: full-bleed playable cutaway environment background for CertCity, a cozy isometric city simulation. Landscape 3:2.
Scene: the interior of a small neighborhood last-mile parcel depot, with the front two walls removed, orthographic isometric 45-degree angle, visible warm brick rear walls and weathered teal trim. Floor on a city lot, foreground includes narrow sidewalk and planting. Large indoor central space fills the image, cozy and readable. 
Layout: three clearly distinguishable stations. Left third, approachable support desk with two warm monitors and a woman in a mustard sweater facing desk. Upper right, industrial order lookup station with a large teal terminal, a monitor, shelving and a staff member. Lower right, organized dispatch bench, packages and loading area with a third employee. Several little shipping boxes and hand trucks, cream concrete floor, restrained safety markings. Exactly three adults at scene scale. 
Style: high-end miniature city-building game environment art, 3D modeled with painterly matte finish, fixed orthographic camera, daylight upper left, subtle ambient occlusion, warm amber brick, cream, teal, industrial slate and sage, original professional characters. Avoid glossy plastic, clutter or dark warehouse. No UI, pin markers, text, logos, floating white backdrop, water or ships. This must look like a playable workplace in a mixed-use neighborhood.
```

</details>
