const express = require("express");
const axios = require("axios");
const multer = require("multer");
const { createWorker } = require("tesseract.js"); // While tesseract.js is in your code, it's bypassed for OCR.Space/HF. Keep for now if you might re-enable.
require("dotenv").config();

const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit
});

// CORS middleware
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// **Removed: express.static middleware and direct index.html serving.**
// These are no longer needed as vercel.json will handle serving static files directly.
// const path = require("path"); // No longer strictly needed if not serving static files
// app.use(express.static(path.join(__dirname, "../public"))); // REMOVED
// app.get("/", (req, res) => { // REMOVED - Vercel will serve public/index.html for the root route
//     res.sendFile(path.join(__dirname, "../public/index.html"));
// });

// **Extracts text from image using Tesseract.js (Currently bypassed by OCR.Space/HF)**
async function processImage(buffer) {
    const worker = await createWorker({
        corePath: '/node_modules/tesseract.js-core/tesseract-core.wasm.js',
        logger: m => console.log(m) // Optional logging
    });
    
    try {
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data: { text } } = await worker.recognize(buffer);
        return text;
    } finally {
        await worker.terminate();
    }
}

// Replace processImage with Hugging Face OCR
async function processImageWithHuggingFace(buffer) {
  const base64Image = buffer.toString('base64');
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/microsoft/trocr-base-printed',
      { inputs: `data:image/jpeg;base64,${base64Image}` },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000
      }
    );
    if (response.data && response.data.generated_text) {
      return response.data.generated_text;
    } else if (Array.isArray(response.data) && response.data[0]?.generated_text) {
      return response.data[0].generated_text;
    } else {
      throw new Error('No text extracted from image (Hugging Face)');
    }
  } catch (err) {
    console.error('Hugging Face OCR error:', err.response?.data || err.message);
    throw new Error('Failed to extract text from image using Hugging Face.');
  }
}

// Replace OCR logic with OCR.Space API
async function processImageWithOCRSpace(buffer) {
  const base64Image = buffer.toString('base64');
  try {
    const response = await axios.post(
      'https://api.ocr.space/parse/image',
      new URLSearchParams({
        base64Image: `data:image/jpeg;base64,${base64Image}`,
        language: 'eng',
        isOverlayRequired: 'false'
      }),
      {
        headers: {
          'apikey': 'fef07ab03488957', // Consider moving this to process.env.OCRSPACE_API_KEY
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );
    const parsed = response.data;
    if (parsed && parsed.ParsedResults && parsed.ParsedResults[0]?.ParsedText) {
      return parsed.ParsedResults[0].ParsedText;
    } else {
      throw new Error('No text extracted from image');
    }
  } catch (err) {
    console.error('OCR.Space error:', err.response?.data || err.message);
    throw new Error('Failed to extract text from image using OCR.Space.');
  }
}

// **Extracts the most likely medicine name from OCR text**
function extractMostLikelyMedicineName(text) {
    const words = text
        .replace(/[^\w\s]/gi, '') // Remove special characters
        .split(/\s+/) // Split into words
        .filter(word => word.length > 2 && isValidWord(word)); // Keep meaningful words

    return words.length > 0 ? words[0] : null; // Pick the first valid word
}

function isValidWord(word) {
    return isNaN(word) && /^[A-Za-z]+$/.test(word); // Ensure it's a valid word (not a number)
}

// **Fetches medicine details from OpenPDA API**
async function fetchMedicineInfo(medicineName) {
    try {
        console.log(`Searching OpenPDA for medicine: ${medicineName}`);

        const apiKey = process.env.OPENFDA_API_KEY;
        if (!apiKey) {
            throw new Error("FDA API key is not configured");
        }

        // Function to fetch data from FDA API
        const fetchData = async (searchTerm) => {
            const response = await axios.get("https://api.fda.gov/drug/label.json", {
                params: { search: searchTerm, api_key: apiKey, limit: 1 }
            });
            console.log('FDA API raw response:', response.data);
            return response.data.results && response.data.results.length > 0 ? response.data.results[0] : null;
        };

        // Try an exact match first
        let medicineInfo = await fetchData(`openfda.brand_name:"${medicineName}"`);
        if (medicineInfo) {
            return medicineInfo; // Return first match
        }

        // If no exact match, try a partial match (fuzzy search)
        console.log("No exact match. Trying partial search...");
        medicineInfo = await fetchData(`openfda.brand_name:${medicineName}*`);
        
        return medicineInfo;

    } catch (error) {
        console.error("API Request Failed:", error.message || error.response?.data); // Log error details
        return null;
    }
}

console.log('OPENFDA_API_KEY:', process.env.OPENFDA_API_KEY);

// Update the POST /api/extract-medicine-name endpoint to use OCR.Space, fallback to Hugging Face
app.post("/api/extract-medicine-name", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
    }
    let text = '';
    try {
        // Try OCR.Space first
        try {
            text = await processImageWithOCRSpace(req.file.buffer);
            console.log("Extracted text (OCR.Space):", text);
        } catch (err) {
            console.warn("OCR.Space failed, trying Hugging Face OCR...", err.message);
            // Fallback to Hugging Face
            text = await processImageWithHuggingFace(req.file.buffer);
            console.log("Extracted text (Hugging Face):", text);
        }
        if (!text || !text.trim()) {
            throw new Error('No text extracted from image by any OCR provider.');
        }
        const medicineName = extractMostLikelyMedicineName(text);
        if (medicineName) {
            res.json({ medicineName, text });
        } else {
            res.json({ text });
        }
    } catch (error) {
        console.error("Error processing image (OCR fallback):", error);
        res.status(500).json({ error: error.message || "Failed to process the image with OCR providers" });
    }
});

