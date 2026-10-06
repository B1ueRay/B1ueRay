import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lookup } from "node:dns/promises";
const options = [];
const ca = process.env.NODE_EXTRA_CA_CERTS;
if (ca && existsSync(ca)) options.push("--secret", `id=registry_ca,src=${ca}`);
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) {
  const hostname = new URL(proxy).hostname;
  const { address } = await lookup(hostname);
  options.push("--add-host", `${hostname}:${address}`);
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"])
    if (process.env[key]) options.push("--build-arg", key);
}
for (const [target, tag] of [
  ["tools", "velora-init"],
  ["runner", "velora-web"],
]) {
  const result = spawnSync(
    "docker",
    [
      "buildx",
      "build",
      ...options,
      "--target",
      target,
      "--tag",
      tag,
      "--load",
      ".",
    ],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
