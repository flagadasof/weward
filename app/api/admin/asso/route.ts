import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Association = {
  type: "pseudo" | "name";
  value: string;
};

type Identifier = {
  id: string;
  profile_id: string;
  identifier_type: "pseudo" | "name";
  value: string;
  normalized_value: string;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configuration Supabase serveur manquante.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Normalisation utilisée pour les recherches.
 *
 * On conserve le @ pour rester compatible avec les
 * valeurs déjà présentes dans la base.
 */
function normalizeValue(value: string) {
  const trimmed = value.trim();

  const withoutSpaces = trimmed.replace(/\s+/g, " ");

  const normalized = withoutSpaces
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized && !normalized.startsWith("@")) {
    return `@${normalized}`;
  }

  return normalized;
}

function formatValue(
  value: string,
  type: "pseudo" | "name",
) {
  const trimmed = value.trim();

  if (type === "pseudo" && trimmed && !trimmed.startsWith("@")) {
    return `@${trimmed}`;
  }

  return trimmed;
}

/**
 * GET
 *
 * Vérifie si un pseudo existe déjà et retourne
 * tous les identifiants associés à son profile_id.
 *
 * Exemple :
 * /api/admin/asso?q=@portopetro26
 */
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams
      .get("q")
      ?.trim();

    if (!query) {
      return NextResponse.json({
        found: false,
        profileId: null,
        pseudos: [],
        names: [],
      });
    }

    const supabase = getSupabaseAdmin();

    const normalizedQuery = normalizeValue(query);

    /*
     * On recherche d'abord le pseudo exact.
     */
    const { data: pseudo, error: pseudoError } =
      await supabase
        .from("profile_identifiers")
        .select(
          "id, profile_id, identifier_type, value, normalized_value",
        )
        .eq("identifier_type", "pseudo")
        .eq("normalized_value", normalizedQuery)
        .limit(1)
        .maybeSingle();

    if (pseudoError) {
      console.error(
        "Erreur recherche pseudo :",
        pseudoError,
      );

      return NextResponse.json(
        {
          error: "Impossible de rechercher le pseudo.",
        },
        { status: 500 },
      );
    }

    /*
     * Si aucun résultat exact n'est trouvé, on renvoie
     * simplement "nouveau pseudo".
     */
    if (!pseudo) {
      return NextResponse.json({
        found: false,
        profileId: null,
        pseudos: [],
        names: [],
      });
    }

    /*
     * Le pseudo existe :
     * on récupère TOUS les identifiants du même profil.
     */
    const { data: identifiers, error: identifiersError } =
      await supabase
        .from("profile_identifiers")
        .select(
          "id, profile_id, identifier_type, value, normalized_value",
        )
        .eq("profile_id", pseudo.profile_id)
        .order("identifier_type")
        .order("value");

    if (identifiersError) {
      console.error(
        "Erreur récupération associations :",
        identifiersError,
      );

      return NextResponse.json(
        {
          error:
            "Impossible de récupérer les associations.",
        },
        { status: 500 },
      );
    }

    const profileIdentifiers =
      (identifiers ?? []) as Identifier[];

    return NextResponse.json({
      found: true,
      profileId: pseudo.profile_id,
      pseudos: profileIdentifiers
        .filter(
          (identifier) =>
            identifier.identifier_type === "pseudo",
        )
        .map((identifier) => identifier.value),
      names: profileIdentifiers
        .filter(
          (identifier) =>
            identifier.identifier_type === "name",
        )
        .map((identifier) => identifier.value),
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
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const mainPseudo =
      typeof body.mainPseudo === "string"
        ? body.mainPseudo.trim()
        : "";

    const associations = Array.isArray(body.associations)
      ? (body.associations as Association[])
      : [];

    if (!mainPseudo) {
      return NextResponse.json(
        {
          error: "Le pseudo principal est obligatoire.",
        },
        { status: 400 },
      );
    }

    if (associations.length > 30) {
      return NextResponse.json(
        {
          error: "Vous pouvez ajouter au maximum 30 associations.",
        },
        { status: 400 },
      );
    }

    const cleanedAssociations = associations
      .filter(
        (association) =>
          association &&
          (association.type === "pseudo" ||
            association.type === "name") &&
          typeof association.value === "string" &&
          association.value.trim(),
      )
      .map((association) => ({
        type: association.type,
        value: formatValue(
          association.value,
          association.type,
        ),
      }));

    const supabase = getSupabaseAdmin();

    const normalizedMainPseudo =
      normalizeValue(mainPseudo);

    /*
     * Recherche du pseudo principal existant.
     */
    const { data: existingMain, error: mainSearchError } =
      await supabase
        .from("profile_identifiers")
        .select(
          "id, profile_id, identifier_type, value, normalized_value",
        )
        .eq("identifier_type", "pseudo")
        .eq("normalized_value", normalizedMainPseudo)
        .limit(1)
        .maybeSingle();

    if (mainSearchError) {
      console.error(
        "Erreur recherche pseudo principal :",
        mainSearchError,
      );

      return NextResponse.json(
        {
          error:
            "Impossible de rechercher le pseudo principal.",
        },
        { status: 500 },
      );
    }

    let profileId: string;

    if (existingMain) {
      profileId = existingMain.profile_id;
    } else {
      /*
       * Création d'un nouveau profil.
       */
      const { data: newProfile, error: profileError } =
        await supabase
          .from("reported_profiles")
          .insert({
            flagged: true,
          })
          .select("id")
          .single();

      if (profileError || !newProfile) {
        console.error(
          "Erreur création profil :",
          profileError,
        );

        return NextResponse.json(
          {
            error: "Impossible de créer le profil.",
          },
          { status: 500 },
        );
      }

      profileId = newProfile.id;

      const formattedMainPseudo = formatValue(
        mainPseudo,
        "pseudo",
      );

      const { error: mainInsertError } =
        await supabase
          .from("profile_identifiers")
          .insert({
            profile_id: profileId,
            identifier_type: "pseudo",
            value: formattedMainPseudo,
            normalized_value: normalizedMainPseudo,
          });

      if (mainInsertError) {
        console.error(
          "Erreur création pseudo principal :",
          mainInsertError,
        );

        await supabase
          .from("reported_profiles")
          .delete()
          .eq("id", profileId);

        return NextResponse.json(
          {
            error:
              "Impossible d'enregistrer le pseudo principal.",
          },
          { status: 500 },
        );
      }
    }

    const added: string[] = [];
    const alreadyPresent: string[] = [];

    for (const association of cleanedAssociations) {
      const normalized = normalizeValue(
        association.value,
      );

      if (!normalized) {
        continue;
      }

      const { data: existingIdentifier, error: identifierError } =
        await supabase
          .from("profile_identifiers")
          .select(
            "id, profile_id, identifier_type, value, normalized_value",
          )
          .eq("identifier_type", association.type)
          .eq("normalized_value", normalized)
          .limit(1)
          .maybeSingle();

      if (identifierError) {
        console.error(
          "Erreur recherche association :",
          identifierError,
        );

        return NextResponse.json(
          {
            error:
              "Impossible de vérifier les associations.",
          },
          { status: 500 },
        );
      }

      if (existingIdentifier) {
        if (existingIdentifier.profile_id === profileId) {
          alreadyPresent.push(association.value);
          continue;
        }

        /*
         * L'identifiant existe sur un autre profil :
         * on le rattache au profil principal.
         */
        const { error: moveError } =
          await supabase
            .from("profile_identifiers")
            .update({
              profile_id: profileId,
            })
            .eq("id", existingIdentifier.id);

        if (moveError) {
          console.error(
            "Erreur déplacement association :",
            moveError,
          );

          return NextResponse.json(
            {
              error:
                "Impossible de rattacher une association existante.",
            },
            { status: 500 },
          );
        }

        added.push(association.value);
        continue;
      }

      const { error: insertError } =
        await supabase
          .from("profile_identifiers")
          .insert({
            profile_id: profileId,
            identifier_type: association.type,
            value: association.value,
            normalized_value: normalized,
          });

      if (insertError) {
        console.error(
          "Erreur ajout association :",
          insertError,
        );

        return NextResponse.json(
          {
            error:
              "Impossible d'ajouter une association.",
          },
          { status: 500 },
        );
      }

      added.push(association.value);
    }

    const { data: identifiers, error: identifiersError } =
      await supabase
        .from("profile_identifiers")
        .select(
          "id, profile_id, identifier_type, value, normalized_value",
        )
        .eq("profile_id", profileId)
        .order("identifier_type")
        .order("value");

    if (identifiersError) {
      console.error(
        "Erreur récupération profil final :",
        identifiersError,
      );

      return NextResponse.json(
        {
          error:
            "Les associations ont été enregistrées, mais impossible de récupérer le résultat.",
        },
        { status: 500 },
      );
    }

    const profileIdentifiers =
      (identifiers ?? []) as Identifier[];

    return NextResponse.json({
      success: true,
      profileId,
      added,
      alreadyPresent,
      pseudos: profileIdentifiers
        .filter(
          (identifier) =>
            identifier.identifier_type === "pseudo",
        )
        .map((identifier) => identifier.value),
      names: profileIdentifiers
        .filter(
          (identifier) =>
            identifier.identifier_type === "name",
        )
        .map((identifier) => identifier.value),
    });
  } catch (error) {
    console.error(
      "Erreur API associations :",
      error,
    );

    return NextResponse.json(
      {
        error: "Erreur serveur.",
      },
      { status: 500 },
    );
  }
}