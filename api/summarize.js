const axios = require("axios");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", async () => {
    try {
      const { text } = JSON.parse(body);
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }
      let inputText = Array.isArray(text) ? text.join(' ') : String(text).trim();
      if (!inputText || inputText.length < 50) {
        return res.json({ summary: inputText });
      }
      const chunkSize = 900;
      const overlap = 100;
      let summaries = [];
      for (let i = 0; i < inputText.length; i += (chunkSize - overlap)) {
        const chunk = inputText.slice(i, i + chunkSize);
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
    } catch (error) {
      res.status(500).json({ error: error.message || "Failed to summarize text" });
    }
  });
}; 