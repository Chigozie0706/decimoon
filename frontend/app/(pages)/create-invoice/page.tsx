import dynamic from "next/dynamic";

const CreateInvoice = dynamic(() => import("@/components/CreateInvoice"), {
  ssr: false,
});

export default function Page() {
  return <CreateInvoice />;
}
