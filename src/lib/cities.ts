/**
 * Candidate tour markets. Coordinates are public city-centre points. `query` is the locality string
 * sent to Qloo (`filter.location.query`), which is fuzzy-matched, so ambiguous names carry a region.
 * `tier` 1 = primary market on most routings, 2 = secondary market.
 */
export type Region = "north-america" | "latin-america" | "europe" | "uk-ireland" | "asia-pacific" | "india";

export interface City {
  id: string;
  name: string;
  query: string;
  country: string;
  region: Region;
  lat: number;
  lng: number;
  tier: 1 | 2;
}

export const REGIONS: { id: Region | "world"; label: string }[] = [
  { id: "north-america", label: "North America" },
  { id: "europe", label: "Europe" },
  { id: "uk-ireland", label: "UK & Ireland" },
  { id: "asia-pacific", label: "Asia-Pacific" },
  { id: "latin-america", label: "Latin America" },
  { id: "india", label: "India" },
  { id: "world", label: "World tour" },
];

/**
 * Area sent to Qloo for one territory-wide `urn:heatmap`. Multi-country territories use a WKT polygon
 * (`filter.location`), because text queries such as "Europe" resolve to no cells. Affinity and
 * popularity in a heatmap are percentiles across every cell in this area.
 */
export const HEAT_AREAS: Record<Region, { label: string; wkt?: string; query?: string }> = {
  "north-america": { label: "North America", wkt: "POLYGON((-126 24,-52 24,-52 57,-126 57,-126 24))" },
  "latin-america": { label: "Latin America", wkt: "POLYGON((-118 -56,-34 -56,-34 33,-118 33,-118 -56))" },
  europe: { label: "Europe", wkt: "POLYGON((-11 35,31 35,31 62,-11 62,-11 35))" },
  "uk-ireland": { label: "UK & Ireland", wkt: "POLYGON((-11 49.8,2 49.8,2 59.5,-11 59.5,-11 49.8))" },
  "asia-pacific": { label: "Asia-Pacific", wkt: "POLYGON((95 -48,179 -48,179 46,95 46,95 -48))" },
  india: { label: "India", query: "India" },
};

type Row = [id: string, name: string, query: string, country: string, lat: number, lng: number, tier?: 1 | 2];

