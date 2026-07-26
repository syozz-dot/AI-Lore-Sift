import sanitizeHtml from "sanitize-html";

import { createMediaProxyUrl } from "./media-proxy";

const allowedTags = [
  "p",
  "br",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "strong",
  "em",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
];

export function sanitizeSourceHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags,
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      img: (_tagName, attribs) => ({
        tagName: "img",
        attribs: {
          ...attribs,
          ...(attribs.src ? { src: createMediaProxyUrl(attribs.src) } : {}),
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      }),
    },
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: [
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "decoding",
        "referrerpolicy",
      ],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
  });
}
