import net from "node:net";

/**
 * Servidor SMTP fake mínimo (porta efêmera, sem TLS/AUTH) para capturar o e-mail real que
 * `src/lib/email/mailer.ts` (nodemailer) envia — o único jeito de pegar o link de verificação/
 * redefinição de senha nos testes, já que o token só existe em texto puro dentro do e-mail (o
 * banco só guarda o hash, `AuthToken.tokenHash`). Implementa o suficiente do protocolo (RFC 5321)
 * para o `nodemailer.createTransport({ secure: false })` padrão completar `verify()` e
 * `sendMail()`: saudação, EHLO, MAIL FROM, RCPT TO, DATA/corpo terminado em "<CRLF>.<CRLF>", QUIT.
 */

export type CapturedMail = { to: string[]; from: string; data: string };

export async function startFakeSmtpServer(): Promise<{
  port: number;
  mails: CapturedMail[];
  close: () => Promise<void>;
}> {
  const mails: CapturedMail[] = [];

  const server = net.createServer((socket) => {
    let mode: "command" | "data" = "command";
    let buffer = "";
    let dataBuffer = "";
    let currentFrom = "";
    let currentTo: string[] = [];

    socket.write("220 fake-smtp ready\r\n");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");

      if (mode === "data") {
        const terminatorIndex = buffer.indexOf("\r\n.\r\n");
        if (terminatorIndex === -1) return; // ainda não recebeu o fim dos dados
        dataBuffer += buffer.slice(0, terminatorIndex);
        buffer = buffer.slice(terminatorIndex + 5);
        mails.push({ to: currentTo, from: currentFrom, data: dataBuffer });
        dataBuffer = "";
        mode = "command";
        socket.write("250 OK: message queued\r\n");
        return;
      }

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 2);
        const upper = line.toUpperCase();

        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-fake-smtp\r\n250 OK\r\n");
        } else if (upper.startsWith("MAIL FROM")) {
          currentFrom = line;
          socket.write("250 OK\r\n");
        } else if (upper.startsWith("RCPT TO")) {
          currentTo.push(line);
          socket.write("250 OK\r\n");
        } else if (upper.startsWith("DATA")) {
          mode = "data";
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (upper.startsWith("RSET")) {
          currentFrom = "";
          currentTo = [];
          socket.write("250 OK\r\n");
        } else if (upper.startsWith("QUIT")) {
          socket.write("221 Bye\r\n");
          socket.end();
        } else if (upper.startsWith("NOOP")) {
          socket.write("250 OK\r\n");
        } else {
          socket.write("250 OK\r\n");
        }
      }
    });

    socket.on("error", () => {
      // Conexão encerrada abruptamente pelo transporte (ex.: `verify()` só faz o handshake e
      // fecha) — não é uma falha do teste.
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake SMTP sem porta.");

  return {
    port: address.port,
    mails,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

/**
 * `nodemailer` codifica corpos multipart em quoted-printable por padrão: quebra linhas longas
 * com `=<CRLF>` (soft break) e escapa qualquer `=` literal como `=3D` — a URL enviada por
 * `sendMail` (`.../verificar-email?token=<hash>`) tem um `=` antes do token, então sem decodificar
 * isso primeiro a URL extraída viria com `=3D` no lugar do `=` (link quebrado só pela captura, não
 * pelo produto). Decodifica antes de procurar a URL.
 */
function decodeQuotedPrintable(input: string): string {
  return input.replace(/=\r\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** Extrai a primeira URL http(s) de dentro do corpo (texto ou HTML) de um e-mail capturado. */
export function extractFirstUrl(mailData: string): string | null {
  const decoded = decodeQuotedPrintable(mailData);
  const match = decoded.match(/https?:\/\/[^\s"'<>]+/);
  return match ? match[0].trim() : null;
}
