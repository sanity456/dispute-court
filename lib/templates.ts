export const templates = [
  {
    id: "blank",
    label: "Start with a blank agreement",
    title: "",
    summary: "",
    rules: "",
  },
  {
    id: "public-doc",
    label: "Public documentation milestone",
    title: "Public documentation milestone",
    summary:
      "Party B will publish a single public documentation page for Party A's agreed feature. Define the feature and the delivery URL here before publishing.",
    rules:
      "The public page must describe the agreed feature, include setup steps, one working usage example and a limitations section. Both parties must specify the feature and acceptable example before accepting. Full satisfaction allocates the net escrow to Party B. No delivery allocates it to Party A. Partial completion is evaluated against the explicitly agreed sections using the contract's fixed allocation buckets. Evidence must remain public and stable.",
  },
  {
    id: "review",
    label: "Structured public review",
    title: "Structured public review",
    summary:
      "Party B will review a named public draft and publish actionable feedback. Name the draft and define the delivery location before publishing.",
    rules:
      "The review must identify at least three specific issues in the agreed draft, explain their impact and propose a concrete improvement for each. Feedback must cite the relevant public sections. Both parties must identify the exact source and version before accepting. Complete delivery allocates net escrow to Party B; no delivery to Party A; partial delivery uses the agreed criteria and the contract's fixed allocation buckets.",
  },
];
