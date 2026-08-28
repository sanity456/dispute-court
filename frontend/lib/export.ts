import { jsonString } from "./activity-model.ts";
export function downloadFile(
  name: string,
  content: string,
  type = "application/json",
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportJson(name: string, data: unknown) {
  downloadFile(name, JSON.stringify(JSON.parse(jsonString(data)), null, 2));
}
