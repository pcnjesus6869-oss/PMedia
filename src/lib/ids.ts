import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Id de mídia (nome do arquivo em disco). */
export const createId = customAlphabet(alphabet, 21);

/** Token do link de cliente: 22 caracteres ≈ 131 bits, impossível de adivinhar. */
export const createShareToken = customAlphabet(alphabet, 22);
