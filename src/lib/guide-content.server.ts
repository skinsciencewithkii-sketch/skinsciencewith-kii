// Paid guide markup lives here so it is only ever reachable from server code.
import paidGuideHtml from "../../content/paid-guide.html?raw";

export function getPaidGuideHtml(): string {
  return paidGuideHtml;
}
