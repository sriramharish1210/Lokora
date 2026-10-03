'use client';

import { FormEvent, useState } from 'react';
import {
  adaptItinerary,
  createContextPlan,
  ContextPlan,
  Itinerary,
} from '@/lib/api';
import { HeroParticles } from '@/components/HeroParticles';

const EXAMPLES = [
  "I'm in Bandra for 2 hours, it's my first time here and I want local food.",
  "I'm in Bandra West for 90 minutes. I have ₹1000 and don't want touristy places.",
  "I'm in Mumbai for 2 hours and want to experience local culture.",
];

const STEPS = [
  {
    number: '01',
    title: 'Tell Lokora your situation',
    description:
      'Say where you are, how much time you have, your budget, and what you want to experience.',
  },
  {
    number: '02',
    title: 'Lokora understands your context',
    description:
      'Your location, time, budget, preferences, and intent are turned into a travel context.',
  },
  {
    number: '03',
    title: 'Find relevant local experiences',
    description:
      'Lokora prioritizes experiences that actually fit your current situation.',
  },
  {
    number: '04',
    title: 'Build your plan',
    description:
      'Your matched experiences are arranged into a practical itinerary for the time you have.',
  },
  {
    number: '05',
    title: 'Your situation changes',
    description:
      'You have less time, move somewhere else, an experience closes, or simply change your mind.',
  },
  {
    number: '06',
    title: 'Lokora adapts',
    description:
      'Describe what changed naturally and Lokora replans the itinerary around your new situation.',
  },
];

