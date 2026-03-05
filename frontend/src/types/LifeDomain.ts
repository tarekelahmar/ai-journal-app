export type LifeDomainScoreData = {
  score_date: string;
  scores: Record<string, number>;
  total_score: number;
};

// Framework alignment (March 2026): 7 life dimensions
export const LIFE_DOMAIN_LABELS: Record<string, string> = {
  career: 'Career / Work',
  relationship: 'Relationship',
  family: 'Family',
  health: 'Physical & Mental Health',
  finance: 'Finance',
  social: 'Social',
  purpose: 'Purpose',
};

export const LIFE_DOMAIN_KEYS = Object.keys(LIFE_DOMAIN_LABELS);
