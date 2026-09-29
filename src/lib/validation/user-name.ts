import { z } from "zod";

/** Nome de exibição do usuário: sem espaços nas pontas, 2 a 80 caracteres. */
export const userNameSchema = z.string().trim().min(2, "Informe seu nome (mínimo 2 letras).").max(80, "O nome pode ter no máximo 80 caracteres.");
