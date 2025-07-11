const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB limit
});

// CORS middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ====== Extract Most Likely Medicine Name from OCR Text ======
function extractMostLikelyMedicineName(text) {
  const words = text
    .replace(/[^\w\s]/gi, "")
    .split(/\s+/)
    .filter(word => word.length > 2 && /^[A-Za-z]+$/.test(word));
  return words.length > 0 ? words[0] : null;
}

// ====== OCR using OCR.Space (primary) and Hugging Face (fallback) ======
async function processImageWithOCRSpace(buffer) {
  const base64Image = buffer.toString("base64");
  const response = await axios.post(
    "https://api.ocr.space/parse/image",
    new URLSearchParams({
      base64Image: `data:image/jpeg;base64,${base64Image}`,
      language: "eng",
      isOverlayRequired: "false"
    }),
    {
      headers: {
        apikey: process.env.OCR_SPACE_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      timeout: 30000
    }
  );
  const result = response.data;
  return result.ParsedResults?.[0]?.ParsedText || "";
}

async function processImageWithHuggingFace(buffer) {
  const base64Image = buffer.toString("base64");
  const response = await axios.post(
    "https://api-inference.huggingface.co/models/microsoft/trocr-base-printed",
    { inputs: `data:image/jpeg;base64,${base64Image}` },
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  );
  if (response.data?.[0]?.generated_text) {
    return response.data[0].generated_text;
  }
  return "";
}

// ====== Extract Medicine Endpoint ======
app.post("/api/extract-medicine-name", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });
  try {
    let text = "";
    try {
      text = await processImageWithOCRSpace(req.file.buffer);
    } catch {
      text = await processImageWithHuggingFace(req.file.buffer);
    }
    if (!text.trim()) throw new Error("OCR failed to extract text.");
    const medicineName = extractMostLikelyMedicineName(text);
    res.json({ medicineName, text });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to process image" });
  }
});

// ====== Suggestion Endpoint ======
app.get("/api/suggestions", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.json({ suggestions: [] });
  try {
    const apiKey = process.env.OPENFDA_API_KEY;
    const response = await axios.get("https://api.fda.gov/drug/label.json", {
      params: { search: `openfda.brand_name:${name}*`, limit: 5, api_key: apiKey }
    });
    const suggestions = response.data.results?.map(r => r.openfda?.brand_name?.[0]).filter(Boolean) || [];
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

// ====== Multi-source Medicine Info Endpoint ======
app.get("/api/medicine-info", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Medicine name is required" });

  try {
    const apiKey = process.env.OPENFDA_API_KEY;
    const fetchFDA = async (search) => {
      const resp = await axios.get("https://api.fda.gov/drug/label.json", {
        params: { search, limit: 1, api_key: apiKey }
      });
      return resp.data.results?.[0] || null;
    };

    let result = null;
    if (apiKey) {
      result = await fetchFDA(`openfda.brand_name:"${name}"`);
      if (!result) result = await fetchFDA(`openfda.brand_name:${name}*`);
      if (result) return res.json({ source: "openfda", data: result });
    }

    try {
      const wiki = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
      if (wiki.data?.extract) return res.json({ source: "wikipedia", data: wiki.data });
    } catch {}

    try {
      const rxResp = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`);
      const rxCui = rxResp.data.idGroup?.rxnormId?.[0];
      if (rxCui) {
        const props = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxCui}/properties.json`);
        const syns = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxCui}/allProperties.json?prop=names`);
        return res.json({
          source: "rxnorm",
          data: {
            ...props.data.properties,
            synonyms: syns.data.propConceptGroup?.propConcept?.map(s => s.propValue) || []
          }
        });
      }
    } catch {}

    return res.status(404).json({ error: "No information found from OpenFDA, Wikipedia, or RxNorm." });
  } catch (err) {
    res.status(500).json({ error: "Error fetching medicine information" });
  }
});

// ====== Summarize Text Endpoint ======
app.post("/api/summarize", express.json(), async (req, res) => {
  let { text } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });
  text = Array.isArray(text) ? text.join(" ") : String(text).trim();
  if (text.length < 50) return res.json({ summary: text });

  const chunkSize = 900;
  const overlap = 100;
  let summaries = [];

  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunk = text.slice(i, i + chunkSize);
    try {
      const hf = await axios.post(
        "https://api-inference.huggingface.co/models/google/pegasus-xsum",
        { inputs: chunk },
        {
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      summaries.push(hf.data[0]?.summary_text || chunk);
    } catch {
      summaries.push(chunk); // fallback
    }
  }

  res.json({ summary: summaries.join(" ") });
});

// ====== Error Handler ======
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// ====== Export for Vercel ======
module.exports = app;

// Run locally if not on Vercel
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
