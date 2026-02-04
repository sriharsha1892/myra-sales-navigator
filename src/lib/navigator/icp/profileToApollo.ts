import type { IcpProfile } from "../types";

/**
 * Maps an ICP profile's size range to Apollo's employee count ranges.
 * Apollo uses predefined ranges like "1,10", "11,20", "21,50", etc.
 */
function sizeRangeToApollo(min: number, max: number): string[] {
  const apolloRanges: [number, number, string][] = [
    [1, 10, "1,10"],
    [11, 20, "11,20"],
    [21, 50, "21,50"],
    [51, 100, "51,100"],
    [101, 200, "101,200"],
    [201, 500, "201,500"],
    [501, 1000, "501,1000"],
    [1001, 2000, "1001,2000"],
    [2001, 5000, "2001,5000"],
    [5001, 10000, "5001,10000"],
    [10001, Infinity, "10001,"],
  ];

  return apolloRanges
    .filter(([lo, hi]) => lo <= max && hi >= min)
    .map(([, , label]) => label);
}

/**
 * Maps an ICP profile's regions to Apollo location keywords.
 */
function regionsToApollo(regions: string[]): string[] {
  const regionMap: Record<string, string[]> = {
    "North America": ["United States", "Canada", "Mexico"],
    "Europe": ["United Kingdom", "Germany", "France", "Netherlands", "Switzerland", "Italy", "Spain", "Sweden", "Norway", "Denmark", "Belgium"],
    "Asia Pacific": ["India", "China", "Japan", "Singapore", "Australia", "South Korea", "Malaysia", "Thailand", "Indonesia"],
    "Latin America": ["Brazil", "Argentina", "Colombia", "Chile", "Peru"],
    "Middle East & Africa": ["United Arab Emirates", "Saudi Arabia", "South Africa", "Israel", "Turkey", "Nigeria", "Kenya"],
  };

  const locations: string[] = [];
  for (const r of regions) {
    const mapped = regionMap[r];
    if (mapped) locations.push(...mapped);
  }
  return locations;
}

/**
 * Converts an ICP profile into Apollo API search parameters.
 * These can be passed to Apollo's organization search endpoint.
 */
export function profileToApolloFilters(profile: IcpProfile): {
  organization_num_employees_ranges: string[];
  organization_locations: string[];
  person_seniorities: string[];
} {
  return {
    organization_num_employees_ranges: sizeRangeToApollo(profile.sizeMin, profile.sizeMax),
    organization_locations: regionsToApollo(profile.regions),
    person_seniorities: ["c_suite", "vp", "director", "manager"],
  };
}

/**
 * Gets the default ICP profile from a list of profiles.
 */
export function getDefaultProfile(profiles: IcpProfile[]): IcpProfile | null {
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
}
