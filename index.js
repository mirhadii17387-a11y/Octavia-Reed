// index.js
// Aman_BilalShah - SMS Proxy API (Updated - Matches exact curl)

const http = require("http");
const https = require("https");
const zlib = require("zlib");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CONFIG ====================
const TARGET_BASE_URL = process.env.TARGET_BASE_URL || "http://51.68.39.124";
const DEFAULT_PHPSESSID = process.env.DEFAULT_PHPSESSID || "9f6cem9j7ra7ackpr45hd3ghuc";   // Updated default

const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

// ==================== FETCH HELPER ====================
const fetchWithDecompression = (url, headers, timeoutMs = 20000) => {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;

    const req = lib.get(url, { headers }, (res) => {
      const chunks = [];

      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const encoding = res.headers["content-encoding"];

        try {
          if (encoding === "gzip") {
            zlib.gunzip(buffer, (err, decoded) => {
              if (err) return reject(err);
              resolve(decoded.toString());
            });
          } else if (encoding === "deflate") {
            zlib.inflate(buffer, (err, decoded) => {
              if (err) return reject(err);
              resolve(decoded.toString());
            });
          } else {
            resolve(buffer.toString());
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", err => reject(err));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
};

// ==================== MAIN ENDPOINT ====================
app.get("/", async (req, res) => {
  const startTime = Date.now();
  const type = req.query.type?.toLowerCase().trim() || "sms";   // default sms
  const session = req.query.session || DEFAULT_PHPSESSID;

  try {
    if (!["numbers", "sms"].includes(type)) {
      return res.status(400).json({ success: false, error: "Invalid type. Use ?type=numbers or ?type=sms" });
    }

    if (!session) {
      return res.status(401).json({ success: false, error: "PHPSESSID required" });
    }

    const today = new Date().toISOString().slice(0, 10);   // 2026-04-09 format
    const timestamp = Date.now();

    const headers = {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
      "Connection": "keep-alive",
      "User-Agent": DEFAULT_USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `${TARGET_BASE_URL}/sms/subclient/Reports`,
      "Cookie": `PHPSESSID=${session}`,
      "Cache-Control": "no-cache"
    };

    let targetUrl = "";

    if (type === "numbers") {
      headers.Referer = `${TARGET_BASE_URL}/sms/subclient/AssignedNumbers`;
      targetUrl = `${TARGET_BASE_URL}/sms/subclient/ajax/dt_numbers.php?ftermination=&sEcho=1&iColumns=3&iDisplayStart=0&iDisplayLength=25&_=${timestamp}`;
    } else {
      // Exact match to your curl for SMS Reports
      headers.Referer = `${TARGET_BASE_URL}/sms/subclient/Reports`;
      targetUrl = `${TARGET_BASE_URL}/sms/subclient/ajax/dt_reports.php?fdate1=${today}%2000:00:00&fdate2=${today}%2023:59:59&ftermination=&fnum=&fcli=&fgdate=0&fgtermination=0&fgnumber=0&fgcli=0&fg=0&sEcho=1&iColumns=8&sColumns=%2C%2C%2C%2C%2C%2C%2C&iDisplayStart=0&iDisplayLength=25&mDataProp_0=0&sSearch_0=&bRegex_0=false&bSearchable_0=true&bSortable_0=true&mDataProp_1=1&sSearch_1=&bRegex_1=false&bSearchable_1=true&bSortable_1=true&mDataProp_2=2&sSearch_2=&bRegex_2=false&bSearchable_2=true&bSortable_2=true&mDataProp_3=3&sSearch_3=&bRegex_3=false&bSearchable_3=true&bSortable_3=true&mDataProp_4=4&sSearch_4=&bRegex_4=false&bSearchable_4=true&bSortable_4=true&mDataProp_5=5&sSearch_5=&bRegex_5=false&bSearchable_5=true&bSortable_5=true&mDataProp_6=6&sSearch_6=&bRegex_6=false&bSearchable_6=true&bSortable_6=true&mDataProp_7=7&sSearch_7=&bRegex_7=false&bSearchable_7=true&bSortable_7=true&sSearch=&bRegex=false&iSortCol_0=0&sSortDir_0=desc&iSortingCols=1&_=${timestamp}`;
    }

    console.log(`[${new Date().toISOString()}] [${type.toUpperCase()}] Fetching from panel | Session: ${session.substring(0, 15)}...`);

    const rawResponse = await fetchWithDecompression(targetUrl, headers);

    let data;
    try {
      data = JSON.parse(rawResponse);
    } catch (e) {
      data = { raw: rawResponse.substring(0, 500) };
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      name: "Aman_BilalShah SMS Proxy",
      version: "1.2",
      type: type,
      date: today,
      data: data,
      responseTimeMs: responseTime,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    res.status(502).json({
      success: false,
      error: "Failed to fetch from SMS panel",
      details: process.env.NODE_ENV === "production" ? "Proxy error" : error.message
    });
  }
});

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Aman_BilalShah SMS Proxy",
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Aman_BilalShah SMS Proxy running on port ${PORT}`);
  console.log(`   Target Panel: ${TARGET_BASE_URL}`);
});
