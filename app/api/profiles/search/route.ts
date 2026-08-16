import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Identifier = {
  id: string;
  profile_id: string;
  identifier_type: "pseudo" | "name";
  value: string;
  normalized_value: string;
};

type Profile = {
  id: string;
  source_profile_id: string | null;
  flagged: boolean;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateSimilarity(a: string, b: string) {
  const left = normalizeForComparison(a);
  const right = normalizeForComparison(b);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftTrigrams = new Set<string>();
  const rightTrigrams = new Set<string>();

  const createTrigrams = (value: string) => {
    const padded = `  ${value}  `;
    const trigrams = new Set<string>();

    for (let index = 0; index < padded.length - 2; index += 1) {
      trigrams.add(padded.slice(index, index + 3));
    }

    return trigrams;
  };

  createTrigrams(left).forEach((value) =>
    leftTrigrams.add(value),
  );

  createTrigrams(right).forEach((value) =>
    rightTrigrams.add(value),
  );

  let intersection = 0;

  leftTrigrams.forEach((value) => {
    if (rightTrigrams.has(value)) {
      intersection += 1;
    }
  });

  const total = leftTrigrams.size + rightTrigrams.size;

  if (total === 0) {
    return 0;
  }

  return (2 * intersection) / total;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error: "Le nom ou pseudo est obligatoire.",
      },
      {
        status: 400,
      },
    );
  }

  if (query.length > 100) {
    return NextResponse.json(
      {
        error: "La recherche est trop longue.",
      },
      {
        status: 400,
      },
    );
  }

  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return NextResponse.json(
      {
        error: "Le nom ou pseudo est obligatoire.",
      },
      {
        status: 400,
      },
    );
  }

  let supabase;

  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error(
      "Configuration Supabase serveur invalide :",
      error,
    );

    return NextResponse.json(
      {
        error: "Configuration serveur incorrecte.",
      },
      {
        status: 500,
      },
    );
  }

  const { data: identifiers, error: identifiersError } =
    await supabase
      .from("profile_identifiers")
      .select(
        "id, profile_id, identifier_type, value, normalized_value",
      )
      .limit(1000);

  if (identifiersError) {
    console.error(
      "Erreur lors de la recherche des identifiants :",
      identifiersError,
    );

    return NextResponse.json(
      {
        error: "Impossible de rechercher les profils.",
      },
      {
        status: 500,
      },
    );
  }

  const allIdentifiers = (identifiers ?? []) as Identifier[];

  const exactMatches = allIdentifiers.filter(
    (identifier) =>
      normalizeForComparison(identifier.normalized_value) ===
      normalizedQuery,
  );

  const exactProfileIds = [
    ...new Set(
      exactMatches.map((identifier) => identifier.profile_id),
    ),
  ];

  let profiles: Profile[] = [];

  if (exactProfileIds.length > 0) {
    const { data: profileData, error: profilesError } =
      await supabase
        .from("reported_profiles")
        .select("id, source_profile_id, flagged")
        .in("id", exactProfileIds);

    if (profilesError) {
      console.error(
        "Erreur lors de la récupération des profils :",
        profilesError,
      );

      return NextResponse.json(
        {
          error: "Impossible de récupérer les profils.",
        },
        {
          status: 500,
        },
      );
    }

    profiles = (profileData ?? []) as Profile[];
  }

  const exactProfileIdSet = new Set(exactProfileIds);

  const similarIdentifiers = allIdentifiers
    .filter(
      (identifier) =>
        !exactProfileIdSet.has(identifier.profile_id),
    )
    .map((identifier) => ({
      identifier,
      similarity: calculateSimilarity(
        normalizedQuery,
        identifier.normalized_value,
      ),
    }))
    .filter((item) => item.similarity >= 0.35)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  const similarProfileIds = [
    ...new Set(
      similarIdentifiers.map(
        (item) => item.identifier.profile_id,
      ),
    ),
  ];

  let similarProfiles: Profile[] = [];

  if (similarProfileIds.length > 0) {
    const {
      data: similarProfileData,
      error: similarProfilesError,
    } = await supabase
      .from("reported_profiles")
      .select("id, source_profile_id, flagged")
      .in("id", similarProfileIds);

    if (similarProfilesError) {
      console.error(
        "Erreur lors de la récupération des profils proches :",
        similarProfilesError,
      );

      return NextResponse.json(
        {
          error: "Impossible de récupérer les profils proches.",
        },
        {
          status: 500,
        },
      );
    }

    similarProfiles = (similarProfileData ??
      []) as Profile[];
  }

  const profileIdsToLoad = [
    ...new Set([
      ...exactProfileIds,
      ...similarProfileIds,
    ]),
  ];

  let allProfileIdentifiers: Identifier[] = [];

  if (profileIdsToLoad.length > 0) {
    const {
      data: profileIdentifiersData,
      error: profileIdentifiersError,
    } = await supabase
      .from("profile_identifiers")
      .select(
        "id, profile_id, identifier_type, value, normalized_value",
      )
      .in("profile_id", profileIdsToLoad);

    if (profileIdentifiersError) {
      console.error(
        "Erreur lors de la récupération des identifiants des profils :",
        profileIdentifiersError,
      );

      return NextResponse.json(
        {
          error:
            "Impossible de récupérer les informations des profils.",
        },
        {
          status: 500,
        },
      );
    }

    allProfileIdentifiers =
      (profileIdentifiersData ?? []) as Identifier[];
  }

  const buildProfileResult = (profile: Profile) => {
    const profileIdentifiers =
      allProfileIdentifiers.filter(
        (identifier) =>
          identifier.profile_id === profile.id,
      );

    return {
      id: profile.id,
      flagged: profile.flagged,
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
    };
  };

  const foundProfiles = profiles.map(buildProfileResult);

  const similarResults = similarProfiles.map((profile) => {
    const matchingIdentifier = similarIdentifiers.find(
      (item) =>
        item.identifier.profile_id === profile.id,
    );

    return {
      ...buildProfileResult(profile),
      similarity: matchingIdentifier
        ? Math.round(
            matchingIdentifier.similarity * 100,
          )
        : 0,
    };
  });

  return NextResponse.json(
    {
      query,
      found: foundProfiles.length > 0,
      profiles: foundProfiles,
      similar: similarResults,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}