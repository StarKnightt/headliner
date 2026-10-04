/**
 * MOCK FIXTURES. Hand-written stand-ins used only when QLOO_API_KEY is absent.
 * Artist, venue and brand names are real public names so the demo reads naturally, but every
 * score, ID, coordinate and relationship here is invented. The UI labels mock mode on every view.
 */
import type { Region } from "../../cities";

export type RegionWeights = Record<Region, number>;

export interface MockArtist {
  name: string;
  popularity: number;
  genres: string[];
  description: string;
  weights: RegionWeights;
  /** Index into AGE_BANDS where the audience peaks. */
  agePeak: number;
  /** -1 (male-skewed) .. 1 (female-skewed) */
  genderSkew: number;
  vibe: string[];
}

const w = (na: number, la: number, eu: number, uk: number, ap: number, ind: number): RegionWeights => ({
  "north-america": na,
  "latin-america": la,
  europe: eu,
  "uk-ireland": uk,
  "asia-pacific": ap,
  india: ind,
});

export const MOCK_ARTISTS: MockArtist[] = [
  { name: "Khruangbin", popularity: 0.93, genres: ["psychedelic", "funk", "indie"], description: "Houston trio blending Thai funk, dub and psychedelia.", weights: w(0.86, 0.7, 0.72, 0.8, 0.55, 0.35), agePeak: 2, genderSkew: -0.08, vibe: ["vinyl_culture", "natural_wine", "vintage_fashion", "surf"] },
  { name: "Japanese Breakfast", popularity: 0.88, genres: ["indie_pop", "indie_rock", "dream_pop"], description: "Michelle Zauner's lush indie-pop project.", weights: w(0.9, 0.35, 0.55, 0.7, 0.62, 0.22), agePeak: 1, genderSkew: 0.22, vibe: ["literary_fiction", "korean_cuisine", "film_photography", "a24"] },
  { name: "Prateek Kuhad", popularity: 0.81, genres: ["singer_songwriter", "indie_folk", "acoustic"], description: "Jaipur-born singer-songwriter writing in Hindi and English.", weights: w(0.48, 0.12, 0.3, 0.42, 0.38, 0.95), agePeak: 0, genderSkew: 0.3, vibe: ["coffee_culture", "poetry", "indie_cinema", "travel"] },
  { name: "Fred again..", popularity: 0.95, genres: ["electronic", "house", "uk_garage"], description: "London producer known for diaristic, sample-built dance music.", weights: w(0.82, 0.5, 0.86, 0.97, 0.66, 0.4), agePeak: 0, genderSkew: 0.02, vibe: ["club_culture", "streetwear", "festival", "running"] },
  { name: "Phoebe Bridgers", popularity: 0.92, genres: ["indie_folk", "indie_rock", "singer_songwriter"], description: "LA songwriter of wry, devastating indie folk.", weights: w(0.94, 0.3, 0.6, 0.8, 0.55, 0.2), agePeak: 0, genderSkew: 0.35, vibe: ["thrift", "horror_film", "tattoo", "poetry"] },
  { name: "Hiatus Kaiyote", popularity: 0.76, genres: ["neo_soul", "jazz_fusion", "future_soul"], description: "Melbourne future-soul band with jazz-fusion chops.", weights: w(0.7, 0.45, 0.74, 0.76, 0.82, 0.3), agePeak: 2, genderSkew: 0.05, vibe: ["jazz_bars", "vinyl_culture", "plant_based", "art_galleries"] },
  { name: "Peggy Gou", popularity: 0.89, genres: ["house", "techno", "electronic"], description: "Berlin-based Korean DJ and producer.", weights: w(0.7, 0.55, 0.93, 0.85, 0.86, 0.45), agePeak: 1, genderSkew: 0.1, vibe: ["fashion", "club_culture", "korean_cuisine", "design"] },
  { name: "Men I Trust", popularity: 0.79, genres: ["dream_pop", "indie_pop", "bedroom_pop"], description: "Montreal trio of hushed, groove-led dream pop.", weights: w(0.8, 0.88, 0.7, 0.62, 0.7, 0.32), agePeak: 0, genderSkew: 0.12, vibe: ["film_photography", "cafes", "vintage_fashion", "lofi"] },
  { name: "Turnstile", popularity: 0.84, genres: ["hardcore_punk", "alternative_rock"], description: "Baltimore hardcore band with a technicolor edge.", weights: w(0.92, 0.5, 0.66, 0.74, 0.42, 0.18), agePeak: 1, genderSkew: -0.3, vibe: ["skateboarding", "streetwear", "tattoo", "craft_beer"] },
  { name: "Arlo Parks", popularity: 0.74, genres: ["indie_pop", "neo_soul", "singer_songwriter"], description: "London poet and songwriter of warm, observational pop.", weights: w(0.62, 0.22, 0.68, 0.92, 0.4, 0.25), agePeak: 0, genderSkew: 0.32, vibe: ["poetry", "bookshops", "mental_health", "cafes"] },
  { name: "Lizzy McAlpine", popularity: 0.8, genres: ["singer_songwriter", "indie_pop", "folk_pop"], description: "Philadelphia songwriter of intimate, theatrical folk-pop.", weights: w(0.93, 0.25, 0.5, 0.72, 0.5, 0.2), agePeak: 0, genderSkew: 0.42, vibe: ["musical_theatre", "thrift", "journaling", "cafes"] },
  { name: "BADBADNOTGOOD", popularity: 0.78, genres: ["jazz", "instrumental_hip_hop", "neo_soul"], description: "Toronto jazz group with hip-hop roots.", weights: w(0.84, 0.6, 0.7, 0.72, 0.68, 0.34), agePeak: 2, genderSkew: -0.25, vibe: ["sneakers", "vinyl_culture", "jazz_bars", "skateboarding"] },
  { name: "Cigarettes After Sex", popularity: 0.87, genres: ["dream_pop", "ambient_pop", "slowcore"], description: "El Paso band of slow, cinematic dream pop.", weights: w(0.8, 0.92, 0.78, 0.7, 0.75, 0.48), agePeak: 0, genderSkew: 0.05, vibe: ["film_noir", "film_photography", "night_life", "perfume"] },
  { name: "Anoushka Shankar", popularity: 0.7, genres: ["indian_classical", "world_fusion", "sitar"], description: "Sitarist bridging Hindustani classical and contemporary music.", weights: w(0.55, 0.2, 0.7, 0.8, 0.45, 0.88), agePeak: 4, genderSkew: 0.1, vibe: ["yoga", "art_galleries", "world_cinema", "tea"] },
  { name: "Lucy Dacus", popularity: 0.75, genres: ["indie_rock", "singer_songwriter"], description: "Richmond songwriter of literate indie rock.", weights: w(0.9, 0.18, 0.5, 0.7, 0.45, 0.15), agePeak: 1, genderSkew: 0.36, vibe: ["bookshops", "thrift", "poetry", "craft_beer"] },
  { name: "Mdou Moctar", popularity: 0.66, genres: ["tuareg_rock", "psychedelic", "desert_blues"], description: "Tuareg guitarist from Niger, psychedelic desert blues.", weights: w(0.7, 0.4, 0.82, 0.76, 0.4, 0.25), agePeak: 3, genderSkew: -0.2, vibe: ["vinyl_culture", "world_cinema", "natural_wine", "travel"] },
];

