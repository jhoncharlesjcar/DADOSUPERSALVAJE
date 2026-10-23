import PanelPrincipal from "@/app/_components/PanelPrincipal";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { redirect } from "next/navigation";

export default async function ManualMode() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login?next=/manual");
  return <PanelPrincipal />;
}
