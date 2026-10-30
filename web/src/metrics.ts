export interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

const unescapeLabelValue = (value: string): string =>
  value.replace(/\\([\\"nrt])/g, (_, char: string) => {
    switch (char) {
      case '\\':
        return '\\';
      case '"':
        return '"';
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return char;
    }
  });

const parseMetricValue = (rawValue: string): number => {
  switch (rawValue) {
    case 'NaN':
      return Number.NaN;
    case 'Inf':
    case '+Inf':
      return Number.POSITIVE_INFINITY;
    case '-Inf':
      return Number.NEGATIVE_INFINITY;
    default:
      return Number(rawValue);
  }
};

export async function getMetrics(): Promise<MetricSample[]> {
  const response = await fetch('/api/metrics');

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar as métricas (HTTP ${response.status}).`,
    );
  }

  const body = await response.text();

  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .flatMap((line) => {
      const match = line.match(
        /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(.+)$/,
      );

      if (!match) return [];

      const [, name, rawLabels = '', rawValue] = match;
      const labels: Record<string, string> = {};

      for (const labelMatch of rawLabels.matchAll(
        /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g,
      )) {
        const [, key, value] = labelMatch;
        labels[key] = unescapeLabelValue(value);
      }

      const value = parseMetricValue(rawValue);

      if (Number.isNaN(value) && rawValue !== 'NaN') {
        return [];
      }

      return [
        {
          name,
          labels,
          value,
        },
      ];
    });
}

export function sumMetric(
  samples: MetricSample[],
  name: string,
  labelFilter?: Record<string, string>,
): number {
  return samples
    .filter((sample) => {
      if (sample.name !== name) return false;

      return Object.entries(labelFilter ?? {}).every(
        ([key, value]) => sample.labels[key] === value,
      );
    })
    .reduce((total, sample) => total + sample.value, 0);
}

export function latestGauge(
  samples: MetricSample[],
  name: string,
): number | null {
  const matches = samples.filter((sample) => sample.name === name);
  return matches.length > 0 ? matches[matches.length - 1]!.value : null;
}
