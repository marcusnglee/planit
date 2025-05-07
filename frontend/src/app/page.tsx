import { redirect } from "next/navigation";

export default function Home() {
  // redirect to dashboard because its protected
  redirect("/dashboard");
}
