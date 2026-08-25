"use client";

import { useState } from "react";

type IdentifierType = "pseudo" | "name";

type VerificationResult = {
  found: boolean;
  identifier: {
    id: string;
    profileId: string;
    type: IdentifierType;
    value: string;
  } | null;
  error?: string;
};

type AddedIdentifier = {
  id: string;
  type: IdentifierType;
  value: string;
};

type SaveResult = {
  success?: boolean;
  alreadyExists?: boolean;
  created?: boolean;
  identifier?: AddedIdentifier;
  error?: string;
};

export default function AssoPage() {
  const [type, setType] =
    useState<IdentifierType>("pseudo");

  const [value, setValue] = useState("");

  const [verification, setVerification] =
    useState<VerificationResult | null>(null);

  const [verifying, setVerifying] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [addedIdentifiers, setAddedIdentifiers] =
    useState<AddedIdentifier[]>([]);

  /*
   * Vérification avant ajout.
   */
  async function handleVerify() {
    const trimmedValue = value.trim();

    setError("");
    setMessage("");
    setVerification(null);

    if (!trimmedValue) {
      setError(
        "Entre d'abord un nom ou un pseudo.",
      );
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(
        `/api/admin/asso?q=${encodeURIComponent(
          trimmedValue,
        )}&type=${type}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data: VerificationResult =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ??
            "Impossible de vérifier cet identifiant.",
        );
        return;
      }

      setVerification(data);
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Impossible de contacter le serveur.",
      );
    } finally {
      setVerifying(false);
    }
  }

  /*
   * Ajout d'un identifiant indépendant.
   */
  async function handleAdd() {
    const trimmedValue = value.trim();

    setError("");
    setMessage("");

    if (!trimmedValue) {
      setError(
        "Entre d'abord un nom ou un pseudo.",
      );
      return;
    }

    if (!verification) {
      setError(
        "Clique d'abord sur « Vérifier ».",
      );
      return;
    }

    if (verification.found) {
      setError(
        "Cet identifiant existe déjà dans la base.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/admin/asso",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            value: trimmedValue,
          }),
        },
      );

      const data: SaveResult =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ??
            "Impossible d'ajouter cet identifiant.",
        );
        return;
      }

      if (data.alreadyExists) {
        setError(
          "Cet identifiant existe déjà dans la base.",
        );

        /*
         * On met à jour la vérification pour refléter
         * l'état réel de la base.
         */
        setVerification({
          found: true,
          identifier: data.identifier
            ? {
                id: data.identifier.id,
                profileId:
                  data.identifier.id,
                type: data.identifier.type,
                value: data.identifier.value,
              }
            : null,
        });

        return;
      }

      if (
        data.created &&
        data.identifier
      ) {
        setAddedIdentifiers((current) => [
          data.identifier!,
          ...current.filter(
            (item) =>
              item.id !==
              data.identifier!.id,
          ),
        ]);

        setMessage(
          "L'identifiant a bien été ajouté à la base.",
        );

        setVerification({
          found: true,
          identifier: data.identifier
            ? {
                id: data.identifier.id,
                profileId:
                  data.identifier.id,
                type: data.identifier.type,
                value: data.identifier.value,
              }
            : null,
        });
      }
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Impossible de contacter le serveur.",
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * Quand la valeur ou le type change,
   * l'ancienne vérification n'est plus valable.
   */
  function handleTypeChange(
    nextType: IdentifierType,
  ) {
    setType(nextType);
    setVerification(null);
    setMessage("");
    setError("");
  }

  function handleValueChange(
    nextValue: string,
  ) {
    setValue(nextValue);
    setVerification(null);
    setMessage("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Gestion des identifiants
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Ajoute séparément les pseudos et noms
            Facebook signalés.
          </p>
        </div>

        {/* Ajout */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            {/* Type */}
            <div>
              <label
                htmlFor="identifier-type"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Type
              </label>

              <select
                id="identifier-type"
                value={type}
                onChange={(event) =>
                  handleTypeChange(
                    event.target
                      .value as IdentifierType,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              >
                <option value="pseudo">
                  Pseudo
                </option>

                <option value="name">
                  Nom Facebook
                </option>
              </select>
            </div>

            {/* Valeur */}
            <div>
              <label
                htmlFor="identifier-value"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Identifiant
              </label>

              <input
                id="identifier-value"
                type="text"
                value={value}
                onChange={(event) =>
                  handleValueChange(
                    event.target.value,
                  )
                }
                placeholder={
                  type === "pseudo"
                    ? "@portopetro26"
                    : "Manuel Cervera"
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                {type === "pseudo"
                  ? "Le @ sera ajouté automatiquement s'il manque."
                  : "Entre le nom tel qu'il apparaît sur Facebook."}
              </p>
            </div>
          </div>

          {/* Vérification */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={
              verifying || !value.trim()
            }
            className="mt-6 w-full rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {verifying
              ? "Vérification..."
              : "🔎 Vérifier"}
          </button>

          {/* Résultat vérification */}
          {verification && (
            <div className="mt-5">
              {verification.found ? (
                <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">
                      🟠
                    </span>

                    <div className="min-w-0">
                      <p className="font-semibold text-amber-300">
                        Identifiant déjà présent
                      </p>

                      <p className="mt-1 text-sm text-amber-200/80">
                        Cet identifiant existe déjà
                        dans la base.
                      </p>

                      {verification.identifier && (
                        <div className="mt-3 rounded-lg bg-slate-950 px-3 py-2">
                          <div className="font-medium text-white">
                            {
                              verification
                                .identifier.value
                            }
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {verification.identifier.type ===
                            "pseudo"
                              ? "Pseudo"
                              : "Nom Facebook"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-700/50 bg-blue-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">
                      🔵
                    </span>

                    <div>
                      <p className="font-semibold text-blue-300">
                        Nouvel identifiant
                      </p>

                      <p className="mt-1 text-sm text-blue-200/80">
                        Cet identifiant n'existe pas
                        encore dans la base.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="mt-5 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Succès */}
          {message && (
            <div className="mt-5 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
              {message}
            </div>
          )}

          {/* Ajouter */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={
              saving ||
              !verification ||
              verification.found ||
              !value.trim()
            }
            className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? "Ajout en cours..."
              : "+ Ajouter à la base"}
          </button>
        </section>

        {/* Ajouts de cette session */}
        {addedIdentifiers.length > 0 && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">
              Ajouts de cette session
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Chaque identifiant est indépendant.
            </p>

            <div className="mt-5 space-y-3">
              {addedIdentifiers.map(
                (identifier) => (
                  <div
                    key={identifier.id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-slate-950 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">
                        {identifier.value}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {identifier.type ===
                        "pseudo"
                          ? "Pseudo"
                          : "Nom Facebook"}
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                      Ajouté
                    </span>
                  </div>
                ),
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}