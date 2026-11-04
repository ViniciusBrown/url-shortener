import { randomInt } from "node:crypto";

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateCode(): string {
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
