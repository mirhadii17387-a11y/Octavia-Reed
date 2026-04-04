// index.js
// Aman_Sahil - SMS Proxy API (Fixed Version)

const http = require("http");
const https = require("https");
const zlib = require("zlib");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CONFIG ====================
const TARGET_BASE_URL = process.env.TARGET_BASE_URL || "http://51.68.39.124";
const DEFAULT_PHPSESSID = process.env.DEFAULT_PHPSESSID || "cmsdqi1t0sddnu0sn83s6bhblr";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

// ==================== FETCH HELPER ====================
const fetchWithDecompression = (url, headers, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;

    const req = lib.get(url, { headers }, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const encoding = response.headers["content-encoding"];

        try {
          if (encoding === "gzip") {
            zlib.gunzip(buffer, (err, decoded) => {
              if (err) return reject(new Error(`Gzip failed: ${err.message}`));
              resolve(decoded.toString());
            });
          } else if (encoding === "deflate") {
            zlib.inflate(buffer, (err, decoded) => {
              if (err) return reject(new Error(`Deflate failed: ${err.message}`));
              resolve(decoded.toString());
            });
          } else {
            resolve(buffer.toString());
          }
        } catch (e) {
          reject(new Error(`Response processing failed: ${e.message}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Request error: ${err.message}`)));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });

// ==================== MAIN ROUTE ====================
app.get("/", async (req, res) => {
  try {
    const type = req.query.type?.toLowerCase().trim();
    const session = req.query.session || DEFAULT_PHPSESSID;

    if (!type || !["numbers", "sms"].includes(type)) {
      return res.status(400).json({ success: false, error: "Invalid or missing type" });
    }

    if (!session) {
      return res.status(401).json({ success: false, error: "PHPSESSID required" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const timestamp = Date.now();

    const headers = {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "Accept-Encoding": "gzip, deflate",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: `PHPSESSID=${session}`,
      Referer: type === "numbers" 
        ? `${TARGET_BASE_URL}/sms/subclient/AssignedNumbers`
        : `${TARGET_BASE_URL}/sms/subclient/SMSReports`,
      "Cache-Control": "no-cache"
    };

    let targetUrl = "";

    if (type === "numbers") {
      targetUrl = `${TARGET_BASE_URL}/sms/subclient/ajax/dt_numbers.php?ftermination=&sEcho=1&iColumns=3&sColumns=%2C%2C&iDisplayStart=0&iDisplayLength=-1&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=asc&iSortingCols=1&_=${timestamp}`;
    } else if (type === "sms") {
      targetUrl = `${TARGET_BASE_URL}/sms/subclient/ajax/dt_reports.php?fdate1=${today}%2000:00:00&fdate2=${today}%2023:59:59&ftermination=&fnum=&fcli=&fgdate=0&fgtermination=0&fgnumber=0&fgcli=0&fg=0&sEcho=1&iColumns=8&sColumns=%2C%2C%2C%2C%2C%2C%2C&iDisplayStart=0&iDisplayLength=-1&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&mDataProp_3=3&sSearch_3=&bRegex_3=false&bSearchable_3=true&bSortable_3=true&mDataProp_4=4&sSearch_4=&bRegex_4=false&bSearchable_4=true&bSortable_4=true&mDataProp_5=5&sSearch_5=&bRegex_5=false&bSearchable_5=true&bSortable_5=true&mDataProp_6=6&sSearch_6=&bRegex_6=false&bSearchable_6=true&bSortable_6=true&mDataProp_7=7&sSearch_7=&bRegex_7=false&bSearchable_7=true&bSortable_7=true&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=desc&iSortingCols=1&_=${timestamp}`;
    }

    console.log(`[${new Date().toISOString()}] Fetching ${type}...`);

    const rawData = await fetchWithDecompression(targetUrl, headers);

    let parsedData;
    try {
      parsedData = JSON.parse(rawData);
    } catch (e) {
      parsedData = rawData;
    }

    res.json({
      success: true,
      name: "Aman_Sahil SMS Proxy",
      type,
      data: parsedData,
      fetchedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error("Real Error:", err.message);
    res.status(502).json({
      success: false,
      error: "Failed to fetch data from SMS panel",
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "Aman_Sahil SMS Proxy" });
});

app.listen(PORT, () => {
  console.log(`🚀 Aman_Sahil SMS Proxy running on port ${PORT}`);
});