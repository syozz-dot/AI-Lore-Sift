import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const allowedEnvironmentFiles = new Set([".env.example"]);
const forbiddenEnvironmentFiles = files.filter(
  (file) =>
    /(^|\/)\.env(?:\..+)?$/.test(file) && !allowedEnvironmentFiles.has(file),
);

const signatures = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/g],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{36,255}/g],
  ["GitHub fine-grained token", /github_pat_[A-Za-z0-9_]{40,255}/g],
  ["OpenAI-style secret", /sk-[A-Za-z0-9_-]{32,}/g],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/g],
  ["Slack token", /xox[baprs]-[0-9A-Za-z-]{20,}/g],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

const findings = forbiddenEnvironmentFiles.map((file) => ({
  file,
  kind: "tracked environment file",
}));

for (const file of files) {
  if (file === "scripts/check-tracked-secrets.mjs") continue;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;
  for (const [kind, signature] of signatures) {
    signature.lastIndex = 0;
    if (signature.test(content)) findings.push({ file, kind });
  }
}

if (findings.length) {
  console.error("Potential secrets are tracked by Git:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.kind}`);
  }
  console.error(
    "Remove the value from Git, rotate it at the provider, and purge it from history before publishing.",
  );
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} tracked files.`);
