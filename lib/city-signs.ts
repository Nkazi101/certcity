import type { DistrictId } from "./scene/districts";

type SignDesign = {
  name: string;
  href: string;
  image: string;
  paper: string;
  kind: "sign" | "billboard";
  placements: readonly {
    location: string;
    district: DistrictId;
    position: readonly [number, number, number];
    angle: number;
    width: number;
    baseY?: number;
  }[];
};

const markdownstl = {
  name: "markdownstl",
  href: "https://markdownstl.com/",
  image: "/signage/markdownstl.png",
  paper: "#fff",
};

export const citySigns: readonly SignDesign[] = [
  {
    ...markdownstl,
    kind: "sign",
    placements: [
      { location: "Park Pacific, second floor", district: "downtown", position: [50.5, 1.57, -3.63], angle: 0, width: 2.38 },
    ],
  },
  {
    ...markdownstl,
    kind: "billboard",
    placements: [
      { location: "Kiel Garage rooftop", district: "enterprise", position: [28.8, 6.18, 73.9], angle: -.42, width: 6.25, baseY: 4.13 },
      { location: "Market Row", district: "market", position: [-40.6, 3.8, 4.65], angle: .55, width: 5.6 },
    ],
  },
  {
    name: "The Prompting Games",
    href: "https://thepromptinggames.com/",
    image: "/signage/the-prompting-games.png",
    paper: "#faf9f7",
    kind: "billboard",
    placements: [
      { location: "Ballpark Village", district: "ballpark", position: [82.5, 3.85, 88.8], angle: -.55, width: 7.1 },
      { location: "Delmar Loop rooftop", district: "delmar", position: [-114.79, 4.88, -41.35], angle: 2.95, width: 6.7, baseY: 2.82 },
    ],
  },
];
