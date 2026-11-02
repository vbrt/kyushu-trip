// =====================================================================
// TRIP CONFIGURATION (public!)
// Everything here is visible to anyone who opens the page. No booking
// codes, addresses, phone numbers or emails. Private data lives in the
// database (see private-daten.example.sql).
// =====================================================================
window.TRIP = {
  id: "sarajapan",
  title: "Sara, Ugo & Theo",
  titleAccent: "back in Japan",
  cockpitTitle: ["Kyushu", "Cockpit"],
  dateLabel: "27 Dec 2026 – 16 Jan 2027",
  start: "2026-12-27T08:00",              // Sara flies out (exact time still open)
  end: "2027-01-16T23:00",                // flight home
  departLabel: "Sara flies out on 27 December",
  routeLine: "Osaka · Fukuoka · Beppu · Miyazaki · Kirishima · Kumamoto · Unzen · Nagasaki · Ureshino · Osaka",
  intro: "Round two in Japan, this time a road trip around Kyushu: New Year's Eve in Fukuoka, hot springs in Beppu and Unzen, volcanoes in Kirishima and Nagasaki's Chinatown. Follow along here.",
  footer: "Greetings from Japan",
  heroImage: "img/hero.jpg",
  cockpitHero: "img/cockpit-hero.jpg",
  noSignalNote: "",

  people: [
    { key: "sara", name: "Sara", img: "img/p-sara.jpg", nick: "The Photographer", bio: "Takes 1,000 photos before breakfast and inspects every hotel like a Michelin judge. Will happily walk 40 minutes for the perfect matcha or a tiny shop without a sign." },
    { key: "ugo",  name: "Ugo",  img: "img/p-ugo.jpg",  nick: "Player One", bio: "Sara's best friend. Has clocked more hours on his Nintendo Switch than at his actual job and treats Japan as the final level. May need to be dragged out of every arcade." },
    { key: "theo", name: "Theo", img: "img/p-theo.jpg", nick: "Croissant Hunter", bio: "Ugo's brother and just as Japan-obsessed. Flew 9,000 km to the land of ramen and sushi to find… the perfect croissant. Kyushu's bakeries have been warned." }
  ],

  features: { blog: true, costs: true, wishes: true },

  baseCurrency: "EUR",
  currencies: ["EUR", "JPY"],
  costCategories: ["Flights", "Accommodation", "Car & fuel", "Trains & ferries", "Food & drink", "Onsen & sights", "Other"],

  // "to" = last night in this place
  stops: [
    { nm: "Getting there", ds: "Flight to Japan", from: "2026-12-27", to: "2026-12-27", dt: "27 Dec" },
    { nm: "Osaka", ds: "Reunion and street food in Dōtonbori", from: "2026-12-28", to: "2026-12-29", dt: "28–30 Dec", key: "osa" },
    { nm: "Fukuoka", ds: "Yatai, ramen and New Year's Eve", from: "2026-12-30", to: "2026-12-31", dt: "30 Dec – 1 Jan", key: "fuk" },
    { nm: "Beppu", ds: "Road trip starts: the onsen town", from: "2027-01-01", to: "2027-01-02", dt: "1–3 Jan", key: "bep" },
    { nm: "Miyazaki", ds: "The sunny east coast", from: "2027-01-03", to: "2027-01-03", dt: "3–4 Jan", key: "miy" },
    { nm: "Kirishima", ds: "Volcanoes and shrines", from: "2027-01-04", to: "2027-01-05", dt: "4–6 Jan", key: "kir" },
    { nm: "Kumamoto", ds: "Castle town", from: "2027-01-06", to: "2027-01-07", dt: "6–8 Jan", key: "kum" },
    { nm: "Unzen", ds: "Onsen with a sea view", from: "2027-01-08", to: "2027-01-08", dt: "8–9 Jan", key: "unz" },
    { nm: "Nagasaki", ds: "Chinatown and night views", from: "2027-01-09", to: "2027-01-10", dt: "9–11 Jan", key: "nag" },
    { nm: "Ureshino", ds: "Green tea and onsen tofu", from: "2027-01-11", to: "2027-01-12", dt: "11–13 Jan", key: "ure" },
    { nm: "Osaka", ds: "Last days in the city", from: "2027-01-13", to: "2027-01-15", dt: "13–16 Jan", key: "osa" },
    { nm: "Home", ds: "Flight home", from: "2027-01-16", to: "2099-12-31", dt: "16 Jan" }
  ],
  places: ["On the road", "Osaka", "Fukuoka", "Beppu", "Miyazaki", "Kirishima", "Kumamoto", "Unzen", "Nagasaki", "Ureshino", "Home"],
  statuses: ["", "All good, having a great time", "Tired but happy", "Soaking in an onsen", "Full and happy", "No signal for a few hours"],
  reactions: ["❤️", "👏", "😂", "😮", "🍜"],

  weather: [
    { key: "osa", name: "Osaka", lat: 34.69, lon: 135.50 },
    { key: "fuk", name: "Fukuoka", lat: 33.59, lon: 130.40 },
    { key: "bep", name: "Beppu", lat: 33.28, lon: 131.49 },
    { key: "miy", name: "Miyazaki", lat: 31.91, lon: 131.42 },
    { key: "kir", name: "Kirishima", lat: 31.74, lon: 130.76 },
    { key: "kum", name: "Kumamoto", lat: 32.80, lon: 130.71 },
    { key: "unz", name: "Unzen", lat: 32.74, lon: 130.26 },
    { key: "nag", name: "Nagasaki", lat: 32.75, lon: 129.87 },
    { key: "ure", name: "Ureshino", lat: 33.10, lon: 129.99 }
  ],

  placeInfo: [
    { nm: "Osaka", when: "28–30 Dec and 13–16 Jan", p: "Japan's kitchen: takoyaki, okonomiyaki and neon signs in Dōtonbori.", f: "The city's motto is kuidaore, \"eat until you drop\"." },
    { nm: "Fukuoka", when: "30 Dec – 1 Jan", p: "Kyushu's biggest city, famous for its open-air food stalls (yatai) along the river.", f: "Hakata ramen with rich pork-bone broth comes from here." },
    { nm: "Beppu", when: "1–3 Jan", p: "The onsen town: steam rises from drains, gardens and backyards.", f: "Beppu has more than 2,000 hot spring sources; the \"hells\" (jigoku) are the most famous." },
    { nm: "Miyazaki", when: "3–4 Jan", p: "Kyushu's sunny east coast with palm trees, surf beaches and ancient shrines.", f: "Saitobaru has more than 300 burial mounds from the 3rd to 7th century." },
    { nm: "Kirishima", when: "4–6 Jan", p: "Volcanic landscape with crater lakes, hiking trails and onsen villages.", f: "Kirishima is part of one of Japan's very first national parks (1934)." },
    { nm: "Kumamoto", when: "6–8 Jan", p: "Home to one of Japan's most impressive castles, rebuilt after the 2016 earthquake.", f: "The local speciality is basashi, raw horse meat sashimi." },
    { nm: "Unzen", when: "8–9 Jan", p: "Hot springs on the Shimabara Peninsula, between a volcano and the sea.", f: "Unzen became one of Japan's first three national parks in 1934." },
    { nm: "Nagasaki", when: "9–11 Jan", p: "Harbour city with a Chinatown, steep hills and one of Japan's best night views.", f: "For over 200 years, the tiny island of Dejima was Japan's only window to Europe." },
    { nm: "Ureshino", when: "11–13 Jan", p: "A small onsen town surrounded by tea fields.", f: "Its spring water is known as \"beauty water\", and tofu is simmered in it." }
  ],

  goodToKnow: [
    ["Time", "Japan is 8 hours ahead of Central Europe in winter"],
    ["Power", "100 V, type A plugs: bring an adapter"],
    ["New Year", "1–3 Jan many shops and restaurants close, shrines are packed"],
    ["Cash", "Carry yen for small restaurants, onsen and shrines"],
    ["Driving", "Japan drives on the left"]
  ],
  emergency: [["Police", "110"], ["Ambulance & fire", "119"]],

  claudeUrl: ""
};
