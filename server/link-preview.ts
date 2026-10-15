import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { ApiError } from "./types.js";

const maximumHtmlBytes = 1024 * 2048; //512 * 1024;
const requestTimeoutMs = 5_000;
const blockedIpv4 = new BlockList();
const blockedIpv6 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedIpv6.addSubnet(address, prefix, "ipv6");
}

function isPublicAddress(address: string, family: number) {
  if (family === 4) return !blockedIpv4.check(address, "ipv4");
  if (family !== 6) return false;
  const firstGroup = Number.parseInt(address.split(":")[0] || "0", 16);
  return (
    firstGroup >= 0x2000 &&
    firstGroup <= 0x3fff &&
    !blockedIpv6.check(address, "ipv6")
  );
}

async function resolvePublicAddresses(hostname: string): Promise<LookupAddress[]> {
  const family = isIP(hostname);
  let addresses: LookupAddress[];
  try {
    addresses = family
      ? [{ address: hostname, family }]
      : await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ApiError(422, "The website address could not be resolved.");
  }
  if (!addresses.length || addresses.some(address => !isPublicAddress(address.address, address.family))) {
    throw new ApiError(400, "Link previews are only available for publicly accessible websites.");
  }
  return addresses;
}

function decodeHtml(value: string) {
  const decodeCodePoint = (number: string, radix = 10) => {
    const codePoint = Number.parseInt(number, radix);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : "";
  };
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, number: string) => decodeCodePoint(number))
    .replace(/&#x([a-f\d]+);/gi, (_match, hex: string) => decodeCodePoint(hex, 16));
}

function metaContent(html: string, key: string) {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const element = tag[0];
    const property = element.match(/\b(?:property|name)\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (property?.toLowerCase() !== key.toLowerCase()) continue;
    const content = element.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (content) return decodeHtml(content).trim();
  }
  return null;
}

function htmlTitle(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(title.replace(/<[^>]*>/g, "")).trim() : null;
}

function assertPreviewUrl(url: URL) {
  const allowedProtocol = url.protocol === "http:" || url.protocol === "https:";
  const allowedPort =
    !url.port ||
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443");
  if (!allowedProtocol || !allowedPort || url.username || url.password) {
    throw new ApiError(400, "Links must use HTTP or HTTPS on a standard web port without embedded credentials.");
  }
}

function createPinnedLookup(addresses: LookupAddress[]): LookupFunction {
  const address = addresses.find(entry => entry.family === 4) ?? addresses[0];
  return (_hostname, options, callback) => {
    if (typeof options === "object" && options.all) {
      callback(null, [address]);
    } else {
      callback(null, address.address, address.family);
    }
  };
}

async function requestHtml(url: URL, addresses: LookupAddress[]) {
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise<{ status: number; location: string | null; body: string; contentType: string }>(
    (resolve, reject) => {
      const request = transport(
        url,
        {
          headers: {
            Accept: "text/html",
            "User-Agent": "BankContentLinkPreview/1.0",
          },
          lookup: createPinnedLookup(addresses),
        },
        response => {
          const status = response.statusCode ?? 0;
          const location = response.headers.location ?? null;
          const contentType = response.headers["content-type"] ?? "";
          if ([301, 302, 303, 307, 308].includes(status) && location) {
            response.resume();
            resolve({ status, location, body: "", contentType });
            return;
          }
          if (status < 200 || status >= 300) {
            response.resume();
            reject(new ApiError(422, "The website could not provide a link preview."));
            return;
          }
          if (!contentType.toLowerCase().includes("text/html")) {
            response.resume();
            resolve({ status, location: null, body: "", contentType });
            return;
          }

          const chunks: Buffer[] = [];
          let totalBytes = 0;
          response.on("data", (chunk: Buffer) => {
            totalBytes += chunk.length;
            if (totalBytes > maximumHtmlBytes) {
              response.destroy(new ApiError(422, "The website page is too large to preview."));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            resolve({
              status,
              location: null,
              body: Buffer.concat(chunks).toString("utf8"),
              contentType,
            });
          });
          response.on("error", error => {
            reject(
              error instanceof ApiError
                ? error
                : new ApiError(422, "The website connection failed while loading its preview."),
            );
          });
        },
      );
      request.setTimeout(requestTimeoutMs, () => {
        request.destroy(new ApiError(422, "The website took too long to provide a link preview."));
      });
      request.on("error", error => {
        reject(
          error instanceof ApiError
            ? error
            : new ApiError(422, "Could not connect to the website to load its preview."),
        );
      });
      request.end();
    },
  );
}

export async function getLinkPreview(rawUrl: string) {
  let currentUrl: URL;
  try {
    currentUrl = new URL(rawUrl);
  } catch {
    throw new ApiError(400, "Enter a valid website URL.");
  }
  assertPreviewUrl(currentUrl);

  let html = "";
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const hostname = currentUrl.hostname.replace(/^\[|\]$/g, "");
    const addresses = await resolvePublicAddresses(hostname);
    const result = await requestHtml(currentUrl, addresses);
    if (!result.location) {
      html = result.body;
      break;
    }
    if (redirectCount === 3) throw new ApiError(422, "The website redirected too many times.");
    try {
      currentUrl = new URL(result.location, currentUrl);
    } catch {
      throw new ApiError(422, "The website returned an invalid redirect.");
    }
    assertPreviewUrl(currentUrl);
  }

  const hostname = currentUrl.hostname.replace(/^www\./i, "");
  const cleanText = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  const title = cleanText(metaContent(html, "og:title") ?? htmlTitle(html) ?? hostname);
  const descriptionValue = metaContent(html, "og:description");
  const description = descriptionValue ? cleanText(descriptionValue).slice(0, 500) : null;
  const imageValue = metaContent(html, "og:image");
  let thumbnailUrl: string | null = null;
  if (imageValue) {
    try {
      const imageUrl = new URL(imageValue, currentUrl);
      if (imageUrl.protocol === "https:" && !imageUrl.username && !imageUrl.password) {
        await resolvePublicAddresses(imageUrl.hostname.replace(/^\[|\]$/g, ""));
        thumbnailUrl = imageUrl.toString().slice(0, 2048);
      }
    } catch {
      thumbnailUrl = null;
    }
  }

  return {
    url: currentUrl.toString(),
    hostname,
    title: title.slice(0, 180) || hostname,
    description,
    thumbnailUrl,
  };
}
