const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const url = process.argv[2];
const outputDir = process.argv[3] || "/app/output";

if (!url) {
  console.error("Error: No target URL provided.");
  process.exit(1);
}

async function run() {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SecureBuddy/1.0",
  });

  const page = await context.newPage();
  const redirectChain = [];

  // Capture HTTP redirects
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 300 && status <= 399) {
      redirectChain.push({
        url: response.url(),
        status,
        to: response.headers()["location"] || "unknown",
      });
    }
  });

  try {
    logger(`Analyzing target URL: ${url}`);
    
    // Visit page
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      // Give dynamic scripts a couple of seconds to render
      await page.waitForTimeout(3000);
    } catch (gotoError) {
      const errorMsg = gotoError instanceof Error ? gotoError.message : String(gotoError);
      if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) {
        logger("Navigation timeout exceeded. Proceeding with partial page render and metadata extraction.");
      } else {
        throw gotoError;
      }
    }

    const finalUrl = page.url();
    
    // If redirectChain is empty but finalUrl is different from initial url, log it
    if (redirectChain.length === 0 && finalUrl !== url) {
      redirectChain.push({ url, status: 302, to: finalUrl });
    }

    // Capture screenshot (with a 10s timeout and graceful fallback if web font loading hangs)
    const screenshotPath = path.join(outputDir, "screenshot.png");
    try {
      logger(`Attempting to capture screenshot at ${screenshotPath}...`);
      await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 10000 });
      logger(`Screenshot captured successfully.`);
    } catch (screenshotError) {
      const errMsg = screenshotError instanceof Error ? screenshotError.message : String(screenshotError);
      logger(`Warning: Screenshot capture bypassed due to error: ${errMsg}`);
    }

    // Extract metadata
    const metadata = await page.evaluate(() => {
      const getMeta = (name) => {
        const element = document.querySelector(
          `meta[name="${name}"], meta[property="${name}"], meta[name="twitter:${name}"]`
        );
        return element ? element.getAttribute("content") : null;
      };

      return {
        title: document.title || "",
        description: getMeta("description") || getMeta("og:description") || "",
        ogTitle: getMeta("og:title") || "",
        ogDescription: getMeta("og:description") || "",
        ogImage: getMeta("og:image") || "",
        ogType: getMeta("og:type") || "",
      };
    });

    const result = {
      status: "success",
      initialUrl: url,
      finalUrl,
      redirectChain,
      metadata,
    };

    fs.writeFileSync(
      path.join(outputDir, "result.json"),
      JSON.stringify(result, null, 2)
    );
    logger("Analysis results written to result.json successfully.");

  } catch (error) {
    logger(`Analysis encountered an error: ${error.message}`);
    const errorResult = {
      status: "error",
      initialUrl: url,
      errorMessage: error.message,
    };
    fs.writeFileSync(
      path.join(outputDir, "result.json"),
      JSON.stringify(errorResult, null, 2)
    );
  } finally {
    await browser.close();
  }
}

function logger(msg) {
  console.log(`[ANALYZER] [${new Date().toISOString()}] ${msg}`);
}

run();
