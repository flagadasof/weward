"use client";

import { useState } from "react";

type AssociationType = "pseudo" | "name";

type AssociationRow = {
  id: number;
  type: AssociationType;
  value: string;
};

type VerificationResult = {
  found: boolean;
  profileId?: string | null;
  pseudos?: string[];
  names?: string[];
  error?: string;
};

type SaveResult = {
  success?: boolean;
  error?: string;
  profileId?: string;
  added?: string[];
  alreadyPresent?: string[];
  pseudos?: string[];
  names?: string[];
};

export default function AssoPage() {
  const [mainPseudo, setMainPseudo] = useState("");

  const [associations, setAssociations] = useState<
    AssociationRow[]
  >([
    {
      id: 1,
      type: "pseudo",
      value: "",
    },
  ]);

  const [verification, setVerification] =
    useState<VerificationResult | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [result, setResult] =
    useState<SaveResult | null>(null);

  function addAssociation() {
    setAssociations((current) => [
      ...current,
      {
        id: Date.now(),
        type: "name",
        value: "",
      },
    ]);
  }

  function removeAssociation(id: number) {
    setAssociations((current) =>
      current.filter(
        (association) => association.id !== id,
      ),
    );
  }

  function updateAssociation(
    id: number,
    field: "type" | "value",
    value: string,
  ) {
    setAssociations((current) =>
      current.map((association) =>
        association.id === id
          ? {
              ...association,
              [field]: value,
            }
          : association,
      ),
    );
  }

  /*
   * Vérification du pseudo principal.
   */
  async function handleVerify() {
    setError("");
    setMessage("");
    setResult(null);
    setVerification(null);

    if (!mainPseudo.trim()) {
      setError(
        "Entre d'abord un pseudo à vérifier.",
      );
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(
        `/api/admin/asso?q=${encodeURIComponent(
          mainPseudo.trim(),
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data: VerificationResult =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de vérifier le pseudo.",
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
   * Enregistrement.
   */
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setError("");
    setResult(null);

    /*
     * Sécurité :
     * impossible d'enregistrer sans avoir vérifié.
     */
    if (!verification) {
      setError(
        "Clique d'abord sur « Vérifier ».",
      );
      return;
    }

    if (!mainPseudo.trim()) {
      setError(
        "Le pseudo principal est obligatoire.",
      );
      return;
    }

    const cleanedAssociations = associations
      .filter(
        (association) =>
          association.value.trim(),
      )
      .map((association) => ({
        type: association.type,
        value: association.value.trim(),
      }));

    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin/asso",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mainPseudo: mainPseudo.trim(),
            associations: cleanedAssociations,
          }),
        },
      );

      const data: SaveResult =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Une erreur est survenue.",
        );
        return;
      }

      setResult(data);

      setMessage(
        "Les associations ont bien été enregistrées.",
      );

      /*
       * On conserve le pseudo principal
       * pour permettre d'ajouter facilement
       * d'autres associations.
       */
      setAssociations([
        {
          id: Date.now(),
          type: "pseudo",
          value: "",
        },
      ]);

      /*
       * On remet à jour la vérification
       * avec les nouvelles données.
       */
      setVerification({
        found: true,
        profileId: data.profileId,
        pseudos: data.pseudos ?? [],
        names: data.names ?? [],
      });
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Impossible de contacter le serveur.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Ajouter des associations
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Vérifie d'abord le pseudo, puis ajoute les
            pseudos ou noms associés.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl"
        >
          {/* Pseudo principal */}
          <div>
            <label
              htmlFor="mainPseudo"
              className="mb-2 block text-sm font-semibold text-slate-200"
            >
              Pseudo principal
            </label>

            <div className="flex gap-3">
              <input
                id="mainPseudo"
                type="text"
                value={mainPseudo}
                onChange={(event) => {
                  setMainPseudo(
                    event.target.value,
                  );

                  /*
                   * Si le pseudo change,
                   * la vérification précédente
                   * n'est plus valable.
                   */
                  setVerification(null);
                  setResult(null);
                  setMessage("");
                  setError("");
                }}
                placeholder="@pseudo"
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />

              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying
                  ? "Vérification..."
                  : "Vérifier"}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Le symbole @ sera ajouté automatiquement
              pour un pseudo.
            </p>
          </div>

          {/* Résultat vérification */}
          {verification && (
            <div className="mt-5">
              {verification.found ? (
                <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      🟢
                    </span>

                    <div>
                      <p className="font-semibold text-emerald-300">
                        Profil déjà présent
                      </p>

                      <p className="text-xs text-emerald-400/70">
                        Ce pseudo existe déjà dans la
                        base.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-400">
                        Pseudos associés
                      </p>

                      {verification.pseudos &&
                      verification.pseudos.length >
                        0 ? (
                        <div className="space-y-2">
                          {verification.pseudos.map(
                            (pseudo) => (
                              <div
                                key={pseudo}
                                className="rounded-lg bg-slate-950 px-3 py-2 text-sm"
                              >
                                {pseudo}
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Aucun autre pseudo.
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-400">
                        Noms associés
                      </p>

                      {verification.names &&
                      verification.names.length >
                        0 ? (
                        <div className="space-y-2">
                          {verification.names.map(
                            (name) => (
                              <div
                                key={name}
                                className="rounded-lg bg-slate-950 px-3 py-2 text-sm"
                              >
                                {name}
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Aucun nom associé.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-700/50 bg-blue-950/30 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      🔵
                    </span>

                    <div>
                      <p className="font-semibold text-blue-300">
                        Nouveau pseudo
                      </p>

                      <p className="text-xs text-blue-400/70">
                        Aucun profil existant pour ce
                        pseudo.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Associations */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Identifiants associés
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Ajoute les autres pseudos ou noms de cette
                  même personne.
                </p>
              </div>

              <button
                type="button"
                onClick={addAssociation}
                className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold transition hover:bg-slate-700"
              >
                + Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {associations.map(
                (association, index) => (
                  <div
                    key={association.id}
                    className="flex gap-3"
                  >
                    <select
                      value={association.type}
                      onChange={(event) =>
                        updateAssociation(
                          association.id,
                          "type",
                          event.target.value,
                        )
                      }
                      className="w-32 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                    >
                      <option value="pseudo">
                        Pseudo
                      </option>

                      <option value="name">
                        Nom
                      </option>
                    </select>

                    <input
                      type="text"
                      value={association.value}
                      onChange={(event) =>
                        updateAssociation(
                          association.id,
                          "value",
                          event.target.value,
                        )
                      }
                      placeholder={
                        association.type ===
                        "pseudo"
                          ? "@autrepseudo"
                          : "Nom Facebook"
                      }
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                    />

                    {associations.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          removeAssociation(
                            association.id,
                          )
                        }
                        className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 text-sm text-red-400 transition hover:bg-red-950/60"
                        aria-label={`Supprimer l'association ${
                          index + 1
                        }`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Succès */}
          {message && (
            <div className="mt-6 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
              {message}
            </div>
          )}

          {/* Enregistrer */}
          <button
            type="submit"
            disabled={
              loading || !verification
            }
            className="mt-8 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? "Enregistrement..."
              : "Enregistrer les associations"}
          </button>
        </form>

        {/* Résultat après enregistrement */}
        {result?.success && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold">
              Profil enregistré
            </h2>

            {result.profileId && (
              <p className="mt-2 break-all text-xs text-slate-500">
                Profil : {result.profileId}
              </p>
            )}

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {/* Pseudos */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-blue-400">
                  Pseudos
                </h3>

                {result.pseudos &&
                result.pseudos.length > 0 ? (
                  <div className="space-y-2">
                    {result.pseudos.map(
                      (pseudo) => (
                        <div
                          key={pseudo}
                          className="rounded-lg bg-slate-950 px-3 py-2 text-sm"
                        >
                          {pseudo}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucun pseudo.
                  </p>
                )}
              </div>

              {/* Noms */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-purple-400">
                  Noms associés
                </h3>

                {result.names &&
                result.names.length > 0 ? (
                  <div className="space-y-2">
                    {result.names.map(
                      (name) => (
                        <div
                          key={name}
                          className="rounded-lg bg-slate-950 px-3 py-2 text-sm"
                        >
                          {name}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucun nom associé.
                  </p>
                )}
              </div>
            </div>

            {result.alreadyPresent &&
              result.alreadyPresent.length > 0 && (
                <div className="mt-6 rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-4">
                  <p className="text-sm font-semibold text-yellow-400">
                    Déjà présents
                  </p>

                  <p className="mt-2 text-sm text-yellow-200/80">
                    {result.alreadyPresent.join(
                      ", ",
                    )}
                  </p>
                </div>
              )}
          </section>
        )}
      </div>
    </main>
  );
}