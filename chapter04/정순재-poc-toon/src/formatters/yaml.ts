// YAML 포맷 변환기
import yaml from "js-yaml";

export function toYAML(data: any): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });
}

export function fromYAML(yamlString: string): any {
  return yaml.load(yamlString);
}
