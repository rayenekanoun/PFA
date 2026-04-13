interface ProfileLike {
  code: string;
  name: string;
  description: string | null;
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'at',
  'be',
  'bit',
  'car',
  'do',
  'does',
  'feels',
  'for',
  'from',
  'get',
  'gets',
  'goes',
  'got',
  'have',
  'i',
  'in',
  'is',
  'it',
  'its',
  'my',
  'of',
  'on',
  'or',
  'seems',
  'some',
  'that',
  'the',
  'take',
  'takes',
  'to',
  'too',
  'very',
  'while',
  'when',
  'with',
]);

function normalizeToken(token: string): string {
  let normalized = token.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (normalized.endsWith('ies') && normalized.length > 4) {
    normalized = `${normalized.slice(0, -3)}y`;
  } else if (normalized.endsWith('ing') && normalized.length > 5) {
    normalized = normalized.slice(0, -3);
    if (/(.)\1$/.test(normalized)) {
      normalized = normalized.slice(0, -1);
    }
  } else if (normalized.endsWith('ed') && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith('ly') && normalized.length > 4) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith('s') && normalized.length > 3 && !normalized.endsWith('ss')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function tokenize(text: string): string[] {
  return text
    .split(/[^a-zA-Z0-9]+/g)
    .map((token) => normalizeToken(token))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    bigrams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return bigrams;
}

function familyKeyFromCode(code: string): string {
  return code.split('__')[0] ?? code;
}

function scoreProfile(complaintText: string, profile: ProfileLike): number {
  const normalizedComplaint = complaintText.toLowerCase();
  const profileText = `${profile.code.replace(/_/g, ' ')} ${profile.name} ${profile.description ?? ''}`.toLowerCase();
  const complaintTokens = tokenize(complaintText);
  const profileTokenList = tokenize(profileText);
  const profileTokens = new Set(profileTokenList);
  const complaintBigrams = buildBigrams(complaintTokens);
  const profileBigrams = new Set(buildBigrams(profileTokenList));

  let score = 0;

  for (const token of complaintTokens) {
    if (profileTokens.has(token)) {
      score += token.length >= 6 ? 5 : 3;
    }
  }

  for (const bigram of complaintBigrams) {
    if (profileText.includes(bigram) || profileBigrams.has(bigram)) {
      score += 7;
    }
  }

  if (normalizedComplaint.includes(profile.code.replace(/_/g, ' '))) {
    score += 10;
  }

  const familyKey = familyKeyFromCode(profile.code).replace(/_/g, ' ');
  if (normalizedComplaint.includes(familyKey)) {
    score += 6;
  }

  return score;
}

export function selectProfilesForComplaint<TProfile extends ProfileLike>(
  profiles: TProfile[],
  complaintText: string,
  options?: {
    limit?: number;
    maxPerFamily?: number;
  },
): TProfile[] {
  if (profiles.length <= 1) {
    return profiles;
  }

  const limit = options?.limit ?? 48;
  const maxPerFamily = options?.maxPerFamily ?? 4;

  const ranked = profiles
    .map((profile) => ({
      profile,
      familyKey: familyKeyFromCode(profile.code),
      score: scoreProfile(complaintText, profile),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.profile.code.localeCompare(right.profile.code);
    });

  const bestScore = ranked[0]?.score ?? 0;
  const minimumAcceptedScore =
    bestScore > 0 ? Math.max(2, Math.ceil(bestScore * 0.25)) : 0;

  const selected: TProfile[] = [];
  const perFamilyCounts = new Map<string, number>();

  for (const entry of ranked) {
    if (selected.length >= limit) {
      break;
    }

    if (entry.score < minimumAcceptedScore) {
      continue;
    }

    const familyCount = perFamilyCounts.get(entry.familyKey) ?? 0;
    if (familyCount >= maxPerFamily) {
      continue;
    }

    selected.push(entry.profile);
    perFamilyCounts.set(entry.familyKey, familyCount + 1);
  }

  if (selected.length === 0) {
    return profiles.slice(0, limit);
  }

  return selected;
}
