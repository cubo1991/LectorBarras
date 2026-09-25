import { generateFixtures } from "./fixtures/make-videos";

// Genera los videos de la cámara falsa (ver e2e/fixtures/make-videos.ts).
export default function globalSetup() {
  generateFixtures();
}
