"use client";

import { FormEvent, useState } from "react";

type Profile = {
  id: string;
  flagged: boolean;
  pseudos: string[];
  names: string[];
};

type SearchResult = {
  query: string;
  found: boolean;
  profiles: Profile[];
  similar: Array<
    Profile & {
      similarity: number;
    }
  >;
  error?: string;
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = query.trim();

    if (!value) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/profiles/search?q=${encodeURIComponent(value)}`,
      );

      const data = (await response.json()) as SearchResult;

      if (!response.ok) {
        throw new Error(
          data.error ?? "Une erreur est survenue.",
        );
      }

      setResult(data);
    } catch (error) {
      console.error(error);

      setResult({
        query: value,
        found: false,
        profiles: [],
        similar: [],
        error: "Impossible d'effectuer la vérification.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="px-6 py-10 text-center sm:px-10">
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
              Vérification
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Vérifier un profil
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Recherchez un nom ou un pseudo pour vérifier s&apos;il
              figure dans notre base de profils signalés.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row"
            >
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom ou pseudo..."
                className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="rounded-2xl bg-sky-500 px-7 py-4 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Vérification..." : "Vérifier"}
              </button>
            </form>
          </div>

          {result && (
            <div className="border-t border-slate-800 px-6 py-8 sm:px-10">
              {result.error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-red-300">
                  {result.error}
                </div>
              ) : result.found ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                    <div className="text-3xl">⚠️</div>

                    <h2 className="mt-3 text-xl font-bold text-red-400">
                      Attention
                    </h2>

                    <p className="mt-2 text-sm text-red-200">
                      Ce profil a été signalé.
                    </p>
                  </div>

                  {result.profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                    >
                      {profile.pseudos.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                            Pseudos associés
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {profile.pseudos.map((pseudo) => (
                              <span
                                key={pseudo}
                                className="rounded-full bg-slate-800 px-3 py-1.5 text-sm text-slate-200"
                              >
                                {pseudo}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profile.names.length > 0 && (
                        <div className="mt-6">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                            Noms associés
                          </h3>

                          <div className="mt-3 space-y-2">
                            {profile.names.map((name) => (
                              <div
                                key={name}
                                className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-200"
                              >
                                {name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                  <div className="text-3xl">✓</div>

                  <h2 className="mt-3 text-xl font-bold text-emerald-400">
                    Aucun problème détecté
                  </h2>

                  <p className="mt-2 text-sm text-emerald-200">
                    Pour le moment, aucun problème sur ce profil.
                  </p>
                </div>
              )}

              {result.similar.length > 0 && (
                <section className="mt-8">
                  <div>
                    <h2 className="text-xl font-bold">
                      Profils proches
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      Des profils similaires à votre recherche ont
                      été trouvés.
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {result.similar.map((profile) => (
                      <div
                        key={profile.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            {profile.pseudos.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {profile.pseudos.map((pseudo) => (
                                  <span
                                    key={pseudo}
                                    className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200"
                                  >
                                    {pseudo}
                                  </span>
                                ))}
                              </div>
                            )}

                            {profile.names.length > 0 && (
                              <div className="mt-3 space-y-1">
                                {profile.names.map((name) => (
                                  <p
                                    key={name}
                                    className="text-sm text-slate-400"
                                  >
                                    {name}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 rounded-xl bg-slate-800 px-3 py-2 text-center">
                            <div className="text-lg font-bold text-sky-400">
                              {profile.similarity}%
                            </div>

                            <div className="text-xs text-slate-500">
                              correspondance
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-slate-600">
          Les résultats sont basés sur les informations actuellement
          présentes dans notre base.
        </p>
      </div>
    </main>
  );
}