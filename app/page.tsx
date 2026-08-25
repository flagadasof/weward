"use client";

import { FormEvent, useRef, useState } from "react";

type SearchMatch = {
  id: string;
  value: string;
  type: "pseudo" | "name";
  similarity: number;
  exact: boolean;
  flagged: boolean;
};

type SearchResult = {
  query: string;
  found: boolean;
  exact: SearchMatch[];
  matches: SearchMatch[];
  error?: string;
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportProfile, setReportProfile] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
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

      setTimeout(() => {
        if (resultRef.current) {
          const y =
            resultRef.current.getBoundingClientRect().top +
            window.scrollY -
            20;

          window.scrollTo({
            top: y,
            behavior: "smooth",
          });
        }
      }, 100);
    } catch (error) {
      console.error(error);

      setResult({
        query: value,
        found: false,
        exact: [],
        matches: [],
        error: "Impossible d'effectuer la vérification.",
      });
    } finally {
      setLoading(false);
    }
  }

  function openReportModal() {
    setReportProfile(query.trim());
    setReportReason("");
    setReportFiles([]);
    setReportError("");
    setReportSuccess(false);
    setIsReportOpen(true);
  }

  function closeReportModal() {
    if (reportLoading) {
      return;
    }

    setIsReportOpen(false);
  }

  function handleFilesChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 5) {
      setReportError(
        "Vous pouvez joindre au maximum 5 fichiers.",
      );
      setReportFiles(files.slice(0, 5));
      return;
    }

    setReportError("");
    setReportFiles(files);
  }

  async function handleReportSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const profile = reportProfile.trim();
    const reason = reportReason.trim();

    if (!profile) {
      setReportError(
        "Veuillez indiquer le nom ou le pseudo à signaler.",
      );
      return;
    }

    if (!reason) {
      setReportError("Veuillez indiquer le motif du signalement.");
      return;
    }

    setReportLoading(true);
    setReportError("");
    setReportSuccess(false);

    try {
      const formData = new FormData();

      formData.append("profile", profile);
      formData.append("reason", reason);

      for (const file of reportFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/reports/send", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "Impossible d'envoyer le signalement.",
        );
      }

      setReportSuccess(true);
      setReportReason("");
      setReportFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error(error);

      setReportError(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le signalement.",
      );
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <>
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto w-full max-w-3xl">
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
             <div
  className="mx-auto w-full max-w-2xl"
  style={{
    maskImage:
      "radial-gradient(ellipse 75% 90% at center, black 55%, transparent 100%)",
    WebkitMaskImage:
      "radial-gradient(ellipse 75% 90% at center, black 55%, transparent 100%)",
  }}
>
  <img
    src="/wardy-fbi.png"
    alt="Wardy FBI - Faut balancer l'individu !"
    className="mx-auto h-auto w-full object-contain"
  />
</div>

              

              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
                Un doute sur un profil weward ? Entre un nom ou un pseudo pour vérifier s&apos;il
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
              <p className="mt-5 text-sm text-slate-400">
  Vous pensez qu’un profil devrait être signalé ?
  <br />
  Envoyez-nous un mail à{" "}
  <a
    href="mailto:wardybip@gmail.com"
    className="font-medium text-red-400 underline-offset-4 transition hover:text-red-300 hover:underline"
  >
    wardybip@gmail.com
  </a>{" "}
  avec vos preuves.
</p>
<div className="mt-8">
  <h2 className="text-lg font-bold text-white">
   Destinés à tous les utilisateurs weward. 
   </h2>

 

