import "server-only";
import { HttpQlooTransport } from "./http";
import { MockQlooTransport } from "./mock/transport";
import { QlooService } from "./service";

let service: QlooService | null = null;

/** Live Qloo when QLOO_API_KEY is set, otherwise the clearly-labelled mock provider. */
export function getQloo(): QlooService {
  if (service) return service;
  const key = process.env.QLOO_API_KEY?.trim();
  const transport = key
    ? new HttpQlooTransport(key, { baseUrl: process.env.QLOO_BASE_URL?.trim() || undefined })
    : new MockQlooTransport();
  service = new QlooService(transport);
  return service;
}

export type { QlooService } from "./service";
