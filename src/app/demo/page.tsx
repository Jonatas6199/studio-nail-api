import { notFound } from "next/navigation";
import { Studio } from "@/components/studio";

export default function DemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Studio demo />;
}