export const AGE_BANDS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;

/** Per-city scene bonus (0..1) by genre family: big music cities over-index on everything. */
export const SCENE_BONUS: Record<string, number> = {
  nyc: 0.12, la: 0.1, chi: 0.08, atx: 0.1, nash: 0.04, sea: 0.08, pdx: 0.1, sf: 0.05, den: 0.06, atl: 0.03, phl: 0.06,
  bos: 0.05, msp: 0.07, tor: 0.08, mtl: 0.09, van: 0.05, mex: 0.1, sao: 0.06, bue: 0.06, bog: 0.04, scl: 0.04,
  lon: 0.12, man: 0.09, gla: 0.1, dub: 0.07, bri: 0.08, par: 0.08, ber: 0.12, ams: 0.1, bcn: 0.07, mad: 0.05, lis: 0.06,
  cph: 0.08, sto: 0.06, mil: 0.04, bru: 0.05, pra: 0.04, war: 0.04, tyo: 0.09, osa: 0.05, sel: 0.07, sin: 0.05,
  bkk: 0.03, mnl: 0.04, jkt: 0.03, syd: 0.07, mel: 0.11, akl: 0.05, bom: 0.1, del: 0.06, blr: 0.12, pnq: 0.07,
  hyd: 0.04, ccu: 0.05, goa: 0.06, shl: 0.08,
};

