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
  origin: "https://dispute-court-studionet.vercel.app",
  recordPath: "agreements",
  listMethod: "list_agreements",
  detailMethod: "get_agreement",
};
