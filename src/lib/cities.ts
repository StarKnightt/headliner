/**
 * Candidate tour markets. Coordinates are public city-centre points. `query` is the locality string
 * sent to Qloo (`signal.location.query` / `filter.location.query`), which is fuzzy-matched.
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

export const CITIES: City[] = [
  { id: "nyc", name: "New York", query: "New York City", country: "US", region: "north-america", lat: 40.7128, lng: -74.006 },
  { id: "la", name: "Los Angeles", query: "Los Angeles", country: "US", region: "north-america", lat: 34.0522, lng: -118.2437 },
  { id: "chi", name: "Chicago", query: "Chicago", country: "US", region: "north-america", lat: 41.8781, lng: -87.6298 },
  { id: "atx", name: "Austin", query: "Austin", country: "US", region: "north-america", lat: 30.2672, lng: -97.7431 },
  { id: "nash", name: "Nashville", query: "Nashville", country: "US", region: "north-america", lat: 36.1627, lng: -86.7816 },
  { id: "sea", name: "Seattle", query: "Seattle", country: "US", region: "north-america", lat: 47.6062, lng: -122.3321 },
  { id: "pdx", name: "Portland", query: "Portland, Oregon", country: "US", region: "north-america", lat: 45.5152, lng: -122.6784 },
  { id: "sf", name: "San Francisco", query: "San Francisco", country: "US", region: "north-america", lat: 37.7749, lng: -122.4194 },
  { id: "den", name: "Denver", query: "Denver", country: "US", region: "north-america", lat: 39.7392, lng: -104.9903 },
  { id: "atl", name: "Atlanta", query: "Atlanta", country: "US", region: "north-america", lat: 33.749, lng: -84.388 },
  { id: "phl", name: "Philadelphia", query: "Philadelphia", country: "US", region: "north-america", lat: 39.9526, lng: -75.1652 },
  { id: "bos", name: "Boston", query: "Boston", country: "US", region: "north-america", lat: 42.3601, lng: -71.0589 },
  { id: "msp", name: "Minneapolis", query: "Minneapolis", country: "US", region: "north-america", lat: 44.9778, lng: -93.265 },
  { id: "tor", name: "Toronto", query: "Toronto", country: "CA", region: "north-america", lat: 43.6532, lng: -79.3832 },
  { id: "mtl", name: "Montreal", query: "Montreal", country: "CA", region: "north-america", lat: 45.5019, lng: -73.5674 },
  { id: "van", name: "Vancouver", query: "Vancouver", country: "CA", region: "north-america", lat: 49.2827, lng: -123.1207 },
  { id: "mex", name: "Mexico City", query: "Mexico City", country: "MX", region: "latin-america", lat: 19.4326, lng: -99.1332 },
  { id: "sao", name: "São Paulo", query: "São Paulo", country: "BR", region: "latin-america", lat: -23.5505, lng: -46.6333 },
  { id: "bue", name: "Buenos Aires", query: "Buenos Aires", country: "AR", region: "latin-america", lat: -34.6037, lng: -58.3816 },
  { id: "bog", name: "Bogotá", query: "Bogotá", country: "CO", region: "latin-america", lat: 4.711, lng: -74.0721 },
  { id: "scl", name: "Santiago", query: "Santiago, Chile", country: "CL", region: "latin-america", lat: -33.4489, lng: -70.6693 },
  { id: "lon", name: "London", query: "London", country: "GB", region: "uk-ireland", lat: 51.5074, lng: -0.1278 },
  { id: "man", name: "Manchester", query: "Manchester", country: "GB", region: "uk-ireland", lat: 53.4808, lng: -2.2426 },
  { id: "gla", name: "Glasgow", query: "Glasgow", country: "GB", region: "uk-ireland", lat: 55.8642, lng: -4.2518 },
  { id: "dub", name: "Dublin", query: "Dublin", country: "IE", region: "uk-ireland", lat: 53.3498, lng: -6.2603 },
  { id: "bri", name: "Bristol", query: "Bristol", country: "GB", region: "uk-ireland", lat: 51.4545, lng: -2.5879 },
  { id: "par", name: "Paris", query: "Paris", country: "FR", region: "europe", lat: 48.8566, lng: 2.3522 },
  { id: "ber", name: "Berlin", query: "Berlin", country: "DE", region: "europe", lat: 52.52, lng: 13.405 },
  { id: "ams", name: "Amsterdam", query: "Amsterdam", country: "NL", region: "europe", lat: 52.3676, lng: 4.9041 },
  { id: "bcn", name: "Barcelona", query: "Barcelona", country: "ES", region: "europe", lat: 41.3874, lng: 2.1686 },
  { id: "mad", name: "Madrid", query: "Madrid", country: "ES", region: "europe", lat: 40.4168, lng: -3.7038 },
  { id: "lis", name: "Lisbon", query: "Lisbon", country: "PT", region: "europe", lat: 38.7223, lng: -9.1393 },
  { id: "cph", name: "Copenhagen", query: "Copenhagen", country: "DK", region: "europe", lat: 55.6761, lng: 12.5683 },
  { id: "sto", name: "Stockholm", query: "Stockholm", country: "SE", region: "europe", lat: 59.3293, lng: 18.0686 },
  { id: "mil", name: "Milan", query: "Milan", country: "IT", region: "europe", lat: 45.4642, lng: 9.19 },
  { id: "bru", name: "Brussels", query: "Brussels", country: "BE", region: "europe", lat: 50.8503, lng: 4.3517 },
  { id: "pra", name: "Prague", query: "Prague", country: "CZ", region: "europe", lat: 50.0755, lng: 14.4378 },
  { id: "war", name: "Warsaw", query: "Warsaw", country: "PL", region: "europe", lat: 52.2297, lng: 21.0122 },
  { id: "tyo", name: "Tokyo", query: "Tokyo", country: "JP", region: "asia-pacific", lat: 35.6762, lng: 139.6503 },
  { id: "osa", name: "Osaka", query: "Osaka", country: "JP", region: "asia-pacific", lat: 34.6937, lng: 135.5023 },
  { id: "sel", name: "Seoul", query: "Seoul", country: "KR", region: "asia-pacific", lat: 37.5665, lng: 126.978 },
  { id: "sin", name: "Singapore", query: "Singapore", country: "SG", region: "asia-pacific", lat: 1.3521, lng: 103.8198 },
  { id: "bkk", name: "Bangkok", query: "Bangkok", country: "TH", region: "asia-pacific", lat: 13.7563, lng: 100.5018 },
  { id: "mnl", name: "Manila", query: "Manila", country: "PH", region: "asia-pacific", lat: 14.5995, lng: 120.9842 },
  { id: "jkt", name: "Jakarta", query: "Jakarta", country: "ID", region: "asia-pacific", lat: -6.2088, lng: 106.8456 },
  { id: "syd", name: "Sydney", query: "Sydney", country: "AU", region: "asia-pacific", lat: -33.8688, lng: 151.2093 },
  { id: "mel", name: "Melbourne", query: "Melbourne", country: "AU", region: "asia-pacific", lat: -37.8136, lng: 144.9631 },
  { id: "akl", name: "Auckland", query: "Auckland", country: "NZ", region: "asia-pacific", lat: -36.8485, lng: 174.7633 },
  { id: "bom", name: "Mumbai", query: "Mumbai", country: "IN", region: "india", lat: 19.076, lng: 72.8777 },
  { id: "del", name: "New Delhi", query: "New Delhi", country: "IN", region: "india", lat: 28.6139, lng: 77.209 },
  { id: "blr", name: "Bengaluru", query: "Bangalore", country: "IN", region: "india", lat: 12.9716, lng: 77.5946 },
  { id: "pnq", name: "Pune", query: "Pune", country: "IN", region: "india", lat: 18.5204, lng: 73.8567 },
  { id: "hyd", name: "Hyderabad", query: "Hyderabad", country: "IN", region: "india", lat: 17.385, lng: 78.4867 },
  { id: "ccu", name: "Kolkata", query: "Kolkata", country: "IN", region: "india", lat: 22.5726, lng: 88.3639 },
  { id: "goa", name: "Goa", query: "Goa", country: "IN", region: "india", lat: 15.4909, lng: 73.8278 },
  { id: "shl", name: "Shillong", query: "Shillong", country: "IN", region: "india", lat: 25.5788, lng: 91.8933 },
];

export const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]));

export function citiesForRegion(region: Region | "world"): City[] {
  if (region === "world") {
    const worldIds = ["nyc", "la", "chi", "tor", "mex", "sao", "lon", "dub", "par", "ber", "ams", "bcn", "cph", "tyo", "sel", "sin", "syd", "mel", "bom", "blr"];
    return worldIds.map((id) => CITY_BY_ID.get(id)!);
  }
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
