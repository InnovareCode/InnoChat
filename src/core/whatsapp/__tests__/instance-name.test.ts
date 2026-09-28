import { describe, expect, it } from "vitest";
import { buildInstanceName } from "../instance-name";

describe("buildInstanceName", () => {
  it("monta innochat-<slug>-<sufixo>", () => {
    expect(buildInstanceName("studio-bela", "x7k2")).toBe("innochat-studio-bela-x7k2");
  });

  it("trunca o slug em 20 caracteres", () => {
    const longSlug = "a".repeat(40);
    const name = buildInstanceName(longSlug, "abcd");
    expect(name).toBe(`innochat-${"a".repeat(20)}-abcd`);
  });

  it("remove caracteres fora de [a-z0-9-] do slug e do sufixo", () => {
    expect(buildInstanceName("Estúdio_Bela!", "AB#12")).toBe("innochat-estdiobela-ab12");
  });

  it("nunca deixa hífen sobrando no fim do segmento do slug", () => {
    expect(buildInstanceName("ab-", "1234")).toBe("innochat-ab-1234");
  });

  it("cai em valores padrão se slug/sufixo ficarem vazios após sanitização", () => {
    expect(buildInstanceName("___", "###")).toBe("innochat-tenant-0000");
  });
});
