const axios = require("axios");

// Extracts the most likely medicine name from OCR text
function extractMostLikelyMedicineName(text) {
  const words = text
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && /^[A-Za-z]+$/.test(word));
  return words.length > 0 ? words[0] : null;
}

// Fetches medicine details from OpenFDA API
async function fetchMedicineInfo(medicineName, openFdaApiKey) {
  try {
    const fetchData = async (searchTerm) => {
      const response = await axios.get("https://api.fda.gov/drug/label.json", {
        params: { search: searchTerm, api_key: openFdaApiKey, limit: 1 }
      });
      return response.data.results && response.data.results.length > 0 ? response.data.results[0] : null;
    };
    // Try an exact match first
    let medicineInfo = await fetchData(`openfda.brand_name:"${medicineName}"`);
    if (medicineInfo) return medicineInfo;
    // If no exact match, try a partial match (fuzzy search)
    medicineInfo = await fetchData(`openfda.brand_name:${medicineName}*`);
    return medicineInfo;
  } catch (error) {
    return null;
  }
}

// OCR.Space API
async function processImageWithOCRSpace(buffer, ocrApiKey) {
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
          'apikey': ocrApiKey,
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
    throw new Error('Failed to extract text from image using OCR.Space.');
  }
}

// Hugging Face OCR
async function processImageWithHuggingFace(buffer, hfApiKey) {
  const base64Image = buffer.toString('base64');
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/microsoft/trocr-base-printed',
      { inputs: `data:image/jpeg;base64,${base64Image}` },
      {
        headers: {
          'Authorization': `Bearer ${hfApiKey}`,
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
    throw new Error('Failed to extract text from image using Hugging Face.');
  }
}

module.exports = {
  extractMostLikelyMedicineName,
  fetchMedicineInfo,
  processImageWithOCRSpace,
  processImageWithHuggingFace
}; 