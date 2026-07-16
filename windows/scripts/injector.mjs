import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function parseArgs(argv) {
  const options = { port: 9335, mode: "watch", timeoutMs: 30000, screenshot: null, reload: false, theme: "rick-portal", windowSize: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port") options.port = Number(argv[++i]);
    else if (arg === "--once") options.mode = "once";
    else if (arg === "--watch") options.mode = "watch";
    else if (arg === "--verify") options.mode = "verify";
    else if (arg === "--remove") options.mode = "remove";
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++i]);
    else if (arg === "--screenshot") options.screenshot = path.resolve(argv[++i]);
    else if (arg === "--reload") options.reload = true;
    else if (arg === "--theme") options.theme = argv[++i];
    else if (arg === "--window-size") {
      const match = /^(\d+)x(\d+)$/i.exec(argv[++i] ?? "");
      if (!match) throw new Error("--window-size must use WIDTHxHEIGHT, for example 1280x800");
      options.windowSize = { width: Number(match[1]), height: Number(match[2]) };
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error(`Invalid port: ${options.port}`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(options.theme)) throw new Error(`Invalid theme: ${options.theme}`);
  if (options.windowSize && (options.windowSize.width < 800 || options.windowSize.height < 600)) {
    throw new Error("--window-size must be at least 800x600");
  }
  return options;
}

