import * as __requires_0 from 'child_process';
const __requires_0_default = __requires_0.default;
import * as __requires_1 from 'path';
const __requires_1_default = __requires_1.default;
import * as __requires_2 from 'fs';
const __requires_2_default = __requires_2.default;

const __requires_lookup = { 'child_process': __requires_0_default || __requires_0, 'path': __requires_1_default || __requires_1, 'fs': __requires_2_default || __requires_2 };

window.require = window.require || ((id) => {
	if (id in __requires_lookup) return __requires_lookup[id];
	throw new Error(`Cannot require modules dynamically (${id})`);
});

const exports = {}; const module = { exports };

// Marzban panel launcher inside a Node.js container
const { execSync, spawn } = require("child_process");
const path = require("path");

const ROOT = __dirname;
function run(cmd) { execSync(cmd, { stdio: "inherit", cwd: ROOT, env: process.env }); }

console.log("==> Marzban launcher (cwd: " + ROOT + ")");

// 1) Ensure python exists
try { execSync("python3 --version", { stdio: "inherit" }); } catch (e) {
  console.log("==> Installing python3...");
  try { run("apt-get update -y && apt-get install -y python3 python3-pip python3-venv curl unzip"); }
  catch (e2) { run("apk add --no-cache python3 py3-pip curl unzip"); }
}

// 2) Install deps (handles PEP 668 too)
console.log("==> Installing Python dependencies...");
const pipFlags = ["", " --break-system-packages"];
let ok = false;
for (const f of pipFlags) {
  try { run("python3 -m pip install --upgrade pip setuptools wheel" + f); ok = true; break; } catch (e) {}
}
if (!ok) { try { run("pip3 install --upgrade pip setuptools wheel"); } catch (e) {} }
let deps = false;
for (const f of pipFlags) {
  try { run("python3 -m pip install -r " + path.join(ROOT,"requirements.txt") + f); deps = true; break; } catch (e) {}
}
if (!deps) { try { run("pip3 install -r " + path.join(ROOT,"requirements.txt")); } catch (e) {} }

// 3) Ensure Xray (inside project dir so we don't need /usr/local/bin write access)
const xr = path.join(ROOT, "xray", "xray");
process.env.XRAY_EXECUTABLE_PATH = xr;
if (!require("fs").existsSync(xr)) {
  console.log("==> Downloading Xray...");
  const arch = execSync("uname -m").toString().trim();
  const asset = arch.includes("arm") ? "Xray-linux-arm64-v8a.zip" : "Xray-linux-64.zip";
  run("mkdir -p " + path.join(ROOT,"xray"));
  run("curl -L -o /tmp/xray.zip https://github.com/XTLS/Xray-core/releases/latest/download/" + asset);
  run("cd /tmp && unzip -o -q xray.zip xray -d /tmp/xr && cp /tmp/xr/xray " + xr + " && chmod +x " + xr);
}

// 4) Env defaults (relative paths)
process.env.UVICORN_HOST = process.env.UVICORN_HOST || "0.0.0.0";
process.env.UVICORN_PORT = process.env.UVICORN_PORT || "8000";
process.env.SQLALCHEMY_DATABASE_URL = process.env.SQLALCHEMY_DATABASE_URL || "sqlite:///" + path.join(ROOT, "var", "db.sqlite");
process.env.XRAY_JSON = process.env.XRAY_JSON || path.join(ROOT, "xray_config.json");
process.env.XRAY_LOCATION = path.join(ROOT, "xray");

require("fs").mkdirSync(path.join(ROOT, "var"), { recursive: true });

// 5) Migrate DB
console.log("==> Preparing database...");
try { run("python3 -m alembic upgrade head"); } catch (e) { console.log("migration skipped."); }

// 6) Launch
const port = process.env.UVICORN_PORT;
console.log("==> Starting Marzban on port " + port);
console.log("==> Panel: http://<host>:" + port + "/dashboard");
const child = spawn("python3", ["-m","uvicorn","main:app","--host",process.env.UVICORN_HOST,"--port",port], { stdio: "inherit", cwd: ROOT, env: process.env });
child.on("exit", c => process.exit(c || 0));


export default module.exports;