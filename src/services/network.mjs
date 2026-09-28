import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { bounded, check, HostError } from "./errors.mjs";

export const NETWORK_MAX_BYTES = 180_000;
export const NETWORK_TIMEOUT_MS = 15_000;
export const NETWORK_MAX_REDIRECTS = 5;

function publicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c, d] = address.split(".").map(Number);
  if ([a, b, c, d].some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function normalizeUrl(input) {
  check(typeof input === "string" && input.length > 0 && input.length <= 2048, "NETWORK_URL", "Enter a public HTTP or HTTPS URL.");
  let url;
  try { url = new URL(input); } catch { throw new HostError("NETWORK_URL", "Enter a valid public HTTP or HTTPS URL."); }
  check(["http:", "https:"].includes(url.protocol), "NETWORK_URL", "Only public HTTP and HTTPS URLs are supported.");
  check(!url.username && !url.password, "NETWORK_URL", "URLs containing embedded credentials are not supported.");
  const expectedPort = url.protocol === "https:" ? "443" : "80";
  check(!url.port || url.port === expectedPort, "NETWORK_PORT", "Only standard HTTP and HTTPS ports are supported.");
  const hostname = url.hostname.toLowerCase();
  check(hostname && !["localhost", "localhost.localdomain"].includes(hostname) && !hostname.endsWith(".localhost") && !hostname.endsWith(".local"), "NETWORK_PRIVATE", "Private or local network sources are blocked.");
  const ipHost = url.hostname.startsWith("[") && url.hostname.endsWith("]") ? url.hostname.slice(1, -1) : url.hostname;
  check(isIP(ipHost) !== 6, "NETWORK_IPV6", "IPv6 sources are not supported by the V0 public-page broker.");
  if (isIP(ipHost) === 4) check(publicIPv4(ipHost), "NETWORK_PRIVATE", "Private or reserved network sources are blocked.");
  url.hash = "";
  return url;
}

async function resolvePublicIPv4(hostname, resolver) {
  if (isIP(hostname) === 4) return hostname;
  let addresses;
  try { addresses = await resolver(hostname, { family: 4, all: true, verbatim: true }); }
  catch { throw new HostError("NETWORK_DNS", "The public hostname could not be resolved."); }
  check(Array.isArray(addresses) && addresses.length > 0, "NETWORK_DNS", "The public hostname could not be resolved.");
  check(addresses.every((item) => publicIPv4(item.address)), "NETWORK_PRIVATE", "Private or reserved network sources are blocked.");
  return addresses[0].address;
}

function requestPinned(url, address, { timeoutMs, maxBytes, signal }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let deadline;
    let req;
    const abort = () => req?.destroy(new HostError("CANCELLED", "Public page request cancelled."));
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(value);
    };
    const transport = url.protocol === "https:" ? https : http;
    req = transport.request(url, {
      method: "GET",
      headers: {
        "user-agent": "NexusAppHost/1.1 public-page-broker",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        "accept-encoding": "identity",
        connection: "close",
      },
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [{ address, family: 4 }]);
        else callback(null, address, 4);
      },
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      const length = Number.parseInt(response.headers["content-length"] ?? "", 10);
      if (Number.isFinite(length) && length > maxBytes) {
        req.destroy(new HostError("NETWORK_SIZE", "The page exceeds the V0 response-size limit."));
        return;
      }
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          req.destroy(new HostError("NETWORK_SIZE", "The page exceeds the V0 response-size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", (error) => finish(error));
      response.on("end", () => finish(null, { status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    deadline = setTimeout(() => req.destroy(new HostError("NETWORK_TIMEOUT", "The public page did not respond before the 15 second limit.")), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    req.setTimeout(timeoutMs, () => req.destroy(new HostError("NETWORK_TIMEOUT", "The public page did not respond before the 15 second limit.")));
    req.on("error", (error) => finish(error instanceof HostError ? error : new HostError("NETWORK_REQUEST", "The public page request failed.")));
    req.end();
  });
}

export class Network {
  constructor({ resolver = dnsLookup, transport = requestPinned, timeoutMs = NETWORK_TIMEOUT_MS, maxBytes = NETWORK_MAX_BYTES, maxRedirects = NETWORK_MAX_REDIRECTS } = {}) {
    Object.assign(this, { resolver, transport, timeoutMs, maxBytes, maxRedirects });
  }
  async fetch(payload, signal) {
    const request = bounded(payload, 4096);
    check(request && Object.keys(request).length === 1 && typeof request.url === "string", "NETWORK_PAYLOAD", "Public page requests require only a URL.");
    let current = normalizeUrl(request.url);
    const visited = new Set();
    for (let redirect = 0; redirect <= this.maxRedirects; redirect++) {
      signal?.throwIfAborted();
      check(!visited.has(current.href), "NETWORK_REDIRECT", "Redirect cycle detected.");
      visited.add(current.href);
      const address = await resolvePublicIPv4(current.hostname, this.resolver);
      signal?.throwIfAborted();
      const response = await this.transport(current, address, { timeoutMs: this.timeoutMs, maxBytes: this.maxBytes, signal });
      const status = Number(response.status);
      if ([301, 302, 303, 307, 308].includes(status)) {
        check(redirect < this.maxRedirects, "NETWORK_REDIRECT", "Too many redirects.");
        const location = Array.isArray(response.headers?.location) ? response.headers.location[0] : response.headers?.location;
        check(typeof location === "string" && location.length > 0, "NETWORK_REDIRECT", "Redirect response did not include a usable location.");
        current = normalizeUrl(new URL(location, current).href);
        continue;
      }
      check(status >= 200 && status < 300, "NETWORK_HTTP", `Public page returned HTTP ${status || "error"}.`);
      const contentType = String(response.headers?.["content-type"] ?? "").toLowerCase();
      check(!contentType || /text\/html|application\/xhtml\+xml|text\/plain/.test(contentType), "NETWORK_TYPE", "The source is not a readable HTML/text page.");
      const body = String(response.body ?? "");
      check(Buffer.byteLength(body) <= this.maxBytes, "NETWORK_SIZE", "The page exceeds the V0 response-size limit.");
      return { url: current.href, status, contentType: contentType || "unknown", fetchedAt: new Date().toISOString(), body };
    }
    throw new HostError("NETWORK_REDIRECT", "Too many redirects.");
  }
}
export { normalizeUrl as normalizePublicUrl, publicIPv4 };
