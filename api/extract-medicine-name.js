const multiparty = require("multiparty");
const { processImageWithOCRSpace, processImageWithHuggingFace, extractMostLikelyMedicineName } = require("./utils");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  // Parse multipart form
  const form = new multiparty.Form();
  form.parse(req, async (err, fields, files) => {
    if (err || !files.image || !files.image[0]) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }
    const file = files.image[0];
    const buffer = require("fs").readFileSync(file.path);
    let text = '';
    try {
      try {
        text = await processImageWithOCRSpace(buffer, process.env.OCR_SPACE_API_KEY);
      } catch (err) {
        text = await processImageWithHuggingFace(buffer, process.env.HF_API_KEY);
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
      res.status(500).json({ error: error.message || "Failed to process the image with OCR providers" });
    }
  });
}; 