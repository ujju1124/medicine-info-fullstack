const axios = require("axios");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", resolve);
  });
  let text;
  try {
    const parsed = JSON.parse(body);
    text = parsed.text;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  if (!text) {
    res.status(400).json({ error: "No text provided" });
    return;
  }
  if (Array.isArray(text)) {
    text = text.join(' ');
  }
  text = String(text).trim();
  if (!text || text.length < 50) {
    res.json({ summary: text });
    return;
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
      summaries.push(chunk);
    }
  }
  const finalSummary = summaries.join(' ');
  res.json({ summary: finalSummary });
}; 