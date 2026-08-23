const { MegaService } = require('./dist/workers/mega.service.js');
const ms = new MegaService();
ms.logger = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

async function testMega() {
  try {
    const url = "https://mega.nz/file/ezwEEaaD#46PpTO1ZxK1_R6EBl_r0RYxGNmKzaHr19zWpk7LHaRE";
    console.log("Testing Mega URL:", url);
    const path = await ms.downloadFile(url);
    console.log("Downloaded to:", path);
  } catch (err) {
    console.error("Error:", err);
  }
}

testMega();
