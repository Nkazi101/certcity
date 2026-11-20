const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(code.outputText, file);
};

const { followRoute } = require("../lib/scene/actors.ts");
const { buildStLouisGround } = require("../lib/scene/st-louis-ground.ts");
const { stLouisDistricts } = require("../lib/scene/st-louis-layout.ts");
const { hasStreetAt } = require("../lib/scene/st-louis-streets.ts");
const { followRoad } = require("../lib/scene/streets.ts");

async function checkRoutes() {
  const { Group, Object3D, Mesh, MeshStandardMaterial } = await import("three");
  // Build the real routes without rasterizing the district's decorative meshes.
  const kit = new Proxy({}, {
    get(_target, key) {
      if (key === "geometry") return (geometry) => geometry;
      if (key === "material") return () => new MeshStandardMaterial();
      if (key === "group") return () => new Group();
      return () => new Mesh();
    },
  });
  for (const district of stLouisDistricts) {
    const { actors } = buildStLouisGround(kit, new Group(), district);
    for (const { model, path, speed, phase, shuttle } of actors) {
      if (model === "trolley") continue;
      const vehicle = model === "sedan" || model === "crossover";
      if (!vehicle && district.id !== "forest-park") continue;
      const route = shuttle ? [...path, ...path.slice(1, -1).reverse()] : path;
      const move = (vehicle ? followRoad : followRoute)(route, speed, phase);
      const actor = new Object3D();
      for (let time = 0; time < 240; time += .08) {
        move(time, actor);
        const { x, z } = actor.position;
        if (vehicle) {
          assert.ok(hasStreetAt(x + district.x, z + district.z, -.5),
            `${district.name} ${model} strays outside its lane at ${x}, ${z}`);
        } else {
          const basinX = x / 10.7;
          const basinZ = (z + 14) / 9.65;
          const angle = Math.atan2(basinZ, basinX);
          const shore = 1 + .095 * Math.sin(angle) - .04 * Math.cos(2 * angle);
          assert.ok(Math.hypot(basinX, basinZ) > shore, `${model} enters the Grand Basin`);
        }
      }
    }
  }

  const signal = { x: 0, z: 0, hx: 1.83, hz: 2.17, offset: 0 };
  const van = new Object3D();
  const drive = followRoad([[-14, 1], [14, 1], [14, 12], [-14, 12]], 3, 12, [signal],
    { at: [10, 1], duration: 4 });
  let stoppedAtLight = false;
  let parked = false;
  let enteredOnGreen = false;
  for (let time = 0; time < 40; time += .04) {
    const previousX = van.position.x;
    const { braking, parkedFor } = drive(time, van);
    if (braking && time > 0 && time < 10 && van.position.z < 2) {
      assert.ok(van.position.x < -4.15, "Vehicle must leave room for the crosswalk while the light is red");
      stoppedAtLight = true;
    }
    const phase = time % 20;
    if (previousX < -4.3 && van.position.x >= -4.3 && van.position.z < 2 && phase >= 10 && phase < 18) {
      enteredOnGreen = true;
    }
    if (parkedFor !== null && parkedFor > 1) {
      assert.ok(Math.abs(van.position.x - 10) < .08 && Math.abs(van.position.z - 1) < .08, "Vehicle waits in its loading space");
      parked = true;
    }
  }
  assert.ok(stoppedAtLight && enteredOnGreen && parked, "The route must exercise a red light, green light and delivery stop");
  console.log("Regional road clearance, Grand Basin walking routes, traffic signals and delivery stop checked.");
}

checkRoutes().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
