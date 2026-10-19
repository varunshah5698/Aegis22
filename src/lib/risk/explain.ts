import type { RiskLevel } from "@/config/risk";
import type { ScoreExplanation, SignalContribution } from "@/lib/risk/types";

const LEVEL_PHRASE: Record<RiskLevel, string> = {
  low: "low risk",
  medium: "medium risk",
  high: "high risk",
  critical: "critical risk",
};

export function buildExplanation(
  contributions: SignalContribution[],
  score: number,
  level: RiskLevel,
): ScoreExplanation {
  const triggered = contributions
    .filter((item) => item.triggered)
    .sort((a, b) => b.points - a.points);

  if (triggered.length === 0) {
    return {
      summary: `This payment scores ${score}/100 (${LEVEL_PHRASE[level]}). No configured signal crossed its materiality threshold.`,
      bullets: [],
    };
  }

  const lead = triggered.slice(0, 2).map((item) => item.narrative);
  const remainder = triggered.length - lead.length;
  const summary = [
    `This payment scores ${score}/100 (${LEVEL_PHRASE[level]}).`,
    ...lead,
    remainder > 0 ? `${remainder} further signal${remainder === 1 ? "" : "s"} contributed to the score.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary,
    bullets: triggered.map((item) => item.narrative),
  };
}
