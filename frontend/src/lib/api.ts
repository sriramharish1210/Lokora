const API_BASE = 'http://localhost:4000';

export interface ContextPlan {
  id: string;
  destination: string;
  startTime: string;
  endTime: string;
  budget: number;
  preferences: string[];
  items: ItineraryItem[];
  context?: {
    location?: string;
    area?: string;
    city?: string;
    durationMinutes?: number;
    budget?: number;
    firstVisit?: boolean;
    preferences?: string[];
    avoidances?: string[];
    intent?: string;
    specificRequest?: string;
  };
}

export interface ItineraryItem {
  id: string;
  experienceId: string;
  startTime: string;
  endTime: string;
  travelMinutes: number;
  order: number;
  experience: {
    id: string;
    title: string;
    description: string;
    category: string;
    city: string;
    durationMinutes: number;
    price: number;
    isAvailable: boolean;
  };
}

export interface Itinerary {
  id: string;
  destination: string;
  startTime: string;
  endTime: string;
  budget: number;
  preferences: string;
  createdAt: string;
  items: ItineraryItem[];
}

export interface AdaptResult {
  itinerary: Itinerary;
  changes: Array<{
    type:
      | 'REMOVED'
      | 'ADDED'
      | 'REPLACED'
      | 'TRAVEL_UPDATED';
    experienceId?: string;
    oldExperienceId?: string;
    newExperienceId?: string;
    title?: string;
    reason: string;
  }>;
  summary: string;
  reason: string;
  explanation: string;
  aiPowered: boolean;
  timeSaved: number;
}

export async function createContextPlan(
  message: string
): Promise<ContextPlan> {
  const res = await fetch(`${API_BASE}/api/context/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));

    throw new Error(
      err.error || 'Could not create your Lokora plan'
    );
  }

  const data = await res.json();

  /*
   * The backend may return the itinerary directly
   * or wrap it inside an `itinerary` property.
   *
   * Normalize both shapes so the frontend always
   * receives the structure it expects.
   */
  const plan = data.itinerary ?? data;

  return {
    ...plan,
    items: Array.isArray(plan.items)
      ? plan.items
      : [],
    preferences: Array.isArray(plan.preferences)
      ? plan.preferences
      : [],
  };
}

export async function getItinerary(
  id: string
): Promise<Itinerary> {
  const res = await fetch(
    `${API_BASE}/api/itineraries/${id}`,
    {
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error('Itinerary not found');
  }

  return res.json();
}

export async function adaptItinerary(
  id: string,
  message: string
): Promise<AdaptResult> {
  const res = await fetch(
    `${API_BASE}/api/itineraries/${id}/adapt`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));

    throw new Error(
      err.error || 'Adaptation failed'
    );
  }

  return res.json();
}