export type VenueTier = "club" | "theatre" | "hall";

/** Real venue names per catalogue city (mock coordinates and scores). */
export const MOCK_VENUES: Record<string, [string, VenueTier, string][]> = {
  nyc: [["Bowery Ballroom", "club", "6 Delancey St"], ["Webster Hall", "theatre", "125 E 11th St"], ["Brooklyn Steel", "hall", "319 Frost St, Brooklyn"], ["Music Hall of Williamsburg", "club", "66 N 6th St, Brooklyn"]],
  la: [["The Troubadour", "club", "9081 Santa Monica Blvd"], ["The Fonda Theatre", "theatre", "6126 Hollywood Blvd"], ["The Wiltern", "hall", "3790 Wilshire Blvd"], ["Lodge Room", "club", "104 N Ave 56"]],
  chi: [["Lincoln Hall", "club", "2424 N Lincoln Ave"], ["Thalia Hall", "theatre", "1807 S Allport St"], ["Metro", "theatre", "3730 N Clark St"]],
  atx: [["Mohawk", "club", "912 Red River St"], ["Stubb's Waller Creek", "hall", "801 Red River St"], ["Scoot Inn", "club", "1308 E 4th St"]],
  nash: [["The Basement East", "club", "917 Woodland St"], ["Brooklyn Bowl Nashville", "theatre", "925 3rd Ave N"], ["Ryman Auditorium", "hall", "116 5th Ave N"]],
  sea: [["Neumos", "club", "925 E Pike St"], ["The Showbox", "theatre", "1426 1st Ave"], ["Paramount Theatre", "hall", "911 Pine St"]],
  pdx: [["Mississippi Studios", "club", "3939 N Mississippi Ave"], ["Wonder Ballroom", "theatre", "128 NE Russell St"], ["Crystal Ballroom", "hall", "1332 W Burnside St"]],
  sf: [["The Independent", "club", "628 Divisadero St"], ["The Fillmore", "theatre", "1805 Geary Blvd"], ["The Warfield", "hall", "982 Market St"]],
  den: [["Bluebird Theater", "club", "3317 E Colfax Ave"], ["Ogden Theatre", "theatre", "935 E Colfax Ave"], ["Mission Ballroom", "hall", "4242 Wynkoop St"]],
  atl: [["Terminal West", "club", "887 W Marietta St"], ["Variety Playhouse", "theatre", "1099 Euclid Ave NE"], ["The Tabernacle", "hall", "152 Luckie St NW"]],
  phl: [["Johnny Brenda's", "club", "1201 Frankford Ave"], ["Union Transfer", "theatre", "1026 Spring Garden St"], ["The Fillmore Philadelphia", "hall", "29 E Allen St"]],
  bos: [["The Sinclair", "club", "52 Church St, Cambridge"], ["Paradise Rock Club", "theatre", "967 Commonwealth Ave"], ["Roadrunner", "hall", "89 Guest St"]],
  msp: [["7th St Entry", "club", "701 N 1st Ave"], ["First Avenue", "theatre", "701 N 1st Ave"], ["Palace Theatre", "hall", "17 W 7th Pl, St Paul"]],
  tor: [["Lee's Palace", "club", "529 Bloor St W"], ["The Danforth Music Hall", "theatre", "147 Danforth Ave"], ["History", "hall", "1663 Queen St E"]],
  mtl: [["La Sala Rossa", "club", "4848 Boul St-Laurent"], ["Théâtre Fairmount", "theatre", "5240 Av du Parc"], ["MTELUS", "hall", "59 Rue Ste-Catherine E"]],
  van: [["Fox Cabaret", "club", "2321 Main St"], ["The Commodore Ballroom", "theatre", "868 Granville St"], ["Orpheum", "hall", "601 Smithe St"]],
  mex: [["Foro Indie Rocks!", "club", "Zacatecas 39, Roma Nte."], ["Lunario", "theatre", "Reforma 50"], ["Pepsi Center WTC", "hall", "Dakota s/n, Nápoles"]],
  sao: [["Cine Joia", "club", "Praça Carlos Gomes 82"], ["Audio", "theatre", "Av. Francisco Matarazzo 694"], ["Espaço Unimed", "hall", "R. Tagipuru 795"]],
  bue: [["Niceto Club", "club", "Niceto Vega 5510"], ["C Complejo Art Media", "theatre", "Av. Corrientes 6271"], ["Teatro Gran Rex", "hall", "Av. Corrientes 857"]],
  bog: [["Teatro Ensueño", "theatre", "Cra. 15 #26-46"], ["Video Club", "club", "Cl. 64 #13-09"], ["Royal Center", "hall", "Cra. 13 #66-80"]],
  scl: [["Club Chocolate", "club", "Ernesto Pinto Lagarrigue 192"], ["Teatro Coliseo", "theatre", "Nataniel Cox 1"], ["Teatro Caupolicán", "hall", "San Diego 850"]],
  lon: [["The Lexington", "club", "96-98 Pentonville Rd"], ["EartH Hackney", "theatre", "11-17 Stoke Newington Rd"], ["O2 Academy Brixton", "hall", "211 Stockwell Rd"], ["Village Underground", "club", "54 Holywell Ln"]],
  man: [["YES", "club", "38 Charles St"], ["Gorilla", "club", "54-56 Whitworth St W"], ["Albert Hall", "theatre", "27 Peter St"]],
  gla: [["King Tut's Wah Wah Hut", "club", "272a St Vincent St"], ["SWG3", "theatre", "100 Eastvale Pl"], ["Barrowland Ballroom", "hall", "244 Gallowgate"]],
  dub: [["Whelan's", "club", "25 Wexford St"], ["The Button Factory", "club", "Curved St, Temple Bar"], ["Vicar Street", "theatre", "58-59 Thomas St"]],
  bri: [["The Louisiana", "club", "Wapping Rd"], ["SWX", "club", "15 Nelson St"], ["O2 Academy Bristol", "theatre", "Frogmore St"]],
  par: [["La Maroquinerie", "club", "23 Rue Boyer"], ["Le Trabendo", "club", "211 Av. Jean Jaurès"], ["Élysée Montmartre", "theatre", "72 Bd de Rochechouart"], ["Le Bataclan", "theatre", "50 Bd Voltaire"]],
  ber: [["Lido", "club", "Cuvrystraße 7"], ["Astra Kulturhaus", "theatre", "Revaler Str. 99"], ["Columbiahalle", "hall", "Columbiadamm 13-21"]],
  ams: [["Paradiso", "theatre", "Weteringschans 6-8"], ["Melkweg", "theatre", "Lijnbaansgracht 234A"], ["Tolhuistuin", "club", "Tolhuisweg 5"]],
  bcn: [["Razzmatazz", "theatre", "C/ dels Almogàvers 122"], ["Apolo", "club", "C/ Nou de la Rambla 113"], ["Sala Upload", "club", "Av. Francesc Ferrer i Guàrdia 13"]],
  mad: [["Sala El Sol", "club", "C/ de los Jardines 3"], ["La Riviera", "theatre", "Paseo Bajo de la Virgen del Puerto"], ["Teatro Eslava", "club", "C/ del Arenal 11"]],
  lis: [["Musicbox", "club", "R. Nova do Carvalho 24"], ["LAV - Lisboa ao Vivo", "theatre", "Av. Infante Dom Henrique"], ["Coliseu dos Recreios", "hall", "R. das Portas de Santo Antão 96"]],
  cph: [["Loppen", "club", "Sydområdet 4B, Christiania"], ["Pumpehuset", "club", "Studiestræde 52"], ["VEGA", "theatre", "Enghavevej 40"]],
  sto: [["Nalen", "club", "Regeringsgatan 74"], ["Debaser Strand", "club", "Hornstulls strand 4"], ["Berns", "theatre", "Berzelii Park"]],
  mil: [["Santeria Toscana 31", "club", "Viale Toscana 31"], ["Magazzini Generali", "club", "Via Pietrasanta 16"], ["Alcatraz", "theatre", "Via Valtellina 25"]],
  bru: [["Botanique", "club", "Rue Royale 236"], ["Ancienne Belgique", "theatre", "Bd Anspach 110"], ["Cirque Royal", "hall", "Rue de l'Enseignement 81"]],
  pra: [["Lucerna Music Bar", "club", "Vodičkova 36"], ["Roxy Prague", "club", "Dlouhá 33"], ["Forum Karlín", "hall", "Pernerova 51"]],
  war: [["Hydrozagadka", "club", "11 Listopada 22"], ["Niebo", "club", "Nowy Świat 21"], ["Progresja", "theatre", "Fort Wola 22"]],
  tyo: [["WWW Shibuya", "club", "Udagawacho 13-17"], ["Liquidroom", "theatre", "3-16-6 Higashi, Shibuya"], ["Zepp Haneda", "hall", "Haneda Innovation City"]],
  osa: [["Shangri-La", "club", "Oyodonaka 1-1-14"], ["Umeda Club Quattro", "club", "Taiyuji-cho 8-17"], ["Zepp Namba", "hall", "Shikitsuhigashi 1-7-5"]],
  sel: [["Rolling Hall", "club", "Eoulmadang-ro 35, Mapo"], ["YES24 Live Hall", "theatre", "Gwangnaru-ro 56, Gwangjin"], ["Blue Square", "hall", "Itaewon-ro 294"]],
  sin: [["Esplanade Annexe Studio", "club", "1 Esplanade Dr"], ["The Coliseum", "theatre", "Hard Rock Hotel, Sentosa"], ["The Star Theatre", "hall", "1 Vista Exchange Green"]],
  bkk: [["Studio Lam", "club", "Sukhumvit 51"], ["Voice Space", "club", "Vibhavadi Rangsit Rd"], ["Thunder Dome", "hall", "Muang Thong Thani"]],
  mnl: [["Social House", "club", "BGC, Taguig"], ["The Music Hall", "theatre", "SM Mall of Asia"], ["New Frontier Theater", "hall", "Araneta City"]],
  jkt: [["Rossi Musik", "club", "Jl. RS Fatmawati"], ["The Pallas", "theatre", "SCBD"], ["Tennis Indoor Senayan", "hall", "Gelora Bung Karno"]],
  syd: [["Oxford Art Factory", "club", "38-46 Oxford St"], ["Metro Theatre", "theatre", "624 George St"], ["Enmore Theatre", "hall", "118-132 Enmore Rd"]],
  mel: [["The Corner Hotel", "club", "57 Swan St, Richmond"], ["Northcote Theatre", "theatre", "216 High St"], ["Forum Melbourne", "hall", "154 Flinders St"]],
  akl: [["Whammy Bar", "club", "183 Karangahape Rd"], ["The Powerstation", "theatre", "33 Mt Eden Rd"], ["Town Hall", "hall", "301-305 Queen St"]],
  bom: [["antiSOCIAL", "club", "Khar West"], ["The Quarter", "club", "Royal Opera House, Girgaon"], ["NMACC Grand Theatre", "hall", "Jio World Centre, BKC"]],
  del: [["The Piano Man Jazz Club", "club", "Safdarjung Enclave"], ["Auro Kitchen & Bar", "club", "Hauz Khas Village"], ["Siri Fort Auditorium", "hall", "August Kranti Marg"]],
  blr: [["Fandom at Gilly's Redefined", "club", "Koramangala"], ["The Humming Tree", "club", "Indiranagar"], ["Phoenix Marketcity Arena", "hall", "Whitefield Rd"]],
  pnq: [["High Spirits", "club", "Koregaon Park"], ["Mi Casa", "club", "Kalyani Nagar"], ["Amanora Park Arena", "hall", "Hadapsar"]],
  hyd: [["Hard Rock Cafe Hyderabad", "club", "Banjara Hills"], ["Shilpakala Vedika", "theatre", "HITEC City"], ["Gachibowli Indoor Stadium", "hall", "Gachibowli"]],
  ccu: [["Someplace Else", "club", "The Park, Park Street"], ["Kala Mandir", "theatre", "Shakespeare Sarani"], ["Netaji Indoor Stadium", "hall", "Eden Gardens"]],
  goa: [["Hilltop Vagator", "club", "Vagator"], ["Antares", "club", "Vagator Beach"], ["Kala Academy", "theatre", "Panaji"]],
  shl: [["Cafe Shillong", "club", "Laitumkhrah"], ["Dylan's Cafe", "club", "Dhankheti"], ["U Soso Tham Auditorium", "theatre", "State Central Library"]],
};

