const functions = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const cors = require("cors");
const fetch = require("node-fetch");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

initializeApp();

// CORS restricted to your Hosting origin
const corsHandler = cors({ origin: "https://ai-3d-model-generator.web.app" });

// Helper: upload base64 → Firebase Storage → return public URL
async function uploadBase64ToStorage(base64Data, filename) {
  const bucket = getStorage().bucket();
  const buffer = Buffer.from(
    base64Data.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  const file = bucket.file(filename);
  await file.save(buffer, { metadata: { contentType: "image/jpeg" } });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}

exports.replicateProxy = functions.https.onRequest(
  { secrets: ["REPLICATE_TOKEN"] },
  (request, response) => {
    corsHandler(request, response, async () => {
      if (request.method !== "POST") {
        logger.warn("Request rejected: Not a POST method.");
        return response.status(405).send({ error: "Method Not Allowed" });
      }

      try {
        const token = process.env.REPLICATE_TOKEN;
        if (!token) {
          const msg =
            "Missing REPLICATE_TOKEN. Did you set it with `firebase functions:secrets:set REPLICATE_TOKEN`?";
          logger.error(msg);
          return response.status(500).send({ error: msg });
        }

        const { imageBase64 } = request.body;
        if (!imageBase64) {
          return response
            .status(400)
            .send({ error: "Missing field: imageBase64" });
        }

        // 1. Upload base64 → Firebase Storage
        const filename = `uploads/${Date.now()}.jpg`;
        const imageUrl = await uploadBase64ToStorage(imageBase64, filename);

        // 2. Call Replicate with TripoSR
        logger.info("Forwarding request to Replicate API...");
        const apiResponse = await fetch(
          "https://api.replicate.com/v1/predictions",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              version:
                "e0d3fe8abce3ba86497ea3530d9eae59af7b2231b6c82bedfc32b0732d35ec3a", // TripoSR version
              input: { image: imageUrl },
            }),
          }
        );

        const responseData = await apiResponse.json();
        logger.info(
          `Received response from Replicate with status: ${apiResponse.status}`
        );
        return response.status(apiResponse.status).send(responseData);
      } catch (error) {
        logger.error("Unexpected error in replicateProxy:", error);
        return response.status(500).send({ error: "Internal Server Error" });
      }
    });
  }
);
