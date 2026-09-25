import { Code128Reader } from "@zxing/library";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gs1CheckDigit } from "../../src/lib/barcode";

/**
 * Cámara falsa para e2e: videos sintéticos (y4m) con códigos de barras que Chromium
 * sirve como si fueran la cámara (`--use-file-for-fake-video-capture`). Se generan en
 * cada corrida y no se commitean.
 *
 * El video es de 1280x720 y el visor de la app es 16:9, así que el marco (≈ 90 % x 55 %,
 * centrado) cubre x ∈ [64, 1216] e y ∈ [162, 558] del cuadro. Lo "de adentro" se dibuja
 * bien dentro de esa zona y lo "de afuera" en la franja superior, fuera de ella.
 *
 * Los codificadores de 1D están acá porque @zxing/library sólo trae el escritor de QR.
 */
const W = 1280;
const H = 720;
const FRAMES = 3;
const BACKGROUND = 235; // blanco en rango de video (Y)
const BAR = 16; // negro en rango de video (Y)

export const FIXTURE_DIR = path.resolve(process.cwd(), "e2e", ".fixtures");
const CODES_FILE = path.join(FIXTURE_DIR, "codes.json");

export type FixtureCodes = { inside: string; outside: string; code128: string };
export type FixtureName = "inside" | "outside" | "outsideCentered" | "two" | "code128";

// ---- Codificadores (módulos: true = barra) -------------------------------------------

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN_R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

const QUIET_ZONE = 10;

function withQuietZone(bits: boolean[]): boolean[] {
  const quiet = Array<boolean>(QUIET_ZONE).fill(false);
  return [...quiet, ...bits, ...quiet];
}

const toBits = (pattern: string) => [...pattern].map((c) => c === "1");

function ean13Bits(code: string): boolean[] {
  const digits = [...code].map(Number);
  const parity = EAN_PARITY[digits[0]];
  const left = digits.slice(1, 7).flatMap((d, i) => toBits((parity[i] === "L" ? EAN_L : EAN_G)[d]));
  const right = digits.slice(7).flatMap((d) => toBits(EAN_R[d]));
  return withQuietZone([...toBits("101"), ...left, ...toBits("01010"), ...right, ...toBits("101")]);
}

/** Code 128 set B (ASCII 32–127): start B + datos + verificador + stop. */
function code128Bits(text: string): boolean[] {
  const patterns = (Code128Reader as unknown as { CODE_PATTERNS: ArrayLike<number>[] }).CODE_PATTERNS;
  const START_B = 104;
  const STOP = 106;
  const values = [...text].map((c) => c.charCodeAt(0) - 32);
  const checksum = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;

  const bits: boolean[] = [];
  for (const symbol of [START_B, ...values, checksum, STOP]) {
    let bar = true;
    for (const width of Array.from(patterns[symbol])) {
      bits.push(...Array<boolean>(width).fill(bar));
      bar = !bar;
    }
  }
  return withQuietZone(bits);
}

// ---- Video --------------------------------------------------------------------------

type Placement = { bits: boolean[]; x: number; y: number; moduleWidth: number; height: number };

function frame(placements: Placement[]): Buffer {
  const y = Buffer.alloc(W * H, BACKGROUND);
  for (const p of placements) {
    p.bits.forEach((isBar, i) => {
      if (!isBar) return;
      for (let row = 0; row < p.height; row++) {
        const start = (p.y + row) * W + p.x + i * p.moduleWidth;
        y.fill(BAR, start, start + p.moduleWidth);
      }
    });
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  return Buffer.concat([Buffer.from("FRAME\n"), y, chroma, chroma]);
}

function writeY4m(name: FixtureName, placements: Placement[]) {
  const header = Buffer.from(`YUV4MPEG2 W${W} H${H} F30:1 Ip A1:1 C420jpeg\n`);
  const one = frame(placements);
  writeFileSync(path.join(FIXTURE_DIR, `${name}.y4m`), Buffer.concat([header, ...Array(FRAMES).fill(one)]));
}

/** Un EAN-13 válido (dígito verificador correcto) con cuerpo aleatorio. */
function randomEan13(): string {
  const body = `9${Math.floor(Math.random() * 1e11).toString().padStart(11, "0")}`;
  return `${body}${gs1CheckDigit(body)}`;
}

export function generateFixtures(): FixtureCodes {
  mkdirSync(FIXTURE_DIR, { recursive: true });

  const codes: FixtureCodes = {
    inside: randomEan13(),
    outside: randomEan13(),
    code128: `LB${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`,
  };

  const centered = (bits: boolean[], moduleWidth: number, height: number): Placement => ({
    bits,
    moduleWidth,
    height,
    x: Math.round((W - bits.length * moduleWidth) / 2),
    y: Math.round((H - height) / 2),
  });

  const inside = centered(ean13Bits(codes.inside), 5, 200); // 565 x 200 px, en el centro
  const outside: Placement = { bits: ean13Bits(codes.outside), moduleWidth: 3, height: 100, x: 30, y: 12 }; // arriba a la izquierda
  const code128 = centered(code128Bits(codes.code128), 5, 200);

  writeY4m("inside", [inside]);
  writeY4m("outside", [outside]);
  // Control positivo: el MISMO código chico de "outside", pero centrado. Si éste se lee y
  // "outside" no, el motivo es el marco y no que el código fuera ilegible.
  writeY4m("outsideCentered", [centered(ean13Bits(codes.outside), 3, 100)]);
  writeY4m("two", [inside, outside]);
  writeY4m("code128", [code128]);
  writeFileSync(CODES_FILE, JSON.stringify(codes));
  return codes;
}

export function readCodes(): FixtureCodes {
  return JSON.parse(readFileSync(CODES_FILE, "utf8"));
}

/** Argumentos de Chromium para que la cámara sea el video `name`. */
export function cameraArgs(name: FixtureName): string[] {
  return [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-video-capture=${path.join(FIXTURE_DIR, `${name}.y4m`)}`,
  ];
}