</div>
{/*
<p className="mt-5 text-sm text-slate-400">
  Vous pensez qu’un profil devrait être signalé ?
</p>

<button
  type="button"
  onClick={openReportModal}
  className="mt-5 text-sm font-medium text-red-400 underline-offset-4 transition hover:text-red-300 hover:underline"
>
  Par içi l'enquête !
</button>
*/}
            </div>

            {result && (
              <div
                ref={resultRef}
                className="border-t border-slate-800 px-6 py-8 sm:px-10"
              >
                {result.error ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-red-300">
                    {result.error}
                  </div>
                ) : result.exact.length > 0 ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                      <div className="text-3xl">⚠️</div>

                      <h2 className="mt-3 text-xl font-bold text-red-400">
                        Identifiant signalé
                      </h2>

                      <p className="mt-2 text-sm text-red-200">
                        Une correspondance exacte a été trouvée dans notre base.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {result.exact.map((match) => (
                        <div
                          key={match.id}
                          className="rounded-2xl border border-red-500/20 bg-slate-950 p-5"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-800 px-3 py-1.5 text-sm font-medium text-white">
                                  {match.value}
                                </span>

                                <span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-400">
                                  {match.type === "pseudo" ? "Pseudo" : "Nom Facebook"}
                                </span>
                              </div>

                              <p className="mt-3 text-sm text-red-300">
                                🔴 Identifiant signalé
                              </p>
                            </div>

                            <div className="shrink-0 rounded-xl bg-red-500/10 px-3 py-2 text-center">
                              <div className="text-lg font-bold text-red-400">100%</div>
                              <div className="text-xs text-slate-500">correspondance</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : result.matches.length > 0 ? (
                  <div className="space-y-8">
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                      <div className="text-3xl">🔎</div>

                      <h2 className="mt-3 text-xl font-bold text-amber-400">
                        Correspondances trouvées
                      </h2>

                      <p className="mt-2 text-sm text-amber-200">
                        Aucun résultat exact pour « {result.query} », mais des identifiants proches ont été trouvés.
                      </p>
                    </div>

                    <section>
                      <div>
                        <h2 className="text-xl font-bold">Profils proches</h2>
                        <p className="mt-1 text-sm text-slate-400">
                          Plus le pourcentage est élevé, plus l'identifiant ressemble à votre recherche.
                        </p>
                      </div>

                      <div className="mt-4 space-y-3">
                        {result.matches.map((match) => (
                          <div
                            key={match.id}
                            className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200">
                                    {match.value}
                                  </span>

                                  <span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-500">
                                    {match.type === "pseudo" ? "Pseudo" : "Nom Facebook"}
                                  </span>
                                </div>

                                {match.flagged ? (
                                  <p className="mt-3 text-sm text-red-400">
                                    🔴 Identifiant signalé
                                  </p>
                                ) : (
                                  <p className="mt-3 text-sm text-slate-500">
                                    Correspondance dans la base
                                  </p>
                                )}
                              </div>

                              <div className="shrink-0 rounded-xl bg-slate-800 px-3 py-2 text-center">
                                <div
                                  className={`text-lg font-bold ${
                                    match.similarity >= 80
                                      ? "text-amber-400"
                                      : match.similarity >= 65
                                        ? "text-sky-400"
                                        : "text-slate-300"
                                  }`}
                                >
                                  {match.similarity}%
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
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                    <div className="text-3xl">✓</div>

                    <h2 className="mt-3 text-xl font-bold text-emerald-400">
                      Aucun résultat trouvé
                    </h2>

                    <p className="mt-2 text-sm text-emerald-200">
                      Aucun identifiant correspondant à votre recherche n'a été trouvé dans notre base.
                    </p>

                    <p className="mt-3 text-xs text-emerald-300/70">
                      Attention, non signalé ne signifie pas forcément sans risque. Nous ne sommes pas responsables de vos échanges.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

         <div className="mt-6 text-center">
  <p className="text-xs text-slate-600">
    Les résultats sont basés sur les informations actuellement
    présentes dans notre base.
  </p>

  <p className="mt-2 text-xs text-slate-600">
    © Wardybip 2026 — Version Beta 1.0 — Tous droits réservés.
  </p>

  <p className="mt-1 text-xs text-slate-700">
    Ce site est indépendant de WeWard. By Flagada
  </p>
</div>
        </div>
      </main>

      {isReportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReportModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">
                  Signaler un profil
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Envoyez-nous les informations nécessaires au
                  traitement du signalement.
                </p>
              </div>

              <button
                type="button"
                onClick={closeReportModal}
                disabled={reportLoading}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleReportSubmit}
              className="space-y-5 px-6 py-6"
            >
              <div>
                <label
                  htmlFor="report-profile"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Nom ou pseudo à signaler
                </label>

                <input
                  id="report-profile"
                  type="text"
                  value={reportProfile}
                  onChange={(event) =>
                    setReportProfile(event.target.value)
                  }
                  placeholder="Ex. @pseudo ou Prénom Nom"
                  disabled={reportLoading}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="report-reason"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Motif du signalement
                </label>

                <textarea
                  id="report-reason"
                  value={reportReason}
                  onChange={(event) =>
                    setReportReason(event.target.value)
                  }
                  placeholder="Expliquez pourquoi ce profil doit être signalé... Tu peux ajouter ton mail ici si tu souhaites une réponse."
                  rows={5}
                  disabled={reportLoading}
                  className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="report-files"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Pièces jointes
                </label>

                <input
                  ref={fileInputRef}
                  id="report-files"
                  type="file"
                  multiple
                  onChange={handleFilesChange}
                  disabled={reportLoading}
                  className="block w-full cursor-pointer rounded-2xl border border-slate-700 bg-slate-950 text-sm text-slate-400 file:mr-4 file:border-0 file:bg-slate-800 file:px-4 file:py-3 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700 disabled:opacity-50"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Maximum 5 fichiers, 10 Mo par fichier.
                </p>

                {reportFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {reportFiles.map((file) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-slate-300">
                          {file.name}
                        </span>

                        <span className="ml-3 shrink-0 text-xs text-slate-500">
                          {(file.size / 1024 / 1024).toFixed(2)} Mo
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {reportError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                  {reportError}
                </div>
              )}

              {reportSuccess && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                  Votre signalement a bien été envoyé. Merci.
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeReportModal}
                  disabled={reportLoading}
                  className="rounded-2xl border border-slate-700 px-5 py-3 font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Fermer
                </button>

                <button
                  type="submit"
                  disabled={reportLoading}
                  className="rounded-2xl bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reportLoading
                    ? "Envoi en cours..."
                    : "Envoyer le signalement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}