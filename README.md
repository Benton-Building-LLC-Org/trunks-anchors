# Trunks' anchors

A public copy of the proofs that date [Trunks](https://planttrunks.com)' history — kept here, outside
Trunks, where Trunks cannot quietly change them.

Trunks keeps an append-only, hash-chained journal of everything that happens on it. Once a day, when there
is anything new, it records a **checkpoint** of that journal's latest fingerprint and hands the fingerprint
to three witnesses it does not control:

- **Bitcoin**, through [OpenTimestamps](https://opentimestamps.org) — a `.ots` proof;
- **FreeTSA** and **DigiCert**, two RFC 3161 time-stamping authorities — a signed `.tsr` reply each, kept
  with the certificates that signed it.

Each proves the fingerprint existed **no later than** a time recorded by someone other than Trunks. Rewriting
anything before a checkpoint would change its fingerprint, and the proofs here would stop matching. They do
not prove that any entry is true or fairly moderated — only that it was already there.

This repository is the **fourth witness**: a copy of those proofs in a place Trunks does not host. Each
checkpoint becomes a [release](../../releases) once all its proofs are final, and releases here are
**immutable** — once published, their files cannot be changed or replaced, by Trunks or anyone.

## Layout

```
anchors/<date>-checkpoint-<entry>/
  chain-head.txt        the fingerprint, which journal entry it is, and how many entries it covers
  opentimestamps.ots    the Bitcoin proof
  freetsa.tsr           FreeTSA's signed reply
  freetsa-chain.pem     the certificates that signed it
  digicert.tsr          DigiCert's signed reply
  digicert-chain.pem    the certificates that signed it
  VERIFY.txt            the exact commands to check them
```

A witness that did not answer that day has no files; `chain-head.txt` says so.

## Checking one yourself

With the fingerprint from `chain-head.txt` as `HASH`:

```sh
ots verify -d HASH opentimestamps.ots
openssl ts -verify -digest HASH -in freetsa.tsr -CAfile freetsa-chain.pem
openssl ts -verify -digest HASH -in digicert.tsr -CAfile digicert-chain.pem
```

`ots` is the OpenTimestamps client (`pip install opentimestamps-client`); it checks the Bitcoin block against a
Bitcoin node or a block explorer. `openssl` checks each authority's signature. **Use these tools, not
anything Trunks wrote** — that is the point.

To compare a checkpoint with Trunks' own journal, see the *Dated by someone else* section of
[planttrunks.com/ledger](https://planttrunks.com/ledger).

## How it is kept

`.github/workflows/mirror.yml` runs every six hours and copies anything new from `https://planttrunks.com/ledger/anchors`
using this repository's own permissions — Trunks holds no key to it. Everything here is public data: hashes,
proofs and public certificates. Nothing names or points to a person.
