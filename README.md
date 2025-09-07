# AI 2D → 3D Model Generator

## Project Overview
This app turns a 2D image into a 3D model using the TripoSR model on Replicate. The frontend is a static site hosted on Firebase Hosting, a Cloud Function acts as a secure proxy to the Replicate API, and the generated .glb model is rendered in the browser using Three.js.

## New Architecture (Why a Cloud Function proxy?)
- Protects your API key: the Replicate token is never exposed in client-side code.
- Solves CORS: the browser calls your Firebase Function, which calls Replicate server‑to‑server.
- Simpler client: the frontend sends the image to the Function and polls the returned status URL.

## Setup Instructions

### 1) Replicate API Token (set securely)
1. Create a free account on Replicate: `https://replicate.com`
2. Get your API token from: `https://replicate.com/account/api-tokens`
3. Set the token in Firebase Functions config (secure, not committed to code):
   ```bash
   firebase functions:config:set replicate.token="YOUR_REPLICATE_API_TOKEN"
   ```
4. Deploy (see below) to apply the new config.

### 2) Firebase Setup
1. Go to `https://console.firebase.google.com` and create a free Firebase project.
2. Initialize Hosting and Functions:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   firebase init functions
   ```
   Choose:
   - Language: JavaScript
   - ESLint: Yes
   - Install dependencies now: Yes

### 3) New Deployment Process (Hosting + Functions)
From the project root, deploy everything:

```bash
firebase deploy
```

This deploys both Firebase Hosting and Cloud Functions. After deployment, Firebase prints your Hosting URL and the `replicateProxy` function URL. In `public/index.html`, set `FUNCTION_URL` to the function’s URL. Then open your site, upload an image, click Generate, and wait for the model to load.
