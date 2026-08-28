export const product: {
  id: "commitment-pools" | "dispute-court";
  name: string;
  origin: string;
  recordPath: string;
  listMethod: string;
  detailMethod: string;
} = {
  id: "dispute-court",
  name: "Dispute Court",
  origin:
    process.env.NEXT_PUBLIC_SITE_ORIGIN ??
    "https://dispute-court-genlayer.blazekingsley2.chatgpt.site",
  recordPath: "agreements",
  listMethod: "list_agreements",
  detailMethod: "get_agreement",
};
