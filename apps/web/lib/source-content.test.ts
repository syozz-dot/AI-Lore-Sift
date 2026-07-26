import { describe, expect, it } from "vitest";

import { sanitizeSourceHtml } from "./source-content";

describe("sanitizeSourceHtml", () => {
  it("removes executable markup and hardens outbound links", () => {
    const html = sanitizeSourceHtml(`
      <script>alert("unsafe")</script>
      <p style="position:fixed">Safe paragraph</p>
      <a href="https://example.com" onclick="alert(1)">Source</a>
    `);

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("style=");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
