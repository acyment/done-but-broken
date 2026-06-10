export type E1RedactionSecret = {
  id: string;
  value: string;
};

export type E1RedactionReport = {
  checked: true;
  secret_ids: string[];
  redaction_count: number;
};

export function redactE1SecretsInText(text: string, secrets: E1RedactionSecret[]): {
  text: string;
  report: E1RedactionReport;
} {
  let redacted = text;
  let redactionCount = 0;

  for (const secret of validSecrets(secrets)) {
    const pieces = redacted.split(secret.value);
    redactionCount += pieces.length - 1;
    redacted = pieces.join(`[REDACTED:${secret.id}]`);
  }

  return {
    text: redacted,
    report: {
      checked: true,
      secret_ids: validSecrets(secrets).map((secret) => secret.id),
      redaction_count: redactionCount
    }
  };
}

export function redactE1SecretsInJson<T>(value: T, secrets: E1RedactionSecret[]): {
  value: T;
  report: E1RedactionReport;
} {
  const redacted = redactE1SecretsInText(JSON.stringify(value), secrets);

  return {
    value: JSON.parse(redacted.text) as T,
    report: redacted.report
  };
}

export function assertE1NoSecretsInJson(value: unknown, secrets: E1RedactionSecret[]): E1RedactionReport {
  const json = JSON.stringify(value);
  const leaked = validSecrets(secrets).filter((secret) => json.includes(secret.value));

  if (leaked.length > 0) {
    throw new Error(`E1 redaction check failed for secret ids: ${leaked.map((secret) => secret.id).join(", ")}`);
  }

  return {
    checked: true,
    secret_ids: validSecrets(secrets).map((secret) => secret.id),
    redaction_count: 0
  };
}

function validSecrets(secrets: E1RedactionSecret[]): E1RedactionSecret[] {
  return secrets.filter((secret) => secret.id.length > 0 && secret.value.length >= 8);
}