const ROWS: Record<Region, Row[]> = {
  "north-america": [
    ["nyc", "New York", "New York City", "US", 40.7128, -74.006, 1],
    ["la", "Los Angeles", "Los Angeles", "US", 34.0522, -118.2437, 1],
    ["chi", "Chicago", "Chicago", "US", 41.8781, -87.6298, 1],
    ["atx", "Austin", "Austin, Texas", "US", 30.2672, -97.7431, 1],
    ["nash", "Nashville", "Nashville", "US", 36.1627, -86.7816, 1],
    ["sea", "Seattle", "Seattle", "US", 47.6062, -122.3321, 1],
    ["pdx", "Portland", "Portland, Oregon", "US", 45.5152, -122.6784, 1],
    ["sf", "San Francisco", "San Francisco", "US", 37.7749, -122.4194, 1],
    ["den", "Denver", "Denver", "US", 39.7392, -104.9903, 1],
    ["atl", "Atlanta", "Atlanta", "US", 33.749, -84.388, 1],
    ["phl", "Philadelphia", "Philadelphia", "US", 39.9526, -75.1652, 1],
    ["bos", "Boston", "Boston", "US", 42.3601, -71.0589, 1],
    ["msp", "Minneapolis", "Minneapolis", "US", 44.9778, -93.265, 1],
    ["dc", "Washington", "Washington, D.C.", "US", 38.9072, -77.0369, 1],
    ["hou", "Houston", "Houston", "US", 29.7604, -95.3698, 1],
    ["dal", "Dallas", "Dallas", "US", 32.7767, -96.797, 1],
    ["mia", "Miami", "Miami", "US", 25.7617, -80.1918, 1],
    ["sd", "San Diego", "San Diego", "US", 32.7157, -117.1611, 1],
    ["phx", "Phoenix", "Phoenix", "US", 33.4484, -112.074, 1],
    ["det", "Detroit", "Detroit", "US", 42.3314, -83.0458, 1],
    ["tor", "Toronto", "Toronto", "CA", 43.6532, -79.3832, 1],
    ["mtl", "Montreal", "Montreal", "CA", 45.5019, -73.5674, 1],
    ["van", "Vancouver", "Vancouver", "CA", 49.2827, -123.1207, 1],
    ["bal", "Baltimore", "Baltimore", "US", 39.2904, -76.6122],
    ["pit", "Pittsburgh", "Pittsburgh", "US", 40.4406, -79.9959],
    ["cbus", "Columbus", "Columbus, Ohio", "US", 39.9612, -82.9988],
    ["cle", "Cleveland", "Cleveland", "US", 41.4993, -81.6944],
    ["cin", "Cincinnati", "Cincinnati", "US", 39.1031, -84.512],
    ["ind", "Indianapolis", "Indianapolis", "US", 39.7684, -86.1581],
    ["mke", "Milwaukee", "Milwaukee", "US", 43.0389, -87.9065],
    ["msn", "Madison", "Madison, Wisconsin", "US", 43.0731, -89.4012],
    ["stl", "St. Louis", "St. Louis", "US", 38.627, -90.1994],
    ["kc", "Kansas City", "Kansas City, Missouri", "US", 39.0997, -94.5786],
    ["oma", "Omaha", "Omaha", "US", 41.2565, -95.9345],
    ["lou", "Louisville", "Louisville", "US", 38.2527, -85.7585],
    ["mem", "Memphis", "Memphis", "US", 35.1495, -90.049],
    ["nola", "New Orleans", "New Orleans", "US", 29.9511, -90.0715],
    ["sat", "San Antonio", "San Antonio", "US", 29.4241, -98.4936],
    ["okc", "Oklahoma City", "Oklahoma City", "US", 35.4676, -97.5164],
    ["tus", "Tucson", "Tucson", "US", 32.2226, -110.9747],
    ["abq", "Albuquerque", "Albuquerque", "US", 35.0844, -106.6504],
    ["sfe", "Santa Fe", "Santa Fe, New Mexico", "US", 35.687, -105.9378],
    ["slc", "Salt Lake City", "Salt Lake City", "US", 40.7608, -111.891],
    ["boi", "Boise", "Boise", "US", 43.615, -116.2023],
    ["lv", "Las Vegas", "Las Vegas", "US", 36.1699, -115.1398],
    ["sac", "Sacramento", "Sacramento", "US", 38.5816, -121.4944],
    ["eug", "Eugene", "Eugene, Oregon", "US", 44.0521, -123.0868],
    ["spo", "Spokane", "Spokane", "US", 47.6588, -117.426],
    ["msl", "Missoula", "Missoula", "US", 46.8721, -113.994],
    ["tpa", "Tampa", "Tampa", "US", 27.9506, -82.4572],
    ["orl", "Orlando", "Orlando", "US", 28.5383, -81.3792],
    ["clt", "Charlotte", "Charlotte", "US", 35.2271, -80.8431],
    ["ral", "Raleigh", "Raleigh", "US", 35.7796, -78.6382],
    ["ric", "Richmond", "Richmond, Virginia", "US", 37.5407, -77.436],
    ["avl", "Asheville", "Asheville", "US", 35.5951, -82.5515],
    ["chs", "Charleston", "Charleston, South Carolina", "US", 32.7765, -79.9311],
    ["sav", "Savannah", "Savannah", "US", 32.0809, -81.0912],
    ["btv", "Burlington", "Burlington, Vermont", "US", 44.4759, -73.2121],
    ["pvd", "Providence", "Providence", "US", 41.824, -71.4128],
    ["buf", "Buffalo", "Buffalo", "US", 42.8864, -78.8784],
    ["ott", "Ottawa", "Ottawa", "CA", 45.4215, -75.6972],
    ["qc", "Quebec City", "Quebec City", "CA", 46.8139, -71.208],
    ["hfx", "Halifax", "Halifax", "CA", 44.6488, -63.5752],
    ["wpg", "Winnipeg", "Winnipeg", "CA", 49.8951, -97.1384],
    ["cgy", "Calgary", "Calgary", "CA", 51.0447, -114.0719],
    ["edm", "Edmonton", "Edmonton", "CA", 53.5461, -113.4938],
    ["vic", "Victoria", "Victoria, British Columbia", "CA", 48.4284, -123.3656],
  ],
  "latin-america": [
    ["mex", "Mexico City", "Mexico City", "MX", 19.4326, -99.1332, 1],
    ["sao", "São Paulo", "São Paulo", "BR", -23.5505, -46.6333, 1],
    ["bue", "Buenos Aires", "Buenos Aires", "AR", -34.6037, -58.3816, 1],
    ["bog", "Bogotá", "Bogotá", "CO", 4.711, -74.0721, 1],
    ["scl", "Santiago", "Santiago, Chile", "CL", -33.4489, -70.6693, 1],
    ["rio", "Rio de Janeiro", "Rio de Janeiro", "BR", -22.9068, -43.1729, 1],
    ["lim", "Lima", "Lima", "PE", -12.0464, -77.0428, 1],
    ["gdl", "Guadalajara", "Guadalajara", "MX", 20.6597, -103.3496, 1],
    ["mty", "Monterrey", "Monterrey", "MX", 25.6866, -100.3161],
    ["tij", "Tijuana", "Tijuana", "MX", 32.5149, -117.0382],
    ["mde", "Medellín", "Medellín", "CO", 6.2442, -75.5812],
    ["uio", "Quito", "Quito", "EC", -0.1807, -78.4678],
    ["mvd", "Montevideo", "Montevideo", "UY", -34.9011, -56.1645],
    ["cor", "Córdoba", "Córdoba, Argentina", "AR", -31.4201, -64.1888],
    ["bhz", "Belo Horizonte", "Belo Horizonte", "BR", -19.9167, -43.9345],
    ["cwb", "Curitiba", "Curitiba", "BR", -25.4284, -49.2733],
    ["poa", "Porto Alegre", "Porto Alegre", "BR", -30.0346, -51.2177],
    ["sju", "San Juan", "San Juan, Puerto Rico", "PR", 18.4655, -66.1057],
    ["pty", "Panama City", "Panama City", "PA", 8.9824, -79.5199],
    ["sjo", "San José", "San José, Costa Rica", "CR", 9.9281, -84.0907],
    ["gua", "Guatemala City", "Guatemala City", "GT", 14.6349, -90.5069],
  ],
  europe: [
    ["par", "Paris", "Paris", "FR", 48.8566, 2.3522, 1],
    ["ber", "Berlin", "Berlin", "DE", 52.52, 13.405, 1],
    ["ams", "Amsterdam", "Amsterdam", "NL", 52.3676, 4.9041, 1],
    ["bcn", "Barcelona", "Barcelona", "ES", 41.3874, 2.1686, 1],
    ["mad", "Madrid", "Madrid", "ES", 40.4168, -3.7038, 1],
    ["lis", "Lisbon", "Lisbon", "PT", 38.7223, -9.1393, 1],
    ["cph", "Copenhagen", "Copenhagen", "DK", 55.6761, 12.5683, 1],
    ["sto", "Stockholm", "Stockholm", "SE", 59.3293, 18.0686, 1],
    ["mil", "Milan", "Milan", "IT", 45.4642, 9.19, 1],
    ["bru", "Brussels", "Brussels", "BE", 50.8503, 4.3517, 1],
    ["pra", "Prague", "Prague", "CZ", 50.0755, 14.4378, 1],
    ["war", "Warsaw", "Warsaw", "PL", 52.2297, 21.0122, 1],
    ["vie", "Vienna", "Vienna", "AT", 48.2082, 16.3738, 1],
    ["ham", "Hamburg", "Hamburg", "DE", 53.5511, 9.9937, 1],
    ["muc", "Munich", "Munich", "DE", 48.1351, 11.582, 1],
    ["rom", "Rome", "Rome", "IT", 41.9028, 12.4964, 1],
    ["osl", "Oslo", "Oslo", "NO", 59.9139, 10.7522, 1],
    ["zrh", "Zurich", "Zurich", "CH", 47.3769, 8.5417],
    ["cgn", "Cologne", "Cologne", "DE", 50.9375, 6.9603],
    ["fra", "Frankfurt", "Frankfurt", "DE", 50.1109, 8.6821],
    ["lei", "Leipzig", "Leipzig", "DE", 51.3397, 12.3731],
    ["lyo", "Lyon", "Lyon", "FR", 45.764, 4.8357],
    ["mrs", "Marseille", "Marseille", "FR", 43.2965, 5.3698],
    ["rtm", "Rotterdam", "Rotterdam", "NL", 51.9244, 4.4777],
    ["utr", "Utrecht", "Utrecht", "NL", 52.0907, 5.1214],
    ["anr", "Antwerp", "Antwerp", "BE", 51.2194, 4.4025],
    ["opo", "Porto", "Porto", "PT", 41.1579, -8.6291],
    ["vlc", "Valencia", "Valencia, Spain", "ES", 39.4699, -0.3763],
    ["blq", "Bologna", "Bologna", "IT", 44.4949, 11.3426],
    ["got", "Gothenburg", "Gothenburg", "SE", 57.7089, 11.9746],
    ["aar", "Aarhus", "Aarhus", "DK", 56.1629, 10.2039],
    ["hel", "Helsinki", "Helsinki", "FI", 60.1699, 24.9384],
    ["bud", "Budapest", "Budapest", "HU", 47.4979, 19.0402],
    ["krk", "Kraków", "Kraków", "PL", 50.0647, 19.945],
    ["zag", "Zagreb", "Zagreb", "HR", 45.815, 15.9819],
    ["bel", "Belgrade", "Belgrade", "RS", 44.7866, 20.4489],
    ["ath", "Athens", "Athens, Greece", "GR", 37.9838, 23.7275],
  ],
  "uk-ireland": [
    ["lon", "London", "London", "GB", 51.5074, -0.1278, 1],
    ["man", "Manchester", "Manchester", "GB", 53.4808, -2.2426, 1],
    ["gla", "Glasgow", "Glasgow", "GB", 55.8642, -4.2518, 1],
    ["dub", "Dublin", "Dublin", "IE", 53.3498, -6.2603, 1],
    ["bri", "Bristol", "Bristol", "GB", 51.4545, -2.5879, 1],
    ["bhx", "Birmingham", "Birmingham, England", "GB", 52.4862, -1.8904, 1],
    ["edi", "Edinburgh", "Edinburgh", "GB", 55.9533, -3.1883, 1],
    ["lds", "Leeds", "Leeds", "GB", 53.8008, -1.5491],
    ["lpl", "Liverpool", "Liverpool", "GB", 53.4084, -2.9916],
    ["shf", "Sheffield", "Sheffield", "GB", 53.3811, -1.4701],
    ["not", "Nottingham", "Nottingham", "GB", 52.9548, -1.1581],
    ["ncl", "Newcastle", "Newcastle upon Tyne", "GB", 54.9783, -1.6178],
    ["btn", "Brighton", "Brighton, England", "GB", 50.8225, -0.1372],
    ["cwl", "Cardiff", "Cardiff", "GB", 51.4816, -3.1791],
    ["bfs", "Belfast", "Belfast", "GB", 54.5973, -5.9301],
    ["ork", "Cork", "Cork, Ireland", "IE", 51.8985, -8.4756],
    ["gwy", "Galway", "Galway", "IE", 53.2707, -9.0568],
  ],
  "asia-pacific": [
    ["tyo", "Tokyo", "Tokyo", "JP", 35.6762, 139.6503, 1],
    ["osa", "Osaka", "Osaka", "JP", 34.6937, 135.5023, 1],
    ["sel", "Seoul", "Seoul", "KR", 37.5665, 126.978, 1],
    ["sin", "Singapore", "Singapore", "SG", 1.3521, 103.8198, 1],
    ["bkk", "Bangkok", "Bangkok", "TH", 13.7563, 100.5018, 1],
    ["mnl", "Manila", "Manila", "PH", 14.5995, 120.9842, 1],
    ["jkt", "Jakarta", "Jakarta", "ID", -6.2088, 106.8456, 1],
    ["syd", "Sydney", "Sydney", "AU", -33.8688, 151.2093, 1],
    ["mel", "Melbourne", "Melbourne", "AU", -37.8136, 144.9631, 1],
    ["akl", "Auckland", "Auckland", "NZ", -36.8485, 174.7633, 1],
    ["tpe", "Taipei", "Taipei", "TW", 25.033, 121.5654, 1],
    ["hkg", "Hong Kong", "Hong Kong", "HK", 22.3193, 114.1694, 1],
    ["kul", "Kuala Lumpur", "Kuala Lumpur", "MY", 3.139, 101.6869, 1],
    ["bne", "Brisbane", "Brisbane", "AU", -27.4698, 153.0251],
    ["per", "Perth", "Perth, Australia", "AU", -31.9505, 115.8605],
    ["adl", "Adelaide", "Adelaide", "AU", -34.9285, 138.6007],
    ["wlg", "Wellington", "Wellington", "NZ", -41.2865, 174.7762],
    ["ngo", "Nagoya", "Nagoya", "JP", 35.1815, 136.9066],
    ["kyo", "Kyoto", "Kyoto", "JP", 35.0116, 135.7681],
    ["fuk", "Fukuoka", "Fukuoka", "JP", 33.5904, 130.4017],
    ["spk", "Sapporo", "Sapporo", "JP", 43.0618, 141.3545],
    ["pus", "Busan", "Busan", "KR", 35.1796, 129.0756],
    ["sgn", "Ho Chi Minh City", "Ho Chi Minh City", "VN", 10.8231, 106.6297],
    ["han", "Hanoi", "Hanoi", "VN", 21.0278, 105.8342],
    ["cnx", "Chiang Mai", "Chiang Mai", "TH", 18.7883, 98.9853],
    ["dps", "Bali", "Bali", "ID", -8.6705, 115.2126],
  ],
  india: [
    ["bom", "Mumbai", "Mumbai", "IN", 19.076, 72.8777, 1],
    ["del", "New Delhi", "New Delhi", "IN", 28.6139, 77.209, 1],
    ["blr", "Bengaluru", "Bangalore", "IN", 12.9716, 77.5946, 1],
    ["pnq", "Pune", "Pune", "IN", 18.5204, 73.8567, 1],
    ["hyd", "Hyderabad", "Hyderabad, India", "IN", 17.385, 78.4867, 1],
    ["ccu", "Kolkata", "Kolkata", "IN", 22.5726, 88.3639, 1],
    ["maa", "Chennai", "Chennai", "IN", 13.0827, 80.2707, 1],
    ["goa", "Goa", "Goa", "IN", 15.4909, 73.8278],
    ["shl", "Shillong", "Shillong", "IN", 25.5788, 91.8933],
    ["amd", "Ahmedabad", "Ahmedabad", "IN", 23.0225, 72.5714],
    ["jai", "Jaipur", "Jaipur", "IN", 26.9124, 75.7873],
    ["ixc", "Chandigarh", "Chandigarh", "IN", 30.7333, 76.7794],
    ["ldh", "Ludhiana", "Ludhiana", "IN", 30.901, 75.8573],
    ["lko", "Lucknow", "Lucknow", "IN", 26.8467, 80.9462],
    ["idr", "Indore", "Indore", "IN", 22.7196, 75.8577],
    ["cok", "Kochi", "Kochi", "IN", 9.9312, 76.2673],
    ["gau", "Guwahati", "Guwahati", "IN", 26.1445, 91.7362],
  ],
};

