import type { ApiResource, Menu, Policy } from '#/api/business/system/types';

// Keep homepage choices consistent with the dynamic route adapter: a hidden
// ancestor hides its descendants, and directories open their first visible leaf.
export function homeMenuOptions(
  menus: Menu[],
): Array<{ label: string; value: string }> {
  return menus.flatMap((menu) => {
    if (menu.hidden) return [];
    const children = homeMenuOptions(menu.children ?? []);
    if (menu.children?.length && !children.length) return [];
    return [{ label: menu.meta.title, value: menu.name }, ...children];
  });
}

export function includeMenuParents(ids: number[], menus: Menu[]) {
  const parents = new Map<number, number>();
  function visit(nodes: Menu[], parent = 0) {
    for (const node of nodes) {
      parents.set(node.ID, parent);
      visit(node.children ?? [], node.ID);
    }
  }
  visit(menus);
  const result = new Set<number>();
  for (const id of ids) {
    let current = id;
    while (current && parents.has(current) && !result.has(current)) {
      result.add(current);
      current = parents.get(current) ?? 0;
    }
  }
  return [...result];
}
export function policyKey(policy: Policy) {
  return `${policy.method.toUpperCase()} ${policy.path}`;
}
export function splitPolicies(policies: Policy[], apis: ApiResource[]) {
  const known = new Map(apis.map((api) => [policyKey(api), api.ID]));
  return {
    ids: policies.flatMap((rule) => {
      const id = known.get(policyKey(rule));
      return id === undefined ? [] : [id];
    }),
    unknown: policies.filter((rule) => !known.has(policyKey(rule))),
  };
}
export function parsePolicies(text: string): Policy[] {
  const result = new Map<string, Policy>();
  for (const line of text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)) {
    const match =
      /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/[^\s?#]*)$/i.exec(line);
    if (!match)
      throw new Error(`规则格式错误：${line}；请使用 GET /v1/sys/...`);
    const rule = { method: match[1]!.toUpperCase(), path: match[2]! };
    result.set(policyKey(rule), rule);
  }
  return [...result.values()];
}
