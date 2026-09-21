#!/usr/bin/env node
/**
 * Publishes each checkpoint as a release once all its proofs are final — the Bitcoin proof confirmed or
 * failed, each authority signed or failed. With immutable releases turned on for this repository, a
 * published release's files cannot be changed or replaced afterwards, by Trunks or anyone.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = "anchors";
const existing = new Set(
  execFileSync("gh", ["release", "list", "--limit", "1000", "--json", "tagName", "--jq", ".[].tagName"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean),
);

for (const name of existsSync(ROOT) ? readdirSync(ROOT).sort() : []) {
  const dir = path.join(ROOT, name);
  const tag = name;
  if (existing.has(tag) || !existsSync(path.join(dir, "state.json"))) continue;
  const proofs = JSON.parse(readFileSync(path.join(dir, "state.json"), "utf8"));
  const final = proofs.every(([witness, state]) => state !== "pending" || witness !== "opentimestamps");
  if (!final) {
    console.log(`${tag}: still waiting for Bitcoin`);
    continue;
  }
  const files = readdirSync(dir)
    .filter((file) => file !== "state.json")
    .map((file) => path.join(dir, file));
  execFileSync(
    "gh",
    ["release", "create", tag, ...files, "--title", tag, "--notes-file", path.join(dir, "chain-head.txt")],
    { stdio: "inherit" },
  );
  console.log(`${tag}: released`);
}