export const CITIES: City[] = (Object.entries(ROWS) as [Region, Row[]][]).flatMap(([region, rows]) =>
  rows.map(([id, name, query, country, lat, lng, tier]) => ({ id, name, query, country, region, lat, lng, tier: tier ?? 2 })),
);

export const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]));

const WORLD_IDS = ["nyc", "la", "chi", "tor", "mex", "sao", "lon", "dub", "par", "ber", "ams", "bcn", "cph", "tyo", "sel", "sin", "syd", "mel", "bom", "blr"];

export function citiesForRegion(region: Region | "world"): City[] {
  if (region === "world") return WORLD_IDS.map((id) => CITY_BY_ID.get(id)!);
  return CITIES.filter((c) => c.region === region);
}

export function findCity(nameOrId: string): City | undefined {
  const key = nameOrId.trim().toLowerCase();
  return (
    CITY_BY_ID.get(key) ??
    CITIES.find((c) => c.name.toLowerCase() === key || c.query.toLowerCase() === key) ??
    CITIES.find((c) => c.name.toLowerCase().startsWith(key))
  );
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Standard geohash of a point, used to find the Qloo heatmap cell a city centre falls in. */
export function geohash(lat: number, lng: number, precision: number): string {
  const latR = [-90, 90];
  const lngR = [-180, 180];
  let bit = 0;
  let ch = 0;
  let even = true;
  let out = "";
  while (out.length < precision) {
    const r = even ? lngR : latR;
    const v = even ? lng : lat;
    const mid = (r[0] + r[1]) / 2;
    if (v >= mid) {
      ch = (ch << 1) | 1;
      r[0] = mid;
    } else {
      ch <<= 1;
      r[1] = mid;
    }
    even = !even;
    if (++bit === 5) {
      out += B32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return out;
}
