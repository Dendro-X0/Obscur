import { chromium } from "@playwright/test";

const GROUP = "PB1A-1791732571";
const MARKER_A = `pb1a-g-a-${Math.floor(Date.now() / 1000)}`;
const MARKER_B = `pb1a-g-b-${Math.floor(Date.now() / 1000)}`;
const T2_HEX = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";
const T1_PDK = "vCiCU0ht+hD9dX7PrpZlq1y2E6UL+ey/1z7GJM4ordY=";
const T2_NSEC = "nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxewaw4vpk9y6krrlcglpqat96ta";
const LOCAL = "ws://localhost:7000";

async function bodyText(page) {
  return page.evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " "));
}
async function dump(page, label) {
  const t = await bodyText(page);
  console.log(label, t.slice(0, 480));
  return t;
}

async function nukeToasts(page) {
  await page
    .evaluate(() => {
      document
        .querySelectorAll(".fixed.bottom-4.right-4, [data-sonner-toaster]")
        .forEach((el) => el.remove());
    })
    .catch(() => {});
}

async function forceLocal(page) {
  return page.evaluate((local) => {
    localStorage.setItem("obscur.operator.workspace_relay_url.v1", local);
    localStorage.setItem("obscur.operator.coordination_url.v1", "http://127.0.0.1:8787");
    localStorage.setItem("obscur.dev.coordination_only_workspace.v1", "1");
    localStorage.setItem("obscur.dev.assume_local_coordination.v1", "1");
    const patched = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/relay_list/i.test(k)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(k) || "");
        if (!Array.isArray(parsed) || !parsed[0] || typeof parsed[0] !== "object") continue;
        const rest = parsed
          .filter((r) => r && typeof r.url === "string" && !/localhost:7000|127\.0\.0\.1:7000/i.test(r.url))
          .map((r) => ({ url: r.url, enabled: false }));
        localStorage.setItem(
          k,
          JSON.stringify([{ url: local, enabled: true }, ...rest]),
        );
        patched.push(k);
      } catch {
        /* ignore */
      }
    }
    return patched;
  }, LOCAL);
}

async function pdk(page) {
  return page.evaluate(async (key) => {
    try {
      await window.__TAURI_INTERNALS__.invoke("desktop_storage_at_rest_unlock", {
        profileId: "default",
        keyMaterialB64: key,
      });
      return "ok";
    } catch (e) {
      return String(e).slice(0, 120);
    }
  }, T1_PDK);
}

async function openHub(page) {
  await nukeToasts(page);
  await page.evaluate(() => {
    const chats = Array.from(document.querySelectorAll("a,button")).find((el) =>
      /^Chats$/i.test((el.textContent || "").trim()),
    );
    chats?.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const group = Array.from(document.querySelectorAll("button")).find((el) =>
      /^Group$/i.test((el.textContent || "").trim()),
    );
    group?.click();
  });
  await page.waitForTimeout(400);
  const clicked = await page.evaluate((group) => {
    const nodes = Array.from(document.querySelectorAll("div,button,a,li")).filter((el) => {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      return t.includes(group) && t.length < 160;
    });
    nodes.sort((a, b) => a.textContent.length - b.textContent.length);
    if (!nodes[0]) return false;
    nodes[0].click();
    return (nodes[0].textContent || "").replace(/\s+/g, " ").slice(0, 100);
  }, GROUP);
  console.log("hub_click", clicked);
  await page.waitForTimeout(1200);
  let t = await bodyText(page);
  if (!/BACK TO NETWORK|Enter Community/i.test(t)) {
    await page.evaluate((group) => {
      const el = Array.from(document.querySelectorAll("*")).find(
        (n) => (n.textContent || "").trim() === group && n.children.length === 0,
      );
      el?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    }, GROUP);
    await page.waitForTimeout(1100);
    t = await bodyText(page);
  }
  return t;
}

