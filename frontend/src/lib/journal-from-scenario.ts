import type { ScenarioResponse } from "../types/scenario";
import { createJournalEntry } from "./firestore-journal";
import { defaultJournalTitleFromScenario, sideFromScenario } from "./journal-utils";

export async function createJournalFromScenario(
  uid: string,
  snapshotId: string,
  scenario: ScenarioResponse,
): Promise<string> {
  return createJournalEntry(uid, {
    templateId: null,
    type: "idea",
    side: sideFromScenario(scenario),
    status: null,
    snapshotId,
    parentEntryId: null,
    title: defaultJournalTitleFromScenario(scenario),
    note: "",
    links: [],
    tags: [],
    entryPrice: null,
    exitPrice: null,
    size: null,
    plannedSl: scenario.exit.stop_loss,
    plannedTp: scenario.exit.take_profit[0] ?? null,
    reviewScore: null,
    reviewLesson: "",
    images: [],
  });
}
