import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const outDir = new URL("../mobile/store-assets/appstore/", import.meta.url);
const tmpDir = new URL("../mobile/store-assets/tmp/", import.meta.url);

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const variants = [
  { display: "iphone", width: 1290, height: 2796, phoneWidth: 910, phoneHeight: 1860, titleSize: 74, sidePad: 70 },
  { display: "ipad", width: 2048, height: 2732, phoneWidth: 1260, phoneHeight: 1740, titleSize: 80, sidePad: 120 }
];

const screens = [
  {
    file: "01-home-admin-login.png",
    kicker: "Locked until your PIN",
    title: "Mobile control for calls, texts, bookings, and spend",
    active: "Home",
    body: `
      ${header("DDD AI Dispatch", "Live")}
      ${card("Admin login", `
        ${statusLine("Ready for admin tabs", "PIN saved")}
        ${field("Admin PIN", "••••")}
        <div class="row">
          ${button("Unlock admin")}
          ${button("Enable alerts", "soft")}
        </div>
        <p class="hint">Use your DDD admin or staff PIN. Protected tabs load after unlock.</p>
      `)}
      ${metrics([["AI", "On"], ["Today", "8"], ["Booked", "5"], ["Texts", "12"]])}
      ${card("Run costs", `
        <div class="linkgrid">
          ${miniLink("Twilio billing", "Top up phone and SMS")}
          ${miniLink("OpenAI billing", "Add AI credits")}
          ${miniLink("OpenAI usage", "Watch AI spend")}
          ${miniLink("Render service", "Hosting and deploys")}
        </div>
      `)}
    `
  },
  {
    file: "02-shared-inbox.png",
    kicker: "Shared team texting",
    title: "One clean inbox for every customer conversation",
    active: "Inbox",
    body: `
      ${header("Shared inbox", "3 online")}
      ${card("Customer threads", `
        <div class="thread active"><b>Marsha L.</b><span>(513) 555-0144</span><p>Can I add tire size to my booking?</p></div>
        <div class="thread"><b>Derrick W.</b><span>(513) 555-0198</span><p>Tech is en route. ETA 18 minutes.</p></div>
        <div class="thread"><b>Jordan P.</b><span>(513) 555-0161</span><p>Need to reschedule the oil change.</p></div>
      `)}
      ${card("Conversation", `
        <div class="bubble customer">Flat tire. I am in Liberty Township by the gas station.</div>
        <div class="bubble ddd">Got it. DDD has your request. A link is coming by text so you can confirm location and view updates. Reply STOP to stop.</div>
        ${field("Reply from DDD", "Type a text back to the customer...")}
        <div class="row">${button("Send text")}${button("Call customer", "soft")}</div>
      `)}
    `
  },
  {
    file: "03-call-log.png",
    kicker: "Calls without the mess",
    title: "Transcripts, recordings, outcomes, and missing details",
    active: "Calls",
    body: `
      ${header("Call log", "Updated now")}
      ${metrics([["Recent", "14"], ["Booked", "9"], ["Review", "2"], ["SMS sent", "11"]])}
      ${card("Recent call", `
        <div class="callhead"><b>(513) 555-0172</b><span>2m 18s</span></div>
        <div class="chips"><i>Booked</i><i>Stayed on</i><i>SMS sent</i><i>Recording</i></div>
        <p class="record">Roadside assistance request for a brake/rotor replacement. Customer confirmed vehicle color, location, part supply, and quantity.</p>
        <div class="transcript"><b>Transcript</b><p>AI: Thank you for calling Triple D Roadside. This will be quick, and I can make the booking for you. Customer: I need front brakes and rotors...</p></div>
      `)}
      ${card("Needs review", `
        <div class="callhead"><b>(513) 555-0108</b><span>41s</span></div>
        <div class="chips warn"><i>Hung up early</i><i>No SMS</i><i>Missing vehicle color</i></div>
      `)}
    `
  },
  {
    file: "04-insights.png",
    kicker: "Business brain",
    title: "Daily, weekly, and monthly patterns from real calls",
    active: "Insights",
    body: `
      ${header("Insights", "Learning on")}
      ${metrics([["Today", "8"], ["Week", "42"], ["Month", "161"], ["SMS", "92%"]])}
      ${card("Suggestions", `
        <div class="suggestion">Brake calls rose 18% this week. Add a faster brake quantity question to the receptionist flow.</div>
        <div class="suggestion">Liberty Township had the most urgent calls. Keep one nearby tech available after 5 PM.</div>
        <div class="suggestion">Two callers asked about services DDD does not do. Add referral directory texting later.</div>
      `)}
      ${card("Hot spots", `
        <div class="hot"><span>Tires</span><b>17</b></div>
        <div class="hot"><span>Oil changes</span><b>11</b></div>
        <div class="hot"><span>Brakes/rotors</span><b>9</b></div>
      `)}
    `
  },
  {
    file: "05-voice-settings.png",
    kicker: "Receptionist controls",
    title: "Tune the voice, speed, script, and follow-up rules",
    active: "Voice",
    body: `
      ${header("Voice settings", "Preview ready")}
      ${card("Voice", `
        <div class="voices"><span class="selected">Marin</span><span>Cedar</span><span>Juniper</span><span>Coral</span></div>
        <div class="speed"><b>Speed</b><strong>1.05x</strong></div>
        <div class="row">${button("Slower", "soft")}${button("Faster", "soft")}${button("Preview")}</div>
      `)}
      ${card("What it says", `
        ${field("Greeting", "Thank you for calling Triple D Roadside. This will be quick, and I can make the booking for you.")}
        ${field("Payment rules", "Cash, card, tap pay, and approved installments. No checks.")}
      `)}
      ${card("Follow-up", `
        <p class="record">Texts DDD Mobile app instructions for iPhone users, dddcincy.com login instructions for everyone else, and STOP opt-out language.</p>
      `)}
    `
  }
];

