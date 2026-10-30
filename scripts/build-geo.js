const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'india_geo_data.json'), 'utf8'));

// Format Delhi districts for natural readability and add name property
for (const [stName, stData] of Object.entries(raw)) {
  stData.name = stName;
}

if (raw['Delhi']) {
  raw['Delhi'].districts = raw['Delhi'].districts.map((d) => ({
    name: d.name.endsWith('Delhi') || d.name === 'Shahdara' ? d.name : `${d.name} Delhi`,
    code: d.code,
  }));
}

// Build formatted State data
const lines = [];
lines.push('// Official Pan-India States & Districts data with eRaktKosh official codes');
lines.push('export interface DistrictInfo {');
lines.push('  name: string;');
lines.push('  code: string;');
lines.push('}');
lines.push('');
lines.push('export interface StateInfo {');
lines.push('  name?: string;');
lines.push('  code: string;');
lines.push('  districts: DistrictInfo[];');
lines.push('}');
lines.push('');
lines.push('export const INDIA_STATES_DATA: Record<string, StateInfo> = ' + JSON.stringify(raw, null, 2) + ';');
lines.push('');
lines.push('export const ALL_INDIAN_STATES = Object.keys(INDIA_STATES_DATA).sort();');
lines.push('');
lines.push('export function getDistrictsForState(stateName: string): string[] {');
lines.push('  const state = INDIA_STATES_DATA[stateName];');
lines.push('  if (!state) return [];');
lines.push('  return state.districts.map((d) => d.name);');
lines.push('}');
lines.push('');
lines.push('export function getEraktkoshStateCode(stateName: string): string | undefined {');
lines.push('  const state = INDIA_STATES_DATA[stateName];');
lines.push('  if (state) return state.code;');
lines.push('  const lower = stateName.toLowerCase();');
lines.push('  for (const s of Object.values(INDIA_STATES_DATA)) {');
lines.push('    if (s.name && s.name.toLowerCase() === lower) return s.code;');
lines.push('  }');
lines.push('  return undefined;');
lines.push('}');
lines.push('');
lines.push('export function getEraktkoshDistrictCode(stateName: string, districtName: string): string | undefined {');
lines.push('  const state = INDIA_STATES_DATA[stateName];');
lines.push('  if (!state) return undefined;');
lines.push('  const lower = districtName.toLowerCase();');
lines.push('  const d = state.districts.find(');
lines.push('    (dist) => dist.name.toLowerCase() === lower || lower.includes(dist.name.toLowerCase()) || dist.name.toLowerCase().includes(lower)');
lines.push('  );');
lines.push('  return d ? d.code : undefined;');
lines.push('}');
lines.push('');
lines.push('export function matchStateAndDistrict(');
lines.push('  rawState?: string | null,');
lines.push('  rawDistrict?: string | null');
lines.push('): { state: string; district: string } {');
lines.push("  let matchedState = 'Maharashtra';");
lines.push("  let matchedDistrict = 'Mumbai Suburban';");
lines.push('');
lines.push('  if (rawState) {');
lines.push('    const rawStLower = rawState.toLowerCase().trim();');
lines.push('    for (const st of ALL_INDIAN_STATES) {');
lines.push('      if (st.toLowerCase() === rawStLower || rawStLower.includes(st.toLowerCase()) || st.toLowerCase().includes(rawStLower)) {');
lines.push('        matchedState = st;');
lines.push('        break;');
lines.push('      }');
lines.push('    }');
lines.push('  }');
lines.push('');
lines.push('  const dists = getDistrictsForState(matchedState);');
lines.push('  if (dists.length > 0) {');
lines.push('    matchedDistrict = dists[0]!;');
lines.push('  }');
lines.push('');
lines.push('  if (rawDistrict) {');
lines.push("    const rawDistLower = rawDistrict.toLowerCase().replace(/district/gi, '').trim();");
lines.push('    for (const d of dists) {');
lines.push('      if (d.toLowerCase() === rawDistLower || rawDistLower.includes(d.toLowerCase()) || d.toLowerCase().includes(rawDistLower)) {');
lines.push('        matchedDistrict = d;');
lines.push('        break;');
lines.push('      }');
lines.push('    }');
lines.push('  }');
lines.push('');
lines.push('  return { state: matchedState, district: matchedDistrict };');
lines.push('}');

fs.writeFileSync(path.join(__dirname, '..', 'packages', 'shared', 'src', 'india-geo.ts'), lines.join('\n'));
console.log('Successfully wrote packages/shared/src/india-geo.ts');
