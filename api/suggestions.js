const axios = require("axios");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { name } = req.query;
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
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message || "FDA API Error" });
  }
}; 