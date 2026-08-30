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
  profileId: string;
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

type DeleteResult = {
  success?: boolean;
  deleted?: boolean;
  found?: boolean;
  identifier?: AddedIdentifier;
  message?: string;
  error?: string;
};

export default function AssoPage() {
  /*
   * AJOUT
   */
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
   * SUPPRESSION
   */
  const [deleteType, setDeleteType] =
    useState<IdentifierType>("pseudo");

  const [deleteValue, setDeleteValue] =
    useState("");

  const [deleteVerification, setDeleteVerification] =
    useState<VerificationResult | null>(null);

  const [deleteVerifying, setDeleteVerifying] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");

  const [deleteMessage, setDeleteMessage] =
    useState("");

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
          identifier: {
            id: data.identifier.id,
            profileId:
              data.identifier.profileId,
            type: data.identifier.type,
            value: data.identifier.value,
          },
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
   * Vérification avant suppression.
   */
  async function handleDeleteVerify() {
    const trimmedValue =
      deleteValue.trim();

    setDeleteError("");
    setDeleteMessage("");
    setDeleteVerification(null);

    if (!trimmedValue) {
      setDeleteError(
        "Entre d'abord un nom ou un pseudo.",
      );
      return;
    }

    setDeleteVerifying(true);

    try {
      const response = await fetch(
        `/api/admin/asso?q=${encodeURIComponent(
          trimmedValue,
        )}&type=${deleteType}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data: VerificationResult =
        await response.json();

      if (!response.ok) {
        setDeleteError(
          data.error ??
            "Impossible de vérifier cet identifiant.",
        );
        return;
      }

      setDeleteVerification(data);
    } catch (requestError) {
      console.error(requestError);

      setDeleteError(
        "Impossible de contacter le serveur.",
      );
    } finally {
      setDeleteVerifying(false);
    }
  }

  /*
   * Suppression définitive d'un identifiant.
   */
  async function handleDelete() {
    if (
      !deleteVerification ||
      !deleteVerification.found ||
      !deleteVerification.identifier
    ) {
      setDeleteError(
        "Vérifie d'abord l'identifiant à supprimer.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement "${deleteVerification.identifier.value}" de la base ?`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setDeleteError("");
    setDeleteMessage("");

    try {
      const response = await fetch(
        `/api/admin/asso?q=${encodeURIComponent(
          deleteVerification.identifier.value,
        )}&type=${deleteVerification.identifier.type}`,
        {
          method: "DELETE",
        },
      );

      const data: DeleteResult =
        await response.json();

      if (!response.ok) {
        setDeleteError(
          data.error ??
            "Impossible de supprimer cet identifiant.",
        );
        return;
      }

      if (data.deleted) {
        setDeleteMessage(
          `"${deleteVerification.identifier.value}" a bien été supprimé.`,
        );

        setDeleteVerification(null);
        setDeleteValue("");

        /*
         * Si l'identifiant venait d'être ajouté
         * pendant cette session, on le retire aussi
         * de la liste affichée.
         */
        if (data.identifier) {
          setAddedIdentifiers((current) =>
            current.filter(
              (item) =>
                item.id !==
                data.identifier!.id,
            ),
          );
        }
      } else {
        setDeleteError(
          data.message ??
            "Cet identifiant n'a pas pu être supprimé.",
        );
      }
    } catch (requestError) {
      console.error(requestError);

      setDeleteError(
        "Impossible de contacter le serveur.",
      );
    } finally {
      setDeleting(false);
    }
  }

  /*
   * Quand le type d'ajout change,
   * la vérification précédente n'est plus valable.
   */
  function handleTypeChange(
    nextType: IdentifierType,
  ) {
    setType(nextType);
    setVerification(null);
    setMessage("");
    setError("");
  }

  /*
   * Quand la valeur d'ajout change,
   * la vérification précédente n'est plus valable.
   */
  function handleValueChange(
    nextValue: string,
  ) {
    setValue(nextValue);
    setVerification(null);
    setMessage("");
    setError("");
  }

  /*
   * Quand le type de suppression change.
   */
  function handleDeleteTypeChange(
    nextType: IdentifierType,
  ) {
    setDeleteType(nextType);
    setDeleteVerification(null);
    setDeleteMessage("");
    setDeleteError("");
  }

  /*
   * Quand la valeur de suppression change.
   */
  function handleDeleteValueChange(
    nextValue: string,
  ) {
    setDeleteValue(nextValue);
    setDeleteVerification(null);
    setDeleteMessage("");
    setDeleteError("");
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Gestion des identifiants
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Ajoute ou supprime séparément les pseudos
            et noms Facebook signalés.
          </p>
        </div>

        {/* ================================================= */}
        {/* AJOUT */}
        {/* ================================================= */}

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Ajouter un identifiant
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Chaque identifiant est indépendant.
            </p>
          </div>

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

          {/* Vérifier */}
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

          {/* Résultat */}
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

          {error && (
            <div className="mt-5 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

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

        {/* ================================================= */}
        {/* SUPPRESSION */}
        {/* ================================================= */}

        <section className="mt-10 rounded-2xl border border-red-900/50 bg-slate-900/80 p-6 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-red-300">
              Supprimer un identifiant
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              La suppression concerne uniquement
              l'identifiant sélectionné.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            {/* Type suppression */}
            <div>
              <label
                htmlFor="delete-type"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Type
              </label>

              <select
                id="delete-type"
                value={deleteType}
                onChange={(event) =>
                  handleDeleteTypeChange(
                    event.target
                      .value as IdentifierType,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-red-500"
              >
                <option value="pseudo">
                  Pseudo
                </option>

                <option value="name">
                  Nom Facebook
                </option>
              </select>
            </div>

            {/* Valeur suppression */}
            <div>
              <label
                htmlFor="delete-value"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Identifiant à supprimer
              </label>

              <input
                id="delete-value"
                type="text"
                value={deleteValue}
                onChange={(event) =>
                  handleDeleteValueChange(
                    event.target.value,
                  )
                }
                placeholder={
                  deleteType === "pseudo"
                    ? "@caramal666"
                    : "Nom Facebook"
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-red-500"
              />
            </div>
          </div>

          {/* Vérification suppression */}
          <button
            type="button"
            onClick={handleDeleteVerify}
            disabled={
              deleteVerifying ||
              !deleteValue.trim()
            }
            className="mt-6 w-full rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleteVerifying
              ? "Vérification..."
              : "🔎 Vérifier avant suppression"}
          </button>

          {/* Résultat suppression */}
          {deleteVerification && (
            <div className="mt-5">
              {deleteVerification.found &&
              deleteVerification.identifier ? (
                <div className="rounded-xl border border-red-700/50 bg-red-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">
                      🔴
                    </span>

                    <div className="min-w-0">
                      <p className="font-semibold text-red-300">
                        Identifiant trouvé
                      </p>

                      <div className="mt-3 rounded-lg bg-slate-950 px-3 py-2">
                        <div className="font-medium text-white">
                          {
                            deleteVerification
                              .identifier.value
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {deleteVerification
                            .identifier.type ===
                          "pseudo"
                            ? "Pseudo"
                            : "Nom Facebook"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">
                      🔵
                    </span>

                    <div>
                      <p className="font-semibold text-slate-300">
                        Aucun identifiant trouvé
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Rien ne correspond exactement
                        à cette recherche.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {deleteError && (
            <div className="mt-5 rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {deleteError}
            </div>
          )}

          {deleteMessage && (
            <div className="mt-5 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
              {deleteMessage}
            </div>
          )}

          {/* Suppression définitive */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={
              deleting ||
              !deleteVerification ||
              !deleteVerification.found ||
              !deleteVerification.identifier
            }
            className="mt-6 w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting
              ? "Suppression..."
              : "🗑 Supprimer définitivement"}
          </button>
        </section>
      </div>
    </main>
  );
}