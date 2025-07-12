const { processImageWithOCRSpace, processImageWithHuggingFace, extractMostLikelyMedicineName } = require("./processImage");
const Busboy = require("busboy");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const busboy = new Busboy({ headers: req.headers, limits: { fileSize: 4 * 1024 * 1024 } });
  let fileBuffer = Buffer.alloc(0);
  let fileFound = false;
  busboy.on("file", (fieldname, file) => {
    if (fieldname === "image") {
      fileFound = true;
      file.on("data", (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    }
  });
  busboy.on("finish", async () => {
    if (!fileFound || !fileBuffer.length) {
      return res.status(400).json({ error: "No image file provided" });
    }
    let text = '';
    try {
      try {
        text = await processImageWithOCRSpace(fileBuffer, process.env.OCR_SPACE_API_KEY);
      } catch (err) {
        text = await processImageWithHuggingFace(fileBuffer, process.env.HF_API_KEY);
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
  req.pipe(busboy);
}; 