export const stLouisDistricts = [
  { id: "enterprise", name: "Enterprise Center", description: "Clark Avenue and the Blues arena", x: 46, z: 67, y: 3.5, angle: -.59, zoom: .97, width: 41 },
  { id: "ballpark", name: "Ballpark Village", description: "Busch Stadium and the Clark Avenue plaza", x: 99, z: 85, y: 3.9, angle: -.61, zoom: .91, width: 49 },
  { id: "delmar", name: "Delmar Loop", description: "Tivoli, Blueberry Hill and the Loop Trolley", x: -117, z: -48, y: 2.15, angle: 2.55, zoom: .96, width: 48 },
  { id: "forest-park", name: "Forest Park", description: "Art Hill, the Grand Basin and the Saint Louis Art Museum", x: -80, z: 13, y: 1.7, angle: 2.66, zoom: .95, width: 48 },
  { id: "washu", name: "WashU", description: "Brookings Hall and the Danforth Campus", x: -151, z: 9, focusX: -137, y: 2.45, angle: .94, zoom: .84, width: 53 },
  { id: "umsl", name: "UMSL", description: "The Touhill and North Campus", x: -172, z: -104, focusZ: -93, y: 2.15, angle: -.59, zoom: .85, width: 50 },
] as const;

export type StLouisDistrict = (typeof stLouisDistricts)[number];

export const marketAllotments = { x: -51.1, z: 10.9, width: 17.12, depth: 14.92 };
