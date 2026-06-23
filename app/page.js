import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import LoginPortal from "./LoginPortal";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/inbox");
  }

  return <LoginPortal />;
}
