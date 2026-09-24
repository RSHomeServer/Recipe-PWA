export function groupSortableId(groupId: string): string {
  return `group:${groupId}`;
}

export function parseGroupSortableId(id: string): string | null {
  return id.startsWith("group:") ? id.slice("group:".length) : null;
}
