import http, { type IncomingMessage, type ServerResponse } from "node:http";

/**
 * Servidor HTTP fake local (porta efêmera, `listen(0)`) para simular Evolution/n8n/Mercado Pago
 * nos testes de "Testar conexão"/"Sincronizar n8n" (docs/contratos.md — "o teste de conexão
 * aceita URL"). Cada rota é um handler síncrono que recebe o request já lido (corpo em JSON, se
 * houver) e devolve `{ status, body }`. Loga cada requisição recebida em `received` — útil para
 * afirmar QUE header/valor chegou (ex.: a apikey certa), sem precisar instrumentar o código de
 * produto.
 */

export type FakeRoute = {
  method: string;
  /** Comparado com `req.url` (sem querystring) OU testado como RegExp. */
  path: string | RegExp;
  handler: (req: {
    headers: IncomingMessage["headers"];
    url: string;
    body: unknown;
  }) => { status: number; body?: unknown };
};

export type ReceivedRequest = { method: string; url: string; headers: IncomingMessage["headers"]; body: unknown };

export async function startFakeServer(routes: FakeRoute[]): Promise<{
  url: string;
  received: ReceivedRequest[];
  close: () => Promise<void>;
}> {
  const received: ReceivedRequest[] = [];

  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      let body: unknown = undefined;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }
      const fullUrl = req.url ?? "/";
      const urlPath = fullUrl.split("?")[0];
      received.push({ method: req.method ?? "GET", url: fullUrl, headers: req.headers, body });

      // Testa contra a URL completa (com querystring) E contra só o path — uma rota declarada
      // como "/foo?bar=1" só bate na completa; uma declarada como "/foo" (sem querystring) bate
      // em qualquer querystring.
      const route = routes.find((r) => {
        if (r.method !== (req.method ?? "GET")) return false;
        return typeof r.path === "string" ? r.path === fullUrl || r.path === urlPath : r.path.test(fullUrl) || r.path.test(urlPath);
      });

      if (!route) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not_found_in_fake_server", url: req.url }));
        return;
      }

      const result = route.handler({ headers: req.headers, url: req.url ?? "/", body });
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(result.body !== undefined ? JSON.stringify(result.body) : undefined);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake server sem porta.");
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    received,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
