import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const appUrl = process.env.VEYRIN_CAPTURE_URL || "http://127.0.0.1:3000";
const debuggingPort = 9333;
const chrome = spawn(chromePath, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--force-prefers-reduced-motion",
  "--window-size=1440,1000",
  `--remote-debugging-port=${debuggingPort}`,
  "--user-data-dir=/tmp/veyrin-readme-chrome",
  appUrl
], { stdio: "ignore" });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function browserPage() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debuggingPort}/json`).then((response) => response.json());
      const page = pages.find((entry) => entry.type === "page");
      if (page) return page;
    } catch {}
    await delay(200);
  }
  throw new Error("Chrome DevTools endpoint did not become ready");
}

function cdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let id = 0;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    }),
    send(method, params = {}) {
      id += 1;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) throw new Error("Browser expression failed");
  return response.result.value;
}

async function screenshot(client, path, clip) {
  const response = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    ...(clip ? { clip } : {})
  });
  await writeFile(path, Buffer.from(response.data, "base64"));
}

let client;
try {
  const page = await browserPage();
  client = cdp(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  let networkReady = false;
  for (let refresh = 0; refresh < 3 && !networkReady; refresh += 1) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const verified = await evaluate(client, `(document.body?.innerText.match(/RESPONSE VERIFIED/g) ?? []).length`);
      if (verified === 4) {
        networkReady = true;
        break;
      }
      await delay(250);
    }
    if (!networkReady) {
      await evaluate(client, `document.querySelector('.text-button:not(:disabled)')?.click()`);
    }
  }
  if (!networkReady) throw new Error("All four live network methods did not render");

  const networkClip = await evaluate(client, `(() => {
    const network = document.querySelector('#network');
    const result = network.getBoundingClientRect();
    return {
      x: 0,
      y: Math.max(0, result.top + window.scrollY),
      width: document.documentElement.scrollWidth,
      height: result.height,
      scale: 1
    };
  })()`);
  await screenshot(client, "/tmp/veyrin-readme-network.png", networkClip);

  await evaluate(client, `(() => {
    const mutationButton = document.querySelectorAll('.sample-actions button')[1];
    mutationButton.click();
    document.querySelector('#lab').scrollIntoView();
    return true;
  })()`);
  await delay(300);
  await evaluate(client, `document.querySelector('.primary-action').click()`);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(client, `document.body?.innerText.includes('Recipient mutation detected') ?? false`)) break;
    if (attempt === 79) throw new Error("Mutation result did not render");
    await delay(250);
  }

  const clip = await evaluate(client, `(() => {
    const lab = document.querySelector('#lab');
    const result = lab.getBoundingClientRect();
    return {
      x: 0,
      y: Math.max(0, result.top + window.scrollY),
      width: document.documentElement.scrollWidth,
      height: result.height,
      scale: 1
    };
  })()`);
  await screenshot(client, "/tmp/veyrin-readme-mutation.png", clip);
  console.log("Captured live-network and recipient-mutation screenshots.");
} finally {
  client?.close();
  chrome.kill("SIGTERM");
}
