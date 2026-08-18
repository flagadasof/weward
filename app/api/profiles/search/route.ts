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

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/**
 * Rate limit en mémoire.
 *
 * Limite : 30 recherches par minute et par IP.
 *
 * Cette protection est volontairement simple pour ne pas ajouter
 * de service externe au projet.
 */
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      retryAfter: 0,
    };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(
        (existing.resetAt - now) / 1000,
      ),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - existing.count,
    retryAfter: 0,
  };
}

function cleanupRateLimitStore() {
  const now = Date.now();

  for (const [ip, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(ip);
    }
  }
}

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

/**
 * Récupère tous les identifiants Supabase par lots.
 *
 * Supabase limite les réponses à un certain nombre de lignes.
 * On récupère donc les données par pages de 1000 lignes.
 */
async function getAllIdentifiers(
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  const PAGE_SIZE = 1000;
  let from = 0;

  const allIdentifiers: Identifier[] = [];

  while (true) {
 const { data, error, count } = await supabase
  .from("profile_identifiers")
  .select(
    "id, profile_id, identifier_type, value, normalized_value",
    { count: "exact" }
  )
  .range(from, from + PAGE_SIZE - 1);



    if (error) {
      throw error;
    }

    const page = (data ?? []) as Identifier[];

    allIdentifiers.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return allIdentifiers;
}

export async function GET(request: NextRequest) {
  cleanupRateLimitStore();

  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:
          "Trop de recherches. Veuillez patienter avant de réessayer.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error: "Le nom ou pseudo est obligatoire.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(
            rateLimit.remaining,
          ),
        },
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
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(
            rateLimit.remaining,
          ),
        },
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
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": String(
            rateLimit.remaining,
          ),
        },
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

  let allIdentifiers: Identifier[];

  try {
    allIdentifiers = await getAllIdentifiers(supabase);

  } catch (error) {
    console.error(
      "Erreur lors de la recherche des identifiants :",
      error,
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
  .map((identifier) => {
    const normalizedIdentifier =
      normalizeForComparison(
        identifier.normalized_value,
      );

    const containsQuery =
      normalizedIdentifier.includes(normalizedQuery);

    const similarity = calculateSimilarity(
      normalizedQuery,
      identifier.normalized_value,
    );

    return {
      identifier,
      similarity,
      containsQuery,
    };
  })
  .filter(
    (item) =>
      item.containsQuery || item.similarity >= 0.35,
  )
  .sort((a, b) => {
    if (a.containsQuery && !b.containsQuery) {
      return -1;
    }

    if (!a.containsQuery && b.containsQuery) {
      return 1;
    }

    return b.similarity - a.similarity;
  })
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
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Remaining": String(
          rateLimit.remaining,
        ),
      },
    },
  );
}