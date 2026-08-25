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
 * Normalisation commune aux recherches.
 *
 * @Yaya77        -> yaya77
 * Stéphanie      -> stephanie
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
 * Formatage de la valeur affichée.
 *
 * Pour un pseudo, on ajoute automatiquement @.
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
 * Exemple :
 * /api/admin/asso?q=@yaya77&type=pseudo
 *
 * ou :
 * /api/admin/asso?q=Yannick%20Beck&type=name
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams
      .get("q")
      ?.trim();

    const typeParam =
      request.nextUrl.searchParams.get("type");

    const type: IdentifierType =
      typeParam === "name" ? "name" : "pseudo";

    if (!query) {
      return NextResponse.json(
        {
          found: false,
          identifier: null,
        },
      );
    }

    const supabase = getSupabaseAdmin();

    const normalizedQuery =
      normalizeValue(query);

    const { data: identifier, error } =
      await supabase
        .from("profile_identifiers")
        .select(
          "id, profile_id, identifier_type, value, normalized_value",
        )
        .eq("identifier_type", type)
        .eq("normalized_value", normalizedQuery)
        .limit(1)
        .maybeSingle();

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
      body.type === "name" ? "name" : "pseudo";

    const rawValue =
      typeof body.value === "string"
        ? body.value.trim()
        : "";

    if (!rawValue) {
      return NextResponse.json(
        {
          error: "L'identifiant est obligatoire.",
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
          error: "L'identifiant est invalide.",
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
      .eq("identifier_type", type)
      .eq("normalized_value", normalizedValue)
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
          value: existingIdentifier.value,
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
        normalized_value: normalizedValue,
      })
      .select(
        "id, profile_id, identifier_type, value, normalized_value",
      )
      .single();

    if (identifierError || !newIdentifier) {
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
        value: newIdentifier.value,
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