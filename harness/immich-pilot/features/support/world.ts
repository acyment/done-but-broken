import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';

export interface PersonResponse {
  id: string | number;
  name: string;
  birthDate: string | null;
}

export class ApiWorld extends World {
  createdPersonId?: string | number;
  fetchedPerson?: PersonResponse | null;

  constructor(options: IWorldOptions) {
    super(options);
  }

  get baseUrl(): string {
    const v = process.env.IMMICH_BASE_URL;
    if (!v) throw new Error('IMMICH_BASE_URL env var is required but not set');
    return v.replace(/\/+$/, ''); // URL hygiene only; never touches test data
  }

  get apiKey(): string {
    const v = process.env.IMMICH_API_KEY;
    if (!v) throw new Error('IMMICH_API_KEY env var is required but not set');
    return v;
  }

  // Inert transport: send exactly what it is given, fail loudly on non-2xx,
  // return the parsed body verbatim. No interpretation of any field.
  async request(method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'x-api-key': this.apiKey,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}; body: ${text}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${method} ${path} -> ${res.status} but body was not valid JSON: ${text}`);
    }
  }
}

setWorldConstructor(ApiWorld);
