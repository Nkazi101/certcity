import type { Casework } from "../casework";
import { architectCases } from "./architect";
import { associateCases } from "./associate";
import { developerCases } from "./developer";
import { professionalCases } from "./professional";
import { developerProfessionalCases } from "./developer-professional";

export const cityCasework: Readonly<Record<string, Casework>> = {
  ...architectCases, ...associateCases, ...developerCases, ...professionalCases, ...developerProfessionalCases,
};

export function caseworkFor(missionId: string): Casework | undefined {
  return Object.hasOwn(cityCasework, missionId) ? cityCasework[missionId] : undefined;
}
