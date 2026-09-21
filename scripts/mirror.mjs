#!/usr/bin/env node
/**
 * Copies Trunks' checkpoints and their proofs from https://planttrunks.com/ledger/anchors into anchors/.
 *
 * A checkpoint's folder is written once, and its files again only when a witness's state changes — in
 * practice, when an OpenTimestamps proof is upgraded after Bitcoin confirms it. Files are fetched slowly, a
 * second and a half apart, because Trunks limits how fast anyone may read it and this job is no exception.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE = process.env.TRUNKS_SITE ?? "https://planttrunks.com";
const ROOT = "anchors";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function listed() {
  const response = await fetch(`${SITE}/ledger/anchors`, { headers: { accept: "application/json" } });
  if (!response.ok || !(response.headers.get("content-type") ?? "").includes("json")) {
    await response.body?.cancel();
    console.log(`${SITE}/ledger/anchors answered ${response.status} without JSON — nothing published yet.`);
    return [];
  }
  return (await response.json()).checkpoints;
}

// Ends by running out of work, never by process.exit: on Windows, exiting while a fetch socket closes crashes Node.
const checkpoints = await listed();
console.log(`${checkpoints.length} checkpoint(s) listed.`);

const FILES = {
  opentimestamps: ["opentimestamps.ots"],
  freetsa: ["freetsa.tsr", "freetsa-chain.pem"],
  digicert: ["digicert.tsr", "digicert-chain.pem"],
};

for (const checkpoint of [...checkpoints].reverse()) {
  const dir = path.join(ROOT, `${checkpoint.at.slice(0, 10)}-checkpoint-${checkpoint.seq}`);
  const stateFile = path.join(dir, "state.json");
  const state = JSON.stringify(checkpoint.proofs.map((p) => [p.witness, p.state, p.bitcoinHeight]));
  if (existsSync(stateFile) && readFileSync(stateFile, "utf8") === state) continue;
  mkdirSync(dir, { recursive: true });

  for (const proof of checkpoint.proofs) {
    if (proof.state === "failed") continue;
    for (const file of FILES[proof.witness] ?? []) {
      await sleep(1_500);
      const response = await fetch(`${SITE}/ledger/anchors/${checkpoint.eventId}/${file}`);
      if (!response.ok) {
        console.log(`  ${file}: ${response.status}, left for the next run`);
        continue;
      }
      const named = response.headers.get("x-trunks-anchored-hash");
      if (named !== null && named !== checkpoint.hash) {
        throw new Error(`${file} names ${named}, not the checkpoint's ${checkpoint.hash}`);
      }
      writeFileSync(path.join(dir, file), Buffer.from(await response.arrayBuffer()));
    }
  }

  const witnesses = checkpoint.proofs
    .map((p) => {
      if (p.state === "failed") return `  ${p.witness}: did not answer`;
      if (p.witness === "opentimestamps") {
        return `  opentimestamps: ${p.bitcoinHeight === null ? "waiting for Bitcoin" : `Bitcoin block ${p.bitcoinHeight}`}`;
      }
      return `  ${p.witness}: signed at ${p.witnessedAt}`;
    })
    .join("\n");
  writeFileSync(
    path.join(dir, "chain-head.txt"),
    `fingerprint   ${checkpoint.hash}\n` +
      `journal entry ${checkpoint.seq}, covering the first ${checkpoint.eventCount}\n` +
      `the head it closes over ${checkpoint.headHash}\n` +
      `taken         ${checkpoint.at}\n` +
      `checkpoint    ${checkpoint.eventId}\n\nwitnesses\n${witnesses}\n`,
  );
  writeFileSync(
    path.join(dir, "VERIFY.txt"),
    `Check these with the witnesses' own tools, not anything Trunks wrote.\n\n` +
      `ots verify -d ${checkpoint.hash} opentimestamps.ots\n` +
      `openssl ts -verify -digest ${checkpoint.hash} -in freetsa.tsr -CAfile freetsa-chain.pem\n` +
      `openssl ts -verify -digest ${checkpoint.hash} -in digicert.tsr -CAfile digicert-chain.pem\n`,
  );
  writeFileSync(stateFile, state);
  console.log(`${dir}: written`);
}