export interface MockBrand {
  name: string;
  category: string;
  popularity: number;
  /** Vibes/genres this brand over-indexes with. */
  affinityTo: string[];
}

export const MOCK_BRANDS: MockBrand[] = [
  { name: "Carhartt WIP", category: "Streetwear", popularity: 0.82, affinityTo: ["streetwear", "skateboarding", "hardcore_punk", "vinyl_culture", "electronic"] },
  { name: "Rough Trade", category: "Record shop", popularity: 0.68, affinityTo: ["vinyl_culture", "indie_rock", "psychedelic", "indie_pop"] },
  { name: "Polaroid", category: "Cameras", popularity: 0.8, affinityTo: ["film_photography", "dream_pop", "vintage_fashion", "thrift"] },
  { name: "Teenage Engineering", category: "Music hardware", popularity: 0.6, affinityTo: ["electronic", "house", "design", "bedroom_pop"] },
  { name: "Aesop", category: "Skincare", popularity: 0.74, affinityTo: ["design", "neo_soul", "art_galleries", "perfume"] },
  { name: "Oatly", category: "Food & drink", popularity: 0.79, affinityTo: ["plant_based", "cafes", "indie_pop", "coffee_culture"] },
  { name: "Dr. Martens", category: "Footwear", popularity: 0.87, affinityTo: ["hardcore_punk", "tattoo", "thrift", "indie_rock"] },
  { name: "Patagonia", category: "Outdoor apparel", popularity: 0.88, affinityTo: ["surf", "travel", "indie_folk", "craft_beer"] },
  { name: "Fender", category: "Instruments", popularity: 0.85, affinityTo: ["indie_rock", "psychedelic", "tuareg_rock", "singer_songwriter"] },
  { name: "Lomography", category: "Cameras", popularity: 0.55, affinityTo: ["film_photography", "lofi", "dream_pop"] },
  { name: "Stüssy", category: "Streetwear", popularity: 0.8, affinityTo: ["streetwear", "club_culture", "surf", "house"] },
  { name: "New Balance", category: "Footwear", popularity: 0.9, affinityTo: ["running", "sneakers", "streetwear", "uk_garage"] },
  { name: "Converse", category: "Footwear", popularity: 0.9, affinityTo: ["indie_rock", "skateboarding", "singer_songwriter"] },
  { name: "Levi's", category: "Denim", popularity: 0.93, affinityTo: ["vintage_fashion", "funk", "alternative_rock"] },
  { name: "Blue Bottle Coffee", category: "Coffee", popularity: 0.66, affinityTo: ["coffee_culture", "cafes", "design", "jazz"] },
  { name: "Liquid Death", category: "Beverage", popularity: 0.72, affinityTo: ["hardcore_punk", "tattoo", "skateboarding", "craft_beer"] },
  { name: "Sézane", category: "Fashion", popularity: 0.62, affinityTo: ["vintage_fashion", "cafes", "indie_pop", "poetry"] },
  { name: "Bandcamp", category: "Music platform", popularity: 0.64, affinityTo: ["vinyl_culture", "jazz", "instrumental_hip_hop", "desert_blues"] },
  { name: "Sonos", category: "Audio", popularity: 0.81, affinityTo: ["design", "house", "neo_soul"] },
  { name: "Ray-Ban", category: "Eyewear", popularity: 0.91, affinityTo: ["night_life", "film_noir", "surf", "psychedelic"] },
  { name: "Muji", category: "Lifestyle", popularity: 0.83, affinityTo: ["journaling", "design", "lofi", "bookshops"] },
  { name: "Arc'teryx", category: "Outdoor apparel", popularity: 0.79, affinityTo: ["running", "streetwear", "travel"] },
  { name: "Le Labo", category: "Fragrance", popularity: 0.65, affinityTo: ["perfume", "film_noir", "dream_pop", "art_galleries"] },
  { name: "Penguin Classics", category: "Publishing", popularity: 0.7, affinityTo: ["literary_fiction", "poetry", "bookshops", "singer_songwriter"] },
  { name: "Bira 91", category: "Beer", popularity: 0.6, affinityTo: ["craft_beer", "indie_folk", "acoustic", "festival"] },
  { name: "boAt", category: "Audio", popularity: 0.71, affinityTo: ["festival", "electronic", "acoustic", "running"] },
  { name: "Blue Tokai Coffee", category: "Coffee", popularity: 0.52, affinityTo: ["coffee_culture", "singer_songwriter", "poetry", "travel"] },
  { name: "Gentle Monster", category: "Eyewear", popularity: 0.68, affinityTo: ["fashion", "korean_cuisine", "design", "club_culture"] },
  { name: "Criterion Collection", category: "Film", popularity: 0.58, affinityTo: ["world_cinema", "a24", "indie_cinema", "horror_film", "film_noir"] },
  { name: "Lush", category: "Cosmetics", popularity: 0.8, affinityTo: ["plant_based", "mental_health", "musical_theatre"] },
];

export const MOCK_GENRE_LABELS: Record<string, string> = {
  psychedelic: "Psychedelic", funk: "Funk", indie: "Indie", indie_pop: "Indie Pop", indie_rock: "Indie Rock",
  dream_pop: "Dream Pop", singer_songwriter: "Singer-Songwriter", indie_folk: "Indie Folk", acoustic: "Acoustic",
  electronic: "Electronic", house: "House", uk_garage: "UK Garage", neo_soul: "Neo-Soul", jazz_fusion: "Jazz Fusion",
  future_soul: "Future Soul", techno: "Techno", bedroom_pop: "Bedroom Pop", hardcore_punk: "Hardcore Punk",
  alternative_rock: "Alternative Rock", folk_pop: "Folk Pop", jazz: "Jazz", instrumental_hip_hop: "Instrumental Hip-Hop",
  ambient_pop: "Ambient Pop", slowcore: "Slowcore", indian_classical: "Indian Classical", world_fusion: "World Fusion",
  sitar: "Sitar", tuareg_rock: "Tuareg Rock", desert_blues: "Desert Blues",
};
