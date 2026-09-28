import type { GithubEvent } from "@prisma/client";

export type MatchedAction =
  | { type: "add_label"; label: string }
  | { type: "slack_notify" };

type Rule = {
  condition: (event: GithubEvent) => boolean;
  actions: MatchedAction[];
};

const rules: Rule[] = [
  {
    condition: (event) => {
      if (event.eventType !== "issues" || event.action !== "opened") return false;
      const payload = event.payload as { issue?: { title?: unknown } };
      return typeof payload.issue?.title === "string" &&
        payload.issue.title.toLowerCase().includes("bug");
    },
    actions: [
      { type: "add_label", label: "bug" },
      { type: "slack_notify" },
    ],
  },
];

export function matchRules(event: GithubEvent): MatchedAction[] {
  return rules.flatMap((rule) => rule.condition(event) ? rule.actions : []);
}