await mkdir(outDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });

for (const variant of variants) {
  for (const screen of screens) {
    const outputFile = variant.display === "iphone" ? screen.file : screen.file.replace(/^\d+-/, "ipad-");
    const htmlPath = join(tmpDir.pathname, outputFile.replace(".png", ".html"));
    const pngPath = join(outDir.pathname, outputFile);
    await writeFile(htmlPath, renderScreen(screen, variant), "utf8");
    await run(chromePath, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${variant.width},${variant.height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href
    ]);
    console.log(`Generated ${pngPath}`);
  }
}

function renderScreen(screen, variant) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { width: ${variant.width}px; height: ${variant.height}px; margin: 0; overflow: hidden; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 12% 6%, rgba(255, 62, 165, .26), transparent 30%),
          radial-gradient(circle at 88% 12%, rgba(255, 200, 61, .26), transparent 30%),
          radial-gradient(circle at 16% 88%, rgba(35, 199, 121, .18), transparent 28%),
          linear-gradient(135deg, #fff7fb 0%, #f8fff9 47%, #f6f2ff 100%);
        color: #151629;
      }
      .frame { height: 100%; padding: 76px ${variant.sidePad}px 66px; position: relative; }
      .rainbow { position: absolute; inset: 0 0 auto; height: 18px; background: linear-gradient(90deg, #7657ff, #ff3ea5, #ff7a3d, #ffc83d, #23c779, #16b8ff); }
      .kicker { color: #a81586; font-size: 30px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; margin-top: 14px; }
      h1 { font-size: ${variant.titleSize}px; line-height: .98; margin: 18px 0 34px; max-width: ${variant.width - (variant.sidePad * 2)}px; letter-spacing: 0; }
      .phone {
        position: relative;
        width: ${variant.phoneWidth}px;
        height: ${variant.phoneHeight}px;
        margin: 0 auto;
        border: 20px solid #151629;
        border-radius: 96px;
        background: #fff;
        box-shadow: 0 44px 90px rgba(59, 34, 103, .24);
        overflow: hidden;
      }
      .island { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); width: 270px; height: 66px; border-radius: 999px; background: #07070d; z-index: 5; }
      .screen { padding: 114px 26px 122px; height: 100%; overflow: hidden; background: linear-gradient(180deg, #fffaff, #f8fffb 58%, #f6f2ff); }
      .apphead, .card { background: rgba(255,255,255,.92); border: 2px solid rgba(118, 87, 255, .16); border-radius: 28px; box-shadow: 0 18px 36px rgba(59, 34, 103, .1); overflow: hidden; }
      .apphead { padding: 18px 18px 15px; margin-bottom: 18px; }
      .apphead .top { display:flex; align-items:center; gap: 14px; }
      .logo { width: 72px; height: 72px; border-radius: 22px; background: linear-gradient(135deg, #fff, #fff0fa); display:grid; place-items:center; font-size: 19px; font-weight: 1000; color:#a81586; border: 2px solid rgba(255,62,165,.2); }
      .apphead b { font-size: 32px; }
      .live { margin-left:auto; color:#12824d; background:#e9fff3; border-radius:999px; padding: 11px 16px; font-size: 18px; font-weight:900; }
      .bar { height: 7px; margin-top: 15px; border-radius:999px; background: linear-gradient(90deg, #7657ff, #ff3ea5, #ff7a3d, #ffc83d, #23c779, #16b8ff); }
      .card { padding: 22px; margin-bottom: 18px; }
      .card:before { content:""; display:block; height: 7px; margin: -22px -22px 18px; background: linear-gradient(90deg, #7657ff, #ff3ea5, #ff7a3d, #ffc83d, #23c779, #16b8ff); }
      .card h2 { margin: 0 0 18px; font-size: 31px; }
      .row { display:flex; gap: 14px; flex-wrap: wrap; }
      .button { color: #fff; font-size: 22px; font-weight:900; border-radius:999px; padding: 18px 25px; background: linear-gradient(90deg, #7657ff, #ff3ea5, #ff7a3d); box-shadow: 0 12px 28px rgba(255,62,165,.22); }
      .button.soft { color:#a81586; background:#fff0fa; box-shadow:none; }
      .field { border: 2px solid #ded8ef; border-radius: 18px; padding: 13px 16px; margin: 13px 0; background:#fff; }
      .field label { display:block; color:#a81586; font-size: 16px; font-weight:900; text-transform:uppercase; }
      .field p { margin: 7px 0 0; color:#171827; font-size: 24px; font-weight:800; line-height:1.2; }
      .hint, .record { color:#55576d; font-size: 21px; line-height:1.35; margin: 10px 0 0; }
      .statusline { display:flex; align-items:center; justify-content:space-between; gap:12px; background:#fffaff; border:2px solid rgba(118,87,255,.12); border-radius:21px; padding:16px; margin-bottom:14px; }
      .statusline b { font-size: 25px; } .statusline span { color:#12824d; background:#e9fff3; border-radius:999px; padding:9px 14px; font-weight:900; }
      .metrics { display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 18px; }
      .metric, .link, .thread, .suggestion, .hot, .transcript { border:2px solid rgba(118,87,255,.13); border-radius:24px; background:linear-gradient(135deg,#fffaff,#f7fffb); padding:18px; }
      .metric small, .link small { color:#a81586; display:block; font-size: 16px; font-weight:900; text-transform:uppercase; }
      .metric b { display:block; font-size: 36px; margin-top:7px; }
      .linkgrid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
      .link b { display:block; font-size: 24px; margin-top:5px; }
      .thread { margin-bottom: 12px; }
      .thread.active { background: linear-gradient(90deg, #ff3ea5, #ff7a3d); color:#fff; }
      .thread b { font-size:25px; } .thread span { float:right; font-size:20px; font-weight:800; } .thread p { clear:both; margin:10px 0 0; font-size:20px; color:inherit; }
      .bubble { max-width: 82%; margin: 10px 0; border-radius: 25px; padding:18px; font-size:23px; line-height:1.3; }
      .bubble.customer { background:#f0fbff; color:#203040; border-bottom-left-radius:8px; }
      .bubble.ddd { background:#fff0fa; color:#3f2140; margin-left:auto; border-bottom-right-radius:8px; }
      .callhead { display:flex; justify-content:space-between; align-items:center; }
      .callhead b { font-size:29px; } .callhead span { color:#12824d; background:#e9fff3; border-radius:999px; padding:8px 13px; font-weight:900; font-size:18px; }
      .chips { display:flex; flex-wrap:wrap; gap:9px; margin:16px 0; }
      .chips i { color:#5b45cf; background:#f3f0ff; border-radius:999px; padding:9px 13px; font-style:normal; font-size:18px; font-weight:900; }
      .chips.warn i { color:#9a3412; background:#fff7ed; }
      .transcript b { color:#a81586; font-size:18px; text-transform:uppercase; } .transcript p { font-size:21px; line-height:1.35; margin:8px 0 0; color:#55576d; }
      .suggestion { font-size:23px; line-height:1.32; font-weight:800; margin-bottom:12px; color:#34364a; }
      .hot { display:flex; justify-content:space-between; font-size:24px; font-weight:900; margin-bottom:10px; }
      .voices { display:flex; flex-wrap:wrap; gap:12px; }
      .voices span { border:2px solid #ded8ef; border-radius:999px; padding:13px 17px; font-size:21px; font-weight:900; color:#55576d; }
      .voices .selected { background:#fff0fa; border-color:#ff3ea5; color:#a81586; }
      .speed { display:flex; justify-content:space-between; align-items:center; margin:22px 0; font-size:27px; }
      .speed strong { color:#a81586; }
      .tabs { position:absolute; left:26px; right:26px; bottom:24px; display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding:10px; border-radius:32px; background:rgba(255,255,255,.9); border:2px solid rgba(118,87,255,.16); box-shadow:0 18px 34px rgba(59,34,103,.12); }
      .tab { text-align:center; border-radius:999px; font-size:17px; font-weight:900; padding:10px 6px; border:2px solid rgba(118,87,255,.11); }
      .tab.active { color:#fff; background: var(--tab-color); }
    </style>
  </head>
  <body>
    <main class="frame">
      <div class="rainbow"></div>
      <div class="kicker">${screen.kicker}</div>
      <h1>${screen.title}</h1>
      <section class="phone">
        <div class="island"></div>
        <div class="screen">
          ${screen.body}
        </div>
        ${tabs(screen.active)}
      </section>
    </main>
  </body>
</html>`;
}

function header(title, pill) {
  return `<div class="apphead"><div class="top"><div class="logo">DDD<br>AI</div><div><b>${title}</b><p class="hint">DDD Roadside admin</p></div><span class="live">${pill}</span></div><div class="bar"></div></div>`;
}

function card(title, inner) {
  return `<section class="card"><h2>${title}</h2>${inner}</section>`;
}

function button(label, kind = "") {
  return `<span class="button ${kind}">${label}</span>`;
}

function field(label, value) {
  return `<div class="field"><label>${label}</label><p>${value}</p></div>`;
}

function statusLine(left, right) {
  return `<div class="statusline"><b>${left}</b><span>${right}</span></div>`;
}

function metrics(items) {
  return `<section class="metrics">${items.map(([label, value]) => `<div class="metric"><small>${label}</small><b>${value}</b></div>`).join("")}</section>`;
}

function miniLink(label, detail) {
  return `<div class="link"><small>${label}</small><b>${detail}</b></div>`;
}

function tabs(active) {
  const colors = {
    Home: "#7657ff",
    Voice: "#ff3ea5",
    Script: "#ff7a3d",
    Flows: "#ffc83d",
    Inbox: "#23c779",
    Calls: "#16b8ff",
    Insights: "#7657ff"
  };
  return `<nav class="tabs">${Object.keys(colors).map((name) => `<div class="tab ${name === active ? "active" : ""}" style="--tab-color:${colors[name]}">${name}</div>`).join("")}</nav>`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root.pathname, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}
