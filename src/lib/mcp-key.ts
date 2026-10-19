import { randomBytes } from "node:crypto";
import { getProject, q1, run } from "./db";

// Read-only MCP access key, created on first use and kept in `setting`.
export function mcpKey(): string {
  const pid = getProject().id;
  const cur = q1<{ value: string }>("select value from setting where project_id=? and key='mcp_key'", pid)?.value;
  if (cur) return cur;
  const k = randomBytes(24).toString("hex");
  run("insert or replace into setting(project_id,key,value) values(?,'mcp_key',?)", pid, k);
  return k;
}
