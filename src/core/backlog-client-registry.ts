import { Backlog } from "backlog-js";
import { product } from "../product.js";
import type { BacklogClientRegistry, BacklogOrganization } from "./contracts.js";
import { createBacklogCapturingFetch } from "./backlog-access-context.js";

const USER_AGENT = `${product.name}/${product.version}`;

interface ClientRegistryOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
}

interface OrganizationConfig {
  domain: string | undefined;
  apiKey: string | undefined;
}

export function createBacklogClientRegistry(
  options: ClientRegistryOptions = {}
): BacklogClientRegistry {
  const env = options.env ?? process.env;
  const fetch = createBacklogCapturingFetch(options.fetch);
  const multiOrganization = createMultiOrganizationRegistry(env, fetch);
  if (multiOrganization !== undefined) {
    return multiOrganization;
  }

  const domain = env.BACKLOG_DOMAIN;
  const apiKey = env.BACKLOG_API_KEY;
  if (!domain || !apiKey) {
    throw new Error(
      "Configure either BACKLOG_ORG_<NAME>_DOMAIN and BACKLOG_ORG_<NAME>_API_KEY " +
      "with BACKLOG_DEFAULT_ORG, or both BACKLOG_DOMAIN and BACKLOG_API_KEY."
    );
  }

  const client = createClient(domain, apiKey, fetch);
  return {
    resolveClient(organization) {
      if (organization !== undefined && organization !== "default") {
        throw new Error(`Unknown organization '${organization}'.`);
      }
      return client;
    },
    listOrganizations() {
      return [{ name: "default", domain, isDefault: true }];
    }
  };
}

function createMultiOrganizationRegistry(
  env: NodeJS.ProcessEnv,
  fetch: typeof globalThis.fetch
): BacklogClientRegistry | undefined {
  const organizations = new Map<string, OrganizationConfig>();
  let hasMultiOrganizationKeys = false;

  for (const [key, value] of Object.entries(env)) {
    const match = /^BACKLOG_ORG_(.+)_(DOMAIN|API_KEY)$/.exec(key);
    if (match === null) {
      continue;
    }
    hasMultiOrganizationKeys = true;
    const organization = match[1];
    const field = match[2];
    if (organization === undefined || field === undefined) {
      continue;
    }
    const config = organizations.get(organization) ?? {
      domain: undefined,
      apiKey: undefined
    };
    if (field === "DOMAIN") {
      config.domain = value;
    } else {
      config.apiKey = value;
    }
    organizations.set(organization, config);
  }

  if (!hasMultiOrganizationKeys) {
    return undefined;
  }

  const invalid = [...organizations.entries()]
    .filter(([, config]) => !config.domain || !config.apiKey)
    .map(([organization]) => organization)
    .sort();
  if (invalid.length > 0) {
    throw new Error(
      `Incomplete multi-organization configuration: ${invalid.join(", ")}.`
    );
  }

  const defaultOrganization = env.BACKLOG_DEFAULT_ORG;
  if (!defaultOrganization) {
    throw new Error(
      "BACKLOG_DEFAULT_ORG is required when using BACKLOG_ORG_<NAME> configuration."
    );
  }

  const clients = new Map<string, Backlog>();
  const organizationInfo: BacklogOrganization[] = [];
  for (const [organization, config] of organizations) {
    clients.set(organization, createClient(config.domain!, config.apiKey!, fetch));
    organizationInfo.push({
      name: organization,
      domain: config.domain!,
      isDefault: organization === defaultOrganization
    });
  }
  if (!clients.has(defaultOrganization)) {
    throw new Error(
      `BACKLOG_DEFAULT_ORG '${defaultOrganization}' does not match a configured organization.`
    );
  }

  return {
    resolveClient(organization) {
      const selected = organization ?? defaultOrganization;
      const client = clients.get(selected);
      if (client === undefined) {
        throw new Error(`Unknown organization '${selected}'.`);
      }
      return client;
    },
    listOrganizations() {
      return organizationInfo.slice().sort(compareOrganizationNames);
    }
  };
}

function compareOrganizationNames(left: BacklogOrganization, right: BacklogOrganization): number {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function createClient(
  host: string,
  apiKey: string,
  fetch: typeof globalThis.fetch
): Backlog {
  return new Backlog({ host, apiKey, fetch, userAgent: USER_AGENT });
}
