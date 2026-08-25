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
 * Normalisation de la recherche.
 *
 * Exemple :
 * "@Yaya77" -> "yaya77"
 * "Stéphanie Millan" -> "stephanie millan"
 */
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

/**
 * Similarité Jaccard basée sur des trigrammes.
 *
 * Retourne une valeur entre 0 et 1.
 */
function calculateSimilarity(a: string, b: string) {
  const left = normalizeForComparison(a);
  const right = normalizeForComparison(b);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const createTrigrams = (value: string) => {
    const padded = `  ${value}  `;
    const trigrams = new Set<string>();

    for (
      let index = 0;
      index < padded.length - 2;
      index += 1
    ) {
      trigrams.add(padded.slice(index, index + 3));
    }

    return trigrams;
  };

  const leftTrigrams = createTrigrams(left);
  const rightTrigrams = createTrigrams(right);

  let intersection = 0;

  leftTrigrams.forEach((value) => {
    if (rightTrigrams.has(value)) {
      intersection += 1;
    }
  });

  const total =
    leftTrigrams.size + rightTrigrams.size;

  if (total === 0) {
    return 0;
  }

  return (2 * intersection) / total;
}

/**
 * Calcule le score final.
 *
 * Cas important :
 *
 * yaya -> @yaya77
 *
 * Comme "yaya" est contenu dans "yaya77",
 * on considère cela comme une correspondance
 * forte même si la similarité trigramme brute
 * est plus faible.
 */
function calculateSearchScore(
  query: string,
  identifier: string,
) {
  const normalizedQuery =
    normalizeForComparison(query);

  const normalizedIdentifier =
    normalizeForComparison(identifier);

  if (!normalizedQuery || !normalizedIdentifier) {
    return 0;
  }

  if (normalizedQuery === normalizedIdentifier) {
    return 100;
  }

  const similarity =
    calculateSimilarity(
      normalizedQuery,
      normalizedIdentifier,
    ) * 100;

  const contains =
    normalizedIdentifier.includes(normalizedQuery);

  if (contains) {
    const ratio =
      normalizedQuery.length /
      normalizedIdentifier.length;

    /*
     * Une correspondance contenue dans un identifiant
     * reçoit un score élevé.
     *
     * Exemple :
     * yaya -> yaya77 ≈ 96 %
     * yaya -> yaya57720 ≈ 89 %
     */
    const containmentScore =
      80 + ratio * 20;

    return Math.round(
      Math.max(
        similarity,
        containmentScore,
      ),
    );
  }

  return Math.round(similarity);
}

/**
 * Récupère tous les identifiants par lots.
 */
async function getAllIdentifiers(
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  const PAGE_SIZE = 1000;
  let from = 0;

  const allIdentifiers: Identifier[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("profile_identifiers")
      .select(
        "id, profile_id, identifier_type, value, normalized_value",
      )
      .range(
        from,
        from + PAGE_SIZE - 1,
      );

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
          "Retry-After": String(
            rateLimit.retryAfter,
          ),
          "X-RateLimit-Limit": String(
            RATE_LIMIT_MAX,
          ),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const query = request.nextUrl.searchParams
    .get("q")
    ?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Le nom ou pseudo est obligatoire.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(
            RATE_LIMIT_MAX,
          ),
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
        error:
          "La recherche est trop longue.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(
            RATE_LIMIT_MAX,
          ),
          "X-RateLimit-Remaining": String(
            rateLimit.remaining,
          ),
        },
      },
    );
  }

  const normalizedQuery =
    normalizeSearch(query);

  if (!normalizedQuery) {
    return NextResponse.json(
      {
        error:
          "Le nom ou pseudo est obligatoire.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Limit": String(
            RATE_LIMIT_MAX,
          ),
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
        error:
          "Configuration serveur incorrecte.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * Récupération de tous les identifiants.
   */
  let allIdentifiers: Identifier[];

  try {
    allIdentifiers =
      await getAllIdentifiers(supabase);
  } catch (error) {
    console.error(
      "Erreur lors de la recherche des identifiants :",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Impossible de rechercher les profils.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * Calcul du score pour chaque identifiant.
   *
   * On travaille maintenant directement
   * sur les pseudos / noms.
   */
  const scoredIdentifiers = allIdentifiers
    .map((identifier) => {
      const score = calculateSearchScore(
        normalizedQuery,
        identifier.normalized_value ||
          identifier.value,
      );

      const normalizedIdentifier =
        normalizeForComparison(
          identifier.normalized_value ||
            identifier.value,
        );

      const containsQuery =
        normalizedIdentifier.includes(
          normalizedQuery,
        );

      const exact =
        normalizedIdentifier ===
        normalizedQuery;

      return {
        identifier,
        score,
        containsQuery,
        exact,
      };
    })
    /*
     * Seuil minimum demandé :
     * 50 %.
     */
    .filter(
      (item) =>
        item.score >= 50 ||
        item.exact,
    )
    .sort((a, b) => {
      /*
       * Exact toujours en premier.
       */
      if (a.exact && !b.exact) {
        return -1;
      }

      if (!a.exact && b.exact) {
        return 1;
      }

      /*
       * Puis les correspondances qui
       * contiennent directement la recherche.
       */
      if (
        a.containsQuery &&
        !b.containsQuery
      ) {
        return -1;
      }

      if (
        !a.containsQuery &&
        b.containsQuery
      ) {
        return 1;
      }

      /*
       * Enfin par score décroissant.
       */
      return b.score - a.score;
    })
    .slice(0, 20);

  /*
   * Récupération des profils concernés
   * uniquement pour connaître leur statut "flagged".
   */
  const profileIds = [
    ...new Set(
      scoredIdentifiers.map(
        (item) =>
          item.identifier.profile_id,
      ),
    ),
  ];

  let profiles: Profile[] = [];

  if (profileIds.length > 0) {
    const {
      data: profileData,
      error: profilesError,
    } = await supabase
      .from("reported_profiles")
      .select(
        "id, source_profile_id, flagged",
      )
      .in("id", profileIds);

    if (profilesError) {
      console.error(
        "Erreur lors de la récupération des profils :",
        profilesError,
      );

      return NextResponse.json(
        {
          error:
            "Impossible de récupérer les profils.",
        },
        {
          status: 500,
        },
      );
    }

    profiles =
      (profileData ?? []) as Profile[];
  }

  const profileMap = new Map<
    string,
    Profile
  >(
    profiles.map((profile) => [
      profile.id,
      profile,
    ]),
  );

  /*
   * Résultat final :
   * un résultat = un pseudo ou un nom.
   *
   * Il n'y a plus de notion d'association
   * dans la réponse de recherche.
   */
  const matches = scoredIdentifiers.map(
    (item) => {
      const profile =
        profileMap.get(
          item.identifier.profile_id,
        );

      return {
        id: item.identifier.id,
        value: item.identifier.value,
        type: item.identifier.identifier_type,
        similarity: item.score,
        exact: item.exact,
        flagged: profile?.flagged ?? false,
      };
    },
  );

  /*
   * Correspondance exacte.
   */
  const exactMatches = matches.filter(
    (match) => match.exact,
  );

  /*
   * Correspondances approximatives.
   */
  const similarMatches = matches.filter(
    (match) => !match.exact,
  );

  return NextResponse.json(
    {
      query,
      found: exactMatches.length > 0,
      exact: exactMatches,
      matches: similarMatches,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(
          RATE_LIMIT_MAX,
        ),
        "X-RateLimit-Remaining": String(
          rateLimit.remaining,
        ),
      },
    },
  );
}