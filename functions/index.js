'use strict';

/**
 * Cloud Function: replicateProxy
 *
 * Purpose
 * - Acts as a secure backend proxy between your frontend and the Replicate API.
 * - Keeps your Replicate API token on the server (never exposed to the client).
 * - Accepts image data from the client, uploads to Replicate if needed,
 *   starts a prediction using TripoSR, and forwards the API response back.
 *
 * CORS
 * - Handles CORS for requests originating from your Firebase Hosting domain.
 * - Configure ALLOWED_ORIGIN in your function's environment to restrict access.
 *
 * Environment Variables (set via: firebase functions:config:set ...)
 * - replicate.token: Your Replicate API token
 * - cors.allowed_origin: Your site origin, e.g. https://your-project.web.app
 *
 * Expected Request (JSON, POST):
 * {
 *   "image": "<https URL or data URL (base64)>",
 *   "version": "stabilityai/triposr:v2.2.0" (optional; defaults to this),
 *   "format": "glb" (optional; defaults to glb)
 * }
 *
 * Notes
 * - If image is a data URL (base64), the function uploads it to Replicate Files API first
 *   and uses the returned temporary URL for the prediction.
 */

const functions = require('firebase-functions');

// Node 18+ on Cloud Functions has fetch/FormData/Blob globally available.
const fetchImpl = globalThis.fetch;
const FormDataImpl = globalThis.FormData;
const BlobImpl = globalThis.Blob;

// Defaults
const DEFAULT_VERSION = 'stabilityai/triposr:v2.2.0';
const DEFAULT_FORMAT = 'glb';

// Helpers: CORS
function getAllowedOrigin(req) {
  const requestOrigin = req.headers.origin;
  const configured = (functions.config()?.cors?.allowed_origin) || '';
  // If configured origin is set, only allow exact match
  if (configured) {
    return requestOrigin === configured ? configured : '';
  }
  // Fallback: during development allow localhost to ease testing
  if (requestOrigin && /^(https?:\/\/localhost(?::\d+)?|http:\/\/127\.0\.0\.1(?::\d+)?)$/.test(requestOrigin)) {
    return requestOrigin;
  }
  return '';
}

function setCorsHeaders(res, origin) {
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '86400');
}

// Helpers: Data URL detection
function isDataUrl(value) {
  return typeof value === 'string' && /^data:\w+\/[\w.+-]+;base64,/.test(value);
}

// Convert data URL to a Blob for multipart upload
function dataUrlToBlob(dataUrl) {
  const match = /^data:(?<mime>[^;]+);base64,(?<b64>.+)$/.exec(dataUrl);
  if (!match || !match.groups) throw new Error('Invalid data URL');
  const mime = match.groups.mime;
  const b64 = match.groups.b64;
  const bytes = Buffer.from(b64, 'base64');
  return new BlobImpl([bytes], { type: mime });
}

// Upload a blob to Replicate Files API and return temporary URL
async function uploadToReplicateFiles(blob, filename, token) {
  const form = new FormDataImpl();
  form.append('file', blob, filename);

  const r = await fetchImpl('https://api.replicate.com/v1/files', {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
    },
    body: form,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Replicate file upload failed: ${r.status} ${text}`);
  }
  const json = await r.json();
  return json?.url;
}

// Start a prediction on Replicate using TripoSR
async function startPredictionOnReplicate({ imageUrl, version, format, token }) {
  const body = {
    version: version || DEFAULT_VERSION,
    input: {
      image: imageUrl,
      format: format || DEFAULT_FORMAT,
    },
  };

  const r = await fetchImpl('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Replicate prediction start failed: ${r.status} ${text}`);
  }
  return r.json();
}

exports.replicateProxy = functions.https.onRequest(async (req, res) => {
  const origin = getAllowedOrigin(req);
  setCorsHeaders(res, origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const token = (functions.config()?.replicate?.token) || '';
    if (!token) {
      return res.status(500).json({ error: 'Missing Replicate API token. Set functions config: replicate.token' });
    }

    // Parse input
    const { image, version, format } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Missing required field: image (URL or data URL).' });
    }

    let imageUrl = image;
    // If we received a data URL, upload it to Replicate Files API first
    if (isDataUrl(image)) {
      const blob = dataUrlToBlob(image);
      // Create a simple filename with extension from mime, default to png
      const ext = (blob.type && blob.type.split('/')[1]) || 'png';
      imageUrl = await uploadToReplicateFiles(blob, `upload.${ext}`, token);
    }

    // Start prediction and forward the response
    const prediction = await startPredictionOnReplicate({ imageUrl, version, format, token });
    return res.status(200).json(prediction);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});


