import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type IdentifierType = "pseudo" | "name";

type Identifier = {
  id: string;
  profile_id: string;
  identifier_type: IdentifierType;
  value: string;
  normalized_value: string;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Configuration Supabase serveur manquante.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Normalisation utilisée pour la recherche.
 *
 * @Yaya77 -> yaya77
 * Stéphanie Millan -> stephanie millan
 */
function normalizeValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Formatage de la valeur enregistrée.
 */
function formatValue(
  value: string,
  type: IdentifierType,
) {
  const trimmed = value.trim();

  if (
    type === "pseudo" &&
    trimmed &&
    !trimmed.startsWith("@")
  ) {
    return `@${trimmed}`;
  }

  return trimmed;
}

/**
 * GET
 *
 * Vérifie si un identifiant exact existe déjà.
 *
 * La recherche est faite dans les pseudos ET
 * dans les noms Facebook.
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams
      .get("q")
      ?.trim();

    if (!query) {
      return NextResponse.json({
        found: false,
        identifier: null,
      });
    }

    const supabase = getSupabaseAdmin();

    const normalizedQuery =
      normalizeValue(query);

    if (!normalizedQuery) {
      return NextResponse.json({
        found: false,
        identifier: null,
      });
    }

    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      const {
        data: identifiers,
        error,
      } = await supabase
        .from("profile_identifiers")
        .select(
          "id, profile_id, identifier_type, value, normalized_value",
        )
        .range(
          from,
          from + PAGE_SIZE - 1,
        );

      if (error) {
        console.error(
          "Erreur récupération identifiants :",
          error,
        );

        return NextResponse.json(
          {
            error:
              "Impossible de vérifier cet identifiant.",
          },
          {
            status: 500,
          },
        );
      }

      const matchingIdentifier =
        (identifiers ?? []).find(
          (identifier: Identifier) =>
            normalizeValue(
              identifier.value,
            ) === normalizedQuery,
        ) ?? null;

      if (matchingIdentifier) {
        return NextResponse.json({
          found: true,
          identifier: {
            id: matchingIdentifier.id,
            profileId:
              matchingIdentifier.profile_id,
            type:
              matchingIdentifier.identifier_type,
            value:
              matchingIdentifier.value,
          },
        });
      }

      if (
        !identifiers ||
        identifiers.length < PAGE_SIZE
      ) {
        break;
      }

      from += PAGE_SIZE;
    }

    return NextResponse.json({
      found: false,
      identifier: null,
    });
  } catch (error) {
    console.error(
      "Erreur GET /api/admin/asso :",
      error,
    );

    return NextResponse.json(
      {
        error: "Erreur serveur.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST
 *
 * Ajoute UN identifiant indépendant.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const type: IdentifierType =
      body.type === "name"
        ? "name"
        : "pseudo";

    const rawValue =
      typeof body.value === "string"
        ? body.value.trim()
        : "";

    if (!rawValue) {
      return NextResponse.json(
        {
          error:
            "L'identifiant est obligatoire.",
        },
        {
          status: 400,
        },
      );
    }

    if (rawValue.length > 150) {
      return NextResponse.json(
        {
          error:
            "L'identifiant est trop long.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase = getSupabaseAdmin();

    const value = formatValue(
      rawValue,
      type,
    );

    const normalizedValue =
      normalizeValue(value);

    if (!normalizedValue) {
      return NextResponse.json(
        {
          error:
            "L'identifiant est invalide.",
        },
        {
          status: 400,
        },
      );
    }

    /**
     * Vérification d'un doublon exact
     * sur le même type.
     */
    const {
      data: existingIdentifier,
      error: existingError,
    } = await supabase
      .from("profile_identifiers")
      .select(
        "id, profile_id, identifier_type, value, normalized_value",
      )
      .eq(
        "identifier_type",
        type,
      )
      .eq(
        "normalized_value",
        normalizedValue,
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Erreur recherche doublon :",
        existingError,
      );

      return NextResponse.json(
        {
          error:
            "Impossible de vérifier si cet identifiant existe déjà.",
        },
        {
          status: 500,
        },
      );
    }

    if (existingIdentifier) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        created: false,
        identifier: {
          id: existingIdentifier.id,
          profileId:
            existingIdentifier.profile_id,
          type:
            existingIdentifier.identifier_type,
          value:
            existingIdentifier.value,
        },
      });
    }

    /**
     * Création d'un profil indépendant.
     */
    const {
      data: newProfile,
      error: profileError,
    } = await supabase
      .from("reported_profiles")
      .insert({
        flagged: true,
      })
      .select("id")
      .single();

    if (profileError || !newProfile) {
      console.error(
        "Erreur création profil signalé :",
        profileError,
      );

      return NextResponse.json(
        {
          error:
            "Impossible de créer le profil signalé.",
        },
        {
          status: 500,
        },
      );
    }

    /**
     * Création de l'identifiant.
     */
    const {
      data: newIdentifier,
      error: identifierError,
    } = await supabase
      .from("profile_identifiers")
      .insert({
        profile_id: newProfile.id,
        identifier_type: type,
        value,
        normalized_value:
          normalizedValue,
      })
      .select(
        "id, profile_id, identifier_type, value, normalized_value",
      )
      .single();

    if (
      identifierError ||
      !newIdentifier
    ) {
      console.error(
        "Erreur création identifiant :",
        identifierError,
      );

      /**
       * Nettoyage du profil si
       * l'identifiant n'a pas pu être créé.
       */
      await supabase
        .from("reported_profiles")
        .delete()
        .eq("id", newProfile.id);

      return NextResponse.json(
        {
          error:
            "Impossible d'enregistrer l'identifiant.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      created: true,
      identifier: {
        id: newIdentifier.id,
        profileId:
          newIdentifier.profile_id,
        type:
          newIdentifier.identifier_type,
        value:
          newIdentifier.value,
      },
    });
  } catch (error) {
    console.error(
      "Erreur POST /api/admin/asso :",
      error,
    );

    return NextResponse.json(
      {
        error: "Erreur serveur.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * DELETE
 *
 * Supprime uniquement l'identifiant demandé.
 *
 * IMPORTANT :
 * la suppression recherche maintenant dans les
 * pseudos ET les noms Facebook, indépendamment
 * du type choisi dans l'interface.
 */
export async function DELETE(
  request: NextRequest,
) {
  try {
    const query = request.nextUrl.searchParams
      .get("q")
      ?.trim();

    if (!query) {
      return NextResponse.json(
        {
          error:
            "L'identifiant à supprimer est obligatoire.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase = getSupabaseAdmin();

    const normalizedQuery =
      normalizeValue(query);

    if (!normalizedQuery) {
      return NextResponse.json({
        success: false,
        deleted: false,
        found: false,
        message:
          "Identifiant invalide.",
      });
    }

    /*
     * Comme pour le GET, on parcourt la table
     * par pages de 1000 lignes.
     */
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      const {
        data: identifiers,
        error: searchError,
      } = await supabase
        .from("profile_identifiers")
        .select(
          "id, profile_id, identifier_type, value, normalized_value",
        )
        .range(
          from,
          from + PAGE_SIZE - 1,
        );

      if (searchError) {
        console.error(
          "Erreur récupération identifiants pour suppression :",
          searchError,
        );

        return NextResponse.json(
          {
            error:
              "Impossible de rechercher cet identifiant.",
          },
          {
            status: 500,
          },
        );
      }

      /*
       * On compare la vraie valeur enregistrée
       * après normalisation.
       *
       * Cela permet de retrouver :
       * @wic72
       * wic72
       * @Wic72
       */
      const matchingIdentifier =
        (identifiers ?? []).find(
          (identifier: Identifier) =>
            normalizeValue(
              identifier.value,
            ) === normalizedQuery,
        ) ?? null;

      if (matchingIdentifier) {
        /*
         * Suppression uniquement de cet identifiant.
         */
        const {
          error: deleteError,
        } = await supabase
          .from("profile_identifiers")
          .delete()
          .eq(
            "id",
            matchingIdentifier.id,
          );

        if (deleteError) {
          console.error(
            "Erreur suppression identifiant :",
            deleteError,
          );

          return NextResponse.json(
            {
              error:
                "Impossible de supprimer cet identifiant.",
            },
            {
              status: 500,
            },
          );
        }

        return NextResponse.json({
          success: true,
          deleted: true,
          found: true,
          identifier: {
            id: matchingIdentifier.id,
            profileId:
              matchingIdentifier.profile_id,
            type:
              matchingIdentifier.identifier_type,
            value:
              matchingIdentifier.value,
          },
          message:
            "Identifiant supprimé.",
        });
      }

      /*
       * Fin de la table.
       */
      if (
        !identifiers ||
        identifiers.length < PAGE_SIZE
      ) {
        break;
      }

      from += PAGE_SIZE;
    }

    return NextResponse.json({
      success: false,
      deleted: false,
      found: false,
      message:
        "Identifiant introuvable.",
    });
  } catch (error) {
    console.error(
      "Erreur DELETE /api/admin/asso :",
      error,
    );

    return NextResponse.json(
      {
        error: "Erreur serveur.",
      },
      {
        status: 500,
      },
    );
  }
}