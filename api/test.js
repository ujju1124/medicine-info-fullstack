const axios = require("axios");
module.exports = async (req, res) => {
  res.json({ message: "Axios is working!", axiosVersion: axios.VERSION });
};