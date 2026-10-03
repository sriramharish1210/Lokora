import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const experiences = [
  // ── SOUTH MUMBAI / FORT ──
  { title: 'Irani Café Breakfast Trail', description: 'Hop between Britannia, Kyani & Co., and Café Military for a taste of 100-year-old Irani café culture.', category: 'food', city: 'Mumbai', area: 'Fort', latitude: 18.9322, longitude: 72.8352, durationMinutes: 90, price: 350 },
  { title: 'Crawford Market Spice Walk', description: 'Explore British-era Crawford Market with a local guide — spices, dry fruits, and street food.', category: 'food', city: 'Mumbai', area: 'Fort', latitude: 18.9478, longitude: 72.8347, durationMinutes: 75, price: 200 },
  { title: 'Kala Ghoda Art Precinct Walk', description: 'Self-guided art walk through galleries, street art and the Jehangir Art Gallery.', category: 'art', city: 'Mumbai', area: 'Kala Ghoda', latitude: 18.9281, longitude: 72.8322, durationMinutes: 75, price: 0 },
  { title: 'Marine Drive Golden Hour', description: "Walk the Queen's Necklace at sunset — the 3.6 km seafront promenade in full golden light.", category: 'nature', city: 'Mumbai', area: 'Marine Drive', latitude: 18.9440, longitude: 72.8236, durationMinutes: 45, price: 0 },
  { title: 'Sassoon Dock at Dawn', description: "Watch Koli fisherfolk unload the night catch at one of Mumbai's oldest working docks.", category: 'culture', city: 'Mumbai', area: 'Colaba', latitude: 18.9179, longitude: 72.8196, durationMinutes: 60, price: 0 },
  { title: 'Banganga Tank & Walkeshwar Temple', description: 'Ancient freshwater tank in the heart of Malabar Hill — rare living heritage site.', category: 'heritage', city: 'Mumbai', area: 'Malabar Hill', latitude: 18.9547, longitude: 72.8022, durationMinutes: 60, price: 0 },
  { title: 'Haji Ali Dargah Crossing', description: "Walk the causeway at low tide to the iconic 15th-century sea shrine.", category: 'heritage', city: 'Mumbai', area: 'Worli', latitude: 18.9823, longitude: 72.8089, durationMinutes: 45, price: 0 },
  { title: 'Elephanta Caves Ferry & Tour', description: "Ferry from Gateway of India to the UNESCO-listed rock-cut Shiva caves on Elephanta Island.", category: 'heritage', city: 'Mumbai', area: 'Gateway of India', latitude: 18.9633, longitude: 72.9315, durationMinutes: 180, price: 600 },
  // ── BANDRA ──
  { title: 'Bandra Bandstand Promenade', description: 'Stroll the iconic seafront promenade past Carter Road, colourful fishing boats, and the Bandra-Worli Sea Link at sunset.', category: 'nature', city: 'Mumbai', area: 'Bandra', latitude: 19.0449, longitude: 72.8192, durationMinutes: 50, price: 0 },
  { title: 'Mount Mary Basilica & Bandra Village', description: 'Visit the 16th-century hilltop basilica then explore the Portuguese-era lanes of Bandra village on foot.', category: 'heritage', city: 'Mumbai', area: 'Bandra', latitude: 19.0521, longitude: 72.8213, durationMinutes: 60, price: 0 },
  { title: 'Bandra Street Food — Elco Pani Puri & Kebabs', description: "A local food circuit from Elco Market's legendary pani puri stall to the kebab lanes behind Hill Road.", category: 'food', city: 'Mumbai', area: 'Bandra', latitude: 19.0590, longitude: 72.8367, durationMinutes: 60, price: 250 },
  { title: 'Bandra Reclamation Art Walk', description: 'Explore the emerging street-art district near Bandra Reclamation — murals by local and international artists.', category: 'art', city: 'Mumbai', area: 'Bandra', latitude: 19.0530, longitude: 72.8290, durationMinutes: 45, price: 0 },
  { title: 'Carter Road Café Hop', description: "Sit at one of Carter Road's open-air cafés overlooking the sea — a beloved ritual for Bandra locals.", category: 'food', city: 'Mumbai', area: 'Bandra', latitude: 19.0612, longitude: 72.8215, durationMinutes: 60, price: 300 },
  // ── DHARAVI ──
  { title: 'Dharavi Pottery Workshop', description: 'Hands-on pottery session with the Kumbhar artisan community in Dharavi.', category: 'art', city: 'Mumbai', area: 'Dharavi', latitude: 19.0400, longitude: 72.8534, durationMinutes: 120, price: 450 },
  { title: 'Dharavi Leather Craft Quarter', description: 'Tour the leather micro-factories and see how handbags and wallets are made by hand.', category: 'culture', city: 'Mumbai', area: 'Dharavi', latitude: 19.0389, longitude: 72.8521, durationMinutes: 60, price: 150 },
  // ── WORLI ──
  { title: 'Worli Sea Face Sunset Walk', description: 'Stroll the sea-face promenade at dusk watching fishing boats and the Bandra-Worli Sealink light up.', category: 'nature', city: 'Mumbai', area: 'Worli', latitude: 19.0134, longitude: 72.8170, durationMinutes: 60, price: 0 },
  // ── OLD CITY ──
  { title: 'Chor Bazaar Antique Trail', description: 'Navigate the "Thieves Market" for vintage cameras, Bollywood posters and colonial curios.', category: 'culture', city: 'Mumbai', area: 'Chor Bazaar', latitude: 18.9592, longitude: 72.8330, durationMinutes: 90, price: 0 },
  { title: 'Street Food Tour — Mohammed Ali Road', description: 'Mughlai seekh kebabs, nalli nihari, and caramelised phirni from legendary roadside vendors.', category: 'food', city: 'Mumbai', area: 'Mohammed Ali Road', latitude: 18.9604, longitude: 72.8337, durationMinutes: 90, price: 300 },
  // ── VERSOVA / GOREGAON ──
  { title: 'Versova Village Fish Market', description: "Early-morning fish auction at the Koli fishing village in Versova.", category: 'culture', city: 'Mumbai', area: 'Versova', latitude: 19.1307, longitude: 72.8135, durationMinutes: 60, price: 0 },
  { title: 'Bollywood Studio Tour — Film City', description: "Behind-the-scenes walk through active Bollywood sets in Goregaon's Film City complex.", category: 'culture', city: 'Mumbai', area: 'Goregaon', latitude: 19.1722, longitude: 72.8486, durationMinutes: 150, price: 750 },
];

async function main() {
  // Delete ItineraryItems first to avoid FK constraint, then experiences
  await prisma.itineraryItem.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.experience.createMany({ data: experiences });
  console.log(`✓ Seeded ${experiences.length} Mumbai experiences with area data.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());