function formatTime(value: string) {
  if (!value) return '';

  const [hours, minutes] = value.split(':').map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;

  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatPrice(price: number) {
  if (price === 0) return 'Free';

  return `₹${price.toLocaleString('en-IN')}`;
}

function getContextLabel(
  itinerary: Itinerary | ContextPlan
) {
  const parts: string[] = [];

  if (itinerary.destination) {
    parts.push(itinerary.destination);
  }

  if (itinerary.startTime && itinerary.endTime) {
    parts.push(
      `${formatTime(itinerary.startTime)} – ${formatTime(itinerary.endTime)}`
    );
  }

  if (itinerary.budget) {
    parts.push(`₹${itinerary.budget.toLocaleString('en-IN')}`);
  }

  return parts.join(' · ');
}

export default function HomePage() {
  const [message, setMessage] = useState('');
  const [exampleIndex, setExampleIndex] = useState(0);

  const [itinerary, setItinerary] = useState<
    Itinerary | ContextPlan | null
  >(null);

  const [loading, setLoading] = useState(false);
  const [adaptMessage, setAdaptMessage] = useState('');
  const [adaptLoading, setAdaptLoading] = useState(false);

  const [error, setError] = useState('');
  const [adaptError, setAdaptError] = useState('');
  const [adaptExplanation, setAdaptExplanation] = useState('');

  function useExample(example: string) {
    setMessage(example);

    setExampleIndex(
      (current) => (current + 1) % EXAMPLES.length
    );
  }

  async function handlePlanSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!message.trim()) {
      setError(
        'Tell Lokora a little about your situation first.'
      );
      return;
    }

    setError('');
    setLoading(true);
    setAdaptExplanation('');

    try {
      const result = await createContextPlan(
        message.trim()
      );

      setItinerary(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not create your plan. Is the backend running?'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAdaptSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!itinerary || !adaptMessage.trim()) {
      return;
    }

    setAdaptError('');
    setAdaptLoading(true);

    try {
      const result = await adaptItinerary(
        itinerary.id,
        adaptMessage.trim()
      );

      setItinerary(result.itinerary);
      setAdaptExplanation(
        result.explanation ||
          result.summary ||
          ''
      );

      setAdaptMessage('');
    } catch (err) {
      setAdaptError(
        err instanceof Error
          ? err.message
          : 'Could not adapt your itinerary.'
      );
    } finally {
      setAdaptLoading(false);
    }
  }

  return (
    <main>

      {/* =====================================================
          HERO
      ====================================================== */}

      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        aria-label="Lokora contextual travel planner"
      >
        <div className="absolute inset-0 z-0 overflow-hidden">

          <img
            src="/hero-india.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-[center_40%] hero-breathe"
          />

          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(10,10,20,0.48) 0%, rgba(10,10,20,0.04) 35%, rgba(10,10,20,0.04) 65%, rgba(10,10,20,0.38) 100%)',
            }}
          />

        </div>

        <HeroParticles />

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center py-28 sm:py-32">

          {/* HERO COPY */}

          <div className="max-w-3xl">

            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.28em] text-white/60 animate-on-load">
              Context-aware travel
            </p>

            <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight animate-on-load">
              Don&apos;t just visit India.
              <br />
              <span className="gradient-text">
                Live it from the inside.
              </span>
            </h1>

            <p
              className="mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto animate-on-load stagger-1"
              style={{
                color: 'rgba(255,255,255,0.82)',
              }}
            >
              Tell Lokora what&apos;s happening right now.
              <br className="hidden sm:block" />
              We&apos;ll figure out what you can actually experience.
            </p>

          </div>


          {/* =================================================
              CONTEXT INPUT
          ================================================== */}

          <div className="mt-9 w-full max-w-2xl animate-on-load stagger-2">

            <form
              onSubmit={handlePlanSubmit}
              className="rounded-2xl overflow-hidden text-left shadow-2xl"
              style={{
                background: 'rgba(18,18,28,0.58)',
                backdropFilter: 'blur(22px)',
                WebkitBackdropFilter: 'blur(22px)',
                border:
                  '1px solid rgba(255,255,255,0.25)',
              }}
            >

              <div className="p-4 sm:p-5">

                <div className="flex items-center justify-between mb-3">

                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                    Your situation
                  </span>

                  <span className="text-[10px] text-white/35">
                    Natural language
                  </span>

                </div>


                <textarea
                  value={message}
                  onChange={(event) =>
                    setMessage(event.target.value)
                  }
                  placeholder="I'm in Bandra for 2 hours, it's my first time here and I want local food..."
                  rows={3}
                  className="w-full resize-none bg-transparent text-white placeholder:text-white/35 outline-none text-sm sm:text-base leading-relaxed"
                />


                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">

                  <button
                    type="submit"
                    disabled={loading}
                    className="order-1 sm:order-2 sm:ml-auto flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-all duration-200 text-sm px-5 py-3"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Understanding...
                      </>
                    ) : (
                      'Find My Experience →'
                    )}
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      useExample(EXAMPLES[exampleIndex])
                    }
                    className="order-2 sm:order-1 text-left text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Try an example →
                  </button>

                </div>

              </div>


              {error && (
                <div className="px-5 py-3 bg-red-950/40 border-t border-red-400/20 text-xs text-red-200">
                  {error}
                </div>
              )}

            </form>


            <p className="mt-3 text-white/35 text-[11px]">
              Location · time · budget · preferences · intent
            </p>

          </div>


          {/* =================================================
              RESULT / GENERATED PLAN
          ================================================== */}

          {itinerary && (

            <section
              className="mt-8 w-full max-w-4xl text-left animate-on-load"
              aria-label="Your Lokora plan"
            >

              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  background: 'rgba(12,12,20,0.76)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border:
                    '1px solid rgba(255,255,255,0.18)',
                }}
              >

                {/* RESULT HEADER */}

                <div className="p-5 sm:p-7 border-b border-white/10">

                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">

                    <div>

                      <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-brand-400">
                        Your context
                      </p>

                      <h2 className="mt-1 text-xl sm:text-2xl font-bold text-white">
                        Your Lokora plan
                      </h2>

                    </div>

                    <p className="text-xs text-white/45">
                      {getContextLabel(itinerary)}
                    </p>

                  </div>

                </div>


                {/* EXPERIENCE LIST */}

                <div className="p-5 sm:p-7">

                  {itinerary.items.length === 0 ? (

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">

                      <p className="text-white/70 text-sm">
                        We couldn&apos;t find a suitable experience for this exact situation yet.
                      </p>

                    </div>

                  ) : (

                    <div className="space-y-3">

                      {itinerary.items.map(
                        (item, index) => (

                          <div
                            key={item.id}
                            className="group rounded-2xl border border-white/10 bg-white/[0.045] hover:bg-white/[0.07] transition-colors p-4"
                          >

                            <div className="flex gap-4">

                              {/* TIMELINE NUMBER */}

                              <div className="flex flex-col items-center">

                                <span className="text-[10px] font-bold text-brand-400">
                                  {String(index + 1).padStart(2, '0')}
                                </span>

                                {index <
                                  itinerary.items.length - 1 && (
                                  <div className="mt-2 w-px flex-1 bg-white/10" />
                                )}

                              </div>


                              {/* EXPERIENCE */}

                              <div className="flex-1 min-w-0">

                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">

                                  <div>

                                    <p className="text-xs text-white/45">
                                      {formatTime(item.startTime)}
                                      {' – '}
                                      {formatTime(item.endTime)}
                                    </p>

                                    <h3 className="mt-1 text-base font-semibold text-white">
                                      {item.experience.title}
                                    </h3>

                                  </div>


                                  <span className="text-xs font-medium text-brand-300">
                                    {formatPrice(
                                      item.experience.price
                                    )}
                                  </span>

                                </div>


                                <p className="mt-2 text-sm text-white/55 leading-relaxed">
                                  {item.experience.description}
                                </p>


                                <div className="mt-3 flex flex-wrap gap-2">

                                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px] text-white/55">
                                    {item.experience.category}
                                  </span>

                                  <span className="px-2 py-1 rounded-full bg-white/10 text-[10px] text-white/55">
                                    {item.experience.durationMinutes} min
                                  </span>

                                  {item.travelMinutes > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-white/10 text-[10px] text-white/55">
                                      +{item.travelMinutes} min travel
                                    </span>
                                  )}

                                </div>

                              </div>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  )}


                  {/* =================================================
                      ADAPT
                  ================================================== */}

                  <div className="mt-7 pt-6 border-t border-white/10">

                    <div className="mb-3">

                      <p className="text-xs font-semibold text-white">
                        Something changed?
                      </p>

                      <p className="mt-1 text-xs text-white/40">
                        Tell Lokora naturally. Your itinerary will adapt around the new situation.
                      </p>

                    </div>


                    <form
                      onSubmit={handleAdaptSubmit}
                      className="flex flex-col sm:flex-row gap-2"
                    >

                      <input
                        value={adaptMessage}
                        onChange={(event) =>
                          setAdaptMessage(
                            event.target.value
                          )
                        }
                        placeholder="I only have 45 minutes now..."
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-brand-500/60"
                      />


                      <button
                        type="submit"
                        disabled={
                          adaptLoading ||
                          !adaptMessage.trim()
                        }
                        className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold px-5 py-3 text-sm transition-colors"
                      >

                        {adaptLoading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Adapting...
                          </>
                        ) : (
                          'Adapt Plan →'
                        )}

                      </button>

                    </form>


                    {adaptError && (
                      <p className="mt-3 text-xs text-red-300">
                        {adaptError}
                      </p>
                    )}


                    {adaptExplanation && (
                      <div className="mt-4 rounded-xl border border-brand-500/20 bg-brand-500/10 p-4">

                        <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-brand-300">
                          What changed
                        </p>

                        <p className="mt-1 text-sm leading-relaxed text-white/70">
                          {adaptExplanation}
                        </p>

                      </div>
                    )}

                  </div>

                </div>

              </div>

            </section>

          )}


          <p className="mt-5 text-white/35 text-xs animate-on-load stagger-3">
            Context → Experiences → Plan → Adapt
          </p>

        </div>

      </section>


      {/* =====================================================
          HOW IT WORKS
      ====================================================== */}

      <section
        id="how-it-works"
        className="py-20 lg:py-28 bg-lokora-cream"
      >

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-14">

            <span className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2 block">
              How Lokora works
            </span>

            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900">
              Travel planning that starts with your situation.
            </h2>

            <p className="mt-4 max-w-2xl mx-auto text-slate-500 text-sm sm:text-base leading-relaxed">
              Lokora doesn&apos;t ask you to build a perfect itinerary first.
              It understands what is happening now and builds around it.
            </p>

          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {STEPS.map((step) => (

              <div
                key={step.number}
                className="rounded-2xl bg-white border border-slate-100 p-6 shadow-sm"
              >

                <div className="flex items-center justify-between">

                  <span className="text-xs font-bold text-brand-600">
                    {step.number}
                  </span>

                  <span className="h-px w-10 bg-brand-200" />

                </div>


                <h3 className="mt-8 font-display font-bold text-slate-900 text-lg">
                  {step.title}
                </h3>


                <p className="mt-2 text-slate-500 text-sm leading-relaxed">
                  {step.description}
                </p>

              </div>

            ))}

          </div>

        </div>

      </section>


      {/* =====================================================
          WHY LOKORA
      ====================================================== */}

      <section
        id="features"
        className="py-20 lg:py-28 bg-white"
      >

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid lg:grid-cols-[1fr_1.25fr] gap-12 lg:gap-20 items-start">

            <div>

              <span className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2 block">
                Why Lokora
              </span>

              <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
                Local intelligence,
                <br />
                built around you.
              </h2>

              <p className="mt-5 text-slate-500 text-sm sm:text-base leading-relaxed">
                The useful part of travel isn&apos;t knowing every place in a city.
                It&apos;s knowing what makes sense for you right now.
              </p>

            </div>


            <div className="grid sm:grid-cols-2 gap-4">

              {[
                {
                  title: 'Hyper-local discovery',
                  text: 'Find experiences around specific neighborhoods instead of generic city-wide recommendations.',
                },
                {
                  title: 'Context-aware planning',
                  text: 'Location, time, budget, preferences and intent all influence what Lokora recommends.',
                },
                {
                  title: 'Adaptive itineraries',
                  text: 'Your plan is not fixed. When your situation changes, Lokora can re-plan it.',
                },
                {
                  title: 'Maharashtra-first',
                  text: 'Start with the local character of Maharashtra and expand outward without losing that local focus.',
                },
              ].map((feature) => (

                <div
                  key={feature.title}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
                >

                  <h3 className="font-display font-bold text-slate-900">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {feature.text}
                  </p>

                </div>

              ))}

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}