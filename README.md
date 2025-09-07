# AI 2D → 3D Model Generator

## Project Overview
This app turns a 2D image into a 3D model using the TripoSR model on Replicate. The frontend is a static site hosted on Firebase Hosting, and the AI inference is called directly via the Replicate API. The generated .glb model is rendered in the browser using Three.js.

## Setup Instructions

### 1) Replicate API Token
1. Create a free account on Replicate: `https://replicate.com`
2. Get your API token from: `https://replicate.com/account/api-tokens`
3. Open `public/index.html` and find the line:
```js
const REPLICATE_API_TOKEN = "PASTE_YOUR_REPLICATE_API_TOKEN_HERE";
```
4. Replace the placeholder with your actual token.

Note: For simplicity, this demo uses the token in the client. For production, consider a small backend proxy to keep the token private.

### 2) Firebase Setup
1. Go to `https://console.firebase.google.com` and create a free Firebase project.
2. You only need Firebase Hosting (no database/auth required).

### 3) Deploy to Firebase Hosting
Run these commands in your project directory:

```bash
npm install -g firebase-tools

firebase login

firebase init hosting
```

When prompted during `firebase init hosting`:
- Use an existing project: select the Firebase project you created
- Public directory: `public`
- Configure as a single-page app (rewrite all URLs to /index.html): `No`
- Set up automatic builds and deploys with GitHub: `No` (optional)

Deploy your site:

```bash
firebase deploy
```

After deployment, Firebase will print your Hosting URL. Open it, upload an image, click Generate, and wait for the model to load.