// **Updated: The root route is now just a placeholder for the API**
// The actual root (/) of your Vercel deployment will serve public/index.html
// due to the vercel.json configuration. This route will only be hit if
// your vercel.json routes specifically target the root of the *API*.
// Given your vercel.json, this route `/` in your API *won't* serve your
// frontend homepage on Vercel's production environment.
// It's primarily for local testing of the API.
app.get("/", (req, res) => {
    res.json({ message: "Welcome to Medisearch Backend! This is an API endpoint." });
});


app.get("/api/suggestions", async (req, res, next) => {
    const { name } = req.query;
    console.log('Suggestion query:', name);

    if (!name) {
        return res.json({ suggestions: [] });
    }

    try {
        const apiKey = process.env.OPENFDA_API_KEY;
        if (!apiKey) {
            throw new Error("FDA API key is not configured");
        }

        const response = await axios.get("https://api.fda.gov/drug/label.json", {
            params: { search: `openfda.brand_name:${name}*`, limit: 5, api_key: apiKey }
        });

        const suggestions = response.data.results
            ? response.data.results
                    .filter((medicine) => medicine.openfda && medicine.openfda.brand_name)
                    .map((medicine) => medicine.openfda.brand_name[0])
            : [];

        console.log('Suggestions returned:', suggestions);
        res.json({ suggestions });
    } catch (error) {
        console.error("FDA API Error:", error.response?.data || error.message);
        next(error);
    }
});

app.get("/api/medicine-info", async (req, res, next) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: "Medicine name is required" });
    }
    try {
        // 1. Try OpenFDA
        const medicineInfo = await fetchMedicineInfo(name);
        if (medicineInfo) {
            return res.json({ source: 'openfda', data: medicineInfo });
        }
        // 2. Try Wikipedia
        try {
            const wikiResp = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
            if (wikiResp.data && wikiResp.data.extract) {
                return res.json({ source: 'wikipedia', data: wikiResp.data });
            }
        } catch (err) {
            // Wikipedia failed, continue to RxNorm
        }
        // 3. Try RxNorm
        try {
            // Get RxCUI for the name
            const rxCuiResp = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`);
            const rxCui = rxCuiResp.data.idGroup?.rxnormId?.[0];
            if (rxCui) {
                // Get RxNorm properties
                const propsResp = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxCui}/properties.json`);
                const props = propsResp.data.properties || {};
                // Get synonyms (optional)
                let synonyms = [];
                try {
                    const synResp = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxCui}/allProperties.json?prop=names`);
                    synonyms = synResp.data.propConceptGroup?.propConcept?.map(s => s.propValue) || [];
                } catch {}
                return res.json({ source: 'rxnorm', data: { ...props, synonyms } });
            }
        } catch (err) {
            // RxNorm failed
        }
        // 4. All failed
        return res.status(404).json({ error: "No information found for this medicine in OpenFDA, Wikipedia, or RxNorm." });
    } catch (error) {
        console.error("Error fetching medicine info (multi-source):", error);
        res.status(500).json({ error: "Failed to fetch medicine information" });
    }
});

app.post("/api/summarize", express.json(), async (req, res) => {
    let { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: "No text provided" });
    }
    if (Array.isArray(text)) {
        text = text.join(' ');
    }
    text = String(text).trim();
    if (!text || text.length < 50) {
        return res.json({ summary: text });
    }

    // Split text into chunks of 900 characters with 100 char overlap
    const chunkSize = 900;
    const overlap = 100;
    let summaries = [];
    for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
        const chunk = text.slice(i, i + chunkSize);
        try {
            const hfResponse = await axios.post(
                "https://api-inference.huggingface.co/models/google/pegasus-xsum",
                { inputs: chunk },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.HF_API_KEY}`
                    }
                }
            );
            const summary = hfResponse.data[0]?.summary_text || chunk;
            summaries.push(summary);
        } catch (error) {
            console.error("Hugging Face API error:", error.response?.data || error.message);
            summaries.push(chunk); // fallback: use original chunk
        }
    }
    // Join all summaries into one readable summary
    const finalSummary = summaries.join(' ');
    res.json({ summary: finalSummary });
});

// **Apply error handling middleware**
app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

// **Export the app for Vercel**
module.exports = app;

// Start server locally if not running on Vercel
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}