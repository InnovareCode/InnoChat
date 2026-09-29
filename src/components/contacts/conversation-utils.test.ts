import { describe, expect, it } from "vitest";
import { bubbleAriaLabel, groupConversationByDay, mergeConversation, type ConversationMessage } from "./conversation-utils";

const msg = (id: string, createdAt: string, direction: ConversationMessage["direction"] = "INBOUND"): ConversationMessage => ({
  id,
  direction,
  body: id,
  createdAt,
  instanceLabel: "Recepção",
});

describe("groupConversationByDay", () => {
  const now = new Date("2026-09-29T15:00:00Z"); // 12:00 em São Paulo

  it("agrupa por dia no fuso da empresa e rotula Hoje/Ontem/data", () => {
    const groups = groupConversationByDay(
      [msg("a", "2026-09-27T13:00:00Z"), msg("b", "2026-09-28T13:00:00Z"), msg("c", "2026-09-29T13:00:00Z"), msg("d", "2026-09-29T14:00:00Z")],
      "America/Sao_Paulo",
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["27/09/2026", "Ontem", "Hoje"]);
    expect(groups[2]!.items.map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("23h30 em São Paulo (02h30 UTC do dia seguinte) fica no dia de São Paulo", () => {
    const groups = groupConversationByDay([msg("x", "2026-09-29T02:30:00Z")], "America/Sao_Paulo", now);
    expect(groups[0]!.label).toBe("Ontem");
  });

  it("lista vazia não gera grupos", () => {
    expect(groupConversationByDay([], "America/Sao_Paulo", now)).toEqual([]);
  });
});

describe("mergeConversation", () => {
  it("prepend de página antiga mantém ordem cronológica e não duplica", () => {
    const merged = mergeConversation([msg("b", "2026-09-29T10:00:00Z"), msg("c", "2026-09-29T11:00:00Z")], [
      msg("a", "2026-09-29T09:00:00Z"),
      msg("b", "2026-09-29T10:00:00Z"),
    ]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("bubbleAriaLabel", () => {
  it("diz quem falou e a hora", () => {
    expect(bubbleAriaLabel("INBOUND", "14:32")).toBe("Cliente, 14:32");
    expect(bubbleAriaLabel("OUTBOUND", "14:32")).toBe("Bot, 14:32");
  });
});
