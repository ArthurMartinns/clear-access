import dns from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  blocked.addSubnet(address, prefix, "ipv4");

for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
])

  blocked.addSubnet(address, prefix, "ipv6");

export class InvalidTargetError extends Error {}

export function privateIp(address) {
  const family = isIP(address);
  return !family || blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export async function checkUrl(raw, { allowDemo = false } = {}) {
  let url;

  try {
    url = new URL(raw);
  } catch {
    throw new InvalidTargetError("URL inválida.");
  }

  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  
  if (
    allowDemo &&
    url.protocol === "http:" &&
    host === "localhost" &&
    url.port === "5173"
  )
    return url.href;
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  ) {
    throw new InvalidTargetError(
      "Use uma URL HTTP ou HTTPS sem credenciais e em porta padrão.",
    );
  }
  if (
    host === "localhost" ||
    !host.includes(".") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new InvalidTargetError("Destinos internos não podem ser analisados.");
  }

  let addresses;

  try {
    addresses = isIP(host)
      ? [{ address: host }]
      : await dns.lookup(host, { all: true });
  } catch {
    throw new InvalidTargetError("Não foi possível resolver o endereço.");
  }
  
  if (
    !addresses.length ||
    addresses.some(({ address }) => privateIp(address))
  ) {
    throw new InvalidTargetError(
      "O endereço resolve para uma rede privada ou reservada.",
    );
  }
  return url.href;
}
