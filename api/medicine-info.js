const axios = require("axios");
const { fetchMedicineInfo } = require("./utils");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { name } = req.query;
  if (!name) {
    res.status(400).json({ error: "Medicine name is required" });
    return;
  }
  try {
    // 1. Try OpenFDA
    const medicineInfo = await fetchMedicineInfo(name, process.env.OPENFDA_API_KEY);
    if (medicineInfo) {
      res.json({ source: "openfda", data: medicineInfo });
      return;
    }
    // 2. Try Wikipedia
    try {
      const wikiResp = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
      if (wikiResp.data && wikiResp.data.extract) {
        res.json({ source: "wikipedia", data: wikiResp.data });
        return;
      }
    } catch (err) {}
    // 3. Try RxNorm
    try {
      const rxCuiResp = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`);
      const rxCui = rxCuiResp.data.idGroup?.rxnormId?.[0];
      if (rxCui) {
        const propsResp = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxCui}/properties.json`);
        const props = propsResp.data.properties || {};
        let synonyms = [];
        try {
          const synResp = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxCui}/allProperties.json?prop=names`);
          synonyms = synResp.data.propConceptGroup?.propConcept?.map(s => s.propValue) || [];
        } catch {}
        res.json({ source: "rxnorm", data: { ...props, synonyms } });
        return;
      }
    } catch (err) {}
    // 4. All failed
    res.status(404).json({ error: "No information found for this medicine in OpenFDA, Wikipedia, or RxNorm." });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch medicine information" });
  }
}; 