const axios = require("axios");
const { createWorker } = require("tesseract.js");

// Extracts text from image using Tesseract.js (not used in serverless, but kept for reference)
async function processImage(buffer) {
    const worker = await createWorker({
        corePath: '/node_modules/tesseract.js-core/tesseract-core.wasm.js',
        logger: m => console.log(m)
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
        console.error('Hugging Face OCR error:', err.response?.data || err.message);
        throw new Error('Failed to extract text from image using Hugging Face.');
    }
}

// OCR.Space API
async function processImageWithOCRSpace(buffer, ocrSpaceApiKey) {
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
                    'apikey': ocrSpaceApiKey,
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

function extractMostLikelyMedicineName(text) {
    const words = text
        .replace(/[^\w\s]/gi, '')
        .split(' ')
        .filter(word => word.length > 0);

    const wordCounts = {};
    words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    let mostFrequentWord = null;
    let maxCount = 0;

    for (const word in wordCounts) {
        if (wordCounts[word] > maxCount) {
            maxCount = wordCounts[word];
            mostFrequentWord = word;
        }
    }

    return mostFrequentWord;
} 