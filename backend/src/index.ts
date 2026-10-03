import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { getGeminiAdaptation } from './services/gemini';
import { parseContext, rankExperiences, generatePlanSummary } from './services/context';

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function fromMins(m: number): string {
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function addMins(t: string, mins: number): string { return fromMins(toMins(t) + mins); }
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function travelMins(distKm: number): number { return Math.ceil((distKm / 20) * 60); }

function buildSchedule(
  experiences: any[], startTime: string, endTime: string, budget: number,
  fromLat?: number, fromLng?: number,
) {
  const items: { experienceId: string; startTime: string; endTime: string; travelMinutes: number; order: number }[] = [];
  let cursor = startTime; let remaining = budget;
  let curLat = fromLat; let curLng = fromLng;
  for (const exp of experiences) {
    const travel = (curLat != null && curLng != null)
      ? travelMins(haversineKm(curLat, curLng, exp.latitude, exp.longitude)) : 0;
    const slotStart = addMins(cursor, travel);
    const slotEnd = addMins(slotStart, exp.durationMinutes);
    if (toMins(slotEnd) > toMins(endTime)) continue;
    if (exp.price > remaining) continue;
    items.push({ experienceId: exp.id, startTime: slotStart, endTime: slotEnd, travelMinutes: travel, order: items.length });
    cursor = slotEnd; remaining -= exp.price;
    curLat = exp.latitude; curLng = exp.longitude;
  }
  return items;
}

async function getFullItinerary(id: string) {
  return prisma.itinerary.findUnique({
    where: { id },
    include: {
      items: { include: { experience: true }, orderBy: { order: 'asc' } },
      adaptations: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
}

// ─── GET /api/experiences ─────────────────────────────────────────────────────

app.get('/api/experiences', async (_req, res) => {
  const experiences = await prisma.experience.findMany({ where: { isAvailable: true } });
  res.json(experiences);
});

// ─── POST /api/itineraries ────────────────────────────────────────────────────

app.post('/api/itineraries', async (req, res) => {
  const { destination, startTime, endTime, budget, preferences = [] } = req.body;
  if (!destination || !startTime || !endTime || !budget)
    return res.status(400).json({ error: 'destination, startTime, endTime, budget are required' });
  if (toMins(endTime) <= toMins(startTime))
    return res.status(400).json({ error: 'endTime must be after startTime' });

  const prefs: string[] = Array.isArray(preferences) ? preferences : [];
  const where: any = {
    city: { contains: destination },
    isAvailable: true,
    ...(prefs.length > 0 ? { category: { in: prefs } } : {}),
  };
  const experiences = await prisma.experience.findMany({ where, orderBy: [{ price: 'asc' }] });
  if (experiences.length === 0)
    return res.status(404).json({ error: `No experiences found in ${destination}` });

  const items = buildSchedule(experiences, startTime, endTime, Number(budget));
  const itinerary = await prisma.itinerary.create({
    data: {
      destination, startTime, endTime, budget: Number(budget),
      preferences: JSON.stringify(prefs),
      items: { create: items },
    },
    include: { items: { include: { experience: true }, orderBy: { order: 'asc' } } },
  });
  res.status(201).json(itinerary);
});

// ─── GET /api/itineraries/:id ─────────────────────────────────────────────────

app.get('/api/itineraries/:id', async (req, res) => {
  const itinerary = await getFullItinerary(req.params.id);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });
  res.json(itinerary);
});

// ─── POST /api/itineraries/:id/adapt ─────────────────────────────────────────

app.post('/api/itineraries/:id/adapt', async (req, res) => {
  const itinerary = await getFullItinerary(req.params.id);
  if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

  // ── Natural-language message → structured params ──────────────────────────
  let body = { ...req.body };
  if (body.message && !body.type) {
    const msg = (body.message as string).toLowerCase();

    // LESS_TIME: "45 minutes", "an hour", "half an hour"
    const hrMatch  = msg.match(/(\d+(?:\.\d+)?)\s*hour/);
    const minMatch = msg.match(/only\s+(\d+)\s*min|(\d+)\s*min(?:utes?)?\s+(?:now|left|only)/);
    const halfHour = /half\s+an?\s+hour/.test(msg);
    const anHour   = /\ban?\s+hour\b/.test(msg);
    if (hrMatch || minMatch || halfHour || anHour) {
      body.type = 'LESS_TIME';
      if (hrMatch)      body.availableMinutes = Math.round(parseFloat(hrMatch[1]) * 60);
      else if (minMatch) body.availableMinutes = parseInt(minMatch[1] || minMatch[2]);
      else if (halfHour) body.availableMinutes = 30;
      else               body.availableMinutes = 60;
    }
    // LOCATION_CHANGED: "I'm now in X" / "I am in X" / "moved to X"
    else if (/(?:i'?m\s+now\s+in|i\s+am\s+now\s+in|moved\s+to|heading\s+to|just\s+arrived\s+in|i'?m\s+in)\s+([\w\s]+?)(?:\s*[\.,]|$)/i.test(body.message)) {
      const locMatch = body.message.match(/(?:i'?m\s+now\s+in|i\s+am\s+now\s+in|moved\s+to|heading\s+to|just\s+arrived\s+in|i'?m\s+in)\s+([\w\s]+?)(?:\s*[\.,]|$)/i);
      if (locMatch) {
        const locName = locMatch[1].trim();
        // resolve area → lat/lng from seed data centroid fallback; pass location name for DB matching
        body.type = 'LOCATION_CHANGED';
        body.newLocation = locName;   // used below in LOCATION_CHANGED handler
        // default coords — overridden if the new location is known
        body.latitude  = body.latitude  ?? 18.9322;
        body.longitude = body.longitude ?? 72.8352;
      }
    }
    // PREFERENCE_CHANGED: "I don't want food" / "I want cultural"
    else if (/don'?t\s+want|not\s+interested\s+in|avoid|something\s+(?:cultural|heritage|art|nature|local)|i\s+want\s+(?:cultural|heritage|art|food|nature)/.test(msg)) {
      body.type = 'PREFERENCE_CHANGED';
    }
    // EXPERIENCE_UNAVAILABLE: "closed", "not available", "can't go"
    else if (/closed|not\s+(?:open|available)|shut|can'?t\s+(?:go|visit)|won'?t\s+be\s+(?:open|available)/.test(msg)) {
      body.type = 'EXPERIENCE_UNAVAILABLE';
    }
  }

  const { type } = body;
  const validTypes = ['LESS_TIME', 'LOCATION_CHANGED', 'EXPERIENCE_UNAVAILABLE', 'PREFERENCE_CHANGED'];
  if (!validTypes.includes(type))
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}. Or send a { "message": "..." } to auto-detect.` });

  const changes: any[] = [];
  let summary = '';
  let reason = '';
  let explanation = '';
  let timeSaved = 0;
  let aiPowered = false;
  const prefs: string[] = JSON.parse(itinerary.preferences || '[]');

  // ── LESS_TIME ───────────────────────────────────────────────────────────────
  if (type === 'LESS_TIME') {
    const limit = Number(body.availableMinutes);
    if (!limit) return res.status(400).json({ error: 'availableMinutes required' });

    let used = 0;
    const keep: any[] = [];
    const remove: any[] = [];
    for (const item of itinerary.items) {
      const cost = item.experience.durationMinutes + item.travelMinutes;
      if (used + cost <= limit) { keep.push(item); used += cost; }
      else { remove.push(item); timeSaved += cost; }
    }

    // Candidates for replacement (shorter, within remaining time/budget)
    const existingIds = keep.map((i) => i.experienceId);
    const budgetUsed = keep.reduce((s, i) => s + i.experience.price, 0);
    const remainingBudget = itinerary.budget - budgetUsed;
    const remainingMins = limit - used;
    const ltDestCity = itinerary.destination.includes(',')
      ? itinerary.destination.split(',').pop()!.trim()
      : itinerary.destination;
    const ltDestArea = itinerary.destination.includes(',')
      ? itinerary.destination.split(',')[0].trim()
      : '';

    const availMins = remainingMins > 0 ? remainingMins : limit;
    const availBudget = remainingBudget > 0 ? remainingBudget : itinerary.budget;
    const allCandidates = await prisma.experience.findMany({
      where: {
        id: { notIn: [...existingIds, ...remove.map((i) => i.experienceId)] },
        city: { contains: ltDestCity },
        isAvailable: true,
        durationMinutes: { lte: availMins },
        price: { lte: availBudget },
      },
      orderBy: { durationMinutes: 'desc' },
      take: 20,
    });
    // Priority: area + prefs > area only > prefs only > any
    const aL = ltDestArea.toLowerCase();
    const inArea = (e: any) => aL && (e.area.toLowerCase().includes(aL) || aL.includes(e.area.toLowerCase()));
    const inPref = (e: any) => prefs.length > 0 && prefs.includes(e.category);
    let candidates = allCandidates.filter(e => inArea(e) && inPref(e));
    if (candidates.length === 0) candidates = allCandidates.filter(e => inArea(e));
    if (candidates.length === 0) candidates = allCandidates.filter(e => inPref(e));
    if (candidates.length === 0) candidates = allCandidates;

    // Ask Gemini for intelligent recommendation
    const gemini = await getGeminiAdaptation({
      destination: itinerary.destination,
      adaptationType: 'LESS_TIME',
      constraint: `Only ${limit} minutes available (was ${toMins(itinerary.endTime) - toMins(itinerary.startTime)} minutes)`,
      preferences: prefs,
      currentItems: itinerary.items.map(i => ({
        id: i.experienceId, title: i.experience.title, category: i.experience.category,
        durationMinutes: i.experience.durationMinutes, travelMinutes: i.travelMinutes, price: i.experience.price,
      })),
      candidateItems: candidates.map(c => ({
        id: c.id, title: c.title, category: c.category,
        durationMinutes: c.durationMinutes, price: c.price,
      })),
    });
    aiPowered = gemini.aiPowered;
    summary = gemini.summary || `Removed ${remove.length} stop(s) to fit ${limit} minutes.`;
    reason = gemini.reason || `Available time reduced to ${limit} minutes.`;
    explanation = gemini.explanation || '';

    // Apply: delete removed, reschedule kept
    await prisma.itineraryItem.deleteMany({ where: { id: { in: remove.map((i) => i.id) } } });
    let cursor = itinerary.startTime;
    for (let i = 0; i < keep.length; i++) {
      const item = keep[i];
      const s = addMins(cursor, item.travelMinutes);
      const e = addMins(s, item.experience.durationMinutes);
      await prisma.itineraryItem.update({ where: { id: item.id }, data: { startTime: s, endTime: e, order: i } });
      cursor = e;
    }
    for (const item of remove)
      changes.push({ type: 'REMOVED', experienceId: item.experienceId, title: item.experience.title, reason: 'Insufficient remaining time' });

    // Add replacements — prefer Gemini's picks if valid, else try all area-prioritised candidates
    // The time-window guard below enforces the hard limit; no artificial cap needed
    const toAdd = gemini.replacementExperienceIds.length > 0
      ? candidates.filter(c => gemini.replacementExperienceIds.includes(c.id))
      : candidates;

    let order = keep.length;
    for (const rep of toAdd) {
      const s = cursor;
      const e = addMins(s, rep.durationMinutes);
      if (toMins(e) > toMins(addMins(itinerary.startTime, limit))) break;
      await prisma.itineraryItem.create({
        data: { itineraryId: itinerary.id, experienceId: rep.id, startTime: s, endTime: e, travelMinutes: 0, order: order++ },
      });
      cursor = e;
      timeSaved -= rep.durationMinutes;
      changes.push({ type: 'ADDED', experienceId: rep.id, title: rep.title, reason: 'Shorter replacement fits in remaining time' });
    }
  }

  // ── LOCATION_CHANGED ────────────────────────────────────────────────────────
  else if (type === 'LOCATION_CHANGED') {
    // If message-parsed, swap items for area-matched experiences instead of relying on coords alone
    if (body.newLocation) {
      const areaName: string = body.newLocation;
      const areaLower = areaName.toLowerCase();
      // Find area experiences within budget
      const areaExps = await prisma.experience.findMany({
        where: { isAvailable: true, price: { lte: itinerary.budget } },
      });
      // Prefer area matches; fall back to city-wide
      const areaMatch = areaExps.filter(e => e.area.toLowerCase().includes(areaLower) || areaLower.includes(e.area.toLowerCase()));
      const pool = areaMatch.length > 0 ? areaMatch : areaExps;

      // Build a fresh schedule from the new area pool
      const newItems = buildSchedule(pool, itinerary.startTime, itinerary.endTime, itinerary.budget);

      // Replace all itinerary items
      await prisma.itineraryItem.deleteMany({ where: { itineraryId: itinerary.id } });
      for (const item of newItems) {
        await prisma.itineraryItem.create({ data: { itineraryId: itinerary.id, ...item } });
      }

      // Derive city from current destination ("Bandra, Mumbai" → "Mumbai")
      const prevCity = itinerary.destination.includes(',')
        ? itinerary.destination.split(',').pop()!.trim()
        : itinerary.destination;
      const newDestination = `${areaName}, ${prevCity}`;

      await prisma.itinerary.update({
        where: { id: itinerary.id },
        data: { destination: newDestination },
      });

      changes.push(...newItems.map(i => ({ type: 'ADDED', experienceId: i.experienceId, reason: `Replaced with ${areaName} experience` })));
      summary = `Itinerary rebuilt for ${areaName}.`;
      reason  = `Location changed to ${areaName}.`;
      aiPowered = false;

      await prisma.adaptation.create({
        data: { itineraryId: itinerary.id, type, reason: summary, changes: JSON.stringify(changes) },
      });
      return res.json({ itinerary: await getFullItinerary(itinerary.id), changes, summary, reason, explanation, aiPowered, message: body.message });
    }

    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!body.latitude || !body.longitude)
      return res.status(400).json({ error: 'latitude, longitude or a location message required' });

    const gemini = await getGeminiAdaptation({
      destination: itinerary.destination,
      adaptationType: 'LOCATION_CHANGED',
      constraint: `User moved to (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      preferences: prefs,
      currentItems: itinerary.items.map(i => ({
        id: i.experienceId, title: i.experience.title, category: i.experience.category,
        durationMinutes: i.experience.durationMinutes, travelMinutes: i.travelMinutes, price: i.experience.price,
      })),
    });
    aiPowered = gemini.aiPowered;
    summary = gemini.summary || 'Itinerary updated for your new location.';
    reason = gemini.reason || `Location changed to (${lat.toFixed(4)}, ${lng.toFixed(4)}).`;
    explanation = gemini.explanation || '';

    let cursor = itinerary.startTime;
    const toRemove: any[] = [];
    for (let i = 0; i < itinerary.items.length; i++) {
      const item = itinerary.items[i];
      const exp = item.experience;
      const prevLat = i === 0 ? lat : itinerary.items[i - 1].experience.latitude;
      const prevLng = i === 0 ? lng : itinerary.items[i - 1].experience.longitude;
      const dist = haversineKm(prevLat, prevLng, exp.latitude, exp.longitude);
      const travel = travelMins(dist);
      const s = addMins(cursor, travel);
      const e = addMins(s, exp.durationMinutes);
      if (toMins(e) > toMins(itinerary.endTime)) {
        toRemove.push(item);
        changes.push({ type: 'REMOVED', experienceId: item.experienceId, title: exp.title, reason: `${dist.toFixed(1)} km away — no longer fits in time window` });
      } else {
        const oldTravel = item.travelMinutes;
        await prisma.itineraryItem.update({ where: { id: item.id }, data: { startTime: s, endTime: e, travelMinutes: travel, order: i } });
        cursor = e;
        if (Math.abs(travel - oldTravel) > 2)
          changes.push({ type: 'TRAVEL_UPDATED', experienceId: item.experienceId, title: exp.title, reason: `Travel time updated: ${oldTravel}m → ${travel}m` });
      }
    }
    if (toRemove.length > 0)
      await prisma.itineraryItem.deleteMany({ where: { id: { in: toRemove.map((i) => i.id) } } });
  }

  // ── EXPERIENCE_UNAVAILABLE ──────────────────────────────────────────────────
  else if (type === 'EXPERIENCE_UNAVAILABLE') {
    const experienceId: string | undefined = body.experienceId;
    // No ID (message-based): treat the first/next item as the unavailable one
    const target = experienceId
      ? itinerary.items.find((i) => i.experienceId === experienceId)
      : itinerary.items[0];
    if (!target) return res.status(404).json({ error: 'No experience found in this itinerary to mark unavailable' });
    if (!target) return res.status(404).json({ error: 'Experience not in this itinerary' });

    const resolvedExpId = target.experienceId;
    await prisma.experience.update({ where: { id: resolvedExpId }, data: { isAvailable: false } });
    await prisma.itineraryItem.delete({ where: { id: target.id } });
    changes.push({ type: 'REMOVED', experienceId: resolvedExpId, title: target.experience.title, reason: 'Experience marked unavailable' });

    const existingIds = itinerary.items.filter(i => i.experienceId !== resolvedExpId).map(i => i.experienceId);
    const budgetUsed = itinerary.items.filter(i => i.experienceId !== resolvedExpId).reduce((s, i) => s + i.experience.price, 0);
    const destCityForReplace = itinerary.destination.includes(',')
      ? itinerary.destination.split(',').pop()!.trim()
      : itinerary.destination;
    // Also get area from destination if present
    const destAreaForReplace = itinerary.destination.includes(',')
      ? itinerary.destination.split(',')[0].trim()
      : '';

    const candidateReplacements = await prisma.experience.findMany({
      where: {
        id: { notIn: existingIds },
        city: { contains: destCityForReplace },
        isAvailable: true,
        price: { lte: itinerary.budget - budgetUsed },
        durationMinutes: { lte: target.experience.durationMinutes + 30 },
        // prefer same category but don't require it — handled by ordering
      },
      orderBy: [{ price: 'asc' }],
      take: 8,
    });

    // Sort: same category + same area first, then same area, then same category
    // Priority cascade: area+category > area only > category only > any
    const areaL = destAreaForReplace.toLowerCase();
    const inExpArea = (e: any) => areaL && (e.area.toLowerCase().includes(areaL) || areaL.includes(e.area.toLowerCase()));
    const inExpCat  = (e: any) => e.category === target.experience.category;
    const inExpPref = (e: any) => prefs.length > 0 && prefs.includes(e.category);
    let bestCandidates = candidateReplacements.filter(e => inExpArea(e) && inExpCat(e));
    if (bestCandidates.length === 0) bestCandidates = candidateReplacements.filter(e => inExpArea(e) && inExpPref(e));
    if (bestCandidates.length === 0) bestCandidates = candidateReplacements.filter(e => inExpArea(e));
    if (bestCandidates.length === 0) bestCandidates = candidateReplacements.filter(e => inExpCat(e));
    if (bestCandidates.length === 0) bestCandidates = candidateReplacements;
    // Replace candidateReplacements with ranked list
    candidateReplacements.length = 0;
    candidateReplacements.push(...bestCandidates);

    const gemini = await getGeminiAdaptation({
      destination: itinerary.destination,
      adaptationType: 'EXPERIENCE_UNAVAILABLE',
      constraint: `"${target.experience.title}" is no longer available`,
      preferences: prefs,
      currentItems: itinerary.items.filter(i => i.experienceId !== resolvedExpId).map(i => ({
        id: i.experienceId, title: i.experience.title, category: i.experience.category,
        durationMinutes: i.experience.durationMinutes, travelMinutes: i.travelMinutes, price: i.experience.price,
      })),
      candidateItems: candidateReplacements.map(c => ({
        id: c.id, title: c.title, category: c.category, durationMinutes: c.durationMinutes, price: c.price,
      })),
    });
    aiPowered = gemini.aiPowered;

    // Pick replacement: prefer Gemini's top pick if valid, else first candidate
    const chosenId = gemini.replacementExperienceIds[0] || candidateReplacements[0]?.id;
    const replacement = candidateReplacements.find(c => c.id === chosenId) || candidateReplacements[0];

    if (replacement) {
      const newEnd = addMins(target.startTime, replacement.durationMinutes);
      await prisma.itineraryItem.create({
        data: { itineraryId: itinerary.id, experienceId: replacement.id, startTime: target.startTime, endTime: newEnd, travelMinutes: target.travelMinutes, order: target.order },
      });
      changes.push({ type: 'REPLACED', oldExperienceId: resolvedExpId, newExperienceId: replacement.id, title: replacement.title, reason: `Similar ${replacement.category} alternative` });
      summary = gemini.summary || `"${target.experience.title}" replaced with "${replacement.title}".`;
      reason = gemini.reason || 'Experience became unavailable.';
      explanation = gemini.explanation || '';
    } else {
      summary = gemini.summary || `"${target.experience.title}" removed. No suitable replacement found.`;
      reason = gemini.reason || 'Experience became unavailable.';
      explanation = gemini.explanation || '';
    }
  }

  // ── PREFERENCE_CHANGED ──────────────────────────────────────────────────────
  else if (type === 'PREFERENCE_CHANGED') {
    const msg = (body.message || '').toLowerCase();

    // Avoidances: "don't want cultural", "no culture", "avoid heritage"
    const avoidCats: string[] = [];
    const preferCats: string[] = [];
    if (/don'?t\s+want\s+(?:cultural?|culture|heritage)|no\s+cultur|avoid\s+cultur|not\s+cultur/.test(msg)) { avoidCats.push('culture'); avoidCats.push('heritage'); }
    if (/don'?t\s+want\s+food|no\s+food|not\s+(?:hungry|food)|avoid\s+food/.test(msg)) avoidCats.push('food');
    if (/don'?t\s+want\s+(?:art|craft)|no\s+art|avoid\s+art/.test(msg)) avoidCats.push('art');
    // Preferences — split message on negation boundary so "don't want X, I want Y" correctly isolates Y
    // Strip "don't want ..." clauses before testing positive preference signals
    const posMsg = msg.replace(/(?:don'?t|not|no)\s+want\s+\w+(?:\s+\w+){0,3}/g, '');
    if (/want\s+food|give\s+me\s+food|something\s+food|food\s+instead/.test(posMsg)) preferCats.push('food');
    if (/want\s+cultur|something\s+cultural|give\s+me\s+cultur/.test(posMsg)) { preferCats.push('culture'); preferCats.push('heritage'); }
    if (/want\s+art|something\s+(?:artistic|art)|give\s+me\s+art/.test(posMsg)) preferCats.push('art');
    if (/want\s+nature|something\s+(?:natural|outdoors)|give\s+me\s+nature/.test(posMsg)) preferCats.push('nature');

    // Extract city and area from destination ("Colaba, Mumbai" → city="Mumbai", area="Colaba")
    const destCity = itinerary.destination.includes(',')
      ? itinerary.destination.split(',').pop()!.trim()
      : itinerary.destination;
    const destArea = itinerary.destination.includes(',')
      ? itinerary.destination.split(',')[0].trim()
      : '';

    // Get all experiences for this city within budget
    let pool = await prisma.experience.findMany({
      where: { city: { contains: destCity }, isAvailable: true, price: { lte: itinerary.budget } },
    });

    // Apply avoidances
    if (avoidCats.length > 0) pool = pool.filter(e => !avoidCats.includes(e.category));

    // Apply category preference (hard — only fall back if zero results)
    if (preferCats.length > 0) {
      const preferred = pool.filter(e => preferCats.includes(e.category));
      if (preferred.length > 0) pool = preferred;
    }

    // Soft area preference: sort area matches to the front so buildSchedule picks them first,
    // but keep the full preference-filtered pool so remaining time can be filled with
    // non-area experiences of the right category when the local supply is exhausted.
    if (destArea) {
      const aL = destArea.toLowerCase();
      pool.sort((a, b) => {
        const aInArea = (a.area.toLowerCase().includes(aL) || aL.includes(a.area.toLowerCase())) ? 1 : 0;
        const bInArea = (b.area.toLowerCase().includes(aL) || aL.includes(b.area.toLowerCase())) ? 1 : 0;
        return bInArea - aInArea; // area matches first
      });
    }

    const newItems = buildSchedule(pool, itinerary.startTime, itinerary.endTime, itinerary.budget);

    await prisma.itineraryItem.deleteMany({ where: { itineraryId: itinerary.id } });
    for (const item of newItems) {
      await prisma.itineraryItem.create({ data: { itineraryId: itinerary.id, ...item } });
    }

    const removedCatsLabel = avoidCats.join(', ') || 'previous';
    const addedCatsLabel   = preferCats.join(', ')  || 'new';
    changes.push({ type: 'REBUILT', reason: `Preferences changed: avoided [${removedCatsLabel}], preferred [${addedCatsLabel}]` });
    summary     = `Itinerary rebuilt to reflect your new preferences.`;
    reason      = `Avoided: ${removedCatsLabel || 'none'}. Preferred: ${addedCatsLabel || 'none'}.`;
    explanation = '';
    aiPowered   = false;

    // Update stored preferences
    const newPrefs = preferCats.length > 0 ? preferCats : prefs.filter(p => !avoidCats.includes(p));
    await prisma.itinerary.update({ where: { id: itinerary.id }, data: { preferences: JSON.stringify(newPrefs) } });
  }

  await prisma.adaptation.create({
    data: { itineraryId: itinerary.id, type, reason: summary, changes: JSON.stringify(changes) },
  });

  res.json({
    itinerary: await getFullItinerary(itinerary.id),
    changes,
    summary,
    reason,
    explanation,
    aiPowered,
    ...(body.message ? { message: body.message, parsedType: type } : {}),
  });
});


// ─── POST /api/context/plan ────────────────────────────────────────────────────
// Natural-language context → structured plan

app.post('/api/context/plan', async (req, res) => {
  const { message, latitude, longitude } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ error: 'message is required (min 5 characters)' });
  }

  // 1. Parse natural language → structured context
  const { context, aiPowered: contextAi } = await parseContext(message.trim());

  // 2. Determine time window
  const durationMins = context.durationMinutes ?? 120;
  const now = new Date();
  const startH = now.getHours();
  const startM = now.getMinutes();
  const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
  const endTotal = startH * 60 + startM + durationMins;
  const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
  const budget = context.budget ?? 5000;

  // 3. Query DB — hard constraints applied deterministically
  const whereCity = context.city ?? 'Mumbai';
  const allCandidates = await prisma.experience.findMany({
    where: {
      city: { contains: whereCity },
      isAvailable: true,
      price: { lte: budget },
      durationMinutes: { lte: durationMins },
    },
  });

  if (allCandidates.length === 0) {
    return res.status(404).json({
      error: `No experiences found matching your request in ${whereCity}.`,
      context,
    });
  }

  // 4. Area constraint — HARD when user explicitly stated an area
  const areaLower = (context.area || '').toLowerCase();
  const areaMatches = areaLower
    ? allCandidates.filter(e => e.area.toLowerCase().includes(areaLower) || areaLower.includes(e.area.toLowerCase()))
    : [];
  // Area is a hard constraint: use area-only pool when area was specified and matches exist.
  // Fall back to city-wide ONLY when no area matches exist at all.
  const pool = (areaLower && areaMatches.length > 0) ? areaMatches : allCandidates;

  // 5. Filter by preferences if specified
  let filtered = pool;
  if (context.preferences.length > 0) {
    const prefFiltered = pool.filter(e => context.preferences.includes(e.category));
    // Only restrict if we get at least one result
    if (prefFiltered.length > 0) filtered = prefFiltered;
  }

  // 6. Filter out avoidances
  if (context.avoidances.includes('touristy')) {
    // Score each experience: 0 = non-touristy, higher = more touristy
    // Match against title + description to catch obvious tourist draws
    const touristySignals = /iconic|famous|must.?see|popular|landmark|attraction|promenade|unesco|ferry|tour\b|studio tour|bollywood|gateway|monument|seafront|sea link|sea face|bandstand/i;
    const scored = filtered.map(e => ({
      e,
      score: (touristySignals.test(e.title) ? 2 : 0) +
             (touristySignals.test(e.description) ? 1 : 0) +
             (e.price > 400 ? 1 : 0),
    }));
    const nonTouristy = scored.filter(x => x.score === 0).map(x => x.e);
    // Only apply filter if at least one result survives; otherwise fall back gracefully
    if (nonTouristy.length > 0) filtered = nonTouristy;
  }

  // 7. Rank with Gemini (or deterministic fallback)
  const rankedIds = await rankExperiences(context, filtered.map(e => ({
    id: e.id, title: e.title, category: e.category, area: e.area,
    durationMinutes: e.durationMinutes, price: e.price, description: e.description,
  })));

  // Reorder filtered by ranked order
  const ranked = rankedIds
    .map(id => filtered.find(e => e.id === id))
    .filter(Boolean) as typeof filtered;

  // 8. Build schedule deterministically
  const items = buildSchedule(ranked, startTime, endTime, budget,
    latitude ?? undefined, longitude ?? undefined);

  if (items.length === 0) {
    // Return recommendations even if schedule is empty (very short time window)
    return res.json({
      context,
      itinerary: null,
      recommendations: ranked.slice(0, 5).map(e => ({ id: e.id, title: e.title, category: e.category, area: e.area, durationMinutes: e.durationMinutes, price: e.price })),
      summary: `No experiences fit your ${durationMins}-minute window in ${context.area || whereCity}. Here are nearby options you could consider.`,
      aiPowered: contextAi,
    });
  }

  // 9. Persist itinerary using existing models
  const itinerary = await prisma.itinerary.create({
    data: {
      destination: context.area ? `${context.area}, ${whereCity}` : whereCity,
      startTime,
      endTime,
      budget,
      preferences: JSON.stringify(context.preferences),
      items: { create: items },
    },
    include: { items: { include: { experience: true }, orderBy: { order: 'asc' } } },
  });

  // 10. Generate summary
  const selectedTitles = itinerary.items.map(i => i.experience.title);
  const summary = await generatePlanSummary(context, selectedTitles, contextAi);

  res.status(201).json({
    context,
    itinerary,
    recommendations: ranked.slice(0, 8).map(e => ({ id: e.id, title: e.title, category: e.category, area: e.area, durationMinutes: e.durationMinutes, price: e.price })),
    summary,
    aiPowered: contextAi,
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`Lokora API running on http://localhost:${PORT}`));