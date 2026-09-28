import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { digitsFromJid, normalizeEvolutionMessage, resolveSenderIdentity } from "../evolution-normalize";

const FIXTURES_DIR = join(process.cwd(), "fixtures", "evolution");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"));
}

describe("normalizeEvolutionMessage", () => {
  it("texto simples (message.conversation)", () => {
    const result = normalizeEvolutionMessage(loadFixture("text-conversation.json"));
    expect(result).toMatchObject({ kind: "message", fromMe: false, content: { type: "text", text: "2" } });
    if (result.kind === "message") {
      expect(result.jid).toBe("5511988887777@s.whatsapp.net");
      expect(result.providerMessageId).toBe("3EB0C767D26A1D2F1234");
    }
  });

  it("texto com citação (message.extendedTextMessage.text)", () => {
    const result = normalizeEvolutionMessage(loadFixture("text-extended.json"));
    expect(result).toMatchObject({ kind: "message", content: { type: "text", text: "Quero remarcar" } });
  });

  it("@lid com remoteJidAlt resolve para o número real", () => {
    const result = normalizeEvolutionMessage(loadFixture("lid-sender.json"));
    expect(result.kind).toBe("message");
    if (result.kind !== "message") return;
    expect(result.jid).toBe("184926574839201@lid");
    expect(result.altJid).toBe("5511977776666@s.whatsapp.net");

    const identity = resolveSenderIdentity(result);
    expect(identity).toEqual({ waJid: "5511977776666@s.whatsapp.net", lid: "184926574839201@lid" });
  });

  it("@lid sem alternativa não resolve waJid (fica UNRESOLVABLE_SENDER a cargo do claim)", () => {
    const result = normalizeEvolutionMessage(loadFixture("lid-sender-no-alt.json"));
    expect(result.kind).toBe("message");
    if (result.kind !== "message") return;
    const identity = resolveSenderIdentity(result);
    expect(identity).toEqual({ waJid: null, lid: "184926574839202@lid" });
  });

  it("mensagem de grupo (@g.us) vira unsupported/GROUP", () => {
    const result = normalizeEvolutionMessage(loadFixture("group-message.json"));
    expect(result).toEqual({ kind: "unsupported", reason: "GROUP" });
  });

  it("mídia vira content type media", () => {
    const result = normalizeEvolutionMessage(loadFixture("media-message.json"));
    expect(result).toMatchObject({ kind: "message", content: { type: "media" } });
  });

  it("fromMe: true é reconhecido", () => {
    const result = normalizeEvolutionMessage(loadFixture("from-me.json"));
    expect(result).toMatchObject({ kind: "message", fromMe: true });
  });

  it("evento connection.update não é uma mensagem (claim não trata; /connection-events trata)", () => {
    const result = normalizeEvolutionMessage(loadFixture("connection-update.json"));
    expect(result).toEqual({ kind: "unsupported", reason: "UNSUPPORTED_EVENT" });
  });

  it("payload lixo nunca lança — sempre unsupported/UNSUPPORTED_EVENT", () => {
    const result = normalizeEvolutionMessage(loadFixture("garbage.json"));
    expect(result).toEqual({ kind: "unsupported", reason: "UNSUPPORTED_EVENT" });
  });

  it("payloads totalmente inválidos (null, array, string, number) nunca lançam", () => {
    for (const bad of [null, undefined, [], "string", 42, {}]) {
      expect(() => normalizeEvolutionMessage(bad)).not.toThrow();
      expect(normalizeEvolutionMessage(bad)).toEqual({ kind: "unsupported", reason: "UNSUPPORTED_EVENT" });
    }
  });
});

describe("digitsFromJid", () => {
  it("extrai os dígitos exatamente como recebidos, sem reconstituir o 9º dígito", () => {
    expect(digitsFromJid("5511988887777@s.whatsapp.net")).toBe("5511988887777");
  });
});
