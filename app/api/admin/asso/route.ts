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
 * Vérifie si un identifiant existe exactement.
 *
 * La vérification cherche maintenant dans LES DEUX TYPES :
 * - pseudo
 * - nom Facebook
 *
 * Cela évite qu'un mauvais choix dans le sélecteur
 * empêche de retrouver un identifiant déjà présent.
 *
 * Exemple :
 * /api/admin/asso?q=@yaya77
 * /api/admin/asso?q=Manuel%20Cervera
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

    /*
     * On cherche d'abord une correspondance exacte
     * dans les pseudos ET les noms.
     */
    const {
      data: identifiers,
      error,
    } = await supabase
      .from("profile_identifiers")
      .select(
        "id, profile_id, identifier_type, value, normalized_value",
      )
      .eq(
        "normalized_value",
        normalizedQuery,
      )
      .in("identifier_type", [
        "pseudo",
        "name",
      ])
      .limit(10);

    if (error) {
      console.error(
        "Erreur vérification identifiant :",
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

    /*
     * On prend la première correspondance exacte.
     */
    const identifier =
      (identifiers?.[0] as Identifier | undefined) ??
      null;

    return NextResponse.json({
      found: Boolean(identifier),
      identifier: identifier
        ? {
            id: identifier.id,
            profileId: identifier.profile_id,
            type: identifier.identifier_type,
            value: identifier.value,
          }
        : null,
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
 *
 * Body :
 * {
 *   "type": "pseudo",
 *   "value": "@yaya77"
 * }
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

    /*
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

    /*
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

    /*
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

      /*
       * Nettoyage du profil si l'identifiant
       * n'a pas pu être créé.
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
 * Exemple :
 * /api/admin/asso?q=@caramal666&type=pseudo
 */
export async function DELETE(
  request: NextRequest,
) {
  try {
    const query = request.nextUrl.searchParams
      .get("q")
      ?.trim();

    const typeParam =
      request.nextUrl.searchParams.get("type");

    const type: IdentifierType =
      typeParam === "name"
        ? "name"
        : "pseudo";

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

    /*
     * Recherche exacte du type demandé.
     */
    const {
      data: identifier,
      error: searchError,
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
        normalizedQuery,
      )
      .limit(1)
      .maybeSingle();

    if (searchError) {
      console.error(
        "Erreur recherche suppression :",
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

    if (!identifier) {
      return NextResponse.json({
        success: false,
        deleted: false,
        found: false,
        message:
          "Identifiant introuvable.",
      });
    }

    /*
     * Suppression de l'identifiant uniquement.
     */
    const {
      error: deleteError,
    } = await supabase
      .from("profile_identifiers")
      .delete()
      .eq("id", identifier.id);

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
        id: identifier.id,
        profileId:
          identifier.profile_id,
        type:
          identifier.identifier_type,
        value:
          identifier.value,
      },
      message:
        "Identifiant supprimé.",
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