const axios = require("axios");

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: "Medicine name is required" });
  }
  try {
    // 1. Try OpenFDA
    const apiKey = process.env.OPENFDA_API_KEY;
    let medicineInfo = null;
    if (apiKey) {
      const fetchData = async (searchTerm) => {
        const response = await axios.get("https://api.fda.gov/drug/label.json", {
          params: { search: searchTerm, api_key: apiKey, limit: 1 }
        });
        return response.data.results && response.data.results.length > 0 ? response.data.results[0] : null;
      };
      // Try an exact match first
      medicineInfo = await fetchData(`openfda.brand_name:"${name}"`);
      if (!medicineInfo) {
        medicineInfo = await fetchData(`openfda.brand_name:${name}*`);
      }
      if (medicineInfo) {
        return res.json({ source: 'openfda', data: medicineInfo });
      }
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
}; 