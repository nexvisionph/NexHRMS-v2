"use client";

/**
 * Client-side face detection and embedding using face-api.js
 *
 * Uses TensorFlow.js (WebGL) to compute real 128-dimensional face descriptors.
 * Models are loaded from /models/face-api/ (SSD MobileNet + Landmarks + Recognition).
 *
 * Architecture:
 * - Browser computes embeddings (no server ML needed)
 * - Server stores/compares embeddings (Supabase PostgreSQL function)
 * - Qwen AI handles liveness detection only (anti-spoofing layer)
 */

import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "/models/face-api";
let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

/**
 * Load face-api.js models (SSD MobileNet, Landmarks, Recognition).
 * Safe to call multiple times — only loads once.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();

  return modelsLoading;
}

/**
 * Check if models are loaded.
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

export interface FaceDetectionResult {
  /** 128-dimensional face descriptor */
  descriptor: number[];
  /** Detection confidence score (0-1) */
  score: number;
  /** Bounding box of detected face */
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Detect a single face and compute its 128-d embedding.
 * Returns null if no face found or detection confidence < 0.6.
 */
export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceDetectionResult | null> {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  const result = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  return {
    descriptor: Array.from(result.descriptor),
    score: result.detection.score,
    box: {
      x: result.detection.box.x,
      y: result.detection.box.y,
      width: result.detection.box.width,
      height: result.detection.box.height,
    },
  };
}

/**
 * Average multiple 128-d descriptors into a single representative descriptor.
 * Averaging reduces noise from single-frame detection jitter and produces a
 * more stable embedding for verification.
 */
export function averageDescriptors(descriptors: number[][]): number[] {
  if (descriptors.length === 0) return [];
  if (descriptors.length === 1) return descriptors[0];
  const dim = descriptors[0].length;
  const avg = new Array<number>(dim).fill(0);
  for (const desc of descriptors) {
    for (let i = 0; i < dim; i++) avg[i] += desc[i];
  }
  for (let i = 0; i < dim; i++) avg[i] /= descriptors.length;
  return avg;
}

/**
 * Detect ALL faces in an image (for multi-face validation).
 */
export async function detectAllFaces(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceDetectionResult[]> {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  const results = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results.map((r) => ({
    descriptor: Array.from(r.descriptor),
    score: r.detection.score,
    box: {
      x: r.detection.box.x,
      y: r.detection.box.y,
      width: r.detection.box.width,
      height: r.detection.box.height,
    },
  }));
}

/**
 * Compute euclidean distance between two 128-d descriptors.
 * Lower = more similar. Threshold ~0.6 for same person.
 */
export function computeDistance(desc1: number[], desc2: number[]): number {
  if (desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += (desc1[i] - desc2[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/** Threshold for face matching (euclidean distance). Below this = same person.
 * face-api.js same-person distance across sessions typically 0.3–0.55;
 * inter-person distance usually > 0.9. 0.75 balances accuracy vs convenience.
 */
export const FACE_MATCH_THRESHOLD = 0.75;