async function inviteFromHub(page) {
  await nukeToasts(page);
  const opened = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /^Invite$/i.test((b.textContent || "").trim()),
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!opened) return { ok: false, reason: "no_invite" };
  await page.waitForTimeout(900);
  const sel = await page.evaluate((t2hex) => {
    const layer = document.querySelector('[data-testid="invite-connections-dialog-layer"]');
    if (!layer) return { err: "no_layer" };
    const search = layer.querySelector('input[placeholder*="Search"]');
    if (search) {
      search.focus();
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const rows = Array.from(layer.querySelectorAll("div"))
      .filter((el) => {
        const t = (el.textContent || "").replace(/\s+/g, " ");
        return (
          (/Unknown contact|UNNAMED CONNECTION|IDENTITY HIDDEN|Tester2/i.test(t) ||
            t.toLowerCase().includes(t2hex.slice(0, 12))) &&
          t.length < 240 &&
          t.length > 10
        );
      })
      .sort((a, b) => a.textContent.length - b.textContent.length);
    if (!rows[0]) {
      return { err: "no_row", t: (layer.innerText || "").replace(/\s+/g, " ").slice(0, 300) };
    }
    rows[0].click();
    return { ok: (rows[0].textContent || "").replace(/\s+/g, " ").slice(0, 100) };
  }, T2_HEX);
  console.log("sel", sel);
  await page.waitForTimeout(450);
  const invited = await page.evaluate(() => {
    const layer = document.querySelector('[data-testid="invite-connections-dialog-layer"]');
    const btn = Array.from(layer?.querySelectorAll("button") || []).find((b) =>
      /Send Invites/i.test(b.textContent || ""),
    );
    if (!btn) {
      return {
        ok: false,
        btns: Array.from(layer?.querySelectorAll("button") || []).map((b) =>
          (b.textContent || "").trim().slice(0, 40),
        ),
        t: (layer?.innerText || "").replace(/\s+/g, " ").slice(0, 300),
      };
    }
    if (btn.disabled) return { ok: false, reason: "disabled" };
    btn.click();
    return { ok: true };
  });
  await page.waitForTimeout(2800);
  await page.keyboard.press("Escape").catch(() => {});
  return invited;
}

async function enterChatAndSend(page, marker) {
  await nukeToasts(page);
  await page.evaluate(() => {
    const enter = Array.from(document.querySelectorAll("button")).find((b) =>
      /Enter Community Chat/i.test(b.textContent || ""),
    );
    enter?.click();
  });
  await page.waitForTimeout(900);
  const hasComposer = await page.evaluate(() =>
    Boolean(document.querySelector('textarea[placeholder*="Type a message"]')),
  );
  if (!hasComposer) {
    return { ok: false, reason: "no_composer" };
  }
  await page.evaluate((m) => {
    const ta = document.querySelector('textarea[placeholder*="Type a message"]');
    if (!ta) return;
    ta.focus();
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(ta, m);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, marker);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3200);
  const body = await bodyText(page);
  return {
    ok: body.includes(marker) && !/Failed to send|database is locked/i.test(body),
    has: body.includes(marker),
    fail: /Failed to send|database is locked/i.test(body),
    pub: /relay publish failed/i.test(body),
  };
}

const b1 = await chromium.connectOverCDP("http://127.0.0.1:9230");
const t1 =
  b1.contexts()[0].pages().find((p) => /1430/.test(p.url())) || b1.contexts()[0].pages()[0];
t1.setDefaultTimeout(6000);
await t1.bringToFront();
console.log("url", t1.url());
console.log("patched", await forceLocal(t1));
console.log("pdk", await pdk(t1));
await nukeToasts(t1);
await dump(t1, "home");

let hub = await openHub(t1);
await dump(t1, "hub");
const invited = await inviteFromHub(t1);
console.log("invited", invited);
await dump(t1, "after_invite");

if (!/Enter Community Chat|Type a message/i.test(await bodyText(t1))) {
  hub = await openHub(t1);
}
const sendA = await enterChatAndSend(t1, MARKER_A);
console.log("sendA", sendA);
await dump(t1, "t1_sent");

