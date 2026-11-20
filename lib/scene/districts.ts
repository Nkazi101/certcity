import { stLouisDistricts } from "./st-louis-layout";

export const districts = [
  { id: "downtown", name: "Downtown", description: "Park Pacific, Olive Street and Washington Avenue", x: 49.5, z: -1.15 },
  { id: "riverfront", name: "Gateway Arch", description: "Arch grounds, Old Courthouse and the Mississippi", x: 123.4, z: 46.3 },
  ...stLouisDistricts,
  { id: "maplewood", name: "Maplewood", description: "School, homes and local businesses", x: -.25, z: 1.6 },
  { id: "market", name: "Market Row", description: "Market hall, bookshop and greenhouse", x: -35.3, z: 3.8 },
  { id: "gardens", name: "Lucas Gardens", description: "Library, community center and gardens", x: .5, z: -34.8 },
] as const;

export type DistrictId = (typeof districts)[number]["id"];

export const defaultDistrict: DistrictId = "downtown";

export function districtCamera(id: DistrictId, portrait = false) {
  if (id === "downtown") return portrait
    ? { x: 42.0, y: 4.0, z: 3.2, angle: .07, pitch: .55, zoom: 1.02, width: 30 }
    : { x: 44.7, y: 5.7, z: 4.55, angle: -.62, pitch: .56, zoom: .94, width: 45 };
  if (id === "delmar") return portrait
    ? { x: -111.2, y: 1.9, z: -44.5, angle: 2.59, pitch: .56, zoom: 1.00, width: 29 }
    : { x: -116.0, y: 2.3, z: -44.3, angle: 2.57, pitch: .57, zoom: 1.12, width: 46 };
  if (id === "forest-park") return portrait
    ? { x: -80.4, y: 1.8, z: 12.0, angle: 3.06, pitch: .58, zoom: 1.0, width: 31.5 }
    : { x: -80.5, y: 2.5, z: 12.8, angle: 2.92, pitch: .59, zoom: .97, width: 46 };
  const district = districts.find((place) => place.id === id) ?? districts[0];
  const pitch = portrait ? .62 : .735;
  if ("width" in district) return { ...district, x: "focusX" in district ? district.focusX : district.x,
    z: "focusZ" in district ? district.focusZ : district.z, width: district.width * (portrait ? .76 : 1), pitch };
  if (id === "riverfront") return portrait
    ? { x: 126.1, z: 44.6, y: 9.2, angle: -1.39, pitch: .46, zoom: .81, width: 26.8 }
    : { x: 129.1, z: 38.3, y: 8.05, angle: -1.19, pitch: .52, zoom: .85, width: 48 };
  return { x: district.x, z: district.z, y: .64, angle: .78, zoom: 1, width: portrait ? 32.68 : 43, pitch };
}
