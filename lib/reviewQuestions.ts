// ─── Review question definitions ───────────────────────────────────────────
// Edit this file to change question text. No DB migration needed.
// question_key values are stored in review_responses.question_key.
// ───────────────────────────────────────────────────────────────────────────

export type QuestionType = 'text' | 'rating';

export interface Question {
  key: string;
  text: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
}

// ─── Self-review ──────────────────────────────────────────────────────────────

export const SELF_REVIEW_HEADLINE =
  'Please reflect on your performance over the last year.';

/** Special free-text key for the goals / progress section */
export const SELF_GOALS_KEY = 'goals_progress';

export const SELF_REVIEW_QUESTIONS: Question[] = [
  {
    key: 'sourcing_overview',
    text: 'Overview of investments sourced or gained access to that were brought to IC. What was your specific role?',
    type: 'text',
    required: true,
  },
  {
    key: 'conviction_building',
    text: 'Overview of investments where you built conviction and presented to IC. How did you build conviction and what was the outcome?',
    type: 'text',
    required: true,
  },
  {
    key: 'execution_overview',
    text: 'Overview of investments executed in the past period, including workstreams you led. Key contributions and learnings?',
    type: 'text',
    required: true,
  },
  {
    key: 'portfolio_value',
    text: 'Overview of portfolio value creation you initiated and executed. How did those translate into reaching target case?',
    type: 'text',
    required: true,
  },
  {
    key: 'investor_relations',
    text: 'How did you contribute to investor relations and promotion of the MTIP brand?',
    type: 'text',
    required: true,
  },
  {
    key: 'collaboration',
    text: "How did you demonstrate collaboration and teamwork in line with MTIP's values?",
    type: 'text',
    required: true,
  },
  {
    key: 'communication',
    text: 'How do you assess your communication effectiveness and areas for improvement?',
    type: 'text',
    required: true,
  },
  {
    key: 'ownership',
    text: 'Where and how did you demonstrate ownership and initiative?',
    type: 'text',
    required: true,
  },
  {
    key: 'leadership',
    text: "What leadership behavior of yours most positively impacts the team?",
    type: 'text',
    required: true,
  },
  {
    key: 'team_impact',
    text: "Where and how did you have positive impact on the team's success and culture?",
    type: 'text',
    required: true,
  },
  {
    key: 'next_year_goals',
    text: 'Key goals and focus areas for the next year?',
    type: 'text',
    required: true,
  },
];

// ─── Peer review ──────────────────────────────────────────────────────────────

export function getPeerReviewHeadline(subjectName: string): string {
  const first = subjectName.split(' ')[0];
  return `Peer review of ${subjectName}. Your responses will be shared anonymously with ${first}'s manager and no one else.`;
}

export const PEER_REVIEW_QUESTIONS: Question[] = [
  {
    key: 'done_well',
    text: 'What has this person done well?',
    type: 'text',
    required: true,
  },
  {
    key: 'improvement',
    text: 'What could this person have done differently or improved?',
    type: 'text',
    required: true,
  },
  {
    key: 'collaboration_example',
    text: 'How has this person demonstrated collaboration and teamwork? Share a specific example.',
    type: 'text',
    required: true,
  },
  {
    key: 'rating_collaboration',
    text: 'On a scale of 1–5, how well does this person collaborate with others?',
    type: 'rating',
    required: true,
  },
  {
    key: 'communication_improvement',
    text: 'One way this person could improve their communication effectiveness?',
    type: 'text',
    required: true,
  },
  {
    key: 'rating_communication',
    text: 'Rate overall communication skills, 1–5.',
    type: 'rating',
    required: true,
  },
  {
    key: 'continue_develop',
    text: 'What would you like to see this person continue doing, and focus on developing?',
    type: 'text',
    required: true,
  },
  {
    key: 'recent_strength',
    text: 'One strength this person has developed recently?',
    type: 'text',
    required: true,
  },
  {
    key: 'ownership_initiative',
    text: 'Where could this person take more ownership or initiative?',
    type: 'text',
    required: true,
  },
  {
    key: 'rating_initiative',
    text: "Rate this person's level of initiative, 1–5.",
    type: 'rating',
    required: true,
  },
  {
    key: 'leadership_impact',
    text: 'What leadership behavior from this person most positively impacts the team?',
    type: 'text',
    required: true,
  },
  {
    key: 'rating_overall_impact',
    text: 'Overall, how much positive impact does this person have on team success and culture? 1–5.',
    type: 'rating',
    required: true,
  },
  {
    key: 'additional_comments',
    text: 'Any additional comments?',
    type: 'text',
    required: false,
    placeholder: 'Optional',
  },
];

// ─── Manager review ───────────────────────────────────────────────────────────

export const MANAGER_REVIEW_QUESTIONS: Question[] = PEER_REVIEW_QUESTIONS;

/** Key prefix for goal comments in manager review. Index is 0-based. */
export function goalCommentKey(index: number): string {
  return `goal_comment_${index}`;
}

/** Rating labels */
export const RATING_LABELS: Record<number, string> = {
  1: '1 — Significant gap',
  2: '2 — Developing / inconsistent',
  3: '3 — Solid / meets expectations',
  4: '4 — Strong / exceeds expectations',
  5: '5 — Exceptional / role model',
};
