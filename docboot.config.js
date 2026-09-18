/** @type {import('docboot').DocbootConfig} */
export default {
  title: "Vitest Doctor",
  description: "Low-overhead performance diagnostics, memory leak detector, and root-cause analyzer for Vitest test suites",
  docs: "./docs",
  out: "./dist-docs",
  base: "/vitest-doctor/",
  repo: "https://github.com/litepacks/vitest-doctor",
  theme: {
    preset: "emerald",
    defaultMode: "system"
  },
  editLink: {
    pattern: 'https://github.com/litepacks/vitest-doctor/edit/main/docs/:path'
  },
  sourceLink: {
    pattern: 'https://github.com/litepacks/vitest-doctor/blob/main/:path'
  },
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10
  }
};