// T2 window
try {
  const r = await fetch("http://127.0.0.1:9231/json/version");
  if (!r.ok) throw new Error("down");
} catch {
  await t1.evaluate(async () => {
    await window.__TAURI_INTERNALS__.invoke("desktop_open_profile_window", {
      profileId: "profile-2",
    });
  });
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch("http://127.0.0.1:9231/json/version")).ok) break;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
}

const b2 = await chromium.connectOverCDP("http://127.0.0.1:9231");
const t2 =
  b2.contexts()[0].pages().find((p) => /1430|profiles/.test(p.url())) || b2.contexts()[0].pages()[0];
t2.setDefaultTimeout(6000);
await t2.bringToFront();
await dump(t2, "t2_boot");
await forceLocal(t2);

if (/Who's using Obscur|PROFILES/i.test(await bodyText(t2))) {
  await t2.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Tester2|Profile 2/i.test((b.textContent || "").replace(/\s+/g, " ")),
    );
    btn?.click();
  });
  await t2.waitForTimeout(2000);
}

if (/Import Key/i.test(await bodyText(t2))) {
  await t2.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Import Key/i.test(b.textContent || ""),
    );
    btn?.click();
  });
  await t2.waitForTimeout(400);
  await t2.getByPlaceholder(/nsec|private|hex|key/i).first().fill(T2_NSEC).catch(() => {});
  await t2.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button"))
      .reverse()
      .find((b) => /^(Import|Unlock|Continue|Log In)$/i.test((b.textContent || "").trim()));
    btn?.click();
  });
  await t2.waitForTimeout(2000);
}

await forceLocal(t2);
await nukeToasts(t2);
await dump(t2, "t2_shell");

await t2.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /^Requests$/i.test((b.textContent || "").trim()),
  );
  btn?.click();
});
await t2.waitForTimeout(800);
await dump(t2, "t2_req");
await t2.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /Accept|Join|Approve/i.test((b.textContent || "").trim()),
  );
  btn?.click();
});
await t2.waitForTimeout(1200);

await t2.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /^Chat$/i.test((b.textContent || "").trim()),
  );
  btn?.click();
});
await t2.waitForTimeout(600);
await dump(t2, "t2_chat");
await t2.evaluate(() => {
  const peer = Array.from(document.querySelectorAll("div,button,a,li")).find((el) => {
    const t = (el.textContent || "").replace(/\s+/g, " ");
    return /Community invitation|Tester1|e07f67dc/i.test(t) && t.length < 200;
  });
  peer?.click();
});
await t2.waitForTimeout(800);
await dump(t2, "t2_dm");
await t2.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /Accept|Join Community|^Join$/i.test((b.textContent || "").trim()),
  );
  btn?.click();
});
await t2.waitForTimeout(1800);
await dump(t2, "t2_dm_acc");

await t2.evaluate(() => {
  const btn = Array.from(document.querySelectorAll("button")).find((b) =>
    /^Group$/i.test((b.textContent || "").trim()),
  );
  btn?.click();
});
await t2.waitForTimeout(600);
let has = (await bodyText(t2)).includes(GROUP);
for (let i = 0; i < 12 && !has; i++) {
  await t2.waitForTimeout(1000);
  has = (await bodyText(t2)).includes(GROUP);
}
console.log("t2_has", has);

let sendB = { ok: false };
let t2b = "";
if (has) {
  await openHub(t2);
  sendB = await enterChatAndSend(t2, MARKER_B);
  console.log("sendB", sendB);
  t2b = await dump(t2, "t2_sent");
}

await t1.bringToFront();
await nukeToasts(t1);
await t1.waitForTimeout(2000);
const final = await dump(t1, "t1_final");
console.log(
  JSON.stringify(
    {
      GROUP,
      MARKER_A,
      MARKER_B,
      invited,
      sendA,
      sendB,
      t2_has: has,
      t2HasA: t2b.includes(MARKER_A),
      t2HasB: t2b.includes(MARKER_B),
      t1HasA: final.includes(MARKER_A) || sendA.has,
      t1HasB: final.includes(MARKER_B),
      members: (final.match(/(\d+)\s*members/i) || [])[1] || null,
    },
    null,
    2,
  ),
);

process.exit(0);
