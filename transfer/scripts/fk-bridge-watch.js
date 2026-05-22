#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("path");
const { spawn } = require("child_process");

const bridgePath = path.resolve(__dirname, "fk-bridge.js");
let child = null;
let stopping = false;

function startBridge() {
  child = spawn(process.execPath, [bridgePath], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(`[fk-bridge-watch] bridge exited code=${code ?? "null"} signal=${signal ?? "null"}; restarting in 2s`);
    setTimeout(startBridge, 2000);
  });
}

process.on("SIGINT", () => {
  stopping = true;
  if (child) child.kill("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopping = true;
  if (child) child.kill("SIGTERM");
  process.exit(0);
});

startBridge();
