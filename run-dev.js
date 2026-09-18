import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("\x1b[36m%s\x1b[0m", "=================================================");
console.log("\x1b[36m%s\x1b[0m", "       ⚡ AI RELAY — Khởi động hệ thống          ");
console.log("\x1b[36m%s\x1b[0m", "=================================================");

function startProcess(name, fullCommand, cwd, color) {
  // Trên Windows, gọi npm bắt buộc dùng shell: true
  const proc = spawn(fullCommand, {
    cwd,
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}[${name}]\x1b[0m ${line}`);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${color}[${name}]\x1b[0m ${line}`);
      }
    }
  });

  proc.on("close", (code) => {
    if (code !== null && code !== 0) {
      console.log(`${color}[${name}]\x1b[0m Tiến trình dừng với mã ${code}`);
    }
  });

  return proc;
}

// Khởi chạy Backend trên cổng 8787
const backendProc = startProcess(
  "Backend",
  "npm run dev",
  path.join(__dirname, "backend"),
  "\x1b[33m" // Màu vàng
);

// Khởi chạy Frontend trên cổng 5173
const frontendProc = startProcess(
  "Frontend",
  "npm run dev",
  path.join(__dirname, "frontend"),
  "\x1b[32m" // Màu xanh lá
);

// Bắt sự kiện thoát (Ctrl + C) để dừng cả 2 tiến trình con
function shutdown() {
  console.log("\n\x1b[31m%s\x1b[0m", "Đang dừng AI Relay...");
  backendProc.kill();
  frontendProc.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