class CdpSession {
  constructor(target) {
    this.target = target;
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.onMessage(event));
    this.ws.addEventListener("close", () => {
      this.closed = true;
      for (const waiter of this.pending.values()) waiter.reject(new Error("CDP socket closed"));
      this.pending.clear();
    });
    await this.send("Runtime.enable");
    await this.send("Page.enable");
    return this;
  }

  onMessage(event) {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error("CDP session is closed"));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Renderer evaluation failed: ${detail}`);
    }
    return result.result?.value;
  }

  close() {
    if (!this.closed) this.ws.close();
    this.closed = true;
  }
}

async function waitForTargets(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const targets = await response.json();
      const pages = targets.filter((item) => item.type === "page" && item.url.startsWith("app://"));
      if (pages.length) return pages;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`No Codex renderer target on 127.0.0.1:${port}: ${lastError?.message ?? "timed out"}`);
}

async function loadPayload(themeName) {
  if (themeName !== "dream") {
    const themeRoot = path.join(root, "themes", themeName);
    const manifest = JSON.parse(await fs.readFile(path.join(themeRoot, "theme.json"), "utf8"));
    if (manifest.id !== themeName) throw new Error(`Theme id mismatch: expected ${themeName}, got ${manifest.id}`);
    const [css, template, homeArt, homeHeroArt, workArt, portalTexture] = await Promise.all([
      fs.readFile(path.join(themeRoot, manifest.css), "utf8"),
      fs.readFile(path.join(themeRoot, manifest.renderer), "utf8"),
      fs.readFile(path.join(themeRoot, manifest.assets.home)),
      fs.readFile(path.join(themeRoot, manifest.assets.homeHero)),
      fs.readFile(path.join(themeRoot, manifest.assets.work)),
      fs.readFile(path.join(themeRoot, manifest.assets.portalTexture)),
    ]);
    return template
      .replace("__PORTAL_CSS_JSON__", JSON.stringify(css))
      .replace("__PORTAL_HOME_ART_JSON__", JSON.stringify(`data:image/png;base64,${homeArt.toString("base64")}`))
      .replace("__PORTAL_HOME_HERO_ART_JSON__", JSON.stringify(`data:image/png;base64,${homeHeroArt.toString("base64")}`))
      .replace("__PORTAL_WORK_ART_JSON__", JSON.stringify(`data:image/png;base64,${workArt.toString("base64")}`))
      .replace("__PORTAL_FLUID_TEXTURE_JSON__", JSON.stringify(`data:image/png;base64,${portalTexture.toString("base64")}`))
      .replace("__PORTAL_THEME_META_JSON__", JSON.stringify({
        id: manifest.id,
        version: manifest.version,
        motion: manifest.motion ?? null,
      }));
  }
  const [css, template, art] = await Promise.all([
    fs.readFile(path.join(root, "assets", "dream-skin.css"), "utf8"),
    fs.readFile(path.join(root, "assets", "renderer-inject.js"), "utf8"),
    fs.readFile(path.join(root, "assets", "dream-reference.png")),
  ]);
  const artDataUrl = `data:image/png;base64,${art.toString("base64")}`;
  return template
    .replace("__DREAM_CSS_JSON__", JSON.stringify(css))
    .replace("__DREAM_ART_JSON__", JSON.stringify(artDataUrl));
}

async function connectTarget(target) {
  return new CdpSession(target).open();
}

async function applyToSession(session, payload) {
  return session.evaluate(payload);
}

async function removeFromSession(session) {
  return session.evaluate(`(() => {
    window.__CODEX_DREAM_SKIN_DISABLED__ = true;
    const state = window.__CODEX_DREAM_SKIN_STATE__;
    if (state?.cleanup) return state.cleanup();
    document.documentElement?.classList.remove('codex-dream-skin', 'portal-skin');
    document.documentElement?.style.removeProperty('--dream-art');
    document.documentElement?.style.removeProperty('--portal-home-art');
    document.documentElement?.style.removeProperty('--portal-work-art');
    if (document.documentElement?.dataset) {
      delete document.documentElement.dataset.portalTheme;
      delete document.documentElement.dataset.portalMode;
    }
    document.getElementById('codex-dream-skin-style')?.remove();
    document.getElementById('codex-dream-skin-chrome')?.remove();
    return true;
  })()`);
}

async function verifySession(session) {
  return session.evaluate(`(() => {
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const home = document.querySelector('.dream-home');
    const suggestions = home?.querySelector('.group\\\\/home-suggestions') ?? null;
    const cards = suggestions ? [...suggestions.querySelectorAll('button')].map(box) : [];
    const composer = box(document.querySelector('.composer-surface-chrome'));
    const sidebar = box(document.querySelector('aside.app-shell-left-panel'));
    const main = box(document.querySelector('main.main-surface') || document.querySelector('main'));
    const chrome = box(document.getElementById('codex-dream-skin-chrome'));
    const hero = box(home?.firstElementChild?.firstElementChild?.firstElementChild);
    const projectSelector = box(home?.querySelector('div:has(> .horizontal-scroll-fade-mask [class*="group/project-selector"])'));
    const withinViewport = (rect) => Boolean(rect) && rect.width > 0 && rect.height > 0 &&
      rect.x >= -2 && rect.y >= -2 && rect.x + rect.width <= innerWidth + 2 && rect.y + rect.height <= innerHeight + 2;
    const intersects = (a, b) => Boolean(a && b) &&
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 3 &&
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 3;
    const cardsOverlap = cards.some((card, index) => cards.slice(index + 1).some((other) => intersects(card, other)));
    const chromeAligned = Boolean(main && chrome) &&
      Math.abs(main.x - chrome.x) <= 3 && Math.abs(main.y - chrome.y) <= 3 &&
      Math.abs(main.width - chrome.width) <= 3 && Math.abs(main.height - chrome.height) <= 3;
    const layoutIssues = [];
    if (!withinViewport(composer)) layoutIssues.push('composer-outside-viewport');
    if (!withinViewport(sidebar)) layoutIssues.push('sidebar-outside-viewport');
    if (!chromeAligned) layoutIssues.push('chrome-not-aligned-to-main');
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) layoutIssues.push('horizontal-document-overflow');
    if (cardsOverlap) layoutIssues.push('suggestion-cards-overlap');
    if (cards.some((card) => intersects(card, projectSelector))) layoutIssues.push('suggestion-cards-overlap-project-selector');
    if (home && !withinViewport(hero)) layoutIssues.push('home-hero-outside-viewport');
    if (home && intersects(hero, composer)) layoutIssues.push('home-hero-overlaps-composer');
    const portalMotion = window.__CODEX_DREAM_SKIN_STATE__?.motion?.snapshot?.() ?? null;
    const result = {
      installed: document.documentElement.classList.contains('codex-dream-skin'),
      version: window.__CODEX_DREAM_SKIN_STATE__?.version ?? null,
      theme: window.__CODEX_DREAM_SKIN_STATE__?.theme ?? 'dream',
      mode: document.documentElement.dataset.portalMode ?? (home ? 'home' : 'unknown'),
      stylePresent: Boolean(document.getElementById('codex-dream-skin-style')),
      chromePresent: Boolean(document.getElementById('codex-dream-skin-chrome')),
      chromePointerEvents: getComputedStyle(document.getElementById('codex-dream-skin-chrome') || document.body).pointerEvents,
      homePresent: Boolean(home),
      suggestionsPresent: Boolean(suggestions),
      hero,
      cards,
      projectSelector,
      composer,
      sidebar,
      main,
      chrome,
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: {
        x: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      },
      portalAssets: {
        home: Boolean(window.__CODEX_DREAM_SKIN_STATE__?.homeArtUrl),
        homeHero: Boolean(window.__CODEX_DREAM_SKIN_STATE__?.homeHeroArtUrl),
        work: Boolean(window.__CODEX_DREAM_SKIN_STATE__?.workArtUrl),
        portalTexture: Boolean(window.__CODEX_DREAM_SKIN_STATE__?.portalTextureUrl),
      },
      portalMotion,
      layoutIssues,
    };
    const motionEnabledForThread = Boolean(result.portalMotion?.enabled && result.mode === 'thread');
    const motionCanvasHealthy = !motionEnabledForThread || (
      result.portalMotion.active && result.portalMotion.canvasPresent &&
      result.portalMotion.canvasCount === 1 && result.portalMotion.fluidCanvasCount === 1 &&
      (!result.portalMotion.fluidAvailable || result.portalMotion.fluidTextureReady === true) &&
      result.portalMotion.visuallyContained === true && Boolean(result.portalMotion.portal)
    );
    const motionShouldRun = Boolean(motionEnabledForThread && !result.portalMotion.reducedMotion && !result.portalMotion.hidden);
    const motionRunStateHealthy = motionShouldRun
      ? (result.portalMotion.running && result.portalMotion.frameCount > 0 && Boolean(result.portalMotion.sampleHash))
      : !result.portalMotion?.running;
    const motionHealthy = motionCanvasHealthy && motionRunStateHealthy;
    result.pass = result.installed && result.stylePresent && result.chromePresent &&
      result.chromePointerEvents === 'none' && Boolean(result.composer) && Boolean(result.sidebar) &&
      result.layoutIssues.length === 0 && motionHealthy &&
      (!result.homePresent || (Boolean(result.hero) &&
        (!result.suggestionsPresent || (result.cards.length >= 2 && result.cards.length <= 4))));
    return result;
  })()`);
}

async function waitForVerifiedSession(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastResult;
  while (Date.now() < deadline) {
    lastResult = await verifySession(session);
    if (lastResult.pass) return lastResult;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return lastResult;
}

async function capture(session, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  const viewport = await session.evaluate("({ width: innerWidth, height: innerHeight })");
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: Math.round(viewport.width * 0.64),
    y: Math.round(viewport.height * 0.62),
    button: "none",
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const result = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await fs.writeFile(outputPath, Buffer.from(result.data, "base64"));
}

async function runOneShot(options) {
  const targets = await waitForTargets(options.port, options.timeoutMs);
  const payload = (options.mode === "once" || options.reload) ? await loadPayload(options.theme) : null;
  const results = [];
  for (const target of targets) {
    const session = await connectTarget(target);
    let emulatedViewport = false;
    try {
      if (options.windowSize) {
        await session.send("Emulation.setDeviceMetricsOverride", {
          width: options.windowSize.width,
          height: options.windowSize.height,
          deviceScaleFactor: 1,
          mobile: false,
          screenWidth: options.windowSize.width,
          screenHeight: options.windowSize.height,
        });
        emulatedViewport = true;
        await new Promise((resolve) => setTimeout(resolve, 900));
        await session.evaluate("window.__CODEX_DREAM_SKIN_STATE__?.ensure?.()");
      }
      if (options.mode === "remove") await removeFromSession(session);
      else if (options.mode === "once") await applyToSession(session, payload);
      if (options.mode === "once") {
        await new Promise((resolve) => setTimeout(resolve, 850));
      }
      if (options.reload) {
        await session.send("Page.reload", { ignoreCache: true });
        await new Promise((resolve) => setTimeout(resolve, 1600));
        if (options.mode !== "remove") await applyToSession(session, payload);
      }
      const verified = options.mode === "remove"
        ? await session.evaluate("!document.documentElement.classList.contains('codex-dream-skin')")
        : (options.reload || options.mode === "once")
          ? await waitForVerifiedSession(session, options.timeoutMs)
          : await verifySession(session);
      results.push({ targetId: target.id, title: target.title, url: target.url, result: verified });
      if (options.screenshot) await capture(session, options.screenshot);
    } finally {
      if (emulatedViewport) {
        await session.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
        await session.evaluate("window.__CODEX_DREAM_SKIN_STATE__?.ensure?.()").catch(() => {});
      }
      session.close();
    }
  }
  console.log(JSON.stringify({ mode: options.mode, theme: options.theme, port: options.port, targets: results }, null, 2));
  if (options.mode === "verify" && results.some((item) => !item.result.pass)) process.exitCode = 2;
}

async function runWatch(options) {
  const payload = await loadPayload(options.theme);
  const sessions = new Map();
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopping) {
    let targets = [];
    try {
      targets = await waitForTargets(options.port, 2000);
    } catch (error) {
      console.error(`[dream-skin] ${new Date().toISOString()} ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const activeIds = new Set(targets.map((target) => target.id));
    for (const [id, session] of sessions) {
      if (!activeIds.has(id) || session.closed) {
        session.close();
        sessions.delete(id);
      }
    }

    for (const target of targets) {
      if (sessions.has(target.id)) continue;
      try {
        const session = await connectTarget(target);
        session.on("Page.loadEventFired", () => {
          setTimeout(() => applyToSession(session, payload).catch((error) => {
            console.error(`[dream-skin] reinject failed: ${error.message}`);
          }), 250);
        });
        await applyToSession(session, payload);
        sessions.set(target.id, session);
        console.log(`[dream-skin] injected ${options.theme} into target ${target.id} (${target.title || target.url})`);
      } catch (error) {
        console.error(`[dream-skin] inject failed for ${target.id}: ${error.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }

  for (const session of sessions.values()) session.close();
}

const options = parseArgs(process.argv.slice(2));
if (options.mode === "watch") await runWatch(options);
else await runOneShot(options);
